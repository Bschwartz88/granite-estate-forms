# Granite Estate Forms
**A zero-knowledge, browser-native DIY tool for basic New Hampshire estate and emergency protective forms.**

Granite Estate Forms evaluates draft estate planning documents against New Hampshire statutory reference points (NH RSA), clarifies intentions through deterministic questions, generates official NH statutory legal forms (Advance Directives, Powers of Attorney, Wills, and Transfer-on-Death Deeds), and produces a structured **attorney preparation brief** sealed with a cryptographic SHA-256 manifest.

---

## 🌟 Key Architecture & Privacy Model
Unlike server-based applications, **Granite Estate Forms** is a 100% client-side, zero-knowledge web application:

- **Zero Server Footprint:** Runs entirely in your web browser. No server backend, no central database, and no cloud hosting costs.
- **Client-Side Database:** All engagements, documents, statutory findings, questions, and plans are stored privately in your browser's local **IndexedDB** storage. Nothing is sent to any developer server.
- **Direct Gemini Multimodal AI:** Connects directly from your browser to Google Gemini using your free API key (stored in `localStorage`). Scanned PDFs and text documents are analyzed directly without intermediate server conversions.
- **Official NH Statutory Forms:** Includes the zero-draft assembly engine for:
  - Simple NH Will with RSA 551:10 pretermitted heir protections and RSA 551:35 self-proving affidavit
  - Statutory Advance Directive (RSA 137-J:39)
  - Statutory Form Financial Power of Attorney (RSA 564-E:301)
  - Transfer on Death Deed for real estate (RSA 563-D:19)

---

## 🚀 Quick Start (Local Run)

You can run Granite Estate locally with any static web server:

### Option 1: Python
```bash
python -m http.server 8080
```
Then open `http://localhost:8080` in your browser.

### Option 2: Node.js (npx)
```bash
npx serve .
```

### Option 3: Direct File
You can also open `index.html` directly in your browser.

---

## 🌐 Deploying to GitHub Pages

To publish this app so anyone can access it via a public URL:

1. Push this folder to a GitHub repository (`https://github.com/Bschwartz88/granite-estate-forms`).
2. Go to **Settings → Pages** in your GitHub repository.
3. Under **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: `main` / Folder: `/ (root)`
4. Click **Save**.
5. Within 1–2 minutes, your web app will be live at:
   **https://bschwartz88.github.io/granite-estate-forms/**

---

## 🧪 Testing

The automated test suite verifies all New Hampshire statutory compliance rules, person harvesting, question prioritization, document assembly, and the IndexedDB engine:

```bash
node test/run_all.js
node test/test_server.js
```

---

## ⚖️ Legal Disclaimer
Granite Estate is an informational document-preparation tool. It is not a law firm, does not provide legal advice, and does not create an attorney–client relationship. All statutory references (NH RSA) are informational reference points for review by a New Hampshire-licensed attorney, who should supervise the execution of any estate planning documents.
