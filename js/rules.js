/**
 * Granite Estate — New Hampshire Statutory Rule Pack
 * Pack: 2026.09-M5
 * Deterministic compliance rules mapped to New Hampshire Revised Statutes Annotated (RSA).
 *
 * Universal Module: Works in both browser and Node.js.
 */

var STATUTE_PACK = {
  version: '2026.09-M5',
  updated: '2026-09-21',
  jurisdiction: 'New Hampshire',
  scope: 'Simple estates (no active litigation, no closely-held business operations)'
};

var RULES = [
  // ---------------------------------------------------- Wills (RSA 551, 553, 560, 561)
  {
    id: 'W-01', matter: 'will', severity: 'critical',
    title: 'Fewer than two witnesses on will',
    citation: 'RSA 551:2',
    plain: 'New Hampshire requires at least two credible witnesses to sign a will in the presence of the testator.',
    note: 'Will appears non-compliant with RSA 551:2 witness count requirement.',
    applies: function (f) { return f.doc_type === 'will' && f.will; },
    failed: function (f) { return (f.will.witness_count || 0) < 2; }
  },
  {
    id: 'W-02', matter: 'will', severity: 'critical',
    title: 'Will execution requirements not met',
    citation: 'RSA 551:2',
    plain: 'The draft does not show evidence of testator signature.',
    note: 'Unsigned draft or missing signature block.',
    applies: function (f) { return f.doc_type === 'will' && f.will; },
    failed: function (f) { return !f.will.testator_signed; }
  },
  {
    id: 'W-03', matter: 'will', severity: 'medium',
    title: 'Missing self-proving affidavit',
    citation: 'RSA 551:35',
    plain: 'A self-proving affidavit allows the will to be admitted to probate without locating the witnesses later.',
    note: 'Will lacks self-proving affidavit per RSA 551:35; recommend re-execution with statutory affidavit.',
    applies: function (f) { return f.doc_type === 'will' && f.will; },
    failed: function (f) { return !f.will.self_proving_affidavit; }
  },
  {
    id: 'W-04', matter: 'will', severity: 'high',
    title: 'Missing revocation clause',
    citation: 'RSA 551:13',
    plain: 'The will does not explicitly revoke prior wills, creating risk of conflicting documents.',
    note: 'No express revocation clause identified; risk of partial revocation / revival issues.',
    applies: function (f) { return f.doc_type === 'will' && f.will; },
    failed: function (f) { return !f.will.revocation_clause; }
  },
  {
    id: 'W-05', matter: 'will', severity: 'high',
    title: 'Potential interested witness',
    citation: 'RSA 551:3',
    plain: 'A witness appears to also be named as a beneficiary, which can void the gift to that witness in New Hampshire.',
    note: 'Name overlap between witness and beneficiary lists; verify witness disinterestedness under RSA 551:3.',
    applies: function (f) { return f.doc_type === 'will' && f.will && f.will.witness_names && f.will.beneficiaries; },
    failed: function (f) {
      var wNames = (f.will.witness_names || []).map(function (n) { return (n || '').toLowerCase().trim(); });
      var bNames = (f.will.beneficiaries || []).map(function (b) { return (b.name || '').toLowerCase().trim(); });
      return wNames.some(function (w) {
        return w && bNames.some(function (b) { return b && (b.indexOf(w) !== -1 || w.indexOf(b) !== -1); });
      });
    }
  },
  {
    id: 'W-06', matter: 'will', severity: 'high',
    title: 'No executor named',
    citation: 'RSA 553:1',
    plain: 'The will does not name an executor to carry out instructions.',
    note: 'No executor nominated; probate court will appoint administrator with will annexed (RSA 553:2).',
    applies: function (f) { return f.doc_type === 'will' && f.will; },
    failed: function (f) { return !f.will.executor; }
  },
  {
    id: 'W-06B', matter: 'will', severity: 'medium',
    title: 'No successor executor named',
    citation: 'RSA 553 (best practice)',
    plain: 'If the primary executor cannot serve, no backup is designated.',
    note: 'Single executor without successor; recommend naming alternate executor.',
    applies: function (f) { return f.doc_type === 'will' && f.will && f.will.executor; },
    failed: function (f) { return !f.will.successor_executor; }
  },
  {
    id: 'W-07', matter: 'will', severity: 'high',
    title: 'No residuary clause',
    citation: 'RSA 561 (risk of partial intestacy)',
    plain: 'The will does not say who receives the remainder of property not specifically listed.',
    note: 'Missing residuary disposition; risk of partial intestacy under RSA 561 descent rules.',
    applies: function (f) { return f.doc_type === 'will' && f.will; },
    failed: function (f) { return !f.will.residuary_clause; }
  },
  {
    id: 'W-08', matter: 'cross', severity: 'critical',
    title: 'Minor children without guardian nomination',
    citation: 'RSA 463:3',
    plain: 'You have minor children, but neither your will nor trust nominates a testamentary guardian.',
    note: 'Minor children identified but no RSA 463 testamentary guardian nomination across documents.',
    applies: function (f, ctx) { return ctx.hasMinors; },
    failed: function (f, ctx) { return !ctx.guardianNamed; }
  },
  {
    id: 'W-09', matter: 'will', severity: 'high',
    title: 'Pour-over will without identified trust',
    citation: 'RSA 563-A:1',
    plain: 'The will transfers assets to a trust, but no trust document was provided.',
    note: 'Pour-over clause present but trust instrument missing from engagement dossier.',
    applies: function (f) { return f.doc_type === 'will' && f.will && f.will.pour_over_to_trust; },
    failed: function (f, ctx) { return !ctx.hasTrustDoc; }
  },
  {
    id: 'W-09S', matter: 'cross', severity: 'medium',
    title: 'Surviving spouse omitted or disinherited (RSA 560:10 spousal share risk)',
    citation: 'RSA 560:10 (spousal elective share)',
    plain: 'Under NH RSA 560:10, a surviving spouse has a statutory right to elect against a deceased spouse\'s will.',
    note: 'Client is married but spouse is not provided for in will/trust; verify spousal consent, prenuptial agreement, or elective share exposure.',
    applies: function (f, ctx) { return ctx.hasSpouse && ctx.willFacts; },
    failed: function (f, ctx) {
      var spouseName = (ctx.spouseName || '').toLowerCase();
      var willBen = (ctx.willFacts.beneficiaries || []).map(function (b) { return (b.name || '').toLowerCase(); });
      var getsResidue = ctx.willFacts.residuary_clause;
      var inWill = willBen.some(function (b) { return b && (b.indexOf(spouseName) !== -1 || spouseName.indexOf(b) !== -1); });
      return !inWill;
    }
  },
  {
    id: 'W-10', matter: 'cross', severity: 'critical',
    title: 'Child omitted from will (pretermitted heir risk)',
    citation: 'RSA 551:10 (pretermitted heirs)',
    plain: 'In New Hampshire, any child omitted or not explicitly mentioned in a will automatically receives their statutory intestate share under RSA 551:10.',
    note: 'NH RSA 551:10 pretermitted heir exposure. Landmark case Robbins v. Johnson holds omitted children take statutory intestate share unless explicitly acknowledged or provided for.',
    applies: function (f, ctx) { return ctx.allChildren.length > 0 && ctx.willFacts; },
    failed: function (f, ctx) {
      var wBeneficiaries = (ctx.willFacts.beneficiaries || []).map(function (b) { return (b.name || '').toLowerCase(); });
      return ctx.allChildren.some(function (c) {
        var lc = c.toLowerCase();
        return !wBeneficiaries.some(function (b) { return b && (b.indexOf(lc) !== -1 || lc.indexOf(b) !== -1); });
      });
    }
  },

  // ---------------------------------------------------- Trusts (RSA 564-B)
  {
    id: 'T-01', matter: 'trust', severity: 'high',
    title: 'Trustee vacancy risk',
    citation: 'RSA 564-B:7-704',
    plain: 'The trust names only one trustee without a clear successor mechanism.',
    note: 'Single trustee without successor mechanism; recommend explicit successor designation.',
    applies: function (f) { return f.doc_type === 'revocable_trust' && f.trust; },
    failed: function (f) { return f.trust.trustee && !f.trust.successor_trustee; }
  },
  {
    id: 'T-01B', matter: 'trust', severity: 'critical',
    title: 'No trustee named',
    citation: 'RSA 564-B:7-701',
    plain: 'The trust instrument does not designate an initial trustee.',
    note: 'Trust lacks initial trustee nomination.',
    applies: function (f) { return f.doc_type === 'revocable_trust' && f.trust; },
    failed: function (f) { return !f.trust.trustee; }
  },
  {
    id: 'T-02', matter: 'trust', severity: 'high',
    title: 'Trust appears unfunded',
    citation: 'RSA 564-B:4-401',
    plain: 'No schedule of assets or titling evidence was identified for this trust.',
    note: 'No assets extracted from trust instrument; recommend checking deed titling and account beneficiary designations.',
    applies: function (f) { return f.doc_type === 'revocable_trust' && f.trust; },
    failed: function (f) { return !f.trust.assets || f.trust.assets.length === 0; }
  },
  {
    id: 'T-03', matter: 'trust', severity: 'high',
    title: 'Real estate not titled to trust',
    citation: 'RSA 564-B:4-401 (funding formalities)',
    plain: 'Real estate is referenced, but titling does not reflect ownership by the trustee.',
    note: 'Asset titling appears in individual name rather than trust; deed transfer to trustee required.',
    applies: function (f) { return f.doc_type === 'revocable_trust' && f.trust && f.trust.assets; },
    failed: function (f) {
      return (f.trust.assets || []).some(function (a) {
        return /real estate|house|property|parcel/i.test(a.description || '') && !a.titled_in_trust;
      });
    }
  },
  {
    id: 'T-04', matter: 'trust', severity: 'medium',
    title: 'Trust revocability clause silent',
    citation: 'RSA 564-B:6-602',
    plain: 'New Hampshire law presumes trusts created after 2004 are revocable unless stated otherwise, but explicit language is best practice.',
    note: 'Trust instrument does not state whether it is revocable or irrevocable; RSA 564-B:6-602 presumption applies.',
    applies: function (f) { return f.doc_type === 'revocable_trust' && f.trust; },
    failed: function (f) { return f.trust.revocable == null; }
  },

  // ---------------------------------------------------- Advance Directives (RSA 137-J)
  {
    id: 'A-01', matter: 'ad', severity: 'critical',
    title: 'Advance directive execution non-compliant',
    citation: 'RSA 137-J:14 / 137-J:15',
    plain: 'An advance directive in New Hampshire must be signed before either two qualified adult witnesses or a notary public.',
    note: 'Advance directive lacks required statutory execution formalities (neither 2 witnesses nor notary evidenced).',
    applies: function (f) { return f.doc_type === 'advance_directive' && f.ad; },
    failed: function (f) { return (f.ad.witness_count || 0) < 2 && !f.ad.notarized; }
  },
  {
    id: 'A-02', matter: 'ad', severity: 'high',
    title: 'No alternate health care agent named',
    citation: 'RSA 137-J:39 (statutory form)',
    plain: 'If your primary health care agent is unavailable in an emergency, no alternate is named.',
    note: 'Single health care agent designated without alternate; recommend naming successor per statutory form.',
    applies: function (f) { return f.doc_type === 'advance_directive' && f.ad && f.ad.agent; },
    failed: function (f) { return !f.ad.alternate_agent; }
  },
  {
    id: 'A-03', matter: 'ad', severity: 'critical',
    title: 'No health care agent named',
    citation: 'RSA 137-J:14',
    plain: 'The advance directive does not designate a health care agent.',
    note: 'Advance directive instrument lacks designated agent.',
    applies: function (f) { return f.doc_type === 'advance_directive' && f.ad; },
    failed: function (f) { return !f.ad.agent; }
  },
  {
    id: 'A-04', matter: 'ad', severity: 'medium',
    title: 'Statutory disclosure missing or incomplete',
    citation: 'RSA 137-J:39',
    plain: 'New Hampshire law specifies mandatory notice language that must precede an advance directive.',
    note: 'Statutory notice to person making advance directive appears absent or truncated.',
    applies: function (f) { return f.doc_type === 'advance_directive' && f.ad; },
    failed: function (f) { return !f.ad.statutory_disclosure; }
  },
  {
    id: 'A-05', matter: 'ad', severity: 'medium',
    title: 'HIPAA release language absent',
    citation: 'RSA 137-J:18 / 45 CFR 164.508',
    plain: 'Without explicit medical-record release authority, providers may hesitate to share information with your agent.',
    note: 'No express HIPAA release language identified in advance directive.',
    applies: function (f) { return f.doc_type === 'advance_directive' && f.ad; },
    failed: function (f) { return !f.ad.hipaa_release; }
  },

  // ---------------------------------------------------- Financial Power of Attorney (RSA 564-E)
  {
    id: 'P-01', matter: 'poa', severity: 'critical',
    title: 'Financial POA not acknowledged before notary',
    citation: 'RSA 564-E:105',
    plain: 'Under NH RSA 564-E:105, a power of attorney for property and finances must be signed by the principal and acknowledged before a notary public or justice of the peace.',
    note: 'Financial POA instrument missing notary/JP acknowledgment block required by RSA 564-E:105.',
    applies: function (f) { return (f.doc_type === 'financial_poa' || (f.poa && f.poa.agent)) && f.poa; },
    failed: function (f) { return !f.poa.notarized; }
  },
  {
    id: 'P-02', matter: 'poa', severity: 'critical',
    title: 'No financial agent named in Power of Attorney',
    citation: 'RSA 564-E:105',
    plain: 'The financial power of attorney does not designate an agent (attorney-in-fact).',
    note: 'Missing designated agent in financial power of attorney.',
    applies: function (f) { return f.doc_type === 'financial_poa' && f.poa; },
    failed: function (f) { return !f.poa.agent; }
  },
  {
    id: 'P-02B', matter: 'poa', severity: 'medium',
    title: 'No successor financial agent named',
    citation: 'RSA 564-E:111 (best practice)',
    plain: 'If your primary financial agent is unable or unwilling to act, no backup successor agent is designated.',
    note: 'Single financial agent named without alternate; recommend designating successor agent per RSA 564-E:111.',
    applies: function (f) { return (f.doc_type === 'financial_poa' || (f.poa && f.poa.agent)) && f.poa && f.poa.agent; },
    failed: function (f) { return !f.poa.successor_agent; }
  },
  {
    id: 'P-03', matter: 'poa', severity: 'high',
    title: 'Durability clause missing or unclear',
    citation: 'RSA 564-E:104',
    plain: 'Under NH law, a power of attorney is durable unless stated otherwise, but express durability language avoids banking institution pushback.',
    note: 'Verify express durability clause ("This power of attorney is durable and remains effective upon disability or incapacity").',
    applies: function (f) { return (f.doc_type === 'financial_poa' || (f.poa && f.poa.agent)) && f.poa; },
    failed: function (f) { return !f.poa.durable; }
  },
  {
    id: 'P-04', matter: 'poa', severity: 'informational',
    title: 'Special / "hot powers" require express grant',
    citation: 'RSA 564-E:201',
    plain: 'In NH, powers to create/amend trusts, make gifts, or change beneficiary designations cannot be implied; they require explicit initialing.',
    note: 'Attorney to confirm whether client intends to grant RSA 564-E:201 specific authority ("hot powers") such as trust funding or gifting.',
    applies: function (f) { return (f.doc_type === 'financial_poa' || (f.poa && f.poa.agent)) && f.poa; },
    failed: function (f) { return !f.poa.hot_powers || f.poa.hot_powers.length === 0; }
  },

  // ---------------------------------------------------- Cross-document & Estate
  {
    id: 'N-01', matter: 'cross', severity: 'informational',
    title: 'Estate plan lacks advance planning for incapacity',
    citation: 'RSA 137-J & RSA 564-E',
    plain: 'Your dossier has estate distribution documents (will/trust) but no Advance Directive or Financial Power of Attorney.',
    note: 'No RSA 137-J advance directive or RSA 564-E financial power of attorney found in engagement dossier.',
    applies: function (f, ctx) { return (ctx.hasWill || ctx.hasTrust); },
    failed: function (f, ctx) { return !ctx.hasAD && !ctx.hasPOA; }
  },
  {
    id: 'N-02', matter: 'cross', severity: 'informational',
    title: 'May qualify for waiver of administration',
    citation: 'RSA 553:32',
    plain: 'If the sole beneficiary is also named sole executor, New Hampshire allows a simplified waiver-of-administration probate procedure.',
    note: 'Single beneficiary equals sole executor; attorney should evaluate RSA 553:32 eligibility to streamline probate.',
    applies: function (f, ctx) { return ctx.willFacts && ctx.willFacts.executor && ctx.willFacts.beneficiaries; },
    failed: function (f, ctx) {
      var ex = (ctx.willFacts.executor || '').toLowerCase().trim();
      var bens = ctx.willFacts.beneficiaries || [];
      if (bens.length !== 1 || !ex) return false;
      var bName = (bens[0].name || '').toLowerCase().trim();
      return bName && (bName.indexOf(ex) !== -1 || ex.indexOf(bName) !== -1);
    }
  },
  {
    id: 'N-03', matter: 'cross', severity: 'informational',
    title: 'Streamlined real estate probate bypass via TOD Deed',
    citation: 'RSA 563-D (Uniform Real Property TOD Act)',
    plain: 'New Hampshire allows owners of real property to transfer real estate outside probate via a recorded Transfer on Death Deed (RSA 563-D), without creating a revocable trust.',
    note: 'Client owns NH real property not titled in a trust. Consider statutory RSA 563-D TOD deed to avoid probate. Must be recorded within 60 days of execution.',
    applies: function (f, ctx) { return ctx.hasNHRealEstate && !ctx.hasFundedTrustRealEstate && !ctx.hasTODDeed; },
    failed: function (f, ctx) { return true; }
  }
];

function runRules_(extractions) {
  var willFacts = null, trustFacts = null, adFacts = null, poaFacts = null;
  var hasMinors = false, guardianNamed = false, allChildren = [];
  var hasSpouse = false, spouseName = null;
  var hasNHRealEstate = false, hasFundedTrustRealEstate = false, hasTODDeed = false;

  extractions.forEach(function (f) {
    if (f.doc_type === 'will' && !willFacts) willFacts = f.will;
    if (f.doc_type === 'revocable_trust' && !trustFacts) trustFacts = f.trust;
    if (f.doc_type === 'advance_directive' && !adFacts) adFacts = f.ad;
    if (f.doc_type === 'financial_poa' && !poaFacts) poaFacts = f.poa;
    if (!poaFacts && f.poa && f.poa.agent) poaFacts = f.poa;

    if (f.spouse) { hasSpouse = true; spouseName = f.spouse; }
    (f.all_children || []).forEach(function (c) { if (allChildren.indexOf(c) === -1) allChildren.push(c); });
    (f.minor_children || []).forEach(function (c) {
      hasMinors = true;
      if (allChildren.indexOf(c) === -1) allChildren.push(c);
    });

    if (f.will && (f.will.guardian_named || f.will.guardian_name)) guardianNamed = true;
    (f.real_estate_nh || []).forEach(function (re) {
      hasNHRealEstate = true;
      if (re.titled_in_trust) hasFundedTrustRealEstate = true;
      if (re.tod_deed_recorded || re.tod_deed_referenced) hasTODDeed = true;
    });
  });

  var ctx = {
    hasWill: !!willFacts, willFacts: willFacts,
    hasTrust: !!trustFacts, trustFacts: trustFacts,
    hasAD: !!adFacts, adFacts: adFacts,
    hasPOA: !!poaFacts, poaFacts: poaFacts,
    hasMinors: hasMinors, guardianNamed: guardianNamed,
    allChildren: allChildren, hasSpouse: hasSpouse, spouseName: spouseName,
    hasNHRealEstate: hasNHRealEstate, hasFundedTrustRealEstate: hasFundedTrustRealEstate, hasTODDeed: hasTODDeed,
    hasTrustDoc: extractions.some(function (f) { return f.doc_type === 'revocable_trust'; })
  };

  var out = [];
  extractions.forEach(function (f) {
    var matter = f.doc_type === 'will' ? 'will'
      : f.doc_type === 'revocable_trust' ? 'trust'
      : f.doc_type === 'advance_directive' ? 'ad'
      : f.doc_type === 'financial_poa' ? 'poa' : null;
    f.will = f.will || {}; f.trust = f.trust || {}; f.ad = f.ad || {}; f.poa = f.poa || {};

    RULES.forEach(function (r) {
      if (r.matter !== matter) return;
      try {
        if (r.applies(f, ctx) && r.failed(f, ctx)) out.push(makeDef_(r, f));
      } catch (e) {
        if (typeof audit_ === 'function') audit_('RULE_ERROR', r.id + ': ' + e.message);
      }
    });

    if ((f.confidence || 0) < 0.85) {
      var fname = (f._doc && f._doc.filename) ? f._doc.filename : (f.filename || 'document');
      out.push({
        rule_id: 'X-01', citation: 'Internal QA', severity: 'informational',
        title: 'Document classification unconfirmed',
        plain_language: 'I wasn’t fully certain what type of document "' + fname + '" is (read as: ' + (f.doc_type || 'unknown') + '). Please confirm at the review step.',
        attorney_note: 'Classification confidence ' + (f.confidence || 0) + '; verify document type.',
        source_doc: fname, confidence: f.confidence || 0
      });
    }
  });

  var anchorDoc = ctx.willFacts || ctx.trustFacts || ctx.poaFacts || extractions[0];
  if (anchorDoc) {
    RULES.forEach(function (r) {
      if (r.matter !== 'cross') return;
      try {
        if (r.applies(anchorDoc, ctx) && r.failed(anchorDoc, ctx)) out.push(makeDef_(r, anchorDoc));
      } catch (e) {
        if (typeof audit_ === 'function') audit_('RULE_ERROR', r.id + ': ' + e.message);
      }
    });
  }

  var rank = { critical: 0, high: 1, medium: 2, informational: 3 };
  out.sort(function (a, b) { return rank[a.severity] - rank[b.severity]; });
  return out;
}

function makeDef_(r, f) {
  return {
    rule_id: r.id, citation: r.citation, severity: r.severity, title: r.title,
    plain_language: r.plain, attorney_note: r.note,
    source_doc: (f._doc && f._doc.filename) ? f._doc.filename : (f.filename || ''), confidence: f.confidence || ''
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STATUTE_PACK: STATUTE_PACK, RULES: RULES, runRules_: runRules_, makeDef_: makeDef_ };
}
