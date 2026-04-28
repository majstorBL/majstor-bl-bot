================================================================
MAJSTOR BANJALUKA — CHATBOT PROJECT
Master Context Document for Claude Code
Combines: MAJSTOR_BL_KONTEKST_EN + MAJSTOR_BL_BOT_LOGIC_SUMMARY_EN
Last updated: April 2026 (POST Task 3a — Webhook Foundation)
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

================================================================
SECTION 4 — CURRENT CODE STATE (app.js)
================================================================

CURRENT IMPLEMENTATION STATUS:

- Multi-user sessions (sessions object, keyed by userId) ✅
- normalizeText() — trims, lowercases, handles null/undefined ✅
- Empty input blocked (except START state) ✅
- createSession() function — initializes fresh session per user ✅
- classifyBranch() function — keyword-based branch detection ✅
- extractDeviceType() function — auto-detects device from first message ✅
- isFurniture() function — controls conditional ASK_DIMENSIONS state ✅
- branch field in session (DEVICES / INSTALLATIONS / UNKNOWN) ✅
- Branch A (DEVICES) — full data collection flow ✅
- Branch B (INSTALLATIONS) — full data collection flow ✅
- "dalje" is case-insensitive and trimmed (via normalizeText) ✅
- Max 2 photos enforced with user-facing message ✅
- Webhook foundation implemented (GET/POST /webhook) ✅
- No Messenger reply logic yet
- No AI layer yet

What app.js currently does:

- Express server with multiple endpoints
- normalizeText(text) — safe input normalization used everywhere
- createSession() — initializes fresh session per user
- classifyBranch(text) — returns "DEVICES", "INSTALLATIONS", "UNKNOWN"
- extractDeviceType(text) — returns canonical device name or null.
  "aparat" and "uređaj" intentionally excluded — too generic.
  If detected → skips ASK_DEVICE_TYPE, goes directly to ASK_BRAND.
- isFurniture(text) — returns true if installationType is furniture

- GET /webhook — Meta verification endpoint (hub.challenge response)
  VERIFY_TOKEN read from process.env.META_VERIFY_TOKEN
  Fallback: "majstor_bl_verify_token" (for local testing only)
- POST /webhook — receives Messenger events, logs payload, returns 200

Branch A (DEVICES) state machine:
  START → ASK_SERVICE
  → (auto-detect OR ASK_DEVICE_TYPE)
  → ASK_BRAND → ASK_MODEL → ASK_DESCRIPTION → ASK_FAULT_PATTERN
  → ASK_LOCATION → ASK_INSTALL_TYPE → ASK_PHOTOS
  → ASK_CONTACT → CONFIRM_REQUEST → END

Branch B (INSTALLATIONS) state machine:
  START → ASK_SERVICE → ASK_INSTALLATION_TYPE → ASK_ITEM_NAME
  → ASK_ITEM_CONDITION → ASK_WALL_TYPE → ASK_ACCESS → ASK_WORK_READY
  → (ASK_DIMENSIONS if furniture) → ASK_LOCATION → ASK_FLOOR
  → ASK_PARKING → ASK_PHOTOS → ASK_CONTACT → CONFIRM_REQUEST → END

- Photo handling: normalizeText("dalje") to proceed, max 2 enforced
- Confirmation step before final summary
- Branch A and Branch B have separate summaries
- GET /reset — resets session for specific userId only
- Module export: module.exports = app (correct pattern)

What server.js currently does:

- Imports app from app.js
- Starts server on PORT 3000
- Single responsibility — only server startup logic

================================================================
SECTION 4a — API DESIGN
================================================================

API (current):

  GET /webhook                    — Meta webhook verification endpoint
  POST /webhook                   — incoming Messenger events (log only)
  GET /next?userId=...&tekst=...  — sends user message (browser testing)
  GET /reset?userId=...           — resets session for specific userId

Note:
GET /next and GET /reset are temporary browser testing endpoints.
Final message handling will go through POST /webhook.

================================================================
SECTION 4b — SESSION MODEL
================================================================

Current session (implemented — multi-user, keyed by userId): ✅

  const sessions = {}

  sessions[userId] = {
    state:           "START",
    branch:          null,   // "DEVICES" | "INSTALLATIONS" | "UNKNOWN"
    service:         null,
    // DEVICES-only fields
    deviceType:      null,
    faultPattern:    null,
    installType:     null,
    // INSTALLATIONS-only fields
    installationType: null,
    itemName:        null,
    itemCondition:   null,
    wallType:        null,
    accessInfo:      null,
    workReady:       null,
    dimensions:      null,
    floorInfo:       null,
    parkingInfo:     null,
    // Shared fields
    brand:           null,
    model:           null,
    description:     null,
    location:        null,
    photos:          [],
    contact:         null
  }

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
  1b. Brand / Manufacturer
  1c. Model and serial number
      - Instruct client WHERE to find the label:
        back panel, side, or inside the door of the appliance.
      - If label not found: "Please check your purchase receipt."

Step 2 — Problem Diagnosis
  2a. Fault description — what exactly is happening?
  2b. Fault pattern — constant or intermittent?

Step 3 — Location and Working Conditions
  3a. Device location in the property
  3b. Installation type: Built-in or Freestanding?

Step 4 — Photos (max 2, no videos)

Step 5 — Client Contact Data
  5a. Full name
  5b. Address
  5c. Phone number

Step 6 — Closing message + summary to technician

================================================================
SECTION 7 — BRANCH B: INSTALLATIONS & INTERVENTIONS
================================================================

Sub-categories:
  B1. Furniture assembly/disassembly
  B2. Electrical installations (outlets, switches, lighting, TV mounts)
  B3. Plumbing — external components ONLY
  B4. Device installation (boilers, electric stoves)

DATA COLLECTION FLOW (in order):

Step 1 — Service and Item Identification
  1a. Service type (which sub-category)
  1b. Subject of work (specific item)
  1c. Item condition: new or used?

Step 2 — Technical Site Conditions
  2a. Wall/ceiling surface type (concrete, drywall, wood, ytong)
  2b. Access to installations (water valve / fuse box)
  2c. Work area: cleared and ready?

Step 3 — Conditional Parameters
  [B1 Furniture only]
  3a. Assembly instructions available? (Yes/No)
  3b. Dimensions: Width x Height x Depth

Step 4 — Logistics
  4a. Floor level and elevator availability
  4b. Parking availability

Step 5 — Photos (optional, max 2, no videos)

Step 6 — Client Contact Data
  6a. Full name
  6b. Address
  6c. Phone number

Step 7 — Closing message + summary to technician

================================================================
SECTION 8 — SESSION TERMINATION RULES
================================================================

The bot ends the conversation EARLY (polite thank-you) when:

T1. Request is outside scope of services.
T2. Client seeks DIY repair advice.
T3. Client refuses to provide phone number.
T4. Client requests a direct call at START:
    → Thank them, say technician will call.
    → Collect phone number.
    → Ask preferred app: Viber / FB Messenger / WhatsApp.
    → End session.

================================================================
SECTION 9 — STRICT OPERATIONAL RULES (ALWAYS APPLY)
================================================================

RULE 1 — NO DIY ADVICE
  Never provide self-repair instructions or troubleshooting tips.

RULE 2 — FREE TEXT ONLY
  Never present clickable options, menus, or predefined choices.
  All input is free-form natural language.

RULE 3 — PHOTOS ONLY, MAX 2
  Never request or accept video recordings.
  Only photos accepted, maximum 2 per session.

RULE 4 — NO PRICING
  Never provide a full price list.
  Standard response: "Final price determined only after on-site visit."
  EXCEPTION: Approximate prices for specific standard services (TBD).

RULE 5 — NO APPOINTMENT SCHEDULING
  Never confirm, book, or suggest a specific date/time for a visit.

RULE 6 — ON-SITE SERVICE ONLY
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

Environment variables:
  META_VERIFY_TOKEN   — webhook verification token (set in Render)
  PAGE_ACCESS_TOKEN   — Meta page token for sending messages (next task)

================================================================
SECTION 11 — DEVELOPMENT DECISIONS
================================================================

1. NO ngrok — webhook tested after deploy to Render, not locally
2. Render chosen over Railway — better uptime (critical for webhooks)
3. Deployment flow: Local → git commit → GitHub push → auto-deploy
4. Free-text only — no button menus, no predefined options
5. AI role: classify intent + extract data from natural language
6. "Transport First, Intelligence Second" — stable webhook first
7. Port 3000 is active
8. VERIFY_TOKEN stored as environment variable — never hardcoded
9. Meta App Review required for production:
   → Functional bot + Privacy Policy URL + video demonstration

Future vision (post-MVP):
- Multi-channel: Instagram, WhatsApp, Viber
- Bot-as-a-Service for other local businesses (SaaS model)

================================================================
SECTION 12 — ROADMAP
================================================================

[1]   Multi-user sessions (Map by sender ID)                    ✅ DONE
[2a]  classifyBranch() — DEVICES / INSTALLATIONS / UNKNOWN      ✅ DONE
[2b]  Branch A flow — DEVICES (full data collection)            ✅ DONE
[2b+] extractDeviceType() — UX auto-detection                   ✅ DONE
[2c]  Branch B flow — INSTALLATIONS (full data collection)      ✅ DONE
[2d]  Stabilization — normalizeText, validation, UX fixes       ✅ DONE
[3a]  Webhook foundation (GET/POST /webhook)                    ✅ DONE
[3b]  Deploy to Render (public HTTPS endpoint)                  ← NEXT TASK
[3c]  Connect webhook in Meta Developers Console                ← after [3b]
[4]   AI layer (adapter pattern: Gemini / Claude / GPT)         ← after [3c]
[5]   Send summary to technician (email)                        ← after [4]
[6]   Google Sheets integration (lead logging)                  ← after [5]
[7]   Messenger reply logic (bot sends messages via API)        ← after [3c]

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
