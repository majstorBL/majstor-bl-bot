================================================================
MAJSTOR BANJALUKA — CHATBOT PROJECT
Master Context Document for Claude Code
Last updated: June 2026 (Task [6g] Android Messenger Quick Reply "Dalje" fix ✅ DONE)
              (Task [5] Email Notification ✅ DONE / PRODUCTION VERIFIED)
================================================================
This file is named CLAUDE.md — Claude Code reads it automatically
at the start of every session. No need to reference it manually.
================================================================

================================================================
IMPORTANT RULE — READ BEFORE ANYTHING ELSE
================================================================

Do NOT change existing chatbot behavior unless explicitly instructed.
Refactoring must preserve all existing logic.
When in doubt — ask, do not assume.

================================================================
SECTION 1 — BUSINESS OVERVIEW
================================================================

Business Name: Majstor Banjaluka
Location: Banja Luka, Bosnia and Herzegovina
Services:

- Household appliance repair (white goods, boilers, washing machines,
  small appliances, computers/electronics)
- Furniture assembly/disassembly
- Electrical installations (outlets, switches, lighting, TV mounts)
- Plumbing — external components only
  (fixtures, faucets, valves, hoses, vodokotlići)
- Device installation (boilers, electric stoves, cooktops, range hoods)

Target platform: Facebook Business Page (Messenger)

================================================================
SECTION 2 — PROJECT GOAL
================================================================

Build a Facebook Messenger chatbot that acts as a "smart receptionist":

- Engages clients in BHS (Bosnian/Croatian/Serbian)
- Identifies the type of request (repair vs. installation)
- Guides the client through a structured conversation
- Collects all relevant data
- Delivers a clean summary to the technician/majstor
- Informs the client they will be contacted

The bot does NOT repair, advise, price, or schedule.

================================================================
SECTION 3 — SYSTEM ARCHITECTURE
================================================================

Client → FB Messenger → Webhook (POST /webhook)
→ processMessage() → sendMessengerReply() → Client
→ sendSummaryEmail() → Brevo HTTP API → Gmail (technician)

AI layer (future):
processMessage() → AI Adapter → [Gemini / Claude / GPT] → reply

Note: AI provider is interchangeable via adapter pattern.
      Development/testing phase: Gemini Flash (free tier).
      Production phase: to be decided based on performance and cost.

Key principle: "Transport First, Intelligence Second"
→ Transport layer complete and verified ✅
→ Image/attachment handling complete and tested on live Messenger ✅
→ DEVICES v2 UX Refactor complete and tested ✅
→ DEVICES flow polish + keyword matrix fix complete ✅
→ INSTALLATIONS v2 UX Refactor complete and tested ✅
→ INSTALLATIONS keyword matrix final fix complete, 79/79 PASS ✅
→ Technician email notification live via Brevo HTTP API ✅
→ Meta App Review preparation is NEXT (Task [6])

Current file structure (MajstorBL_GPT — active project):

src/app.js       — Express app, all route logic, session state,
                   processMessage(), sendMessengerReply(),
                   buildTechnicianEmail(), sendSummaryEmail()
src/server.js    — Only starts the server, imports app from app.js
package.json     — Project config (no nodemailer — uses native fetch)
CLAUDE.md        — This file (auto-read by Claude Code)

Test files (root of project — keep in repo, never delete):
test-email-builder.js                  — email builder unit tests, 14 tests
test-installations-keywords.js         — original regression suite, 39 tests
test-installations-keywords-v2.js      — Messenger bug regression suite, 14 tests
test-installations-keywords-master.js  — master keyword matrix suite, 79 tests
test-devices-flow-polish.js            — DEVICES polish regression suite, 28 tests
test-continue-answer-quickreply.js     — Quick Reply "Dalje" regression suite, 27 tests

Entry point: src/server.js  (package.json → "start": "node src/server.js")
Deployed at: Render.com (auto-deploy from GitHub)
Live commit:  55f9a73 — "Replace Gmail SMTP with Brevo HTTP Email API"

Git log (recent):
  55f9a73 Replace Gmail SMTP with Brevo HTTP Email API   ← HEAD
  90a5cc1 Polish DEVICES flow and add regression suite
  931284b INSTALLATIONS v2 final keyword matrix fix

================================================================
SECTION 4 — CURRENT CODE STATE (src/app.js)
================================================================

CURRENT IMPLEMENTATION STATUS:

CORE / SHARED:
- Multi-user sessions (sessions{} keyed by userId) ✅
- normalizeText() — trims, lowercases, null-safe ✅
- isContinueAnswer(text) — Android Messenger Quick Reply continue/skip
  detector ✅ (Task [6g]). Normalizes input, strips emoji/symbol/
  punctuation noise (keeps letters/numbers/spaces, incl. č/ć/đ/š/ž),
  returns true only when the cleaned text equals "dalje". Accepts plain
  "Dalje" AND decorated forms like "➡️ Dalje" that the Android Messenger
  app sends back as the Quick Reply title. Used at ASK_PHOTOS,
  ASK_LOCATION and ASK_NAME skip points. Exported via module.exports
  for the regression unit test. No Unicode property escapes — safe on
  current Node runtime.
- Empty input blocked (except START and END states) ✅
- createSession() — initializes fresh session per user ✅
  Now includes summaryNotes: [] and emailSent: false (added Task [5]).
- classifyBranch() — keyword-based branch detection ✅
  Contains two DEVICES priority guards:
  (a) appliance phrase + fault phrase (osigurač case) — runs FIRST
  (b) [4d-UX] device fault guard (ne radi, ne pali, etc.) — runs AFTER
      installation-intent pre-check, so explicit install verbs still win.
  KNOWN TECHNICAL DEBT: generic keywords "aparat" and "uređaj" may
  cause false DEVICES classification. Low priority — future cleanup.
- handleAskService() — shared START + ASK_SERVICE routing ✅
  Detects greeting-only messages and contact-intent phrases.
  Runs out-of-scope checks BEFORE classifyBranch().
- processMessage() — core state machine, pure function ✅
  Used by both GET /next (testing) and POST /webhook (Messenger).
- sendMessengerReply() — sends text via Facebook Send API ✅
- sendMessengerQuickReply() — sends Quick Reply buttons ✅
  Used ONLY on ASK_PHOTOS step in both branches.
- Webhook GET /webhook — Meta verification ✅
- Webhook POST /webhook — Messenger events, attachment handling ✅
  res.status(200) sent AFTER forEach (prevents proxy close bug).
  Image attachments stored in session.photos[] (max 2).
  Non-image attachments (video, audio, file) rejected with message.
  Quick Reply payload treated as plain text input.

EMAIL NOTIFICATION (Task [5]) ✅ DONE / PRODUCTION VERIFIED:
- buildTechnicianEmail(session) — pure function, returns {subject, text} ✅
  Exported via module.exports for isolated unit testing.
  Builds subject: "[NOVI ZAHTJEV] BRANCH — detail — location"
  Builds body with three sections:
    --- PODACI O ZAHTJEVU --- (branch-specific fields)
    --- KONTAKT ---           (phone, location, name)
    --- FOTOGRAFIJE ---       (count + URL links)
  Guard for old sessions: Array.isArray(session.summaryNotes) check.
  Does NOT touch network or session state — safe to call any time.
- sendSummaryEmail(session) — async, NON-BLOCKING, SAFE, IDEMPOTENT ✅
  Called without await after finalReply is assembled — never delays UX.
  Skips silently if BREVO_API_KEY / EMAIL_FROM / EMAIL_TO are missing.
  Uses Node built-in fetch() — no nodemailer dependency.
  POSTs to https://api.brevo.com/v3/smtp/email (HTTPS port 443).
  Sets session.emailSent = true ONLY after response.ok.
  Logs success: "Technician email notification sent."
  Logs failure: "Technician email notification failed: <error>"
  Never throws — all errors caught locally, never surface to user.
- Email transport decision: Brevo HTTP API (not Gmail SMTP) ✅
  SMTP on Render free tier failed with IPv6 ENETUNREACH on ports 465/587.
  DNS ipv4first workaround still resulted in connection timeout.
  Brevo HTTP API uses HTTPS 443 — works reliably on Render.
  Architecture is flexible: transport is isolated in sendSummaryEmail()
  and can be swapped (SMTP, other API) without touching any flow logic.

DEVICES BRANCH (Branch A) — v2 + [4d-UX] polish ✅ DONE / STABLE:
- extractDeviceType() — auto-detects device from first message ✅
  Ordering: sudomašina → sušilica → veš mašina (prevents ordering bugs).
  Covers: frižder/frizder, škrinja/skrinja, sušilica/sušilica veša,
  printer/štampač, šparet, loptop, indukciona ploča, električna ploča.
- shouldAskDeviceInstallType(deviceType) ✅  [4d-UX]
  Returns true ONLY for: sudomašina, veš mašina, sušilica, frižider,
  zamrzivač, šporet, električna ploča, indukciona ploča, bojler.
  For računar, laptop, monitor, TV, printer — returns false → skip to photos.
- devicesPhotoPrompt() ✅  [4d-UX]
  Aligned with INSTALLATIONS: max 2 photos, video not supported, Dalje.
- getDeviceInstrumental() — BHS instrumental grammatical forms ✅
- getModelHint() — device-specific label location hints ✅
- Model "nepoznat" fallback when user doesn't know model ✅
- phoneRefusedOnce flag — one retry before session closes ✅
- Room/location question REMOVED from DEVICES flow ✅  [4d-UX]
- DEVICES address prompt: "adresa ili naselje gdje bi serviser trebao doći" ✅
- DEVICES summary: installType shown only when present (no null display) ✅

DEVICES v2 state machine (STABLE — do NOT change):
  START → ASK_SERVICE (via handleAskService)
       → (auto-detect device OR ASK_DEVICE_TYPE)
       → ASK_BRAND → ASK_MODEL → ASK_DESCRIPTION
       → ASK_FAULT_PATTERN
       → (ASK_INSTALL_TYPE only if shouldAskDeviceInstallType() = true)
       → ASK_PHOTOS
       → ASK_CONFIRMATION → ASK_PHONE → ASK_LOCATION
       → ASK_NAME → END + summary + sendSummaryEmail()

INSTALLATIONS BRANCH (Branch B) — v2 ✅ DONE / STABLE:

Helper functions (all implemented and tested):
- extractInstallationType() — detects B1/B2/B3/B4 sub-category ✅
- extractInstallationItem() — detects canonical item name ✅
- detectMountingMode() — wall/ceiling/freestanding/unknown ✅
- detectOutOfScopePlumbing() — nuanced, NOT a blunt trigger ✅
  Local endpoint context guard preserves B3 for "začepljen sifon ispod lavaboa".
- detectOutOfScopeElectrical() — nuanced, NOT a blunt trigger ✅
  Local endpoint faults stay B2; in-wall rewiring → out-of-scope.
- detectDemolition() — broad backwards-compatible detector ✅
- detectDemolitionRequested() — nuanced demolition detector ✅
  Regex-based BHS word-order handling. Guards against already-done false positives.
- detectAlreadyRemovedOrReady() — already-done protection ✅
- addBhsNote(session, bhsText) — clean BHS-only summary notes ✅
  Deduplicates. NEVER store English debug strings in summaryNotes.
- sessionHasDemolitionRequestNote() — checks summaryNotes[] ✅
- isNegativeWorkReadyAnswer() — triggers ASK_DEMOLITION_FOLLOWUP ✅
- shouldAskStandaloneOrBuiltIn() — B4 device type question ✅
- buildAccessQuestionForInstallations() — item-specific wording ✅
- continueInstallationsFlow(session, fromState) — central dispatcher ✅
- nextAfterRecognitionInstallations(session) — initial router ✅
  Skips ASK_WORK_READY if demolition already noted.
- installationsPhotoPrompt() — standard photo step message ✅
- ASK_HAS_PART intentionally DISABLED in active v2 flow ✅

INSTALLATIONS v2 state machine (STABLE — do NOT change):
  START → ASK_SERVICE (via handleAskService)
       → (auto-detect type+item OR ASK_INSTALLATION_TYPE)
       → (ASK_ITEM_NAME if B1/B4 and item unknown)

  B1 path:
       → (skip ASK_WORK_READY if demolition already noted)
       → ASK_WORK_READY → (ASK_DEMOLITION_FOLLOWUP if "ne")
       → (ASK_WALL_TYPE if mountingMode=wall/ceiling)
       → ASK_DIMENSIONS → ASK_PHOTOS

  B2/B3 path:
       → ASK_PROBLEM_DESCRIPTION → ASK_ACCESS → ASK_PHOTOS

  B4 path:
       → (skip ASK_WORK_READY if demolition already noted)
       → ASK_WORK_READY → (ASK_DEMOLITION_FOLLOWUP if "ne")
       → (ASK_STANDALONE_OR_BUILTIN if relevant device)
       → ASK_ACCESS
       → (ASK_WALL_TYPE if mountingMode=wall/ceiling)
       → ASK_BRAND → ASK_MODEL
       → (ASK_DIMENSIONS if wall-mounted)
       → ASK_PHOTOS

  All paths converge:
       → ASK_CONFIRMATION → ASK_PHONE → ASK_LOCATION
       → ASK_NAME → END + summary + sendSummaryEmail()

SESSION MODEL (current createSession()):
  state, branch, service
  // DEVICES-only
  deviceType, faultPattern, installType
  // DEVICES v2 contact block
  phone (mandatory), name (optional), phoneRefusedOnce
  // INSTALLATIONS-only
  installationType (B1/B2/B3/B4), itemName, itemCondition
  itemReady (true/false/null), mountingMode
  wallType, accessInfo, workReady, dimensions, floorInfo, parkingInfo
  // Shared
  brand, model, description, location, photos[], notes[], contact
  summaryNotes[]   ← clean BHS notes, initialized in createSession() ✅
  emailSent: false ← prevents duplicate email sends, set in createSession() ✅
  // contact: legacy field — retained for compatibility, unused in v2

================================================================
SECTION 4a — QA / REGRESSION SUITES
================================================================

All five test files live in the project root (not in src/).
Run with server active in one terminal, test in second terminal.
Exception: test-email-builder.js is a unit test — no server needed.

test-email-builder.js                  — 14 tests  — 14/14 PASS ✅
test-installations-keywords.js         — 39 tests  — 39/39 PASS ✅
test-installations-keywords-v2.js      — 14 tests  — 14/14 PASS ✅
test-installations-keywords-master.js  — 79 tests  — 79/79 PASS ✅
test-devices-flow-polish.js            — 28 tests  — 28/28 PASS ✅
test-continue-answer-quickreply.js     — 27 tests  — 27/27 PASS ✅
TOTAL:                                  201 tests  — 201/201 PASS ✅

MANDATORY — run ALL before any commit:
  node --check src/app.js
  node test-email-builder.js
  node test-installations-keywords.js
  node test-installations-keywords-v2.js
  node test-installations-keywords-master.js
  node test-devices-flow-polish.js
  node test-continue-answer-quickreply.js

Note: test-email-builder.js tests buildTechnicianEmail() in isolation.
No server needed — it is a pure function unit test.
test-continue-answer-quickreply.js has two parts: Part A unit-tests
isContinueAnswer() with NO server; Part B runs HTTP flow tests that
require the server. Run it with the server active to exercise both parts.
All other test files require the server running in a second terminal.

Do NOT delete any test files. They are the safety net — regressions
will be invisible without them.

================================================================
SECTION 4b — API DESIGN
================================================================

GET  /webhook                      — Meta webhook verification
POST /webhook                      — Messenger events + reply
GET  /next?userId=...&tekst=...    — browser testing endpoint
GET  /reset?userId=...             — resets session for specific user

GET /next and GET /reset are temporary testing endpoints.
Core production flow runs through POST /webhook only.

module.exports exposes three additional symbols for testing:
  module.exports.buildTechnicianEmail  — pure function, safe to import
  module.exports.createSession         — session factory, safe to import
  module.exports.isContinueAnswer      — Quick Reply "Dalje" detector ([6g])

================================================================
SECTION 5 — TOP-LEVEL ROUTING
================================================================

On the first client message, handleAskService() classifies:

[BRANCH A] DEVICES — repair and maintenance of electrical appliances
[BRANCH B] INSTALLATIONS — assembly, electrical, plumbing, device install
[OUT-OF-SCOPE] — polite decline, session ends

ROUTING ORDER in handleAskService():
  1. Greeting / contact-intent check → ask "Kako Vam možemo pomoći?"
  2. detectOutOfScopePlumbing() → decline + END
  3. detectOutOfScopeElectrical() → decline + END
  4. classifyBranch() → DEVICES / INSTALLATIONS / UNKNOWN
  5. DEVICES: extractDeviceType() → route to flow
  6. INSTALLATIONS: detectDemolitionRequested() → addBhsNote()
                    extractInstallationType() → set installationType
                    extractInstallationItem() → set itemName + mountingMode
                    → nextAfterRecognitionInstallations()

DEVICES priority guards in classifyBranch() (two guards, in order):
  Guard 1: appliance phrase + fault phrase (e.g. "veš mašina izbacuje osigurač")
    → forced DEVICES BEFORE installationIntent pre-check.
  Guard 2: [4d-UX] device fault guard (device phrase + fault symptom)
    → runs AFTER installationIntent pre-check so install verbs still win.
  Pure electrical fault (no appliance) → INSTALLATIONS (B2).

================================================================
SECTION 6 — BRANCH A: DEVICES
================================================================

Scope: white goods, boilers, electronics, computers, small appliances.
TERMINOLOGY: always "serviser" or "tehničar" — NEVER "majstor".

DATA COLLECTION (in order):
  1. Device type — auto-detected or ASK_DEVICE_TYPE
  2. Brand — ASK_BRAND
  3. Model — ASK_MODEL (device-specific label hint, "nepoznat" fallback)
  4. Fault description — ASK_DESCRIPTION
  5. Fault pattern (constant/intermittent) — ASK_FAULT_PATTERN
  6. Install type (built-in/freestanding) — ASK_INSTALL_TYPE
     ONLY if shouldAskDeviceInstallType() returns true.
  7. Photos (optional, Quick Reply, max 2) — ASK_PHOTOS
  8. Confirmation — ASK_CONFIRMATION
  9. Phone (mandatory, one retry) — ASK_PHONE
  10. Address/neighborhood (optional) — ASK_LOCATION
  11. Name (optional) — ASK_NAME → END + summary + email to technician

================================================================
SECTION 7 — BRANCH B: INSTALLATIONS
================================================================

Sub-categories:
  B1 — Furniture assembly/disassembly, wall-mount items
  B2 — Minor electrical: outlets, switches, lighting, fuses
  B3 — Minor plumbing: faucets, siphons, valves, hoses, vodokotlići,
       WC šolje, bidet, tuš kada, tuš baterija, tuš kabina, lavabo
  B4 — Device installation: boiler, šporet, ploča, napa, mašina,
       sudomašina, klima, zamrzivač, frižider

TERMINOLOGY: always "majstor" — NEVER "serviser" or "tehničar".

KEY DISTINCTION DEVICES vs INSTALLATIONS:
  "ne radi / kvar / popravka / greška" → DEVICES
  "ugradnja / montaža / zamjena / priključenje / kupio sam" → INSTALLATIONS

After completing the contact block, both branches call sendSummaryEmail()
non-blocking — the email goes out without the user ever waiting for it.

================================================================
SECTION 8 — SESSION TERMINATION RULES
================================================================

T1. Request outside scope of services.
T2. Client seeks DIY repair advice.
T3. Client refuses phone number (after one retry with explanation).
T4. Client requests direct call at START:
    → Thank, say technician/majstor will call.
    → Collect phone only + preferred app (Viber/Messenger/WhatsApp).
    → End session.
T5. Client answers negatively to ASK_CONFIRMATION:
    → "U redu. Hvala Vam što ste nas kontaktirali."
    → End session. (No email sent — no contact data collected yet.)

================================================================
SECTION 9 — STRICT OPERATIONAL RULES
================================================================

RULE 1 — NO DIY ADVICE
RULE 2 — FREE TEXT ONLY (exception: Quick Reply "Dalje" on ASK_PHOTOS)
RULE 3 — PHOTOS ONLY, MAX 2 — never request/accept video
RULE 4 — NO PRICING — "Cijena se određuje tek nakon izlaska na teren."
RULE 5 — NO APPOINTMENT SCHEDULING
RULE 6 — ON-SITE SERVICE ONLY
RULE 7 — NO "ZABILJEŽENO" PATTERN — confirmations must be natural
RULE 8 — TERMINOLOGY — DEVICES: serviser/tehničar; INSTALLATIONS: majstor
RULE 9 — NO REPEATED QUESTIONS
RULE 10 — SKIP KNOWN DATA — use what the first message already gave
RULE 11 — CLEAN SUMMARY NOTES — summaryNotes[] BHS only, no English labels

================================================================
SECTION 10 — TECH STACK
================================================================

Runtime:      Node.js
Framework:    Express.js
HTTP client:  Node.js built-in https (for Facebook Send API)
              Node.js built-in fetch() (for Brevo Email API) ✅ Task [5]
Dev tool:     Nodemon
Version ctrl: Git (local) + GitHub (remote)
Hosting:      Render.com (auto-deploy from GitHub) ✅ LIVE
Email:        Brevo HTTP API (POST https://api.brevo.com/v3/smtp/email) ✅
              nodemailer was tried and ABANDONED — SMTP unreliable on Render
              (IPv6 ENETUNREACH on ports 465/587, timeout on STARTTLS/IPv4fix)
AI layer:     Provider-agnostic adapter pattern (NOT YET implemented)
                Dev/test:    Google Gemini Flash (free tier)
                Production:  Gemini / Claude / GPT — TBD
                Switch = change ONE file only.
Future DB:    Google Sheets for lead logging (optional)
Bot channel:  Facebook Messenger (Meta Messenger API) ✅ LIVE
Language:     BHS for all client-facing communication
              English for code, docs, and AI prompts

Environment variables (Render dashboard — current active set):
  META_VERIFY_TOKEN   — webhook verification token ✅
  PAGE_ACCESS_TOKEN   — Meta page token for Send API ✅
  BREVO_API_KEY       — Brevo email API key ✅ (added Task [5])
  EMAIL_FROM          — sender address (majstor.banjaluka@gmail.com) ✅
  EMAIL_TO            — technician's address (majstor.banjaluka@gmail.com) ✅
  EMAIL_FROM_NAME     — sender display name ("Majstor Banjaluka") ✅

OBSOLETE env vars — delete from Render if still present:
  EMAIL_USER          — was for Gmail SMTP, no longer used
  EMAIL_PASS          — was for Gmail SMTP App Password, no longer used

================================================================
SECTION 11 — DEVELOPMENT DECISIONS
================================================================

1.  NO ngrok — all webhook testing done after deploy to Render
2.  Render over Railway — better uptime for webhook reliability
3.  Deployment: local edit → Ctrl+S → git add → git commit → git push
    → Render auto-deploy (always verify deploy is live before Messenger test)
4.  ALWAYS Ctrl+S before git add/commit/push
5.  Free-text only, ONE exception: Quick Reply on photo step
6.  AI role: classify intent + extract data from natural language
7.  "Transport First, Intelligence Second" — transport complete ✅
8.  All secrets in env vars — never hardcoded
9.  processMessage() is a pure function — used by /next and /webhook
10. sendMessengerReply() uses native https — no axios dependency
11. res.status(200) sent AFTER forEach in POST /webhook handler
12. Meta App Review required for public users
13. Phone → location → name in contact block (all optional except phone)
14. mountingMode drives conditional ASK_WALL_TYPE
15. itemReady field (B4): if false → skip ASK_BRAND/MODEL
16. Greeting detection in handleAskService()
17. summaryNotes[] clean BHS notes; notes[] internal debug only
18. extractDeviceType() ordering: sudomašina → sušilica → veš mašina
19. handleAskService() extracted for shared START + ASK_SERVICE logic
20. getDeviceInstrumental() — BHS grammatical forms
21. getModelHint() — device-specific label hints
22. model "nepoznat" fallback
23. phoneRefusedOnce flag — one retry
24. DEVICES priority guard 1 — appliance + osigurač fault
25. Out-of-scope detectors BEFORE classifyBranch()
26. detectDemolitionRequested() — nuanced, regex BHS word-order
27. detectAlreadyRemovedOrReady() — false demolition tag protection
28. addBhsNote() + summaryNotes[] — clean BHS architecture
29. nextAfterRecognitionInstallations() skips ASK_WORK_READY when noted
30. continueInstallationsFlow() — single INSTALLATIONS dispatcher
31. ASK_HAS_PART disabled in v2 (UX friction, state kept for v3)
32. TV nosač = B1, not B2
33. "kada" not in keywords — BHS false positive ("when")
34. "pipa" = B3 keyword (colloquial BiH/RS for česma)
35. Master regression suite before any keyword commit
36. shouldAskDeviceInstallType() — selective built-in/freestanding question
37. devicesPhotoPrompt() — aligned DEVICES photo prompt
38. DEVICES fault guard 2 — device phrase + fault phrase → DEVICES
39. Room question removed from DEVICES flow
40. DEVICES summary: no null installType, label "Tip uređaja"
41. EMAIL BEFORE AI LAYER — strategic decision: bot must deliver leads
    before adding AI complexity. Confirmed and executed as Task [5].
42. summaryNotes[] and emailSent initialized in createSession() ✅ Task [5]
43. Email transport = Brevo HTTP API, not Gmail SMTP ✅ Task [5]
    Gmail SMTP failed on Render (IPv6 ENETUNREACH ports 465/587).
    DNS ipv4first workaround still timed out.
    Brevo HTTP API over HTTPS 443 works reliably on Render.
    Transport is isolated in sendSummaryEmail() — can be swapped later.
44. sendSummaryEmail() is non-blocking (no await at call site) ✅ Task [5]
    Fire-and-forget: user gets Messenger reply immediately regardless.
45. buildTechnicianEmail() is a pure function exported for unit testing ✅
    module.exports.buildTechnicianEmail allows test-email-builder.js to
    import and test it in isolation without starting the server.
46. emailSent = true only after response.ok — failed sends can retry ✅
    (retry happens if same user completes another flow — unlikely in MVP
    but architecturally correct)

Minor INSTALLATIONS UX polish backlog (NOT blocking):
- Remove repeated "Razumijem" in B1/B4 demolition intro
- Shorten some INSTALLATIONS prompts

Future vision (post-MVP):
- Multi-channel: Instagram, WhatsApp, Viber
- Bot-as-a-Service for other local businesses (SaaS model)
- Infrastructure: Render → VPS (Hetzner) → Dedicated Server
- Own domain (majstorbanjaluka.ba) for better email deliverability
  (DKIM, DMARC, SPF — currently using Gmail freemail domain via Brevo)

================================================================
SECTION 12 — ROADMAP
================================================================

[1]     Multi-user sessions                                    ✅ DONE
[2a]    classifyBranch()                                       ✅ DONE
[2b]    Branch A — DEVICES flow                               ✅ DONE
[2b+]   extractDeviceType()                                    ✅ DONE
[2c]    Branch B — INSTALLATIONS flow                         ✅ DONE
[2d]    Stabilization                                          ✅ DONE
[3a]    Webhook foundation                                     ✅ DONE
[3b]    Deploy to Render                                       ✅ DONE
[3c]    Messenger webhook + Send API                           ✅ DONE
[4a]    Image/attachment handling in POST /webhook             ✅ DONE
[4b-UX] UX Refactor — DEVICES v2                              ✅ DONE
[4c-UX] UX Refactor — INSTALLATIONS v2                        ✅ DONE / STABLE
        Commit: 931284b — 39/39, 14/14, 79/79 PASS
[4d-UX] DEVICES flow polish + keyword matrix fix               ✅ DONE / STABLE
        Commit: 90a5cc1 — 28/28 PASS
        - shouldAskDeviceInstallType(), devicesPhotoPrompt()
        - Expanded extractDeviceType() and keyword matrix
        - Room question removed; summary null fix
[5]     Technician Email Notification MVP                      ✅ DONE / PRODUCTION VERIFIED
        Commit: 55f9a73 — Brevo HTTP API
        - createSession() extended: summaryNotes: [], emailSent: false
        - buildTechnicianEmail(session) — pure function, exported for testing
        - sendSummaryEmail(session) — async, non-blocking, Brevo HTTP API
        - test-email-builder.js — 14/14 PASS
        - Total tests: 174/174 PASS
        - Messenger smoke test: DEVICES + INSTALLATIONS, with + without photos
        - Render log confirmed: "Technician email notification sent."
        - Lead delivery path: Messenger → bot → Brevo → Gmail ✅ LIVE

        SMTP history (for reference):
        [5a] Gmail SMTP port 465 → IPv6 ENETUNREACH on Render
        [5b] Gmail SMTP port 587 → IPv6 ENETUNREACH on Render
        [5c] DNS ipv4first workaround → Connection timeout
        [5d] Brevo HTTP API → SUCCESS ✅

[6g]    Android Messenger Quick Reply "Dalje" fix             ✅ DONE
        Regression-safe bugfix — no flow/email/keyword logic changed.
        - isContinueAnswer(text) added next to normalizeText().
        - Strict === "dalje" checks replaced by isContinueAnswer() at
          ASK_PHOTOS, ASK_LOCATION, ASK_NAME.
        - Quick Reply title changed "➡️ Dalje" → "Dalje" (payload stays
          "Dalje"). Stops Android sending the emoji title back as text.
        - isContinueAnswer exported for testing.
        - test-continue-answer-quickreply.js — 27/27 PASS.
        - Full suite: 201/201 PASS.
        Result: Android Messenger Quick Reply "Dalje" now advances the
        flow; Messenger Web behavior preserved; no photo-prompt loop.

[6]     Meta App Review preparation + Privacy Policy           ⏸ PAUSED
        Was NEXT — now PAUSED, NOT abandoned.
        Reason: Meta account is currently under restriction, and there
        is no registered business documentation yet, so Meta App Review
        / Business Portfolio verification cannot proceed at this time.
        Privacy Policy draft exists (privacy-policy.html) and is kept
        for when this is resumed.
        Resume condition: Meta restriction cleared AND/OR registered
        business documentation available.
        Original needs (still valid when resumed):
          - Privacy Policy URL (simple webpage)
          - Description of business purpose
          - Demo video of functional bot conversation
          - Complete conversation example for reviewer

        STRATEGIC DIRECTION — AKiPP
        Automatizacija Komunikacije i Prikupljanja Podataka
        (Automation of Communication and Data Collection)
        While Meta App Review is paused, the project pivots toward a
        channel-agnostic, reusable lead-capture engine. The goal is a
        bot core that automates client communication and structured
        data collection independently of any single platform — so the
        same engine can serve Messenger today and other channels later
        without rewriting the flow logic. This makes the product less
        dependent on Meta approval timelines and lays the groundwork for
        the future Bot-as-a-Service vision.

[7a]    Channel Adapter Foundation                            ← NEXT (recommended)
        First step of the AKiPP direction. NO behavior change.
        Introduce a thin transport/channel adapter boundary so the core
        processMessage() flow is decoupled from the Messenger-specific
        send/receive code. Pure structural groundwork:
          - Isolate Messenger send/receive behind an adapter interface.
          - processMessage() stays a pure function — unchanged behavior.
          - All 201 tests must still pass unchanged.
        This prepares multi-channel support (Web widget, Viber, WhatsApp,
        Instagram) WITHOUT touching DEVICES/INSTALLATIONS/email logic.

[7]     Production smoke test with real clients               ← after channel work
        Run with real clients, collect edge cases.
        Real data informs AI layer design.

[8]     Google Sheets lead logging                            ← optional
        One row per completed session.
        May be skipped if email is sufficient.

[9]     AI layer (adapter pattern: Gemini / Claude / GPT)     ← after [7]
        Implement AFTER real production usage.
        Real user data will reveal what AI needs to improve.

================================================================
NOTES FOR CLAUDE CODE
================================================================

- The project owner is NOT a developer. Always explain simply.
- Always explain what code does and why, alongside the code.
- Give terminal commands copy/paste ready, one at a time.
- Guide step by step — small task → confirm → next task.
- Communicate in BHS (Bosnian/Croatian/Serbian).
- Write all code, comments, and docs in English.
- Active project folder: MajstorBL_GPT
- Entry point for logic:  src/app.js
- Entry point for server: src/server.js
- Flow specs:  MAJSTOR_BL_DEVICES_FLOW_v2.md (DEVICES)
               MAJSTOR_BL_INSTALLATIONS_FLOW_v2.md (INSTALLATIONS)
- Test files (root folder, never delete):
    test-email-builder.js  (14 tests — unit test, NO server needed)
    test-installations-keywords.js  (39 tests — server required)
    test-installations-keywords-v2.js  (14 tests — server required)
    test-installations-keywords-master.js  (79 tests — server required)
    test-devices-flow-polish.js  (28 tests — server required)
    test-continue-answer-quickreply.js  (27 tests — Part A unit / Part B server)
- ALWAYS run ALL six test suites before committing.
- ALWAYS Ctrl+S before git add/commit/push.
- Do NOT touch DEVICES flow unless explicitly asked.
- Do NOT touch INSTALLATIONS flow unless explicitly asked.
- Do NOT touch email functions unless explicitly asked.
- Do NOT add new states to processMessage() without mapping them in
  continueInstallationsFlow() or the DEVICES state machine.

================================================================
END OF DOCUMENT
================================================================
