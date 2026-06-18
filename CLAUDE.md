================================================================
MAJSTOR BANJA LUKA / AKiPP — CHATBOT + LEAD INTAKE SYSTEM
Master Context Document for Claude Code
Last updated: June 2026 (Task [7d] Minimal Web Chat / Test UI ✅ DONE)
(Task [7c] Web/Internal Channel API MVP ✅ DONE)
(Task [7b] Channel Transport Adapter Foundation ✅ DONE)
(Task [7a] Channel Adapter Foundation ✅ DONE)
(Task [7a-hotfix] Restore Messenger reset ✅ DONE)
(Task [6g] Android Messenger Quick Reply "Dalje" fix ✅ DONE)
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
Location: Banja Luka, Bosnia and Herzegovina
Services:

- Household appliance repair (white goods, boilers, washing machines,
  small appliances, computers/electronics)
- Furniture assembly/disassembly
- Electrical installations (outlets, switches, lighting, TV mounts)
- Plumbing — external components only
  (fixtures, faucets, valves, hoses, vodokotlici)
- Device installation (boilers, electric stoves, cooktops, range hoods)

Current production channel: Facebook Messenger
Web/Internal API endpoint: implemented and live for internal text-only testing
Minimal Web Chat / Test UI: implemented and live for internal browser testing
Strategic product direction: AKiPP — channel-agnostic communication and
data collection system
Current documentation step: [7e] CLAUDE.md update / Web UI documentation
after [7d]
Future optional step: Web photo upload support only if explicitly scoped later

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
-> extractMessengerInput(event) [7b Messenger adapter]
-> buildMessengerSessionKey(senderId) [7b Messenger adapter]
-> handleIncomingText({ channel: "messenger", userId, text })
-> processMessage(sessionKey, text)
-> sendMessengerChannelReply(recipientId, reply, session) [7b Messenger adapter]
-> Client

Completed request:

processMessage()
-> buildTechnicianEmail()
-> sendSummaryEmail()
-> Brevo HTTP API
-> Gmail / technician inbox

AKiPP current / target architecture:

Client
-> Channel Transport Adapter

   - messenger adapter [LIVE -- [7b] DONE]
   - web/internal API adapter [LIVE FOR INTERNAL TEXT TESTING -- [7c] DONE]
   - minimal web chat/test UI [LIVE FOR INTERNAL BROWSER TESTING -- [7d] DONE]
   - future: Viber / WhatsApp / Instagram
-> handleIncomingText({ channel, userId, text })
-> processMessage(sessionKey, text)
-> Channel Transport Adapter reply
-> Client

Web/Internal flow (Task [7c]):

Client / internal web caller
-> POST /channels/web/message
-> JSON body { userId, text }
-> validation: userId non-empty string, text string
-> handleIncomingText({ channel: "web", userId, text })
-> processMessage(sessionKey, text)
-> JSON { reply }
-> Client

[7c] is NOT a UI and NOT a public web chat yet. It is a minimal
text-only HTTP JSON endpoint for controlled internal testing.

Web UI flow (Task [7d]):

Browser user
-> GET /web-chat
-> static public/web-chat.html
-> same-origin fetch("/channels/web/message")
-> POST /channels/web/message
-> handleIncomingText({ channel: "web", userId, text })
-> processMessage(sessionKey, text)
-> JSON { reply }
-> reply displayed in browser

/web-chat is only a minimal UI wrapper over the existing [7c]
POST /channels/web/message endpoint. It does not add or change bot behavior.

Key principles:
"Transport First, Intelligence Later."
AI layer remains future work -- not the next step.
The raw Web/Internal API endpoint is DONE in [7c], and the minimal
Web Chat / Test UI is DONE in [7d]. The current documentation step is
[7e] CLAUDE.md update / Web UI documentation after [7d].
processMessage() is transport-agnostic and does not know about
Messenger payloads, Send API details, the Web/Internal HTTP endpoint,
or the /web-chat static UI route.
It reads/writes the in-memory sessions{} store through the sessionKey --
not a fully pure reducer in the academic sense, but acceptable for MVP.

Current file structure (active project folder: E:\Majstor_BL\Majstor_BL_Gpt):

src/app.js -- Express app, all route logic, session state,
processMessage(), sendMessengerReply(),
sendMessengerQuickReply(),
buildMessengerSessionKey(), extractMessengerInput(),
sendMessengerChannelReply(),
CHANNEL_WEB, POST /channels/web/message, GET /web-chat,
buildTechnicianEmail(), sendSummaryEmail(),
buildSessionKey(), handleIncomingText()
src/server.js -- Only starts the server, imports app from app.js
public/web-chat.html -- Minimal Web Chat / Test UI [7d]
package.json -- Project config (no nodemailer -- uses native fetch)
CLAUDE.md -- This file (auto-read by Claude Code)

Test files (root of project -- keep in repo, never delete):
test-email-builder.js -- email builder unit tests (14)
test-installations-keywords.js -- original regression suite (39)
test-installations-keywords-v2.js -- Messenger bug regression (14)
test-installations-keywords-master.js -- master keyword matrix (79)
test-devices-flow-polish.js -- DEVICES polish suite (28)
test-continue-answer-quickreply.js -- Quick Reply "Dalje" suite (27)
test-channel-adapter.js -- Channel adapter suite (17)
test-web-channel.js -- Web/Internal channel API suite (19; self-contained
ephemeral HTTP server; no localhost:3000 dev server required)
test-web-ui.js -- Web UI regression suite (12; self-contained ephemeral
HTTP server; no localhost:3000 dev server required)

Entry point: src/server.js (package.json -> "start": "node src/server.js")
Deployed at: Render.com (auto-deploy from GitHub)

Git log (latest known):
2f44fc1 Add minimal Web Chat test UI
d9133f9 Add Web internal channel API MVP
5b73aee Update CLAUDE.md after Task 7b
315b6c7 Add Messenger transport adapter foundation
97ce19b Update CLAUDE.md for AKiPP roadmap
7eacabf Restore Messenger reset after channel adapter
ac8d210 Add channel adapter foundation (Task 7a)
55f9a73 Replace Gmail SMTP with Brevo HTTP Email API
90a5cc1 Polish DEVICES flow and add regression suite
931284b INSTALLATIONS v2 final keyword matrix fix

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

Current channels:

- Facebook Messenger [LIVE]
- Web/Internal API endpoint [LIVE FOR INTERNAL TEXT TESTING -- [7c] DONE]
- Minimal Web Chat / Test UI [LIVE FOR INTERNAL BROWSER TESTING -- [7d] DONE]

Current / next documentation step:
[7e] CLAUDE.md update / Web UI documentation after [7d]

NOT next:

- AI layer
- WhatsApp
- Viber
- Instagram
- Web photo upload unless explicitly scoped as a separate future task
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
- first production customer-facing channel
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
  returning the same reply string. Used by:
  POST /webhook with channel "messenger"
  GET /next with channel "test"
  POST /channels/web/message with channel "web"
  No behavior change. Exported via module.exports.

- Sessions keyed as "channel:userId" [7a]:
  messenger:<senderId> -- Messenger text AND photo attachments
  test:<userId> -- GET /next and GET /reset (browser testing)
  web:<userId> -- POST /channels/web/message
  NOTE: switching Messenger key from raw senderId to
  "messenger:<senderId>" resets active in-memory sessions on next
  deploy. Harmless -- sessions are in-memory only and reset on every
  Render restart/deploy.

- /reset behavior [7a-hotfix]:
  /reset?userId=<id> -> resets test:<id> AND
  messenger:<id>
  /reset?userId=<id>&channel=test -> resets only test:<id>
  /reset?userId=<id>&channel=messenger -> resets only messenger:<id>
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
  Transport-agnostic. Used by GET /next, POST /webhook, and
  POST /channels/web/message. GET /web-chat does not call it directly;
  the browser UI calls POST /channels/web/message.
- sendMessengerReply() -- low-level: sends plain text via Facebook Send API
- sendMessengerQuickReply() -- low-level: sends Quick Reply buttons
  Used ONLY on ASK_PHOTOS step in both branches.
- Webhook GET /webhook -- Meta verification
- Webhook POST /webhook -- Messenger events + attachment handling
  Now uses Messenger transport adapter helpers (see [7b] section below).
  res.status(200) sent AFTER forEach (prevents proxy close bug).
  Image attachments stored in session.photos[] (max 2).
  Non-image attachments rejected with message.
  Quick Reply payload treated as plain text.

MESSENGER TRANSPORT ADAPTER (Task [7b]) DONE / STABLE:

- CHANNEL_MESSENGER = "messenger"
  Named constant for the Messenger channel string. Eliminates
  raw string literals scattered across the webhook handler.
  Used by buildMessengerSessionKey() and handleIncomingText() call
  in POST /webhook.

- buildMessengerSessionKey(senderId) [7b]
  Thin wrapper around buildSessionKey(CHANNEL_MESSENGER, senderId).
  Returns "messenger:<senderId>". Used in both the text path and
  the attachment/photo path inside POST /webhook so both always
  resolve to the same session for the same Messenger user.

- extractMessengerInput(event) [7b]
  Extracts the text input from a Messenger event object. Prefers
  event.message.quick_reply.payload over event.message.text so
  Quick Reply button clicks are treated identically to typed text.
  Returns null for non-text / attachment-only events (those are
  handled separately in the attachment path). Keeps POST /webhook
  handler clean and free of inline extraction logic.

- sendMessengerChannelReply(recipientId, reply, session) [7b]
  Strips the "Bot: " prefix from the reply string, then decides
  whether to send a plain text reply or a Quick Reply with a
  "Dalje" button based on session.state === "ASK_PHOTOS".
  Calls low-level sendMessengerReply() or sendMessengerQuickReply()
  internally. POST /webhook text path now calls this one function
  instead of containing inline prefix-stripping and Quick Reply
  decision logic.
  Behavior is IDENTICAL to the pre-[7b] inline logic -- this is a
  structural refactor only, no user-facing change.

WEB/INTERNAL CHANNEL API (Task [7c]) DONE / LIVE FOR INTERNAL TEXT TESTING:

- CHANNEL_WEB = "web" [7c]
  Canonical channel constant for the Web/Internal channel. Used by
  POST /channels/web/message so the channel string is not hardcoded
  inline. Exported via module.exports.CHANNEL_WEB for regression tests.

- POST /channels/web/message [7c]
  Text-only HTTP JSON endpoint for internal Web channel testing.
  Accepts body: { "userId": "<non-empty string>", "text": "<string>" }
  Validation:
  userId must be a non-empty string.
  text must be a string.
  text: "" is valid and acts as the START trigger.
  Invalid / missing userId or non-string / missing text returns
  HTTP 400 JSON: { "error": "userId and text are required" }
  Calls handleIncomingText({ channel: CHANNEL_WEB, userId, text }).
  Returns JSON: { "reply": "<bot reply string>" }.
  Uses web:<userId> session keys, isolated from messenger:<userId>
  and test:<userId>.

- [7c] endpoint limitations / scope:
  Text-only.
  Does not support photos or videos yet.
  Does not send channel-specific rich messages.
  Does not add UI.
  Does not add AI.
  Does not change Messenger behavior.
  Does not change DEVICES flow.
  Does not change INSTALLATIONS flow.
  Does not change Brevo/email behavior.

- module.exports.CHANNEL_WEB [7c]
  Exported only for Web/Internal channel API regression tests.

MINIMAL WEB CHAT / TEST UI (Task [7d]) DONE / LIVE FOR INTERNAL BROWSER TESTING:

- GET /web-chat [7d]
  Serves public/web-chat.html using res.sendFile(...).
  Uses Node built-in path import for safe file path resolution.
  Route is a static UI wrapper only. It does not call or modify
  processMessage(), DEVICES flow, INSTALLATIONS flow, Messenger logic,
  or Brevo/email logic.

- public/web-chat.html [7d]
  Standalone minimal browser test UI.
  Uses embedded CSS and vanilla JavaScript.
  No frontend framework, no CDN, no build step.
  Uses same-origin fetch("/channels/web/message") to call the
  existing [7c] Web/Internal endpoint.
  Generates a stable web-... userId and stores it in localStorage.
  Sends one automatic START request with text: "" on initial load.
  Sends text messages only and ignores empty manual sends.
  Disables input/send button while a request is in flight.
  Shows user and bot messages in a simple chat layout.
  Preserves multiline bot replies with CSS white-space: pre-wrap.
  Contains visible note:
  "Ovo je tekstualni test UI. Ako bot traži fotografiju, za sada
  napišite „Dalje”."
  Safe rendering: uses textContent and replaceChildren(); no
  .innerHTML = assignment.

- "Nova konverzacija" button [7d]
  Creates a fresh browser userId and clears visible messages.
  Does NOT call backend /reset.

- [7d] limitations / scope:
  Text-only internal browser testing UI.
  No photo upload and no video upload.
  No AI.
  No authentication.
  No pricing.
  No scheduling.
  No DB / CRM / Google Sheets.
  No bot behavior change.
  Existing bot prompts may still mention Messenger at the photo step.
  In Web UI testing, user should type "Dalje" when the bot asks for
  a photo. This is expected and accepted for [7d].

- [7d] security / exposure note:
  /web-chat is internal/test-oriented and unauthenticated. It should
  not be treated as a hardened public production widget. Token/auth,
  rate limiting, public hardening, and web photo upload are future
  separately scoped concerns only.

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
summaryNotes[] -- clean BHS notes for summary/email
emailSent: false -- prevents duplicate email sends
// contact: legacy field -- retained for compatibility, unused in v2

================================================================
SECTION 6 -- QA / REGRESSION SUITES
================================================================

All test files live in the project root (not in src/).
There are now nine maintained regression suites.

Server requirements:

- test-email-builder.js and test-channel-adapter.js are pure unit tests --
  no server needed.
- test-web-channel.js starts its own Express server on an ephemeral port --
  no localhost:3000 dev server required.
- test-web-ui.js starts its own Express server on an ephemeral port --
  no localhost:3000 dev server required.
- Some older HTTP suites still require the local dev server running on
  localhost:3000 in a second terminal.

test-email-builder.js -- 14 tests -- 14/14 PASS
test-installations-keywords.js -- 39 tests -- 39/39 PASS
test-installations-keywords-v2.js -- 14 tests -- 14/14 PASS
test-installations-keywords-master.js -- 79 tests -- 79/79 PASS
test-devices-flow-polish.js -- 28 tests -- 28/28 PASS
test-continue-answer-quickreply.js -- 27 tests -- 27/27 PASS
test-channel-adapter.js -- 17 tests -- 17/17 PASS
test-web-channel.js -- 19 tests -- 19/19 PASS
test-web-ui.js -- 12 tests -- 12/12 PASS
TOTAL: 249 tests -- 249/249 PASS

test-continue-answer-quickreply.js has two parts:
Part A -- unit tests isContinueAnswer() without server
Part B -- HTTP flow tests that require the server

Manual Render smoke test after [7c] deploy:
Endpoint: /channels/web/message
Two-step same-userId test:

1. text: "" -> opening prompt:
   "Bot: Zdravo! Koju uslugu trebate? Opišite ukratko šta Vam treba."
2. text: "Laptop ne radi" -> expected DEVICES continuation, asks for
   brand/proizvođač.
   Result: [7c] Render smoke test -- PASS

Manual Render/browser smoke test after [7d] deploy:
Endpoint: /web-chat
Render URL: https://majstor-bl-bot.onrender.com/web-chat
Result:

- Web UI opens in browser.
- DEVICES flow works through the Web UI.
- INSTALLATIONS flow works through the Web UI.
- Email summary is delivered after completed request.
- Negative confirmation / contact refusal path closes politely.
- Known limitation: Web UI is text-only; at the photo step user types
  "Dalje". This is expected for [7d].
  Result: [7d] Render/browser smoke test -- PASS

MANDATORY -- run ALL before any commit:
node --check src/app.js
node test-email-builder.js
node test-installations-keywords.js
node test-installations-keywords-v2.js
node test-installations-keywords-master.js
node test-devices-flow-polish.js
node test-continue-answer-quickreply.js
node test-channel-adapter.js
node test-web-channel.js
node test-web-ui.js

Do NOT delete any test files. They are the regression safety net.

================================================================
SECTION 7 -- API / ENDPOINTS
================================================================

GET /webhook -- Meta webhook verification
POST /webhook -- Messenger events + reply
POST /channels/web/message -- Web/Internal text-only JSON endpoint [7c]
GET /web-chat -- Minimal Web Chat / Test UI [7d]
GET /next?userId=...&tekst=... -- browser testing endpoint
GET /reset?userId=... -- resets test + messenger sessions
GET /reset?userId=...&channel=... -- resets only that channel session

POST /channels/web/message accepts:
{ "userId": "<non-empty string>", "text": "<string>" }
Returns:
{ "reply": "<bot reply string>" }
Validation failure returns HTTP 400:
{ "error": "userId and text are required" }
text: "" is valid and starts the conversation.

GET /web-chat serves the browser UI from public/web-chat.html.
The UI calls POST /channels/web/message via same-origin fetch.
The UI is text-only and does not upload photos or videos.

GET /next and GET /reset are temporary testing endpoints.
Core Messenger production flow runs through POST /webhook.
Web/Internal internal text testing runs through POST /channels/web/message.
Minimal Web browser testing runs through GET /web-chat.

module.exports exposes for testing:
module.exports.buildTechnicianEmail -- pure function
module.exports.createSession -- session factory
module.exports.isContinueAnswer -- Quick Reply "Dalje" detector
module.exports.buildSessionKey -- channel-aware session key
module.exports.handleIncomingText -- channel-agnostic entry wrapper
module.exports.CHANNEL_MESSENGER -- Messenger channel constant
module.exports.buildMessengerSessionKey -- Messenger session-key helper
module.exports.extractMessengerInput -- Messenger input extractor
module.exports.CHANNEL_WEB -- Web/Internal channel constant

================================================================
SECTION 8 -- TOP-LEVEL ROUTING
================================================================

On the first client message, handleAskService() classifies:

[BRANCH A] DEVICES -- repair and maintenance of electrical appliances
[BRANCH B] INSTALLATIONS -- assembly, electrical, plumbing, device install
[OUT-OF-SCOPE] -- polite decline, session ends

ROUTING ORDER in handleAskService():

1. Greeting / contact-intent check -> "Kako Vam mozemo pomoci?"
2. detectOutOfScopePlumbing() -> decline + END
3. detectOutOfScopeElectrical() -> decline + END
4. classifyBranch() -> DEVICES / INSTALLATIONS / UNKNOWN
5. DEVICES: extractDeviceType() -> route to flow
6. INSTALLATIONS: detectDemolitionRequested() -> addBhsNote()
   extractInstallationType() -> set installationType
   extractInstallationItem() -> set itemName + mountingMode
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

1.  Device type -- auto-detected or ASK_DEVICE_TYPE
2.  Brand -- ASK_BRAND
3.  Model -- ASK_MODEL (device hint, "nepoznat" fallback)
4.  Fault description -- ASK_DESCRIPTION
5.  Fault pattern (constant/intermittent) -- ASK_FAULT_PATTERN
6.  Install type -- ASK_INSTALL_TYPE
    Only if shouldAskDeviceInstallType() = true.
7.  Photos (optional, Quick Reply, max 2) -- ASK_PHOTOS
8.  Confirmation -- ASK_CONFIRMATION
9.  Phone (mandatory, one retry) -- ASK_PHONE
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
"ne radi / kvar / popravka / greska" -> DEVICES
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

RULE 1 -- NO DIY ADVICE
RULE 2 -- FREE TEXT ONLY (exception: Quick Reply "Dalje" on ASK_PHOTOS)
RULE 3 -- PHOTOS ONLY, MAX 2 -- never request/accept video
RULE 4 -- NO PRICING
"Cijena se odredjuje tek nakon izlaska na teren."
RULE 5 -- NO APPOINTMENT SCHEDULING
RULE 6 -- ON-SITE SERVICE ONLY
RULE 7 -- NO "ZABILJEZENО" PATTERN -- confirmations must be natural
RULE 8 -- TERMINOLOGY
DEVICES: serviser/tehnicar; INSTALLATIONS: majstor
RULE 9 -- NO REPEATED QUESTIONS
RULE 10 -- SKIP KNOWN DATA -- use what the first message already gave
RULE 11 -- CLEAN SUMMARY NOTES
summaryNotes[] BHS only -- never English debug labels

================================================================
SECTION 13 -- TECH STACK
================================================================

Runtime: Node.js
Framework: Express.js
HTTP (FB): Node.js built-in https (Facebook Send API)
HTTP (email): Node.js built-in fetch() (Brevo Email API)
Dev tool: Nodemon
Version ctrl: Git (local) + GitHub (remote)
Hosting: Render.com (auto-deploy from GitHub) LIVE
Email: Brevo HTTP API
(POST https://api.brevo.com/v3/smtp/email)
nodemailer: ABANDONED -- SMTP unreliable on Render
(IPv6 ENETUNREACH on ports 465/587;
STARTTLS/IPv4fix also timed out)
AI layer: NOT YET IMPLEMENTED
Provider-agnostic adapter pattern designed, not built.
Dev/test: Google Gemini Flash (free tier)
Production: Gemini / Claude / GPT -- TBD
Target design goal: future provider switch should be
isolated behind one adapter boundary.
Future DB: Google Sheets lead logging (optional -- not prioritised)
Bot channel: Facebook Messenger (Meta Messenger API) LIVE
Web/Internal API + Minimal Web Chat UI: LIVE FOR INTERNAL TESTING
Language: BHS for all client-facing communication
English for code, docs, and AI prompts

Environment variables (Render dashboard -- current active set):
META_VERIFY_TOKEN -- webhook verification token
PAGE_ACCESS_TOKEN -- Meta page token for Send API
BREVO_API_KEY -- Brevo email API key
EMAIL_FROM -- sender address (majstor.banjaluka@gmail.com)
EMAIL_TO -- technician's address
EMAIL_FROM_NAME -- sender display name ("Majstor Banjaluka")

OBSOLETE env vars -- delete from Render if still present:
EMAIL_USER -- was for Gmail SMTP, no longer used
EMAIL_PASS -- was for Gmail SMTP App Password, no longer used

================================================================
SECTION 14 -- DEVELOPMENT DECISIONS
================================================================

1.  NO ngrok -- all webhook testing done after deploy to Render
2.  Render over Railway -- better uptime for webhook reliability
3.  Deployment: local -> Ctrl+S -> git add -> git commit -> git push
    -> Render auto-deploy. Always verify deploy is live before test.
4.  ALWAYS Ctrl+S before git add/commit/push
5.  Free-text only; ONE exception: Quick Reply on photo step
6.  Future AI role: classify intent + extract data from natural language.
    AI layer is NOT implemented and is NOT the next step.
7.  "Transport First, Intelligence Later" -- Messenger + Web/Internal API transport foundation complete
8.  All secrets in env vars -- never hardcoded
9.  processMessage() is transport-agnostic -- used by /next, /webhook,
    and /channels/web/message
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
51. CHANNEL_MESSENGER constant [7b]
    Named constant replaces raw "messenger" string in POST /webhook.
52. buildMessengerSessionKey(senderId) [7b]
    Wraps buildSessionKey(CHANNEL_MESSENGER, senderId). Used by both
    text path and attachment path in POST /webhook -- guarantees same
    session key regardless of message type.
53. extractMessengerInput(event) [7b]
    Prefers quick_reply.payload over message.text. Returns null for
    attachment-only events. Keeps webhook handler clean.
54. sendMessengerChannelReply(recipientId, reply, session) [7b]
    Strips "Bot: " prefix and decides plain vs. Quick Reply based on
    session.state === "ASK_PHOTOS". Structural refactor only --
    behavior identical to pre-[7b] inline logic.
55. CHANNEL_WEB constant [7c]
    Canonical channel string for Web/Internal endpoint.
56. POST /channels/web/message [7c]
    Text-only JSON endpoint. Validates userId/text, allows text: ""
    as START trigger, calls handleIncomingText({ channel: CHANNEL_WEB,
    userId, text }), and returns { reply }.
57. Web sessions [7c]
    Uses web:<userId> keys. No collision with messenger:<id> or test:<id>.
58. [7c] is raw API only
    No UI, no photo support, no video, no AI, no Messenger behavior change,
    no DEVICES/INSTALLATIONS change, no Brevo/email change.
59. Security note [7c]
    Endpoint is currently text-only and unauthenticated. Acceptable for
    controlled MVP/internal smoke testing, but authentication/token protection
    should be considered before exposing a public web UI or collecting real
    public web leads. Do not implement security changes unless explicitly
    scoped in a future task.
60. Minimal Web Chat / Test UI [7d]
    GET /web-chat serves public/web-chat.html as an internal browser test UI.
    It is a UI wrapper over the existing [7c] POST /channels/web/message
    endpoint, not a new bot flow.
61. Minimal Web UI frontend choice [7d]
    Vanilla HTML/CSS/JS only. No frontend framework, no CDN, no build step.
62. Web UI browser identity [7d]
    Stores a stable web-... userId in localStorage. "Nova konverzacija"
    creates a fresh browser userId and clears UI only; it does not call /reset.
63. Web UI is text-only in [7d]
    No photo upload, no video upload. When the bot asks for photos in the
    web UI, user types "Dalje". Existing Messenger wording at photo step is
    accepted for this scoped test UI.
64. Web photo upload is future separate scope
    Do not add file/photo upload to Web UI unless explicitly scoped later.
65. Safe Web UI rendering [7d]
    Uses textContent for message rendering and replaceChildren() for clearing;
    no .innerHTML = assignment.
66. Security note [7d]
    /web-chat is internal/test-oriented and unauthenticated. Do not treat it
    as a hardened public production widget. Token/auth/rate limiting and
    public hardening are future separately scoped concerns.

Future vision:

- Multi-channel: Web -> Viber -> WhatsApp -> Instagram
- Bot-as-a-Service for local businesses in BiH/region (SaaS)
- Infrastructure: Render -> VPS (Hetzner) -> Dedicated
- Own domain (majstorbanjaluka.ba) for email deliverability
  (DKIM, DMARC, SPF -- currently Gmail freemail via Brevo)

================================================================
SECTION 15 -- ROADMAP
================================================================

[1] Multi-user sessions DONE
[2a] classifyBranch() DONE
[2b] Branch A -- DEVICES flow DONE
[2b+] extractDeviceType() DONE
[2c] Branch B -- INSTALLATIONS flow DONE
[2d] Stabilization DONE
[3a] Webhook foundation DONE
[3b] Deploy to Render DONE
[3c] Messenger webhook + Send API DONE
[4a] Image/attachment handling in POST /webhook DONE
[4b-UX] UX Refactor -- DEVICES v2 DONE
[4c-UX] UX Refactor -- INSTALLATIONS v2 DONE / STABLE
Commit: 931284b -- 39/39, 14/14, 79/79 PASS
[4d-UX] DEVICES flow polish + keyword matrix fix DONE / STABLE
Commit: 90a5cc1 -- 28/28 PASS
[5] Technician Email Notification MVP DONE / PRODUCTION VERIFIED
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

[6g] Android Messenger Quick Reply "Dalje" fix DONE
isContinueAnswer(text) replaces strict "=== dalje" checks
Quick Reply title changed to plain "Dalje" (no emoji)
27 regression tests added. Suite: 201/201 PASS.
Android Messenger smoke test: DEVICES + INSTALLATIONS confirmed

[6] Meta App Review preparation + Privacy Policy PAUSED
Not abandoned. Resume when Meta restriction is cleared
and/or registered business documentation is available.
privacy-policy.html draft preserved -- do not delete.

[7a] Channel Adapter Foundation DONE
Commit: ac8d210
buildSessionKey(channel, userId) added + exported
handleIncomingText({ channel, userId, text }) added + exported
Sessions now keyed as "messenger:<id>" and "test:<id>"
test-channel-adapter.js -- 11/11 PASS
Suite: 212/212 PASS

[7a-h] Restore Messenger reset after channel adapter DONE
Commit: 7eacabf
/reset without channel param now resets BOTH
test:<id> and messenger:<id>
Manual Messenger smoke-testing restored.

[7b] Channel Transport Adapter Foundation DONE
Commit: 315b6c7
Added CHANNEL_MESSENGER constant.
Added buildMessengerSessionKey(senderId).
Added extractMessengerInput(event).
Added sendMessengerChannelReply(recipientId, reply, session).
POST /webhook text path now uses adapter helpers instead of
inline prefix-stripping and Quick Reply decision logic.
Low-level sendMessengerReply() and sendMessengerQuickReply()
remain unchanged.
No behavior change. DEVICES, INSTALLATIONS, email unchanged.
test-channel-adapter.js expanded: 11 -> 17 tests, 17/17 PASS
Suite: 218/218 PASS
Messenger smoke test confirmed:
DEVICES flow -- PASS
INSTALLATIONS flow -- PASS
Photo upload -- PASS
Quick Reply "Dalje" -- PASS
Summary email delivered -- PASS
Negative confirmation / no-contact path -- PASS

[7c] Web/Internal Channel API MVP DONE
CHANNEL_WEB = "web"
POST /channels/web/message
JSON { userId, text } -> { reply }
text: "" allowed as START trigger
Web sessions isolated as web:<userId>
test-web-channel.js added -- 19/19 PASS
Full suite: 237/237 PASS
Render smoke test: PASS
Commit: d9133f9 Add Web internal channel API MVP

[7d] Minimal Web Chat / Test UI DONE
Commit: 2f44fc1 Add minimal Web Chat test UI
GET /web-chat serves public/web-chat.html.
Minimal standalone browser UI uses vanilla HTML/CSS/JS.
Uses existing [7c] POST /channels/web/message endpoint.
Generates/stores web-... userId in localStorage.
"Nova konverzacija" creates fresh browser userId and clears UI only.
Text-only: no photo upload, no video upload.
No AI, no pricing, no scheduling, no auth, no DB/CRM/Sheets.
No bot behavior change. DEVICES, INSTALLATIONS, Messenger and email unchanged.
test-web-ui.js added -- 12/12 PASS
Full suite: 249/249 PASS
Render/browser smoke test: PASS
Known limitation: text-only Web UI; at photo step, type "Dalje".
This limitation is expected and accepted for [7d].

[7e] CLAUDE.md update / Web UI documentation after [7d] <- CURRENT / NEXT
Documentation-only update after completed [7d].
Manual Render/browser smoke test after [7d] has already passed.
Do not mark [7e] DONE until the documentation update is reviewed and committed.
Do not start AI, public hardening, authentication, or photo upload here.

Web photo upload support <- FUTURE / OPTIONAL / separate scope
Only if explicitly requested. Do not move ahead of documentation by default.

[8] Google Sheets / CRM lead logging <- OPTIONAL
One row per completed session.
May be skipped if email delivery is sufficient.

[9] AI layer (adapter: Gemini / Claude / GPT) <- LATER
Implement AFTER real production usage across channels.
Real user data reveals what AI actually needs to improve.
Do NOT start this before having multi-channel data.

Current state after [7d]:
First practical Web browser test experience exists for internal testing.
Immediate documentation step: [7e] CLAUDE.md update / Web UI documentation
after [7d].
Future optional work: Web photo upload support, public hardening/auth/rate
limiting, CRM logging, and AI layer -- only if explicitly scoped later.

================================================================
NOTES FOR CLAUDE CODE
================================================================

- The project owner is NOT a developer. Always explain simply.
- Always explain what code does and why, alongside the code.
- Give terminal commands copy/paste ready, one at a time.
- Guide step by step -- small task -> confirm -> next task.
- Communicate in BHS (Bosnian/Croatian/Serbian).
- Write all code, comments, and docs in English.
- Active project folder: E:\Majstor_BL\Majstor_BL_Gpt
- Entry point for logic: src/app.js
- Entry point for server: src/server.js
- Minimal Web UI file: public/web-chat.html
- Flow specs:
  MAJSTOR_BL_DEVICES_FLOW_v2.md (DEVICES)
  MAJSTOR_BL_INSTALLATIONS_FLOW_v2.md (INSTALLATIONS)
- Test files (root folder, never delete):
  test-email-builder.js (14 -- unit, NO server)
  test-installations-keywords.js (39 -- server required)
  test-installations-keywords-v2.js (14 -- server required)
  test-installations-keywords-master.js (79 -- server required)
  test-devices-flow-polish.js (28 -- server required)
  test-continue-answer-quickreply.js (27 -- Part A unit / Part B server)
  test-channel-adapter.js (17 -- unit, NO server)
  test-web-channel.js (19 -- self-contained ephemeral HTTP server,
  NO localhost:3000 dev server required)
  test-web-ui.js (12 -- self-contained ephemeral HTTP server,
  NO localhost:3000 dev server required)
- ALWAYS run ALL nine suites before committing.
- ALWAYS Ctrl+S before git add/commit/push.
- Do NOT touch DEVICES flow unless explicitly asked.
- Do NOT touch INSTALLATIONS flow unless explicitly asked.
- Do NOT touch email functions unless explicitly asked.
- Do NOT add/stage/commit privacy-policy.html unless explicitly instructed.
- Do NOT add/stage/commit old untracked chat summary files unless
  explicitly instructed.
- Do NOT update CLAUDE.md unless explicitly instructed.
  After implementation and tests, only report what should be documented.
- Do NOT add new states to processMessage() without mapping them in
  continueInstallationsFlow() or the DEVICES state machine.
- AKiPP current / next documentation step is [7e] CLAUDE.md update /
  Web UI documentation after [7d] -- not AI, not Viber, not WhatsApp.
- Do NOT add photo upload to Web UI unless explicitly scoped.
- Do NOT turn /web-chat into a public production widget unless explicitly
  scoped. Web UI is currently internal/test-oriented.
- [7c] endpoint is currently text-only and unauthenticated. This is
  acceptable for controlled MVP/internal smoke testing, but
  authentication/token protection should be considered before exposing
  a public web UI or collecting real public web leads. Do not implement
  security changes unless explicitly scoped in a future task.
- [7d] /web-chat is internal/test-oriented and unauthenticated. It should
  not be treated as a hardened public production widget. Token/auth/rate
  limiting and web photo upload are future separately scoped concerns.

================================================================
END OF DOCUMENT
================================================================
