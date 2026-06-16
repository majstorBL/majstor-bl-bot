================================================================
MAJSTOR BANJA LUKA / AKiPP — CHATBOT + LEAD INTAKE SYSTEM
Master Context Document for Claude Code
Last updated: June 2026 (Task [7a] Channel Adapter Foundation ✅ DONE)
              (Task [7a-hotfix] Restore Messenger reset ✅ DONE)
              (Task [6g] Android Messenger Quick Reply "Dalje" fix ✅ DONE)
              (Task [5]  Email Notification ✅ DONE / PRODUCTION VERIFIED)
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

Do NOT update CLAUDE.md unless explicitly instructed.
After implementation and tests, only report what should be documented.
CLAUDE.md updates are reviewed separately to avoid documentation drift.

Each new technical task must be done in a new chat/session with narrow scope.
Do not combine code refactor, new channel, AI layer, and documentation
in the same task.

================================================================
SECTION 1 — BUSINESS OVERVIEW
================================================================

Business Name: Majstor Banjaluka
Location:      Banja Luka, Bosnia and Herzegovina
Services:
  - Household appliance repair (white goods, boilers, washing machines,
    small appliances, computers/electronics)
  - Furniture assembly/disassembly
  - Electrical installations (outlets, switches, lighting, TV mounts)
  - Plumbing — external components only
    (fixtures, faucets, valves, hoses, vodokotlici)
  - Device installation (boilers, electric stoves, cooktops, range hoods)

Current production channel:   Facebook Messenger
Strategic product direction:  AKiPP — channel-agnostic communication and
                               data collection system
Next planned real channel:    Web/Internal channel MVP

================================================================
SECTION 2 — PROJECT GOAL
================================================================

Build a channel-agnostic AKiPP lead intake system that currently runs
through Facebook Messenger and will be extended to additional channels.

The bot / intake system does NOT repair, advise, price, or schedule.

Core intake flow (channel-independent):
  - User sends a message through any supported channel
  - Bot identifies the type of request (repair vs. installation)
  - Bot guides the user through a structured conversation
  - Bot collects all relevant data
  - Bot receives photos where the channel supports it
  - Bot delivers a clean summary to the technician / business owner
  - Bot informs the user they will be contacted

================================================================
SECTION 3 — SYSTEM ARCHITECTURE
================================================================

Current production flow (Messenger):

  Client -> FB Messenger -> POST /webhook
  -> Messenger receive handling
  -> handleIncomingText({ channel: "messenger", userId, text })
  -> processMessage(sessionKey, text)
  -> Messenger send handling
  -> Client

Completed request:

  processMessage()
  -> buildTechnicianEmail()
  -> sendSummaryEmail()
  -> Brevo HTTP API
  -> Gmail / technician inbox

AKiPP target architecture:

  Client
  -> Channel Transport Adapter
     - messenger adapter    [LIVE]
     - web/internal adapter [NEXT -- Task 7b/7c]
     - future: Viber / WhatsApp / Instagram
  -> handleIncomingText({ channel, userId, text })
  -> processMessage(sessionKey, text)
  -> Channel Transport Adapter reply
  -> Client

Key principles:
  "Transport First, Intelligence Later."
  AI layer remains future work -- not the next step.
  The next practical goal is Web/Internal channel MVP.
  processMessage() is transport-agnostic and does not know about
  Messenger payloads or Send API details. It reads/writes the
  in-memory sessions{} store through the sessionKey -- not a fully
  pure reducer in the academic sense, but acceptable for MVP.

Current file structure (active project folder: MajstorBL_GPT):

  src/app.js        -- Express app, all route logic, session state,
                       processMessage(), sendMessengerReply(),
                       buildTechnicianEmail(), sendSummaryEmail(),
                       buildSessionKey(), handleIncomingText()
  src/server.js     -- Only starts the server, imports app from app.js
  package.json      -- Project config (no nodemailer -- uses native fetch)
  CLAUDE.md         -- This file (auto-read by Claude Code)

Test files (root of project -- keep in repo, never delete):
  test-email-builder.js                 -- email builder unit tests (14)
  test-installations-keywords.js        -- original regression suite (39)
  test-installations-keywords-v2.js     -- Messenger bug regression (14)
  test-installations-keywords-master.js -- master keyword matrix (79)
  test-devices-flow-polish.js           -- DEVICES polish suite (28)
  test-continue-answer-quickreply.js    -- Quick Reply "Dalje" suite (27)
  test-channel-adapter.js               -- Channel adapter suite (11)

Entry point: src/server.js  (package.json -> "start": "node src/server.js")
Deployed at: Render.com (auto-deploy from GitHub)

Git log (latest known):
  7eacabf  Restore Messenger reset after channel adapter  <- latest known HEAD
  ac8d210  Add channel adapter foundation (Task 7a)
  55f9a73  Replace Gmail SMTP with Brevo HTTP Email API
  90a5cc1  Polish DEVICES flow and add regression suite
  931284b  INSTALLATIONS v2 final keyword matrix fix

================================================================
SECTION 4 -- AKiPP DIRECTION
================================================================

AKiPP -- Automatizacija Komunikacije i Prikupljanja Podataka
         (Automation of Communication and Data Collection)

Purpose:
  - Accept messages from different channels
  - Run the same structured intake conversation flow
  - Collect service request data
  - Collect photos where the channel supports it
  - Collect contact information
  - Send a clean summary to the business owner / technician

Current channel:
  Facebook Messenger [LIVE]

Next planned channel:
  Web/Internal channel MVP

NOT next:
  - AI layer
  - WhatsApp
  - Viber
  - Instagram
  - Google Sheets / CRM logging (optional, not prioritised)

Meta App Review status: PAUSED, not abandoned.
  Reason: Meta account restriction (advertising/business restriction
  from 2020) and lack of registered business documentation required
  for Meta Business Verification at this stage.
  Resume condition: restriction cleared AND/OR business registration
  available.
  Privacy Policy draft (privacy-policy.html) is preserved for when
  this is resumed. Do not delete it.

Messenger bot remains:
  - active production proof of concept
  - first and currently only live channel
  - stable transport that is already working
  - foundation for the AKiPP multi-channel architecture

================================================================
SECTION 5 -- CURRENT CODE STATE (src/app.js)
================================================================

CORE / SHARED:

- buildSessionKey(channel, userId) [7a]
  Pure helper. Returns "channel:userId" (e.g. "messenger:12345",
  "test:user1"). No side effects. Exported via module.exports.

- handleIncomingText({ channel, userId, text }) [7a]
  Channel-agnostic entry wrapper. Builds the session key via
  buildSessionKey() and calls processMessage(sessionKey, text),
  returning the same reply string. Used by POST /webhook (channel
  "messenger") and GET /next (channel "test"). No behavior change.
  Exported via module.exports.

- Sessions keyed as "channel:userId" [7a]:
    messenger:<senderId>  -- Messenger text AND photo attachments
    test:<userId>         -- GET /next and GET /reset (browser testing)
  NOTE: switching Messenger key from raw senderId to
  "messenger:<senderId>" resets active in-memory sessions on next
  deploy. Harmless -- sessions are in-memory only and reset on every
  Render restart/deploy.

- /reset behavior [7a-hotfix]:
    /reset?userId=<id>                    -> resets test:<id> AND
                                             messenger:<id>
    /reset?userId=<id>&channel=test       -> resets only test:<id>
    /reset?userId=<id>&channel=messenger  -> resets only messenger:<id>
  Restores manual Messenger smoke-testing after channel adapter
  introduced "channel:userId" keys.

- multi-user sessions (sessions{})
- normalizeText() -- trims, lowercases, null-safe
- isContinueAnswer(text) [6g]
  Normalizes text, strips emoji/symbol/punctuation, returns true only
  when the cleaned text equals "dalje". Accepts "Dalje", "DALJE",
  "-> Dalje", "dalje.", "dalje!" etc. Used at ASK_PHOTOS,
  ASK_LOCATION and ASK_NAME. No Unicode property escapes -- safe on
  current Node runtime. Exported via module.exports.
- Empty input blocked (except START and END states)
- createSession() -- initializes fresh session per user
  Includes summaryNotes: [] and emailSent: false.
- classifyBranch() -- keyword-based branch detection
  Two DEVICES priority guards:
  (a) appliance phrase + fault phrase (osigurac case) -- runs FIRST
  (b) [4d-UX] device fault guard -- runs AFTER installationIntent
      pre-check, so explicit install verbs still win.
  KNOWN TECHNICAL DEBT: generic "aparat" and "uredaj" may cause
  false DEVICES classification. Low priority -- future cleanup.
- handleAskService() -- shared START + ASK_SERVICE routing
  Detects greeting-only and contact-intent phrases.
  Runs out-of-scope checks BEFORE classifyBranch().
- processMessage(sessionKey, text) -- core state machine
  Transport-agnostic. Used by GET /next and POST /webhook.
- sendMessengerReply() -- sends text via Facebook Send API
- sendMessengerQuickReply() -- sends Quick Reply buttons
  Used ONLY on ASK_PHOTOS step in both branches.
- Webhook GET /webhook -- Meta verification
- Webhook POST /webhook -- Messenger events + attachment handling
  res.status(200) sent AFTER forEach (prevents proxy close bug).
  Image attachments stored in session.photos[] (max 2).
  Non-image attachments rejected with message.
  Quick Reply payload treated as plain text.

EMAIL NOTIFICATION (Task [5]) DONE / PRODUCTION VERIFIED:

- buildTechnicianEmail(session) -- pure function, returns {subject, text}
  Exported via module.exports for isolated unit testing.
  Subject: "[NOVI ZAHTJEV] BRANCH -- detail -- location"
  Body: three sections:
    --- PODACI O ZAHTJEVU ---
    --- KONTAKT ---
    --- FOTOGRAFIJE ---
  Guard: Array.isArray(session.summaryNotes) for old sessions.
  Does not touch network or session state.

- sendSummaryEmail(session) -- async, NON-BLOCKING, SAFE, IDEMPOTENT
  Called without await -- never delays user-facing reply.
  Skips silently if env vars missing.
  Uses Node built-in fetch().
  POSTs to https://api.brevo.com/v3/smtp/email (HTTPS port 443).
  Sets session.emailSent = true only after response.ok.
  Never throws -- all errors caught locally, never surface to user.

- Email transport: Brevo HTTP API
  SMTP abandoned: IPv6 ENETUNREACH on Render ports 465/587.
  DNS ipv4first workaround still timed out.
  Brevo HTTP API over HTTPS 443 reliable on Render.
  Transport isolated in sendSummaryEmail() -- swappable without
  touching flow logic.

DEVICES BRANCH (Branch A) -- v2 + [4d-UX] polish DONE / STABLE:

- extractDeviceType() -- auto-detects device from first message
  Ordering: sudomasina -> susilica -> ves masina (prevents order bugs).
  Covers frizder/frizider, skrinja, susilica/susilica vesa,
  printer/stampac, sparet, loptop, indukciona ploca, elektricna ploca.
- shouldAskDeviceInstallType(deviceType) [4d-UX]
  Returns true ONLY for: sudomasina, ves masina, susilica, frizider,
  zamrzivac, sporet, elektricna ploca, indukciona ploca, bojler.
  For racunar, laptop, monitor, TV, printer -- returns false.
- devicesPhotoPrompt() [4d-UX]
- getDeviceInstrumental() -- BHS instrumental forms
- getModelHint() -- device-specific label location hints
- model "nepoznat" fallback
- phoneRefusedOnce flag -- one retry before session closes
- Room/location question REMOVED from DEVICES flow [4d-UX]
- DEVICES summary: installType shown only when present

DEVICES v2 state machine (STABLE -- do NOT change without instruction):
  START -> ASK_SERVICE (via handleAskService)
        -> (auto-detect device OR ASK_DEVICE_TYPE)
        -> ASK_BRAND -> ASK_MODEL -> ASK_DESCRIPTION
        -> ASK_FAULT_PATTERN
        -> (ASK_INSTALL_TYPE only if shouldAskDeviceInstallType() true)
        -> ASK_PHOTOS
        -> ASK_CONFIRMATION -> ASK_PHONE -> ASK_LOCATION
        -> ASK_NAME -> END + summary + sendSummaryEmail()

INSTALLATIONS BRANCH (Branch B) -- v2 DONE / STABLE:

Helper functions (all implemented and tested):
  - extractInstallationType() -- detects B1/B2/B3/B4 sub-category
  - extractInstallationItem() -- detects canonical item name
  - detectMountingMode() -- wall/ceiling/freestanding/unknown
  - detectOutOfScopePlumbing() -- nuanced, local endpoint guard
  - detectOutOfScopeElectrical() -- nuanced, local endpoint guard
  - detectDemolition() -- broad backwards-compatible detector
  - detectDemolitionRequested() -- nuanced, regex BHS word-order
  - detectAlreadyRemovedOrReady() -- false demolition tag protection
  - addBhsNote(session, bhsText) -- clean BHS-only summary notes
    Deduplicates. NEVER store English debug strings in summaryNotes.
  - sessionHasDemolitionRequestNote()
  - isNegativeWorkReadyAnswer() -- triggers ASK_DEMOLITION_FOLLOWUP
  - shouldAskStandaloneOrBuiltIn() -- B4 device type question
  - buildAccessQuestionForInstallations() -- item-specific wording
  - continueInstallationsFlow(session, fromState) -- central dispatcher
  - nextAfterRecognitionInstallations(session) -- initial router
  - installationsPhotoPrompt()
  - ASK_HAS_PART intentionally DISABLED in active v2 flow

INSTALLATIONS v2 state machine (STABLE -- do NOT change without instruction):
  START -> ASK_SERVICE (via handleAskService)
        -> (auto-detect type+item OR ASK_INSTALLATION_TYPE)
        -> (ASK_ITEM_NAME if B1/B4 and item unknown)

  B1 path:
        -> (skip ASK_WORK_READY if demolition already noted)
        -> ASK_WORK_READY -> (ASK_DEMOLITION_FOLLOWUP if "ne")
        -> (ASK_WALL_TYPE if mountingMode=wall/ceiling)
        -> ASK_DIMENSIONS -> ASK_PHOTOS

  B2/B3 path:
        -> ASK_PROBLEM_DESCRIPTION -> ASK_ACCESS -> ASK_PHOTOS

  B4 path:
        -> (skip ASK_WORK_READY if demolition already noted)
        -> ASK_WORK_READY -> (ASK_DEMOLITION_FOLLOWUP if "ne")
        -> (ASK_STANDALONE_OR_BUILTIN if relevant device)
        -> ASK_ACCESS
        -> (ASK_WALL_TYPE if mountingMode=wall/ceiling)
        -> ASK_BRAND -> ASK_MODEL
        -> (ASK_DIMENSIONS if wall-mounted)
        -> ASK_PHOTOS

  All paths converge:
        -> ASK_CONFIRMATION -> ASK_PHONE -> ASK_LOCATION
        -> ASK_NAME -> END + summary + sendSummaryEmail()

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
  summaryNotes[]   -- clean BHS notes for summary/email
  emailSent: false -- prevents duplicate email sends
  // contact: legacy field -- retained for compatibility, unused in v2

================================================================
SECTION 6 -- QA / REGRESSION SUITES
================================================================

All test files live in the project root (not in src/).
Exception: test-email-builder.js and test-channel-adapter.js are
pure unit tests -- no server needed.
All other test files require the server running in a second terminal.

  test-email-builder.js                 -- 14 tests -- 14/14 PASS
  test-installations-keywords.js        -- 39 tests -- 39/39 PASS
  test-installations-keywords-v2.js     -- 14 tests -- 14/14 PASS
  test-installations-keywords-master.js -- 79 tests -- 79/79 PASS
  test-devices-flow-polish.js           -- 28 tests -- 28/28 PASS
  test-continue-answer-quickreply.js    -- 27 tests -- 27/27 PASS
  test-channel-adapter.js               -- 11 tests -- 11/11 PASS
  TOTAL:                                   212 tests -- 212/212 PASS

test-continue-answer-quickreply.js has two parts:
  Part A -- unit tests isContinueAnswer() without server
  Part B -- HTTP flow tests that require the server

MANDATORY -- run ALL before any commit:
  node --check src/app.js
  node test-email-builder.js
  node test-installations-keywords.js
  node test-installations-keywords-v2.js
  node test-installations-keywords-master.js
  node test-devices-flow-polish.js
  node test-continue-answer-quickreply.js
  node test-channel-adapter.js

Do NOT delete any test files. They are the regression safety net.

================================================================
SECTION 7 -- API / ENDPOINTS
================================================================

  GET  /webhook                        -- Meta webhook verification
  POST /webhook                        -- Messenger events + reply
  GET  /next?userId=...&tekst=...      -- browser testing endpoint
  GET  /reset?userId=...               -- resets test + messenger sessions
  GET  /reset?userId=...&channel=...   -- resets only that channel session

GET /next and GET /reset are temporary testing endpoints.
Core production flow runs through POST /webhook only.

module.exports exposes for testing:
  module.exports.buildTechnicianEmail  -- pure function
  module.exports.createSession         -- session factory
  module.exports.isContinueAnswer      -- Quick Reply "Dalje" detector
  module.exports.buildSessionKey       -- channel-aware session key
  module.exports.handleIncomingText    -- channel-agnostic entry wrapper

================================================================
SECTION 8 -- TOP-LEVEL ROUTING
================================================================

On the first client message, handleAskService() classifies:

  [BRANCH A] DEVICES      -- repair and maintenance of electrical appliances
  [BRANCH B] INSTALLATIONS -- assembly, electrical, plumbing, device install
  [OUT-OF-SCOPE]           -- polite decline, session ends

ROUTING ORDER in handleAskService():
  1. Greeting / contact-intent check -> "Kako Vam mozemo pomoci?"
  2. detectOutOfScopePlumbing()       -> decline + END
  3. detectOutOfScopeElectrical()     -> decline + END
  4. classifyBranch()                 -> DEVICES / INSTALLATIONS / UNKNOWN
  5. DEVICES: extractDeviceType()     -> route to flow
  6. INSTALLATIONS: detectDemolitionRequested() -> addBhsNote()
                    extractInstallationType()   -> set installationType
                    extractInstallationItem()   -> set itemName + mountingMode
                    -> nextAfterRecognitionInstallations()

DEVICES priority guards in classifyBranch() (two guards, in order):
  Guard 1: appliance phrase + fault phrase (e.g. osigurac case)
           -> forced DEVICES BEFORE installationIntent pre-check.
  Guard 2: [4d-UX] device fault guard (device phrase + fault symptom)
           -> runs AFTER installationIntent pre-check; install verbs still win.
  Pure electrical fault (no appliance) -> INSTALLATIONS (B2).

================================================================
SECTION 9 -- BRANCH A: DEVICES
================================================================

Scope: white goods, boilers, electronics, computers, small appliances.
TERMINOLOGY: always "serviser" or "tehnicar" -- NEVER "majstor".

DATA COLLECTION (in order):
   1. Device type -- auto-detected or ASK_DEVICE_TYPE
   2. Brand -- ASK_BRAND
   3. Model -- ASK_MODEL (device hint, "nepoznat" fallback)
   4. Fault description -- ASK_DESCRIPTION
   5. Fault pattern (constant/intermittent) -- ASK_FAULT_PATTERN
   6. Install type -- ASK_INSTALL_TYPE
      Only if shouldAskDeviceInstallType() = true.
   7. Photos (optional, Quick Reply, max 2) -- ASK_PHOTOS
   8. Confirmation -- ASK_CONFIRMATION
   9. Phone (mandatory, one retry) -- ASK_PHONE
  10. Address/neighborhood (optional) -- ASK_LOCATION
  11. Name (optional) -- ASK_NAME -> END + summary + email

================================================================
SECTION 10 -- BRANCH B: INSTALLATIONS
================================================================

Sub-categories:
  B1 -- Furniture assembly/disassembly, wall-mount items
  B2 -- Minor electrical: outlets, switches, lighting, fuses
  B3 -- Minor plumbing: faucets, siphons, valves, hoses, vodokotlici,
        WC solje, bidet, tus kada, tus baterija, tus kabina, lavabo
  B4 -- Device installation: boiler, sporet, ploca, napa, masina,
        sudomasina, klima, zamrzivac, frizider

TERMINOLOGY: always "majstor" -- NEVER "serviser" or "tehnicar".

KEY DISTINCTION DEVICES vs INSTALLATIONS:
  "ne radi / kvar / popravka / greska"               -> DEVICES
  "ugradnja / montaza / zamjena / prikljucenje / kupio sam" -> INSTALLATIONS

================================================================
SECTION 11 -- SESSION TERMINATION RULES
================================================================

T1. Request outside scope of services.
T2. Client seeks DIY repair advice.
T3. Client refuses phone number after one retry with explanation.
T4. Client requests direct call at START:
    CURRENT STATUS: not implemented as a separate phone-only flow.
    Current behavior: contact-intent messages are treated as a
    greeting/help intent.
    Future option: collect phone + preferred app and end session,
    but only if explicitly implemented in a future task.
T5. Client answers negatively to ASK_CONFIRMATION:
    -> "U redu. Hvala Vam sto ste nas kontaktirali."
    -> End session. (No email sent.)

================================================================
SECTION 12 -- STRICT OPERATIONAL RULES
================================================================

RULE 1  -- NO DIY ADVICE
RULE 2  -- FREE TEXT ONLY (exception: Quick Reply "Dalje" on ASK_PHOTOS)
RULE 3  -- PHOTOS ONLY, MAX 2 -- never request/accept video
RULE 4  -- NO PRICING
          "Cijena se odredjuje tek nakon izlaska na teren."
RULE 5  -- NO APPOINTMENT SCHEDULING
RULE 6  -- ON-SITE SERVICE ONLY
RULE 7  -- NO "ZABILJEZENО" PATTERN -- confirmations must be natural
RULE 8  -- TERMINOLOGY
          DEVICES: serviser/tehnicar; INSTALLATIONS: majstor
RULE 9  -- NO REPEATED QUESTIONS
RULE 10 -- SKIP KNOWN DATA -- use what the first message already gave
RULE 11 -- CLEAN SUMMARY NOTES
          summaryNotes[] BHS only -- never English debug labels

================================================================
SECTION 13 -- TECH STACK
================================================================

Runtime:       Node.js
Framework:     Express.js
HTTP (FB):     Node.js built-in https (Facebook Send API)
HTTP (email):  Node.js built-in fetch() (Brevo Email API)
Dev tool:      Nodemon
Version ctrl:  Git (local) + GitHub (remote)
Hosting:       Render.com (auto-deploy from GitHub) LIVE
Email:         Brevo HTTP API
               (POST https://api.brevo.com/v3/smtp/email)
               nodemailer: ABANDONED -- SMTP unreliable on Render
               (IPv6 ENETUNREACH on ports 465/587;
                STARTTLS/IPv4fix also timed out)
AI layer:      NOT YET IMPLEMENTED
               Provider-agnostic adapter pattern designed, not built.
               Dev/test:   Google Gemini Flash (free tier)
               Production: Gemini / Claude / GPT -- TBD
               Target design goal: future provider switch should be
               isolated behind one adapter boundary.
Future DB:     Google Sheets lead logging (optional -- not prioritised)
Bot channel:   Facebook Messenger (Meta Messenger API) LIVE
Language:      BHS for all client-facing communication
               English for code, docs, and AI prompts

Environment variables (Render dashboard -- current active set):
  META_VERIFY_TOKEN  -- webhook verification token
  PAGE_ACCESS_TOKEN  -- Meta page token for Send API
  BREVO_API_KEY      -- Brevo email API key
  EMAIL_FROM         -- sender address (majstor.banjaluka@gmail.com)
  EMAIL_TO           -- technician's address
  EMAIL_FROM_NAME    -- sender display name ("Majstor Banjaluka")

OBSOLETE env vars -- delete from Render if still present:
  EMAIL_USER  -- was for Gmail SMTP, no longer used
  EMAIL_PASS  -- was for Gmail SMTP App Password, no longer used

================================================================
SECTION 14 -- DEVELOPMENT DECISIONS
================================================================

 1. NO ngrok -- all webhook testing done after deploy to Render
 2. Render over Railway -- better uptime for webhook reliability
 3. Deployment: local -> Ctrl+S -> git add -> git commit -> git push
    -> Render auto-deploy. Always verify deploy is live before test.
 4. ALWAYS Ctrl+S before git add/commit/push
 5. Free-text only; ONE exception: Quick Reply on photo step
 6. Future AI role: classify intent + extract data from natural language.
    AI layer is NOT implemented and is NOT the next step.
 7. "Transport First, Intelligence Later" -- transport complete
 8. All secrets in env vars -- never hardcoded
 9. processMessage() is transport-agnostic -- used by /next and /webhook
10. sendMessengerReply() uses native https -- no axios dependency
11. res.status(200) sent AFTER forEach in POST /webhook handler
12. Meta App Review required for public users -- PAUSED for now
13. Contact block: phone -> location -> name (only phone mandatory)
14. mountingMode drives conditional ASK_WALL_TYPE
15. itemReady field (B4): if false -> skip ASK_BRAND/MODEL
16. Greeting detection in handleAskService()
17. summaryNotes[] clean BHS notes; notes[] internal debug only
18. extractDeviceType() ordering: sudomasina -> susilica -> ves masina
19. handleAskService() extracted for shared START + ASK_SERVICE logic
20. getDeviceInstrumental() -- BHS grammatical forms
21. getModelHint() -- device-specific label hints
22. model "nepoznat" fallback
23. phoneRefusedOnce flag -- one retry
24. DEVICES priority guard 1 -- appliance + osigurac fault
25. Out-of-scope detectors BEFORE classifyBranch()
26. detectDemolitionRequested() -- nuanced, regex BHS word-order
27. detectAlreadyRemovedOrReady() -- false demolition tag protection
28. addBhsNote() + summaryNotes[] -- clean BHS architecture
29. nextAfterRecognitionInstallations() skips ASK_WORK_READY when noted
30. continueInstallationsFlow() -- single INSTALLATIONS dispatcher
31. ASK_HAS_PART disabled in v2 (UX friction; state kept for v3)
32. TV nosac = B1, not B2
33. "kada" not in keywords -- BHS false positive ("when")
34. "pipa" = B3 keyword (colloquial BiH/RS for cesma)
35. Master regression suite before any keyword commit
36. shouldAskDeviceInstallType() -- selective built-in/freestanding
37. devicesPhotoPrompt() -- aligned DEVICES photo prompt
38. DEVICES fault guard 2 -- device phrase + fault phrase -> DEVICES
39. Room question removed from DEVICES flow
40. DEVICES summary: no null installType, label "Tip uredjaja"
41. EMAIL BEFORE AI LAYER -- strategic decision: bot must deliver leads
    before adding AI complexity. Executed as Task [5].
42. summaryNotes[] and emailSent initialized in createSession()
43. Email transport = Brevo HTTP API, not Gmail SMTP
44. sendSummaryEmail() is non-blocking (no await at call site)
45. buildTechnicianEmail() is a pure function exported for unit testing
46. emailSent = true only after response.ok -- failed sends can retry
47. buildSessionKey(channel, userId) -> "channel:userId" [7a]
    Prevents session key collisions across future channels.
48. handleIncomingText({ channel, userId, text }) [7a]
    Channel-agnostic wrapper. Used by POST /webhook and GET /next.
    No behavior change -- structural groundwork only.
49. /reset default resets both test:<id> and messenger:<id> [7a-hotfix]
    Restores manual Messenger smoke-testing after [7a] key change.
50. isContinueAnswer() replaces strict "dalje" matching [6g]
    Strips emoji/symbol noise; Android Quick Reply works correctly.

Future vision:
  - Multi-channel: Web -> Viber -> WhatsApp -> Instagram
  - Bot-as-a-Service for local businesses in BiH/region (SaaS)
  - Infrastructure: Render -> VPS (Hetzner) -> Dedicated
  - Own domain (majstorbanjaluka.ba) for email deliverability
    (DKIM, DMARC, SPF -- currently Gmail freemail via Brevo)

================================================================
SECTION 15 -- ROADMAP
================================================================

[1]      Multi-user sessions                                   DONE
[2a]     classifyBranch()                                      DONE
[2b]     Branch A -- DEVICES flow                             DONE
[2b+]    extractDeviceType()                                   DONE
[2c]     Branch B -- INSTALLATIONS flow                       DONE
[2d]     Stabilization                                         DONE
[3a]     Webhook foundation                                    DONE
[3b]     Deploy to Render                                      DONE
[3c]     Messenger webhook + Send API                          DONE
[4a]     Image/attachment handling in POST /webhook            DONE
[4b-UX]  UX Refactor -- DEVICES v2                            DONE
[4c-UX]  UX Refactor -- INSTALLATIONS v2                      DONE / STABLE
         Commit: 931284b -- 39/39, 14/14, 79/79 PASS
[4d-UX]  DEVICES flow polish + keyword matrix fix              DONE / STABLE
         Commit: 90a5cc1 -- 28/28 PASS
[5]      Technician Email Notification MVP                     DONE / PRODUCTION VERIFIED
         Commit: 55f9a73 -- Brevo HTTP API
         174/174 PASS at time of completion
         Messenger smoke test confirmed with and without photos
         Render log: "Technician email notification sent."
         Gmail receiving leads confirmed

         SMTP history (for reference):
           [5a] Gmail SMTP port 465 -> IPv6 ENETUNREACH on Render
           [5b] Gmail SMTP port 587 -> IPv6 ENETUNREACH on Render
           [5c] DNS ipv4first workaround -> Connection timeout
           [5d] Brevo HTTP API -> SUCCESS

[6g]     Android Messenger Quick Reply "Dalje" fix             DONE
         isContinueAnswer(text) replaces strict "=== dalje" checks
         Quick Reply title changed to plain "Dalje" (no emoji)
         27 regression tests added. Suite: 201/201 PASS.
         Android Messenger smoke test: DEVICES + INSTALLATIONS confirmed

[6]      Meta App Review preparation + Privacy Policy          PAUSED
         Not abandoned. Resume when Meta restriction is cleared
         and/or registered business documentation is available.
         privacy-policy.html draft preserved -- do not delete.

[7a]     Channel Adapter Foundation                            DONE
         Commit: ac8d210
         buildSessionKey(channel, userId) added + exported
         handleIncomingText({ channel, userId, text }) added + exported
         Sessions now keyed as "messenger:<id>" and "test:<id>"
         test-channel-adapter.js -- 11/11 PASS
         Suite: 212/212 PASS

[7a-h]   Restore Messenger reset after channel adapter         DONE
         Commit: 7eacabf (latest known HEAD)
         /reset without channel param now resets BOTH
         test:<id> and messenger:<id>
         Manual Messenger smoke-testing restored.

[7b]     Channel Transport Adapter Foundation                  <- NEXT
         Isolate Messenger-specific send/receive handling
         (sendMessengerReply, sendMessengerQuickReply, webhook parsing)
         behind a small adapter boundary so a new channel can be added
         without modifying POST /webhook.
         No behavior change.
         Do NOT touch DEVICES, INSTALLATIONS, email, keywords, or AI.

[7c]     Web/Internal Channel API MVP                          <- AFTER [7b]
         Add a minimal HTTP endpoint for web/internal channel.
         Calls handleIncomingText({ channel: "web", userId, text }).
         Returns JSON response.
         First version: text-only (no photo handling yet).

[7d]     Minimal Web Chat / Test UI                            <- AFTER [7c]
         Simple local or hosted page for manual testing of web channel.
         No AI, no scheduling, no pricing.

[7e]     Web channel smoke tests + documentation               <- AFTER [7d]
         Confirm first real new channel works with same core flow
         and preserves email lead delivery.

[8]      Google Sheets / CRM lead logging                      <- OPTIONAL
         One row per completed session.
         May be skipped if email delivery is sufficient.

[9]      AI layer (adapter: Gemini / Claude / GPT)             <- LATER
         Implement AFTER real production usage across channels.
         Real user data reveals what AI actually needs to improve.
         Do NOT start this before having multi-channel data.

Estimated path to first real new channel:
  [7b] Channel Transport Adapter Foundation   -- 1 careful work block
  [7c] Web/Internal Channel API MVP           -- 1 careful work block
  [7d] Minimal Web Chat / Test UI             -- 1 careful work block
  [7e] Smoke tests + documentation            -- 0.5-1 work block
  Realistic total: 3-4 work blocks.
  Conservative total: up to 5 blocks if photo support is included
  in the first web channel version.

================================================================
NOTES FOR CLAUDE CODE
================================================================

- The project owner is NOT a developer. Always explain simply.
- Always explain what code does and why, alongside the code.
- Give terminal commands copy/paste ready, one at a time.
- Guide step by step -- small task -> confirm -> next task.
- Communicate in BHS (Bosnian/Croatian/Serbian).
- Write all code, comments, and docs in English.
- Active project folder: MajstorBL_GPT
- Entry point for logic:  src/app.js
- Entry point for server: src/server.js
- Flow specs:
    MAJSTOR_BL_DEVICES_FLOW_v2.md      (DEVICES)
    MAJSTOR_BL_INSTALLATIONS_FLOW_v2.md (INSTALLATIONS)
- Test files (root folder, never delete):
    test-email-builder.js                  (14 -- unit, NO server)
    test-installations-keywords.js         (39 -- server required)
    test-installations-keywords-v2.js      (14 -- server required)
    test-installations-keywords-master.js  (79 -- server required)
    test-devices-flow-polish.js            (28 -- server required)
    test-continue-answer-quickreply.js     (27 -- Part A unit / Part B server)
    test-channel-adapter.js               (11 -- unit, NO server)
- ALWAYS run ALL seven suites before committing.
- ALWAYS Ctrl+S before git add/commit/push.
- Do NOT touch DEVICES flow unless explicitly asked.
- Do NOT touch INSTALLATIONS flow unless explicitly asked.
- Do NOT touch email functions unless explicitly asked.
- Do NOT update CLAUDE.md unless explicitly instructed.
  After implementation and tests, only report what should be documented.
- Do NOT add new states to processMessage() without mapping them in
  continueInstallationsFlow() or the DEVICES state machine.
- AKiPP next step is [7b] -- not AI, not Viber, not WhatsApp.

================================================================
END OF DOCUMENT
================================================================
