================================================================
MAJSTOR BANJALUKA — CHATBOT PROJECT
Master Context Document for Claude Code
Combines: MAJSTOR_BL_KONTEKST_EN + MAJSTOR_BL_BOT_LOGIC_SUMMARY_EN
Last updated: April 2026
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

Client → FB Messenger → Webhook → Server (Node.js/Express)
→ AI Adapter Layer → [Gemini / Claude / GPT] → back to Messenger → Client

Note: AI provider is interchangeable via adapter pattern.
      Development/testing phase: Gemini Flash (free tier).
      Production phase: to be decided based on performance and cost.

Key principle: "Transport First, Intelligence Second"
→ First establish stable Messenger ↔ Server communication
→ Then add AI intelligence layer

Current file structure (MajstorBL_GPT — active project):

app.js     — Express app, all route logic and session state
server.js  — Only starts the server, imports app from app.js
package.json — Project config
CLAUDE.md  — This file (auto-read by Claude Code)

Entry point: server.js

Why this structure:
Separating app.js from server.js is standard Node.js practice.
It allows app to be imported and tested independently of the
server process. This is the architecture we are building on.
The single-file approach (index.js from MajstorBL_Gem) has been
abandoned in favour of this cleaner structure.

================================================================
SECTION 4 — CURRENT CODE STATE (app.js)
================================================================

CURRENT IMPLEMENTATION STATUS:

- Multi-user sessions (sessions object, keyed by userId) ✅
- Working state machine in GET /next route
- No persistence (data lost on server restart)
- No authentication
- createSession() function — initializes fresh session per user ✅
- classifyBranch() function — keyword-based branch detection ✅
- extractDeviceType() function — auto-detects device from first message ✅
- branch field in session object (DEVICES / INSTALLATIONS / UNKNOWN) ✅
- Branch A (DEVICES) — full data collection flow implemented ✅
- Branch B (INSTALLATIONS) — uses temporary linear flow (next task)
- No webhook integration
- No AI layer

What app.js currently does:

- Express server, GET /next endpoint
- Multi-user sessions object (const sessions = {})
- createSession() helper function for session initialization
- classifyBranch(text) helper function — returns "DEVICES",
  "INSTALLATIONS", or "UNKNOWN" based on BHS keyword matching
- extractDeviceType(text) helper function — returns canonical device
  name (e.g. "veš mašina", "bojler") or null if not recognized.
  "aparat" and "uređaj" intentionally excluded — too generic.
- Branch detection happens in ASK_SERVICE state
- UNKNOWN branch: bot asks user to clarify, stays in ASK_SERVICE
- DEVICES branch: auto-detects device type from first message.
  If detected → skips ASK_DEVICE_TYPE, goes directly to ASK_BRAND.
  If not detected → asks explicitly via ASK_DEVICE_TYPE.

Branch A (DEVICES) state machine — full flow:
  START → ASK_SERVICE → [ASK_DEVICE_TYPE if needed] → ASK_BRAND
  → ASK_MODEL → ASK_DESCRIPTION → ASK_FAULT_PATTERN → ASK_LOCATION
  → ASK_INSTALL_TYPE → ASK_PHOTOS → ASK_CONTACT → CONFIRM_REQUEST → END

Branch B (INSTALLATIONS) state machine — temporary linear flow:
  START → ASK_SERVICE → ASK_BRAND → ASK_MODEL → ASK_DESCRIPTION
  → ASK_LOCATION → ASK_PHOTOS → ASK_CONTACT → CONFIRM_REQUEST → END

- Photo handling: accepts multiple photos, user types "dalje" to proceed
- Confirmation step before final summary (da/ne)
- Branch A summary includes: branch, service, deviceType, brand, model,
  description, faultPattern, location, installType, contact
- Branch B summary includes: branch, service, brand, model,
  description, location, contact (temporary)
- GET /reset endpoint — resets session for specific userId only
- Module export: module.exports = app (correct pattern)

What server.js currently does:

- Imports app from app.js
- Starts server on PORT 3000
- Single responsibility — only server startup logic

================================================================
SECTION 4a — API DESIGN
================================================================

API (current — temporary for browser testing):

  GET /next?userId=...&tekst=...   — sends user message, returns bot response
  GET /reset?userId=...            — resets session for specific userId

Note:
This is a temporary testing interface.
Final system will use POST requests received via Facebook webhook.
The /next endpoint will be replaced by a proper webhook handler.

================================================================
SECTION 4b — SESSION MODEL
================================================================

Current session (implemented — multi-user, keyed by userId): ✅

  const sessions = {}

  sessions[userId] = {
    state:        "START",
    branch:       null,        // "DEVICES" | "INSTALLATIONS" | "UNKNOWN"
    service:      null,
    // DEVICES-only fields
    deviceType:   null,
    faultPattern: null,
    installType:  null,
    // Shared fields
    brand:        null,
    model:        null,
    description:  null,
    location:     null,
    photos:       [],
    contact:      null
  }

This allows multiple users to have independent conversations
simultaneously. userId comes from Facebook sender ID via webhook.

================================================================
SECTION 5 — TWO CONVERSATION BRANCHES (TOP-LEVEL ROUTING)
================================================================

On the first client message, the bot MUST classify the request into
one of two primary branches:

[BRANCH A] DEVICES — repair and maintenance of electrical appliances
[BRANCH B] INSTALLATIONS & INTERVENTIONS — assembly, electrical,
           plumbing, and device installation work

The bot determines the branch from the client's natural language input.
It does NOT present a menu or clickable options — free text input only.

================================================================
SECTION 6 — BRANCH A: DEVICES (Repair & Maintenance)
================================================================

Scope:

- White goods (washing machines, dishwashers, refrigerators, boilers)
- Household electronics
- Computers and peripherals
- Small household appliances

DATA COLLECTION FLOW (in order):

Step 1 — Device Identification
  1a. Device category and type
      (e.g. "washing machine", "boiler", "laptop")
  1b. Brand / Manufacturer
      (e.g. Gorenje, Ariston, Dell, Bosch)
  1c. Model and serial number
      - Instruct client WHERE to find the label:
        back panel, side, or inside the door of the appliance.
      - If label not found: "Please check your purchase receipt."
      - Specific hint based on device type is required.

Step 2 — Problem Diagnosis (Symptoms)
  2a. Fault description — what exactly is happening?
      (e.g. "doesn't heat water", "knocks during spin cycle",
      "won't turn on")
  2b. Fault pattern — is the fault constant or intermittent?

Step 3 — Location and Working Conditions
  3a. Device location in the property
      (e.g. bathroom, kitchen, storage room, attic)
      Note: important for access, humidity, outlet availability.
  3b. Installation type:
      - Built-in (integrated inside kitchen units)
      - Freestanding
      Note: this significantly affects the repair time estimate.

Step 4 — Photos (Visual Confirmation)
  - Request photo of the label and/or the device.
  - Message example: "If you are unsure about the model, please
    send a photo of the label or the full device."
  - Maximum 2 photos accepted.
  - Videos are NOT accepted under any circumstances.

Step 5 — Client Contact Data
  5a. Full name (first and last)
  5b. Address: street name and number
      (GPS location via app is optional)
  5c. Contact phone number (for direct scheduling with technician)

Step 6 — Session Closing Message (Bot)
  "Thank you for providing your information. Your request has been
  forwarded to the on-duty technician. You will be contacted as soon
  as possible to arrange a visit. — Majstor Banjaluka"

================================================================
SECTION 7 — BRANCH B: INSTALLATIONS & INTERVENTIONS
================================================================

Sub-categories within this branch:
  B1. Furniture assembly / disassembly
      (flat-pack furniture, shelving units)
  B2. Electrical installations
      (outlets, switches, lighting fixtures, TV wall mounts)
  B3. Plumbing — external components ONLY
      (fixtures, faucets, valves, hoses, sanitary ware)
  B4. Device installation
      (boilers, electric stoves)

DATA COLLECTION FLOW (in order):

Step 1 — Service and Item Identification
  1a. Service type — which sub-category applies?
  1b. Subject of work — what specific item?
      (e.g. wardrobe, TV mount, faucet, boiler, chandelier)
  1c. Item condition:
      - New / still in original packaging
      - Used (requires disassembly of old item or repair of existing)

Step 2 — Technical Site Conditions
  2a. Wall / ceiling surface type (for wall/ceiling mounting tasks):
      Options: Concrete/Brick, Drywall (gypsum board), Wood, Ytong
  2b. Access to installations:
      - Main water shutoff valve accessible? (for plumbing)
      - Electrical fuse box / distribution panel accessible?
  2c. Work area status:
      Is the location cleared and ready for work?

Step 3 — Conditional Parameters (based on sub-category)

  [B1 — Furniture only]
  3a. Assembly instructions: Does the client have the manual? (Yes/No)
  3b. Approximate dimensions: Width x Height x Depth

  [B4 — Devices only]
  3c. Technical specifications:
      - Screen diagonal (for TVs)
      - Volume / capacity in liters (for boilers)
      - Power / wattage (for specific lighting installations)

Step 4 — Logistics and Site Access
  4a. Floor level and elevator availability (important for tools)
  4b. Parking — secured or available nearby?

Step 5 — Photos (Optional but Recommended)
  - Up to 2 photos of current state or installation site.
  - Videos are NOT accepted under any circumstances.

Step 6 — Client Contact Data
  6a. Full name (first and last)
  6b. Address: street name and number
  6c. Contact phone number

Step 7 — Session Closing Message (Bot)
  Same closing message as Branch A.

================================================================
SECTION 8 — SESSION TERMINATION RULES
================================================================

The bot ends the conversation EARLY (with a polite thank-you) in
the following cases:

T1. The client's request is outside the scope of services offered.

T2. The client's questions suggest they are seeking DIY repair
    advice or intend to fix the device themselves.

T3. The client refuses to provide a contact phone number.

T4. The client expresses a preference for a direct phone call
    at the START of the conversation (before data collection).
    In this case:
      - Thank the client.
      - Inform them the technician will call them.
      - Ask for their phone number.
      - Ask which communication app they prefer:
        Viber, Facebook Messenger, WhatsApp, or other.
      - End the session after collecting this information.

================================================================
SECTION 9 — STRICT OPERATIONAL RULES (ALWAYS APPLY)
================================================================

RULE 1 — NO DIY ADVICE
  The bot never provides instructions, tips, or guidance for
  self-repair or DIY troubleshooting.

RULE 2 — FREE TEXT ONLY
  The bot never presents clickable options, menus, or predefined
  choices for the client to select from.
  All input is free-form natural language.

RULE 3 — PHOTOS ONLY, MAX 2
  The bot never requests or accepts video recordings.
  Only photos are accepted, with a maximum of 2 per session.

RULE 4 — NO PRICING / PRICE LIST
  The bot never provides a full price list for services or parts.
  Standard response on pricing:
  "The final price can only be determined after an on-site visit
  and accurate fault diagnosis."
  EXCEPTION: The bot MAY provide approximate prices for a specific
  list of standard services (to be defined separately).

RULE 5 — NO APPOINTMENT SCHEDULING
  The bot never confirms, books, or suggests a specific date and
  time for a technician visit.

RULE 6 — ON-SITE SERVICE ONLY
  If asked about the service location or workshop address:
  "Our technicians work exclusively on-site at the client's address."

================================================================
SECTION 10 — TECH STACK
================================================================

Runtime:      Node.js
Framework:    Express.js
Dev tool:     Nodemon
Version ctrl: Git (local) + GitHub (remote)
Hosting:      Render.com (auto-deploy from GitHub)
AI layer:     Provider-agnostic adapter pattern
                Dev/test phase:  Google Gemini Flash (free tier)
                Production phase: Gemini / Claude / GPT — TBD
                Switching provider requires changes in ONE file only.
Future DB:    Google Sheets for lead logging
Bot channel:  Facebook Messenger (Meta Messenger API)
Language:     BHS for all client-facing communication
              English for code, docs, and AI prompts

================================================================
SECTION 11 — DEVELOPMENT DECISIONS
================================================================

1. NO ngrok — webhook tested after deploy to Render, not locally
2. Render chosen over Railway — better uptime (critical for webhooks)
3. Deployment flow: Local → git commit → GitHub push → auto-deploy
4. Free-text only — no button menus, no predefined options
5. AI role: classify intent + extract data from natural language
   (e.g. "My Gorenje washer is leaking" → brand and category detected)
6. "Transport First, Intelligence Second" — stable webhook first,
   AI layer second
7. Port 3000 is active
8. MajstorBL_Gem project (index.js — single file, Gemini AI session)
   has been reviewed and abandoned in favour of MajstorBL_GPT
   architecture (app.js + server.js)
9. Meta App Review required for production:
   → Functional bot + Privacy Policy URL + video demonstration

Future vision (post-MVP):

- Multi-channel: Instagram, WhatsApp, Viber
- Bot-as-a-Service for other local businesses (SaaS model)

================================================================
SECTION 12 — ROADMAP
================================================================

[1]  Multi-user sessions (Map by sender ID)                     ✅ DONE
[2a] classifyBranch() — detect DEVICES / INSTALLATIONS / UNKNOWN ✅ DONE
[2b] Branch A flow — DEVICES (full data collection)             ✅ DONE
[2b+] UX improvement — extractDeviceType() auto-detection       ✅ DONE
[2c] Branch B flow — INSTALLATIONS (full data collection)       ← NEXT TASK
[3]  FB Messenger webhook integration                           ← after [2c]
[4]  AI layer (adapter pattern: Gemini / Claude / GPT)          ← after [3]
[5]  Send summary to technician (email)                         ← after [4]
[6]  Google Sheets integration (lead logging)                   ← after [5]
[7]  Deploy to Render                                           ← after [6]

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
- Entry point for logic:  app.js
- Entry point for server: server.js

================================================================
END OF DOCUMENT
================================================================
