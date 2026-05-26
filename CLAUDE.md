================================================================
MAJSTOR BANJALUKA — CHATBOT PROJECT
Master Context Document for Claude Code
Last updated: May 2026 (Task [4b-UX] DEVICES v2 ✅ DONE)
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
  (fixtures, faucets, valves, hoses)
- Device installation (boilers, electric stoves)

Target platform: Facebook Business Page (Messenger)

================================================================
SECTION 2 — PROJECT GOAL
================================================================

Build a Facebook Messenger chatbot that acts as a "smart receptionist":

- Engages clients in BHS (Bosnian/Croatian/Serbian)
- Identifies the type of request (repair vs. installation)
- Guides the client through a structured conversation
- Collects all relevant data
- Delivers a clean summary to the technician
- Informs the client they will be contacted

The bot does NOT repair, advise, price, or schedule.

================================================================
SECTION 3 — SYSTEM ARCHITECTURE
================================================================

Client → FB Messenger → Webhook (POST /webhook)
→ processMessage() → sendMessengerReply() → Client

AI layer (future):
processMessage() → AI Adapter → [Gemini / Claude / GPT] → reply

Note: AI provider is interchangeable via adapter pattern.
      Development/testing phase: Gemini Flash (free tier).
      Production phase: to be decided based on performance and cost.

Key principle: "Transport First, Intelligence Second"
→ Transport layer is now complete and verified ✅
→ Image/attachment handling complete and tested on live Messenger ✅
→ DEVICES v2 UX Refactor complete and tested ✅
→ INSTALLATIONS v2 UX Refactor is next (Task 4c-UX)
→ AI intelligence layer is after UX Refactor

Current file structure (MajstorBL_GPT — active project):

src/app.js       — Express app, all route logic, session state,
                   processMessage(), sendMessengerReply()
src/server.js    — Only starts the server, imports app from app.js
package.json     — Project config
CLAUDE.md        — This file (auto-read by Claude Code)

Entry point: src/server.js  (package.json → "start": "node src/server.js")
Deployed at: Render.com (auto-deploy from GitHub)

================================================================
SECTION 4 — CURRENT CODE STATE (app.js)
================================================================

CURRENT IMPLEMENTATION STATUS:

- Multi-user sessions (sessions object, keyed by userId) ✅
- normalizeText() — trims, lowercases, handles null/undefined ✅
- Empty input blocked (except START state) ✅
- createSession() — initializes fresh session per user ✅
- classifyBranch() — keyword-based branch detection ✅
  KNOWN TECHNICAL DEBT: generic keywords "aparat" and "uređaj" may cause
  false DEVICES classification. Low priority — fix in future cleanup.
- extractDeviceType() — auto-detects device from first message ✅
  BUG FIXED in [4b-UX]: dishwasher entry now precedes washing machine.
  "mašina za suđe" / "sudomašina" now correctly resolves to "sudomašina".
- isFurniture() — controls conditional ASK_DIMENSIONS state ✅
- handleAskService() — extracted shared logic for START + ASK_SERVICE ✅
  Fixes bug where first user message was ignored.
  Detects greeting-only messages and contact-intent phrases separately.
- getDeviceInstrumental() — BHS grammatical forms for device names ✅
  e.g. "bojler" → "bojlerom", "frižider" → "frižiderom"
- getModelHint() — device-specific label location hints ✅
  e.g. veš mašina → "unutar vrata bubnja"
- branch field in session (DEVICES / INSTALLATIONS / UNKNOWN) ✅
- Branch A (DEVICES) — DEVICES v2 flow complete ✅
  START fix / greeting detection / contact intent / dishwasher fix /
  model unknown handling / grammar helper / model hint / contact block
- Branch B (INSTALLATIONS) — pre-refactor flow, untouched ← [4c-UX]
- "dalje" is case-insensitive and trimmed (via normalizeText) ✅
- Max 2 photos logic exists in text flow — real Messenger attachments
  handled via Task [4a] ✅
- processMessage() — core logic extracted as standalone function ✅
- sendMessengerReply() — sends messages via Facebook Send API ✅
- Webhook foundation (GET/POST /webhook) ✅
- Webhook verified by Meta ✅
- Messenger integration live and functional ✅
- Image/attachment handling implemented and tested on live Messenger ✅
  - image attachments accepted, URL stored in session.photos[]
  - non-image attachments (video, audio, file) rejected with message
  - maximum 2 photos stored per session, excess ignored
  - ASK_PHOTOS state no longer treats text input as a photo
  - debug logging active with [4a] prefix
  - res.status(200) moved to end of forEach — fixes delayed reply issue
- Code pushed to GitHub ✅
- Deployed to Render (public HTTPS endpoint) ✅
- UX Refactor INSTALLATIONS v2 NOT yet implemented ← Task [4c-UX]
- No AI layer yet ← Task [5]

What app.js currently does:

Core functions:
- normalizeText(text) — safe input normalization used everywhere
- createSession() — initializes fresh session per user
- classifyBranch(text) — returns "DEVICES", "INSTALLATIONS", "UNKNOWN"
- extractDeviceType(text) — returns canonical device name or null.
  Dishwasher entry precedes washing machine entry (bug fix [4b-UX]).
  "aparat" and "uređaj" intentionally excluded — too generic.
- isFurniture(text) — returns true if installationType is furniture
- handleAskService(session, tekst) — shared routing logic for START
  and ASK_SERVICE states. Detects greeting-only and contact-intent
  messages. Routes to DEVICES or INSTALLATIONS branch.
- getDeviceInstrumental(deviceType) — returns BHS instrumental form
  of device name for natural language: "bojler" → "bojlerom"
- getModelHint(deviceType) — returns device-specific hint about where
  to find the model label on the appliance
- processMessage(userId, tekst) — core state machine logic.
  Used by both GET /next (testing) and POST /webhook (Messenger).
  Returns reply string with "Bot: " prefix.
- sendMessengerReply(recipientId, messageText) — sends reply via
  Facebook Graph API v18.0. Strips "Bot: " prefix before sending.
  Uses PAGE_ACCESS_TOKEN from environment variables.

Endpoints:
- GET /webhook — Meta verification (hub.challenge response)
  VERIFY_TOKEN from process.env.META_VERIFY_TOKEN
- POST /webhook — receives Messenger events, handles image attachments
  and text messages separately, sends replies via sendMessengerReply().
  Returns 200 AFTER all processing (not immediately) to prevent
  Render proxy from closing connection before replies are sent.
- GET /next?userId=...&tekst=... — browser testing endpoint
- GET /reset?userId=... — resets session for specific userId

Current Branch A (DEVICES) state machine — POST-REFACTOR ✅ DONE:
  START → ASK_SERVICE (via handleAskService)
  → (auto-detect OR ASK_DEVICE_TYPE)
  → ASK_BRAND → ASK_MODEL → ASK_DESCRIPTION → ASK_FAULT_PATTERN
  → ASK_INSTALL_TYPE → ASK_PHOTOS
  → ASK_CONFIRMATION → ASK_PHONE → ASK_LOCATION → ASK_NAME → END

Current Branch B (INSTALLATIONS) state machine — PRE-REFACTOR:
  START → ASK_SERVICE → ASK_INSTALLATION_TYPE → ASK_ITEM_NAME
  → ASK_ITEM_CONDITION → ASK_WALL_TYPE → ASK_ACCESS → ASK_WORK_READY
  → (ASK_DIMENSIONS if furniture) → ASK_LOCATION → ASK_FLOOR
  → ASK_PARKING → ASK_PHOTOS → ASK_CONTACT → CONFIRM_REQUEST → END

TARGET Branch B (INSTALLATIONS) state machine — POST-REFACTOR (Task 4c-UX):
  START → ASK_SERVICE → ASK_INSTALLATION_TYPE → ASK_ITEM_NAME
  → ASK_ITEM_CONDITION_AND_READY
  → (ASK_MOUNTING_MODE if unknown)
  → (ASK_WALL_TYPE if mountingMode = wall/ceiling)
  → (ASK_ACCESS if B2 or B3 or B4)
  → ASK_WORK_READY
  → (ASK_BRAND + ASK_MODEL if B4 and itemReady = true)
  → (ASK_DIMENSIONS if B1 or wall-mounted items)
  → ASK_FLOOR → ASK_PARKING → ASK_PHOTOS
  → ASK_CONFIRMATION → ASK_PHONE → ASK_LOCATION → ASK_NAME → END

Known technical debt (post [4b-UX]):
  - Dead code: old DEVICES CONFIRM_REQUEST summary block (lines ~582-598)
    never reached in v2 — clean up during [4c-UX]
  - INSTALLATIONS flow still has "zabilježeno" pattern — fix in [4c-UX]
  - INSTALLATIONS contact field still single string — fix in [4c-UX]
  - notes[] not yet in session model — add in [4c-UX]
  - Generic classifyBranch keywords "aparat"/"uređaj" — low priority cleanup
  - handleAskService UNKNOWN response still has old example list — minor

================================================================
SECTION 4a — API DESIGN
================================================================

API (current):

  GET /webhook                    — Meta webhook verification endpoint
  POST /webhook                   — incoming Messenger events + reply
  GET /next?userId=...&tekst=...  — browser testing endpoint
  GET /reset?userId=...           — resets session for specific userId

Note:
GET /next and GET /reset are temporary browser testing endpoints.
Core message flow runs through POST /webhook in production.

================================================================
SECTION 4b — SESSION MODEL
================================================================

TARGET session model (after Task 4c-UX refactor):

  const sessions = {}

  sessions[userId] = {
    state:            "START",
    branch:           null,    // "DEVICES" | "INSTALLATIONS" | "UNKNOWN"
    service:          null,

    // DEVICES-only fields
    deviceType:       null,
    faultPattern:     null,
    installType:      null,

    // DEVICES v2 contact fields (implemented in [4b-UX])
    phone:            null,    // MANDATORY — session closes if refused twice
    phoneRefusedOnce: false,   // tracks first refusal to allow one retry
    name:             null,    // optional

    // INSTALLATIONS-only fields (to be refactored in [4c-UX])
    installationType: null,    // "B1" | "B2" | "B3" | "B4"
    itemName:         null,
    itemCondition:    null,    // "novo" | "polovno"
    itemReady:        null,    // true | false — was item already purchased?
    mountingMode:     null,    // "wall" | "ceiling" | "freestanding" | "unknown"
    wallType:         null,
    accessInfo:       null,
    workReady:        null,
    dimensions:       null,
    floorInfo:        null,
    parkingInfo:      null,

    // Shared fields
    brand:            null,
    model:            null,    // "nepoznat" if user doesn't know
    description:      null,
    location:         null,    // optional for DEVICES — mandatory area for INSTALLATIONS
    photos:           [],
    notes:            [],      // fallback info, additional remarks, future AI use
    contact:          null,    // legacy field — INSTALLATIONS pre-refactor only
  }

================================================================
SECTION 5 — TOP-LEVEL ROUTING
================================================================

On the first client message, the bot classifies the request:

[BRANCH A] DEVICES — repair and maintenance of electrical appliances
[BRANCH B] INSTALLATIONS — assembly, electrical, plumbing, device installation

GREETING DETECTION (new in v2):
- If first message is a greeting only (zdravo, dobar dan, hej, etc.)
  → Bot replies: "Dobar dan! Kako Vam možemo pomoći?"
  → Waits for next message to classify branch

- If first message already describes the need
  → Bot skips greeting, goes directly to branch-specific flow
  → Reply: "Dobro, vidim da imate problem sa [uređaj]." (DEVICES)
         or "Dobro, trebate [intervencija]." (INSTALLATIONS)
  → Then: "Da bismo Vas što prije spojili sa serviserom/majstorom,
           trebam još nekoliko informacija."

================================================================
SECTION 6 — BRANCH A: DEVICES (Repair & Maintenance)
================================================================

Scope:
- White goods (washing machines, dishwashers, refrigerators, boilers)
- Household electronics
- Computers and peripherals
- Small household appliances

TERMINOLOGY: always use "serviser" or "tehničar" — never "majstor"

DATA COLLECTION FLOW (in order):

Step 1 — Device Identification
  1a. Device type — auto-detected from first message if possible
      (extractDeviceType() — skips ASK_DEVICE_TYPE if detected)
  1b. Brand / Manufacturer
      → "Koji je brend (proizvođač) uređaja?"
  1c. Model — with DEVICE-SPECIFIC hint where to find the label:
      - Veš mašina: "unutar vrata bubnja"
      - Bojler:     "prednja ili bočna strana"
      - Frižider:   "unutar frižidera, bočni zid"
      - Laptop:     "naljepnica s donje strane"
      - Generic:    "naljepnica uređaja ili račun o kupovini"

Step 2 — Problem Diagnosis
  2a. Fault description
      → "Opišite problem — šta se tačno dešava sa uređajem?"
  2b. Fault pattern
      → "Da li se problem javlja stalno, ili povremeno?"

Step 3 — Installation Type + Location
  → "Da li je uređaj ugradbeni ili samostojeći, i u kojem dijelu
     prostora se nalazi? (npr. kupatilo, kuhinja, ostava)"
  NOTE: location/address is NOT asked here — moved to contact block

Step 4 — Photos (optional, Quick Reply)
  → "Ako želite, možete nam poslati fotografiju uređaja, mjesta kvara
     ili naljepnice sa modelom (maksimalno 2 fotografije)."
  Quick Reply buttons: [ 📷 Pošalji fotografiju ] [ ➡️ Dalje ]
  NOTE: This is the ONLY step with Quick Reply buttons.

Step 5 — Confirmation
  → "Hvala na informacijama! Da li želite da Vas naš serviser direktno
     kontaktira, radi dogovora termina posjete i popravke Vašeg uređaja?"
  If YES → proceed to contact block
  If NO  → thank client, close session

Step 6 — Contact Block (phone → location → name)
  → "Molimo Vas pošaljite broj telefona na koji Vas serviser može kontaktirati."
     (mandatory — if refused, explain once, then close session)
  → "Možete li poslati adresu ili lokaciju gdje se uređaj nalazi?
     Ako ne želite tačnu adresu, napišite samo naselje ili dio grada." (optional)
  → "Na koje ime da evidentiramo zahtjev? Ako ne želite, napišite Dalje." (optional)

Step 7 — Summary + Close
  📋 Uređaj / 🔧 Brend+Model / ❗ Problem / 🔄 Učestalost /
  📍 Adresa / 📞 Telefon / 👤 Ime
  "Naš serviser će Vas kontaktirati u najkraćem roku!"

================================================================
SECTION 7 — BRANCH B: INSTALLATIONS & INTERVENTIONS
================================================================

Sub-categories:
  B1 — Furniture assembly/disassembly
  B2 — Electrical installations (outlets, switches, lighting, TV mounts)
  B3 — Plumbing — external components ONLY (fixtures, faucets, valves)
  B4 — Device installation (boilers, electric stoves, washers)

TERMINOLOGY: always use "majstor" — never "serviser" or "tehničar"

KEY DISTINCTION FROM DEVICES:
  DEVICES  → client says: ne radi / kvar / popravka / greška
  INSTALLATIONS → client says: kupio sam / ugradnja / montaža / zamjena

DATA COLLECTION FLOW (in order):

Step 1 — Service and Item Identification
  1a. Installation sub-category (B1/B2/B3/B4) — auto-detected if possible
  1b. Specific item (ormar, TV nosač, slavina, bojler, luster...)
      → "Šta je tačno potrebno montirati, ugraditi ili zamijeniti?"
      (skipped if already known from first message)

Step 2 — Item Condition and Availability (COMBINED question)
  → "Da li je predmet već kupljen i spreman za montažu, i da li je nov
     ili polovan?"
  Stores: itemCondition (novo/polovno) + itemReady (true/false)
  IMPORTANT: if itemReady = false → skip Step 5 (brand/model)

Step 3 — Wall / Surface Type (CONDITIONAL)
  mountingMode detection by itemName:
  - wall/ceiling: TV nosač, polica, ogledalo, luster, plafonjera,
                  utičnica, prekidač, zidni bojler, tuš baterija,
                  viseći element
  - freestanding: ormar, komoda, krevet, sto, stolica, radni sto
  - unknown:      bot asks → "Da li se predmet montira samostojeće,
                  ili se fiksira na zid ili plafon?"

  If mountingMode = wall/ceiling:
    → "Kakav je zid ili površina? (beton, cigla, knauf/gips, drvo, ytong)"
  If mountingMode = freestanding:
    → SKIP this step

Step 4 — Access to Installations (CONDITIONAL by sub-category)
  B2 (electrical):
    → "Da li je razvodna tabla (ormarić sa osiguračima) dostupna?"
    → "Da li postoji pripremljen električni priključak na mjestu montaže?"
  B3 (plumbing):
    → "Da li je ventil za zatvaranje vode dostupan i ispravan?"
    → "Da li postoje potrebni priključci za vodu ili odvod?"
  B4 (device install) — by device type:
    Bojler       → "Da li su dostupni priključci za vodu i struju?"
    Šporet/ploča → "Da li postoji električni priključak za šporet/ploču?"
    Mašina       → "Da li su dostupni priključci za vodu, odvod i struju?"
  B1 (furniture):
    → SKIP (unless installation requires drilling or electricity)

Step 5 — Brand and Model (ONLY for B4, ONLY if itemReady = true)
  → "Koji je brend (proizvođač) uređaja?"
  → "Koji je model? Oznaku možete naći na naljepnici ili računu."
  If itemReady = false → SKIP entirely

Step 6 — Work Area Readiness
  → "Da li je prostor pripremljen za rad? (stari predmet uklonjen,
     površina slobodna, mjesto pristupačno)"

Step 7 — Dimensions (CONDITIONAL)
  B1 furniture:
    → "Koje su dimenzije predmeta? (širina x visina x dubina)"
  TV nosač / police / ogledala / viseći elementi:
    → "Koje su dimenzije ili težina predmeta koji se montira?"
  B2, B3:
    → SKIP (unless large element involved)

Step 8 — Floor and Elevator
  → "Na kojem spratu se obavljaju radovi i da li postoji lift?"

Step 9 — Parking
  → "Da li je parking dostupan u blizini objekta?"

Step 10 — Photos (optional, Quick Reply)
  → "Ako želite, možete nam poslati fotografiju trenutnog stanja ili
     mjesta montaže (maksimalno 2 fotografije)."
  Quick Reply buttons: [ 📷 Pošalji fotografiju ] [ ➡️ Dalje ]

Step 11 — Confirmation
  → "Hvala na informacijama! Da li želite da Vas naš majstor kontaktira
     radi dogovora oko dolaska na teren i izvođenja radova?"
  If YES → proceed to contact block
  If NO  → thank client, close session

Step 12 — Contact Block (phone → location → name)
  → "Molimo Vas pošaljite broj telefona na koji Vas majstor može kontaktirati."
     (mandatory — if refused, explain once, then close session)
  → "Možete li poslati adresu ili lokaciju gdje bi se radovi obavljali?
     Ako ne želite tačnu adresu, napišite samo naselje ili dio grada." (optional)
  → "Na koje ime da evidentiramo zahtjev? Ako ne želite, napišite Dalje." (optional)

Step 13 — Summary + Close
  🔧 Vrsta radova / 📦 Predmet / 🆕 Stanje+Kupljeno /
  🧱 Zid / ⚡ Pristup / 🔩 Brend+Model / ✅ Prostor /
  📐 Dimenzije / 🏢 Sprat+Lift / 🅿️ Parking /
  📞 Telefon / 📍 Adresa / 👤 Ime / 📷 Fotografije
  "Naš majstor će Vas kontaktirati u najkraćem roku!"

================================================================
SECTION 8 — SESSION TERMINATION RULES
================================================================

The bot ends the conversation EARLY (polite thank-you) when:

T1. Request is outside scope of services.
T2. Client seeks DIY repair advice.
T3. Client refuses to provide phone number (after one retry with explanation).
T4. Client requests a direct call at START:
    → Thank them, say technician/majstor will call.
    → Collect phone number only.
    → Ask preferred app: Viber / FB Messenger / WhatsApp.
    → End session.
T5. Client responds negatively to confirmation question (Step 5/11):
    → "U redu. Hvala Vam što ste nas kontaktirali."
    → End session.

================================================================
SECTION 9 — STRICT OPERATIONAL RULES (ALWAYS APPLY)
================================================================

RULE 1 — NO DIY ADVICE
  Never provide self-repair instructions or troubleshooting tips.

RULE 2 — FREE TEXT ONLY (with one exception)
  Never present clickable menus or predefined choices.
  All input is free-form natural language.
  EXCEPTION: Quick Reply buttons are used ONLY in the photo step
  (both DEVICES and INSTALLATIONS). This is the only permitted use
  of Quick Reply buttons in the entire bot. Documented as intentional
  rule change from original spec.

RULE 3 — PHOTOS ONLY, MAX 2
  Never request or accept video recordings.
  Only photos accepted, maximum 2 per session.
  Bot responds to image attachments ✅ (implemented in Task [4a]).

RULE 4 — NO PRICING
  Never provide a full price list.
  Standard response: "Cijena se određuje tek nakon izlaska na teren."
  EXCEPTION: Approximate prices for specific standard services (TBD).

RULE 5 — NO APPOINTMENT SCHEDULING
  Never confirm, book, or suggest a specific date/time for a visit.

RULE 6 — ON-SITE SERVICE ONLY
  "Naše usluge se obavljaju isključivo na adresi klijenta."
  (applies to both DEVICES and INSTALLATIONS branches)

RULE 7 — NO "ZABILJEŽENO" PATTERN
  Bot must NEVER echo back user input with "zabilježeno" or repeat
  the user's words literally. Confirmations must be natural and brief:
  "Dobro.", "Razumijem.", "Hvala." — followed immediately by next question.

RULE 8 — TERMINOLOGY
  DEVICES branch     → always "serviser" or "tehničar"
  INSTALLATIONS branch → always "majstor"
  Never mix these terms between branches.

RULE 9 — NO REPEATED QUESTIONS
  Bot must never ask the same question twice unless the client gave
  an unclear or invalid answer. If data was already provided in an
  earlier message, that step must be skipped.

RULE 10 — SKIP KNOWN DATA
  If client provided enough information in the first message, the bot
  must skip redundant questions and proceed to the next unknown field.

================================================================
SECTION 10 — TECH STACK
================================================================

Runtime:      Node.js
Framework:    Express.js
HTTP client:  Node.js built-in https module (for Send API calls)
Dev tool:     Nodemon
Version ctrl: Git (local) + GitHub (remote)
Hosting:      Render.com (auto-deploy from GitHub) ✅ LIVE
AI layer:     Provider-agnostic adapter pattern (not yet implemented)
                Dev/test phase:  Google Gemini Flash (free tier)
                Production phase: Gemini / Claude / GPT — TBD
                Switching provider requires changes in ONE file only.
Future DB:    Google Sheets for lead logging
Bot channel:  Facebook Messenger (Meta Messenger API) ✅ LIVE
Language:     BHS for all client-facing communication
              English for code, docs, and AI prompts

Environment variables (set in Render dashboard):
  META_VERIFY_TOKEN   — webhook verification token ✅ configured
  PAGE_ACCESS_TOKEN   — Meta page token for sending messages ✅ configured

================================================================
SECTION 11 — DEVELOPMENT DECISIONS
================================================================

1.  NO ngrok — webhook tested after deploy to Render, not locally
2.  Render chosen over Railway — better uptime (critical for webhooks)
3.  Deployment flow: Local → git commit → GitHub push → auto-deploy
4.  Free-text only — with ONE exception: Quick Reply for photo step only
5.  AI role: classify intent + extract data from natural language
6.  "Transport First, Intelligence Second" — transport complete ✅
7.  Port 3000 is active on Render
8.  VERIFY_TOKEN and PAGE_ACCESS_TOKEN stored as env vars — never hardcoded
9.  processMessage() extracted as pure function — used by both
    GET /next (testing) and POST /webhook (production)
10. sendMessengerReply() uses native https — no axios dependency needed
11. res.status(200) moved to END of forEach loop (Task [4a] fix)
    → Previously returned 200 immediately at top of handler
    → Caused Render proxy to close connection before attachment replies sent
    → Now returns 200 after all sendMessengerReply() calls are initiated
12. Meta App Review required for public users:
    → Functional bot + Privacy Policy URL + video demonstration
    → Currently only Admin/Developer/Tester roles can interact
13. contact field split into phone + location + name (v2 decision)
    → phone: mandatory, session closes if refused after one retry
    → location: optional, client can skip
    → name: optional, client can skip
14. mountingMode field introduced for INSTALLATIONS (v2 decision)
    → auto-detected from itemName keywords
    → determines whether wallType question is asked
15. itemReady field introduced for INSTALLATIONS (v2 decision)
    → if false, brand/model questions (B4) are skipped entirely
16. Greeting detection introduced (v2 decision)
    → Situacija A (greeting only) vs Situacija B (problem described)
    → affects first bot response and routing speed
17. notes[] array added to both session models (v2 decision)
    → stores fallback info, additional remarks
    → reserved for future AI layer use
18. extractDeviceType() keyword ordering bug fixed in [4b-UX]
    → Dishwasher entry now precedes washing machine entry
    → "mašina za suđe" now correctly resolves to "sudomašina"
19. Always Ctrl+S before git add/commit/push
    → Claude Code edits files in VS Code but does not save automatically
    → unsaved files produce stale deploys on Render
20. handleAskService() extracted as shared function in [4b-UX]
    → Handles both START and ASK_SERVICE states
    → Fixes bug where first user message was ignored
    → Detects greeting-only and contact-intent messages
21. getDeviceInstrumental() added in [4b-UX]
    → BHS grammatical instrumental forms for natural language
    → "bojler" → "bojlerom", "veš mašina" → "veš mašinom"
22. getModelHint() added in [4b-UX]
    → Device-specific hints for where to find model label
    → Different hint per device type
23. model "nepoznat" fallback added in [4b-UX]
    → If user says "ne znam", model is stored as "nepoznat"
    → Prevents null in summary
24. phoneRefusedOnce flag added in [4b-UX]
    → Tracks first phone refusal
    → Allows one retry before session closes politely
25. Future cleanup — low priority:
    → Remove generic classifyBranch keywords "aparat" and "uređaj"
    → May cause false DEVICES classification for generic descriptions

Future vision (post-MVP):
- Multi-channel: Instagram, WhatsApp, Viber
- Bot-as-a-Service for other local businesses (SaaS model)

================================================================
SECTION 12 — ROADMAP
================================================================

[1]     Multi-user sessions (Map by sender ID)                  ✅ DONE
[2a]    classifyBranch() — DEVICES / INSTALLATIONS / UNKNOWN    ✅ DONE
[2b]    Branch A flow — DEVICES (full data collection)          ✅ DONE
[2b+]   extractDeviceType() — UX auto-detection                 ✅ DONE
[2c]    Branch B flow — INSTALLATIONS (full data collection)    ✅ DONE
[2d]    Stabilization — normalizeText, validation, UX fixes     ✅ DONE
[3a]    Webhook foundation (GET/POST /webhook)                   ✅ DONE
[3b]    Deploy to Render (public HTTPS endpoint)                 ✅ DONE
[3c]    Connect webhook in Meta + Messenger Send API             ✅ DONE
[4a]    Image/attachment handling in POST /webhook               ✅ DONE
        - image attachments handled, URL stored in session.photos[]
        - non-image attachments rejected with user-facing message
        - maximum 2 photos enforced, excess ignored
        - ASK_PHOTOS no longer treats text input as photo
        - res.status(200) moved to end of handler (delayed reply fix)
        - debug logging added with [4a] prefix
[4b-UX] UX Refactor — DEVICES v2                                ✅ DONE
        - START fix: first message now processed immediately
        - handleAskService() extracted — shared START + ASK_SERVICE logic
        - Greeting detection (zdravo, dobar dan, hej...)
        - Contact intent detection (kako da Vas kontaktiram...)
        - extractDeviceType() bug fixed — dishwasher before washing machine
        - getDeviceInstrumental() — BHS grammar helper
        - getModelHint() — device-specific label location hints
        - model "nepoznat" fallback for unknown model
        - "zabilježeno" removed from DEVICES flow
        - Location moved to end of DEVICES flow (contact block)
        - ASK_CONFIRMATION state added before contact block
        - ASK_PHONE with phoneRefusedOnce retry logic
        - ASK_LOCATION optional (skip with "dalje")
        - ASK_NAME optional (skip with "dalje")
        - DEVICES summary updated — clean format with emojis
        - INSTALLATIONS flow untouched ✅
[4c-UX] UX Refactor — INSTALLATIONS v2                          ← NEXT TASK
        Spec: MAJSTOR_BL_INSTALLATIONS_FLOW_v2.md
        - Add mountingMode logic (wall/ceiling/freestanding/unknown)
        - Add itemReady field + conditional B4 brand/model
        - Add extractInstallationType() — equivalent of extractDeviceType()
        - Remove all "zabilježeno" patterns from INSTALLATIONS
        - Split contact block (phone → location → name)
        - Add ASK_CONFIRMATION state
        - Add Quick Reply buttons for photo step
        - Add notes[] to session model
        - Clean up dead code: old DEVICES CONFIRM_REQUEST block
        - Update INSTALLATIONS summary format
        NOTE: Do INSTALLATIONS v2 only. Do NOT touch DEVICES flow.
[5]     AI layer (adapter pattern: Gemini / Claude / GPT)        ← after [4c-UX]
[6]     Send summary to technician (email)                       ← after [5]
[7]     Google Sheets integration (lead logging)                 ← after [6]
[8]     Meta App Review (for public users)                       ← after [7]

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
- Flow specification:     MAJSTOR_BL_DEVICES_FLOW_v2.md (DEVICES)
                          MAJSTOR_BL_INSTALLATIONS_FLOW_v2.md (INSTALLATIONS)

================================================================
END OF DOCUMENT
================================================================
