# Granite Estate & Granite Estate Forms
## Comprehensive Architecture, Statutory Engine, Web Deployment & Security Summary

**Date:** September 21, 2026  
**Statute Pack Version:** `2026.09-M5`  
**Google Apps Script Repository:** [Bschwartz88/granite-estate](https://github.com/Bschwartz88/granite-estate)  
**Standalone Web Application Repository:** [Bschwartz88/granite-estate-forms](https://github.com/Bschwartz88/granite-estate-forms)  
**Live Public Application:** [https://bschwartz88.github.io/granite-estate-forms/](https://bschwartz88.github.io/granite-estate-forms/)  
**Author:** Brian Schwartz & Antigravity  

---

## Executive Overview

This document provides a comprehensive technical and legal summary of the complete transformation and hardening of **Granite Estate**:

1. **Phase A (Deepened NH Law Engine):** Codified critical New Hampshire Revised Statutes Annotated (NH RSA) into the deterministic rule catalog, automated fact extraction, clarification question budgeting, and the attorney hand-off brief.
2. **Phase B (Statutory Document Assembly & Zero-Draft Intake):** Solved the "cold start" barrier for clients without existing drafts by introducing a guided statutory intake questionnaire that automatically generates four ready-to-review New Hampshire statutory legal forms.
3. **Phase C (Serverless Web App & GitHub Pages Migration):** Architected, built, tested, and published a 100% browser-native, zero-knowledge web application (**Granite Estate Forms**) hosted for free on GitHub Pages.
4. **Phase D (Security Audit & Production Hardening):** Conducted a rigorous vulnerability review and implemented critical defenses including attribute-context XSS neutralization, HTTP header API key migration, Content Security Policy (CSP), cryptographic SHA-256 audit chaining, and memory DoS guards.

---

## 1. Phase A: New Hampshire Statutory Legal Engine

### 1.1. Pretermitted Heir Protections (NH RSA 551:10)
- **Statutory Rule:** Under NH RSA 551:10 and New Hampshire case law (*Robbins v. Johnson*, 147 N.H. 44), if a testator fails to name or acknowledge any child (whether minor or adult) in their will, that child automatically receives the exact intestate share they would have received had the parent died without a will.
- **Rule `W-10` (Critical Severity):** Evaluates `all_children` against will beneficiaries. If any child is omitted, the rule triggers a critical deficiency warning.
- **Question Engine (`Strategy.gs` / `strategy.js`):** Prioritizes an impact-scored clarification question (Impact: 92) presenting four legally sound choices:
  1. Include and name them as a beneficiary
  2. Explicitly acknowledge them with a nominal bequest ($1 or token gift)
  3. Explicitly declare intentional omission/disinheritance
  4. Attorney to advise on options

### 1.2. Spousal Elective Share Protections (NH RSA 560:10)
- **Statutory Rule:** A surviving spouse in New Hampshire possesses a statutory right to elect against a deceased spouse’s will and receive a designated statutory share (ranging from one-third to one-half of personal and real estate depending on surviving issue/parents).
- **Rule `W-09S` (Medium Severity):** Flags potential spousal elective share risks when a spouse is omitted, verifying whether there is a prenuptial waiver, marital agreement, or mutual consent.

### 1.3. Uniform Power of Attorney Act (NH RSA 564-E)
- **Rule `P-01` (Critical Severity):** Mandates that any financial power of attorney must be acknowledged before a notary public or justice of the peace (RSA 564-E:105).
- **Rule `P-02` (Critical) & Rule `P-02B` (Medium):** Enforces explicit designation of the primary agent and generates a clarification question (Impact: 68) prompting the user to name a backup successor agent (RSA 564-E:111).
- **Rule `P-03` (High Severity):** Checks for statutory durability provisions (RSA 564-E:104) ensuring effectiveness upon principal incapacity.
- **Rule `P-04` (Informational Severity):** Flags "hot powers" under RSA 564-E:201 (creating/amending trusts, making gifts, changing beneficiary designations) that require express statutory grant.

### 1.4. Real Estate Non-Probate Transfer via TOD Deed (NH RSA 563-D)
- **Statutory Rule:** Effective July 1, 2024, New Hampshire adopted the *Uniform Real Property Transfer on Death Act* (RSA 563-D). It permits an owner of New Hampshire real estate to record a Transfer on Death Deed that automatically transfers title to designated beneficiaries upon death without probate.
- **Rule `N-03` (Informational Severity):** Automatically detects individually titled NH real property and prompts the client and attorney to consider an RSA 563-D TOD Deed to avoid probate without establishing a revocable trust.
- **Statutory Recording Requirement:** Must be executed and recorded in the county Registry of Deeds within 60 days of execution and before the transferor's death (RSA 563-D:9).

### 1.5. Attorney Preparation Brief Upgrades
- **Section 1 (Client Snapshot):** Categorizes all children, explicitly distinguishing adult children from minors for pretermitted heir auditing.
- **Section 3 (Asset & Designation Summary):** Tracks NH real property with TOD deed status, Financial POA agent/durability, and Healthcare Advance Directive fiduciaries.
- **Section 7 (Scope Notes):** Detailed statutory citations for NH RSA 551:10, RSA 560:10, RSA 563-D, and RSA 564-E.

---

## 2. Phase B: Statutory Document Assembly (Zero-Draft Intake)

### 2.1. The "Zero Draft" Problem & Solution
Previously, users without prior drafts were blocked at Step 1. Phase B introduced an interactive questionnaire and statutory assembly engine that generates complete, ready-to-review New Hampshire documents:

1. **Simple NH Will Draft:**
   - Statement of NH domicile and legal capacity.
   - Revocation clause of all prior testamentary instruments (RSA 551:13).
   - Explicit family declaration naming spouse and **all living children** (both adult and minor).
   - Verbatim RSA 551:10 statutory heir acknowledgment clause preventing unintended intestacy.
   - Full residuary clause disposing of all remaining estate assets (avoiding partial intestacy under RSA 561).
   - Nomination of Executor and Successor Executor with bond waiver (RSA 553).
   - Nomination of Minor Guardian (RSA 463).
   - Two disinterested witnesses attestation block (RSA 551:2).
   - Notary self-proving affidavit (RSA 551:35).

2. **Statutory Advance Directive (NH RSA 137-J:39):**
   - Mandatory statutory disclosure statement in bold type.
   - Part I: Durable Power of Attorney for Health Care (Primary Agent, Alternate Agent, general authority, life-sustaining treatment instructions).
   - Part II: Living Will (terminal condition and permanent unconscious condition directions).
   - Part III: Execution formalities (two disinterested witnesses or notary public acknowledgment per RSA 137-J:40).

3. **Statutory Form Financial Power of Attorney (NH RSA 564-E:301):**
   - Mandatory statutory Notice to Principal.
   - Explicit appointment of Agent and Successor Agent.
   - Full schedule of 13 general authority powers (Real Property, Tangible Personal Property, Banking, Business, Insurance, Tax, etc.).
   - Explicit "Hot Powers" opt-in section (gifting, trust creation/amendment, beneficiary changes per RSA 564-E:201).
   - Express durability provision (RSA 564-E:104).
   - Mandatory Notary Public / Justice of the Peace acknowledgment (RSA 564-E:105).
   - Mandatory Agent Acknowledgment and Fiduciary Duties notice per RSA 564-E:302.

4. **Transfer on Death (TOD) Deed (NH RSA 563-D:19):**
   - Statutory notice highlighting mandatory recording within 60 days of execution and prior to transferor's death (RSA 563-D:9).
   - Clear transferor and beneficiary identification.
   - NH County Registry of Deeds recording book and page references.
   - Notary acknowledgment block.

---

## 3. Phase C: Standalone Web Application & GitHub Pages Deployment

### 3.1. Architecture & Zero-Knowledge Privacy Model
To allow anyone to access the application via a public URL without requiring Google Workspace or server infrastructure, the codebase was ported into **Granite Estate Forms**:

- **100% Client-Side Engine:** Runs entirely inside the user's browser. Zero server backend, zero central database, zero hosting cost.
- **Client-Side IndexedDB Storage (`js/db.js`):** Engagements, uploaded drafts, extractions, findings, questions, and plans are stored privately in the browser's IndexedDB. No client data is sent to developer servers.
- **Direct Browser-to-Gemini Multimodal AI (`js/analysis.js`):** Calls Google Gemini directly from the client using the user's free Google AI Studio key (saved in browser `localStorage`).
- **Cryptographic SHA-256 Tamper-Evident Manifest:** Assembles an attorney brief sealed with a SHA-256 fingerprint.
- **Print-to-PDF Formatting (`@media print`):** Formats clean, attorney-ready briefs directly via browser print dialog.

### 3.2. Public Repositories & Live Links
- **GitHub Repository:** [https://github.com/Bschwartz88/granite-estate-forms](https://github.com/Bschwartz88/granite-estate-forms)
- **Live Public URL:** **[https://bschwartz88.github.io/granite-estate-forms/](https://bschwartz88.github.io/granite-estate-forms/)**

---

## 4. Phase D: Comprehensive Security Review & Production Hardening

A defensive security audit identified potential browser-native vulnerabilities, which were remediated and verified:

1. **Attribute-Context DOM XSS Neutralization (High):**
   - *Issue:* The standard `esc()` helper used `createElement('div').textContent ... innerHTML`, which escapes `<`, `>`, and `&`, but leaves `"` unescaped. When placed into HTML input `value=""`, double quotes caused attribute breakout.
   - *Fix:* Replaced with a comprehensive regex replacer converting `&quot;` and `&#39;`. Verified via automated tests.
2. **API Key Transmission Hardening (Medium-High):**
   - *Issue:* API keys were previously passed in the URL query string (`?key=...`), exposing them to browser histories and proxy logs.
   - *Fix:* Migrated API key transmission to the official `x-goog-api-key` HTTP request header.
3. **Content Security Policy & Clickjacking Defense (Medium):**
   - *Issue:* Absence of CSP allowed unrestricted script execution and network destinations.
   - *Fix:* Added `<meta http-equiv="Content-Security-Policy">` restricting network connections strictly to `'self'` and `https://generativelanguage.googleapis.com`. Added a frame-busting anti-clickjacking guard in `<head>`.
4. **Cryptographic SHA-256 Audit Trail Upgrade (Medium):**
   - *Issue:* Internal audit hash chaining utilized an 8-character 32-bit polynomial checksum while being labeled SHA-256.
   - *Fix:* Upgraded `DB.addAudit` to calculate true 64-character SHA-256 hashes via the Web Crypto API (`crypto.subtle.digest`) in the browser and `crypto.createHash('sha256')` in Node.js.
5. **Client-Side Denial-of-Service File Guard (Medium):**
   - *Issue:* Reading unbounded file sizes into memory as base64 strings risked freezing the browser tab.
   - *Fix:* Enforced a 15MB client-side file upload limit with friendly user notifications.
6. **Interactive Key Lifecycle & Privacy Disclosure (Low):**
   - *Issue:* Stored keys could not be easily disconnected in the UI.
   - *Fix:* Added an active connection badge in the header, a prominent **"Disconnect Key"** action, and an explicit privacy notice detailing free-tier AI data logging policies.
7. **Indirect Prompt Injection Defense (Low):**
   - *Issue:* Document text was directly concatenated into the AI prompt.
   - *Fix:* Wrapped text in `<raw_document_data>` XML delimiter boundaries with strict system instructions directing the model to treat all document contents as untrusted data.

---

## 5. Automated Verification & Testing

The project maintains 5 automated test suites:
```bash
node test/run_all.js
```
- `test_rules.js`: Validates all NH statutory rules (`W-10`, `P-01`, `P-02B`, `P-03`, `P-04`, `N-03`).
- `test_strategy.js`: Validates person harvesting, question prioritization, and plan builder.
- `test_assembly.js`: Validates statutory zero-draft assembly for all 4 legal instruments.
- `test_db.js`: Validates client-side database schema, persistence, and audit logging.
- `test_security.js`: Validates attribute XSS escaping, 15MB file guards, and SHA-256 audit hashes.

---

## 6. How to Save This Summary Directly to Google Drive

To save an updated, beautifully formatted Google Doc copy of this summary into your Google Drive:

1. Open your Google Apps Script project:
   `https://script.google.com/macros/s/AKfycbwc6Bc0H2bpVAdJ4vYmbzxow-yZted7IZGiQkFHSc2z7e6OGB7nHo_McSvX9EWOKKWu/exec`
2. Open the Apps Script editor (`src/Assembly.gs`).
3. Select the function **`saveEnhancementSummaryToDrive()`** from the function dropdown.
4. Click **Run**.
5. The script will automatically create a formatted Google Doc titled:
   **`Granite_Estate_Enhancement_Summary_2026_09_21`**
   directly inside your `GraniteEstate` root folder on Google Drive!
