/**
 * Granite Estate — Client-Side Database (IndexedDB with in-memory fallback)
 * Replaces Google Sheets DB with zero-knowledge, local-first browser storage.
 *
 * Universal Module: Works in both browser and Node.js.
 */

var DB_VERSION = 1;
var DB_NAME = 'GraniteEstate_DB';

var DB = (function () {
  var idb = null;
  var memStore = {
    engagements: [],
    documents: [],
    extractions: [],
    deficiencies: [],
    questions: [],
    plan: [],
    briefs: [],
    audit: [],
    settings: {}
  };

  function hasIndexedDB() {
    return typeof indexedDB !== 'undefined';
  }

  function init() {
    if (!hasIndexedDB()) {
      return Promise.resolve(true);
    }
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (ev) {
        var db = ev.target.result;
        ['engagements', 'documents', 'extractions', 'deficiencies', 'questions', 'plan', 'briefs', 'audit'].forEach(function (storeName) {
          if (!db.objectStoreNames.contains(storeName)) {
            var keyPath = (storeName === 'engagements' || storeName === 'documents' || storeName === 'deficiencies' || storeName === 'questions')
              ? 'id'
              : (storeName === 'briefs' ? 'engagement_id' : undefined);
            var autoInc = !keyPath;
            db.createObjectStore(storeName, keyPath ? { keyPath: keyPath } : { autoIncrement: true });
          }
        });
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
      req.onsuccess = function (ev) {
        idb = ev.target.result;
        resolve(true);
      };
      req.onerror = function (ev) {
        console.warn('IndexedDB open error; falling back to memory store:', ev);
        resolve(false);
      };
    });
  }

  function tx(storeName, mode, fn) {
    if (!idb) {
      return Promise.resolve().then(function () {
        return fn(null, memStore[storeName]);
      });
    }
    return new Promise(function (resolve, reject) {
      try {
        var transaction = idb.transaction(storeName, mode);
        var store = transaction.objectStore(storeName);
        var res = fn(store);
        transaction.oncomplete = function () { resolve(res); };
        transaction.onerror = function (e) { reject(e); };
      } catch (err) {
        reject(err);
      }
    });
  }

  // ---------------------------------------------------- Engagements
  function getActiveEngagement() {
    if (!idb) {
      for (var i = memStore.engagements.length - 1; i >= 0; i--) {
        var e = memStore.engagements[i];
        if (e.status !== 'sealed' && e.status !== 'exited') return Promise.resolve(e);
      }
      return Promise.resolve(null);
    }
    return new Promise(function (resolve) {
      var req = idb.transaction('engagements', 'readonly').objectStore('engagements').getAll();
      req.onsuccess = function () {
        var list = req.result || [];
        for (var i = list.length - 1; i >= 0; i--) {
          if (list[i].status !== 'sealed' && list[i].status !== 'exited') {
            return resolve(list[i]);
          }
        }
        resolve(null);
      };
      req.onerror = function () { resolve(null); };
    });
  }

  function saveEngagement(eng) {
    if (!idb) {
      var idx = memStore.engagements.findIndex(function (e) { return e.id === eng.id; });
      if (idx >= 0) memStore.engagements[idx] = eng;
      else memStore.engagements.push(eng);
      return Promise.resolve(eng);
    }
    return new Promise(function (resolve, reject) {
      var req = idb.transaction('engagements', 'readwrite').objectStore('engagements').put(eng);
      req.onsuccess = function () { resolve(eng); };
      req.onerror = reject;
    });
  }

  function setEngagementStatus(id, status) {
    return getActiveEngagement().then(function (eng) {
      if (eng && eng.id === id) {
        eng.status = status;
        return saveEngagement(eng);
      }
    });
  }

  // ---------------------------------------------------- Documents
  function saveDocument(doc) {
    if (!idb) {
      var idx = memStore.documents.findIndex(function (d) { return d.id === doc.id; });
      if (idx >= 0) memStore.documents[idx] = doc;
      else memStore.documents.push(doc);
      return Promise.resolve(doc);
    }
    return new Promise(function (resolve, reject) {
      var req = idb.transaction('documents', 'readwrite').objectStore('documents').put(doc);
      req.onsuccess = function () { resolve(doc); };
      req.onerror = reject;
    });
  }

  function listDocuments(engagementId) {
    if (!idb) {
      return Promise.resolve(memStore.documents.filter(function (d) { return d.engagement_id === engagementId; }));
    }
    return new Promise(function (resolve) {
      var req = idb.transaction('documents', 'readonly').objectStore('documents').getAll();
      req.onsuccess = function () {
        var all = req.result || [];
        resolve(all.filter(function (d) { return d.engagement_id === engagementId; }));
      };
      req.onerror = function () { resolve([]); };
    });
  }

  /**
   * Permanently remove a document AND any extraction derived from it.
   * Previously the UI filtered an in-memory array only, so a deleted draft
   * silently survived in IndexedDB and returned on reload.
   */
  function deleteDocument(docId) {
    if (!idb) {
      memStore.documents = memStore.documents.filter(function (d) { return d.id !== docId; });
      memStore.extractions = memStore.extractions.filter(function (x) { return x.doc_id !== docId; });
      return Promise.resolve(true);
    }
    return new Promise(function (resolve) {
      var t = idb.transaction(['documents', 'extractions'], 'readwrite');
      t.objectStore('documents').delete(docId);
      // Cursor delete: generated keys are NOT positional, so never delete by
      // array index — that would remove an unrelated extraction.
      var curReq = t.objectStore('extractions').openCursor();
      curReq.onsuccess = function (ev) {
        var cursor = ev.target.result;
        if (!cursor) return;
        if (cursor.value && cursor.value.doc_id === docId) cursor.delete();
        cursor.continue();
      };
      t.oncomplete = function () { resolve(true); };
      t.onerror = function () { resolve(false); };
    });
  }

  // ---------------------------------------------------- Extractions
  function saveExtraction(docId, engagementId, facts) {
    var item = { doc_id: docId, engagement_id: engagementId, extracted: new Date().toISOString(), facts: facts };
    if (!idb) {
      memStore.extractions = memStore.extractions.filter(function (x) { return x.doc_id !== docId; });
      memStore.extractions.push(item);
      return Promise.resolve(item);
    }
    return new Promise(function (resolve, reject) {
      var store = idb.transaction('extractions', 'readwrite').objectStore('extractions');
      var req = store.add(item);
      req.onsuccess = function () { resolve(item); };
      req.onerror = reject;
    });
  }

  function listExtractions(engagementId) {
    if (!idb) {
      return Promise.resolve(memStore.extractions
        .filter(function (x) { return x.engagement_id === engagementId; })
        .map(function (x) { return x.facts; }));
    }
    return new Promise(function (resolve) {
      var req = idb.transaction('extractions', 'readonly').objectStore('extractions').getAll();
      req.onsuccess = function () {
        var all = req.result || [];
        resolve(all.filter(function (x) { return x.engagement_id === engagementId; }).map(function (x) { return x.facts; }));
      };
      req.onerror = function () { resolve([]); };
    });
  }

  // ---------------------------------------------------- Deficiencies
  function saveDeficiencies(engagementId, defs) {
    if (!idb) {
      memStore.deficiencies = memStore.deficiencies.filter(function (d) { return d.engagement_id !== engagementId; });
      defs.forEach(function (d, i) {
        memStore.deficiencies.push(Object.assign({ id: 'DEF-' + (i + 1), engagement_id: engagementId }, d));
      });
      return Promise.resolve(defs);
    }
    return new Promise(function (resolve, reject) {
      var tx = idb.transaction('deficiencies', 'readwrite');
      var store = tx.objectStore('deficiencies');
      var getReq = store.getAll();
      getReq.onsuccess = function () {
        (getReq.result || []).forEach(function (row) {
          if (row.engagement_id === engagementId) store.delete(row.id);
        });
        defs.forEach(function (d, i) {
          store.put(Object.assign({ id: 'DEF-' + (i + 1), engagement_id: engagementId }, d));
        });
      };
      tx.oncomplete = function () { resolve(defs); };
      tx.onerror = reject;
    });
  }

  function listDeficiencies(engagementId) {
    if (!idb) {
      return Promise.resolve(memStore.deficiencies.filter(function (d) { return d.engagement_id === engagementId; }));
    }
    return new Promise(function (resolve) {
      var req = idb.transaction('deficiencies', 'readonly').objectStore('deficiencies').getAll();
      req.onsuccess = function () {
        var all = req.result || [];
        resolve(all.filter(function (d) { return d.engagement_id === engagementId; }));
      };
      req.onerror = function () { resolve([]); };
    });
  }

  // ---------------------------------------------------- Questions
  function saveQuestions(engagementId, qs) {
    if (!idb) {
      memStore.questions = memStore.questions.filter(function (q) { return q.engagement_id !== engagementId; });
      qs.forEach(function (q) {
        memStore.questions.push(Object.assign({ engagement_id: engagementId, answer: '', status: 'pending' }, q));
      });
      return Promise.resolve(qs);
    }
    return new Promise(function (resolve, reject) {
      var tx = idb.transaction('questions', 'readwrite');
      var store = tx.objectStore('questions');
      var getReq = store.getAll();
      getReq.onsuccess = function () {
        (getReq.result || []).forEach(function (row) {
          if (row.engagement_id === engagementId) store.delete(row.id);
        });
        qs.forEach(function (q) {
          store.put(Object.assign({ engagement_id: engagementId, answer: '', status: 'pending' }, q));
        });
      };
      tx.oncomplete = function () { resolve(qs); };
      tx.onerror = reject;
    });
  }

  function listQuestions(engagementId) {
    if (!idb) {
      return Promise.resolve(memStore.questions.filter(function (q) { return q.engagement_id === engagementId; }));
    }
    return new Promise(function (resolve) {
      var req = idb.transaction('questions', 'readonly').objectStore('questions').getAll();
      req.onsuccess = function () {
        var all = req.result || [];
        resolve(all.filter(function (q) { return q.engagement_id === engagementId; }));
      };
      req.onerror = function () { resolve([]); };
    });
  }

  function updateQuestionAnswer(id, answer, status) {
    if (!idb) {
      var q = memStore.questions.find(function (x) { return x.id === id; });
      if (q) { q.answer = answer; q.status = status; }
      return Promise.resolve(q);
    }
    return new Promise(function (resolve, reject) {
      var store = idb.transaction('questions', 'readwrite').objectStore('questions');
      var req = store.get(id);
      req.onsuccess = function () {
        var q = req.result;
        if (q) {
          q.answer = answer;
          q.status = status;
          store.put(q);
        }
        resolve(q);
      };
      req.onerror = reject;
    });
  }

  // ---------------------------------------------------- Plan
  function savePlan(engagementId, rows) {
    if (!idb) {
      memStore.plan = memStore.plan.filter(function (p) { return p.engagement_id !== engagementId; });
      rows.forEach(function (r, i) {
        memStore.plan.push(Object.assign({ engagement_id: engagementId, idx: i + 1 }, r));
      });
      return Promise.resolve(rows);
    }
    return new Promise(function (resolve, reject) {
      var tx = idb.transaction('plan', 'readwrite');
      var store = tx.objectStore('plan');
      var getReq = store.getAll();
      getReq.onsuccess = function () {
        (getReq.result || []).forEach(function (row) {
          if (row.engagement_id === engagementId) store.delete(row.id);
        });
        rows.forEach(function (r, i) {
          store.add(Object.assign({ engagement_id: engagementId, idx: i + 1 }, r));
        });
      };
      tx.oncomplete = function () { resolve(rows); };
      tx.onerror = reject;
    });
  }

  function listPlan(engagementId) {
    if (!idb) {
      return Promise.resolve(memStore.plan.filter(function (p) { return p.engagement_id === engagementId; }));
    }
    return new Promise(function (resolve) {
      var req = idb.transaction('plan', 'readonly').objectStore('plan').getAll();
      req.onsuccess = function () {
        var all = req.result || [];
        resolve(all.filter(function (p) { return p.engagement_id === engagementId; }));
      };
      req.onerror = function () { resolve([]); };
    });
  }

  function addPlanItem(engagementId, row) {
    if (!idb) {
      memStore.plan.push(Object.assign({ engagement_id: engagementId }, row));
      return Promise.resolve(row);
    }
    return new Promise(function (resolve, reject) {
      var store = idb.transaction('plan', 'readwrite').objectStore('plan');
      var req = store.add(Object.assign({ engagement_id: engagementId }, row));
      req.onsuccess = function () { resolve(row); };
      req.onerror = reject;
    });
  }

  // ---------------------------------------------------- Briefs
  function saveBrief(brief) {
    if (!idb) {
      var idx = memStore.briefs.findIndex(function (b) { return b.engagement_id === brief.engagement_id; });
      if (idx >= 0) memStore.briefs[idx] = brief;
      else memStore.briefs.push(brief);
      return Promise.resolve(brief);
    }
    return new Promise(function (resolve, reject) {
      var req = idb.transaction('briefs', 'readwrite').objectStore('briefs').put(brief);
      req.onsuccess = function () { resolve(brief); };
      req.onerror = reject;
    });
  }

  function getBrief(engagementId) {
    if (!idb) {
      return Promise.resolve(memStore.briefs.find(function (b) { return b.engagement_id === engagementId; }) || null);
    }
    return new Promise(function (resolve) {
      var req = idb.transaction('briefs', 'readonly').objectStore('briefs').get(engagementId);
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror = function () { resolve(null); };
    });
  }

  // ---------------------------------------------------- Audit Trail (Cryptographic Hash-chained)
  function addAudit(event, detail, appVersion) {
    var ts = new Date().toISOString();
    var last = memStore.audit[memStore.audit.length - 1];
    var prevHash = last ? last.hash : 'GENESIS';
    var payload = ts + '|' + event + '|' + detail + '|' + prevHash;
    return computeSha256_(payload).then(function (hash) {
      var record = {
        ts: ts, event: event, detail: detail,
        app_version: appVersion || '2026.09-WEB',
        prev_hash: prevHash, hash: hash
      };
      memStore.audit.push(record);
      if (idb) {
        try {
          idb.transaction('audit', 'readwrite').objectStore('audit').add(record);
        } catch (e) {}
      }
      return record;
    });
  }

  function computeSha256_(s) {
    // 1. Browser Web Crypto API (Standard SHA-256)
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
      try {
        var enc = new TextEncoder().encode(s);
        return crypto.subtle.digest('SHA-256', enc).then(function (buf) {
          var arr = Array.from(new Uint8Array(buf));
          return arr.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
        });
      } catch (e) {}
    }
    // 2. Node.js environment
    if (typeof require !== 'undefined') {
      try {
        var c = require('crypto');
        var hex = c.createHash('sha256').update(s).digest('hex');
        return Promise.resolve(hex);
      } catch (e) {}
    }
    // 3. Fallback deterministic checksum
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return Promise.resolve('crc32-' + ('0000000' + (h >>> 0).toString(16)).slice(-8));
  }

  // ---------------------------------------------------- Reset
  function clearAll() {
    memStore = {
      engagements: [], documents: [], extractions: [],
      deficiencies: [], questions: [], plan: [], briefs: [], audit: [], settings: {}
    };
    if (!idb) return Promise.resolve(true);
    return new Promise(function (resolve) {
      var tx = idb.transaction(['engagements', 'documents', 'extractions', 'deficiencies', 'questions', 'plan', 'briefs', 'audit'], 'readwrite');
      tx.objectStore('engagements').clear();
      tx.objectStore('documents').clear();
      tx.objectStore('extractions').clear();
      tx.objectStore('deficiencies').clear();
      tx.objectStore('questions').clear();
      tx.objectStore('plan').clear();
      tx.objectStore('briefs').clear();
      tx.objectStore('audit').clear();
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function () { resolve(true); };
    });
  }

  return {
    init: init,
    getActiveEngagement: getActiveEngagement,
    saveEngagement: saveEngagement,
    setEngagementStatus: setEngagementStatus,
    saveDocument: saveDocument,
    listDocuments: listDocuments,
    deleteDocument: deleteDocument,
    saveExtraction: saveExtraction,
    listExtractions: listExtractions,
    saveDeficiencies: saveDeficiencies,
    listDeficiencies: listDeficiencies,
    saveQuestions: saveQuestions,
    listQuestions: listQuestions,
    updateQuestionAnswer: updateQuestionAnswer,
    savePlan: savePlan,
    listPlan: listPlan,
    addPlanItem: addPlanItem,
    saveBrief: saveBrief,
    getBrief: getBrief,
    addAudit: addAudit,
    clearAll: clearAll
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DB: DB };
}
