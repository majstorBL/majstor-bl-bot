================================================================
MAJSTOR BANJALUKA — CHATBOT PROJECT
Master Context Document for Claude Code
Last updated: April 2026 (POST Task 2d — Stabilization)
=======================================================

IMPORTANT RULE — READ BEFORE ANYTHING ELSE

Do NOT change existing chatbot behavior unless explicitly instructed.
Refactoring must preserve all existing logic.
When in doubt — ask, do not assume.

================================================================
SECTION 1 — BUSINESS OVERVIEW
=============================

Business Name: Majstor Banjaluka
Location: Banja Luka, Bosnia and Herzegovina

Services:

* Appliance repair (white goods, electronics)
* Furniture assembly
* Electrical installations
* Plumbing (external components only)
* Device installation

Target platform: Facebook Messenger

================================================================
SECTION 2 — PROJECT GOAL
========================

Build a chatbot that:

* Talks in BHS
* Identifies request type
* Guides conversation
* Collects structured data
* Outputs clean summary

NO:

* pricing
* advice
* scheduling

================================================================
SECTION 3 — SYSTEM ARCHITECTURE
===============================

Client → Messenger → Webhook → Node.js backend → AI → response

Principle:
Transport First, Intelligence Second

Structure:

* app.js → logic
* server.js → server start

================================================================
SECTION 4 — CURRENT CODE STATE
==============================

STATUS:

* Multi-user sessions ✅
* Branch detection ✅
* Device auto-detection ✅
* DEVICES flow (full) ✅
* INSTALLATIONS flow (full) ✅
* Stabilization (validation + UX fixes) ✅
* No webhook yet
* No AI yet

Key functions:

* createSession()
* normalizeText()
* classifyBranch()
* extractDeviceType()
* isFurniture()

================================================================
STATE MACHINE — FINAL VERSION
=============================

BRANCH A — DEVICES:

START → ASK_SERVICE
→ (auto-detect OR ASK_DEVICE_TYPE)
→ ASK_BRAND
→ ASK_MODEL
→ ASK_DESCRIPTION
→ ASK_FAULT_PATTERN
→ ASK_LOCATION
→ ASK_INSTALL_TYPE
→ ASK_PHOTOS
→ ASK_CONTACT
→ CONFIRM_REQUEST
→ END

---

BRANCH B — INSTALLATIONS:

START → ASK_SERVICE
→ ASK_INSTALLATION_TYPE
→ ASK_ITEM_NAME
→ ASK_ITEM_CONDITION
→ ASK_WALL_TYPE
→ ASK_ACCESS
→ ASK_WORK_READY
→ (ASK_DIMENSIONS if furniture)
→ ASK_LOCATION
→ ASK_FLOOR
→ ASK_PARKING
→ ASK_PHOTOS
→ ASK_CONTACT
→ CONFIRM_REQUEST
→ END

================================================================
SECTION 5 — SESSION MODEL
=========================

sessions[userId] = {
state,
branch,
service,

// DEVICES
deviceType,
faultPattern,
installType,

// INSTALLATIONS
installationType,
itemName,
itemCondition,
wallType,
accessInfo,
workReady,
dimensions,
floorInfo,
parkingInfo,

// shared
brand,
model,
description,
location,
photos,
contact
}

================================================================
SECTION 6 — KEY RULES
=====================

* Free text only
* No menus
* Max 2 photos
* No videos
* No pricing
* No scheduling

================================================================
SECTION 7 — IMPLEMENTATION NOTES
================================

* Branch detection is keyword-based (temporary)
* Device detection skips ASK_DEVICE_TYPE if possible
* INSTALLATIONS uses structured flow
* Furniture detection controls ASK_DIMENSIONS
* normalizeText() ensures safe input handling
* "dalje" is case-insensitive and trimmed
* Empty input is blocked (except START)
* Max 2 photos enforced

IMPORTANT:
Keyword precision improvements (e.g. "mašina" vs "veš mašina")
are intentionally postponed to later AI/NLP phase.

================================================================
SECTION 8 — ROADMAP
===================

[1] Multi-user sessions ✅
[2a] Branch detection ✅
[2b] DEVICES flow ✅
[2b+] Device auto-detection ✅
[2c] INSTALLATIONS flow ✅
[2d] Stabilization & UX improvements ✅

NEXT:

[3] FB Messenger webhook integration
[4] AI layer (Gemini / Claude / GPT)
[5] Send summary to technician
[6] Google Sheets integration
[7] Deployment (Render)

================================================================
NOTES FOR CLAUDE CODE
=====================

* User is NOT developer → explain simply
* Give step-by-step instructions
* One task at a time
* BHS communication
* English code

================================================================
END
================================================================

