const express = require("express");
const https = require("https"); // built-in Node.js module — no install needed
const app = express();

// Multi-user session store — each user gets their own session object
const sessions = {};

// Returns a fresh, empty session for a new user
function createSession() {
  return {
    state: "START",
    branch: null,
    service: null,
    // DEVICES-only fields
    deviceType: null,
    faultPattern: null,
    installType: null,
    // DEVICES v2 contact block
    phone: null, // mandatory — session closes if refused twice
    name: null, // optional
    phoneRefusedOnce: false, // tracks first phone refusal to allow one retry
    // INSTALLATIONS-only fields (v2)
    installationType: null,
    itemName: null,
    itemCondition: null,
    itemReady: null, // true | false | null — was item already purchased?
    mountingMode: null, // "wall" | "ceiling" | "freestanding" | "unknown"
    wallType: null,
    accessInfo: null,
    workReady: null,
    dimensions: null,
    floorInfo: null,
    parkingInfo: null,
    // Shared fields
    brand: null,
    model: null,
    description: null,
    location: null,
    photos: [],
    notes: [], // fallback info, additional remarks, reserved for future AI use
    summaryNotes: [], // clean BHS notes for display/email summary (Task [5])
    contact: null, // legacy — retained for backwards compatibility, unused by v2 flow
    emailSent: false, // prevents duplicate technician email notifications (Task [5])
  };
}

// Normalizes user input — trims whitespace, lowercases, handles null/undefined
function normalizeText(text) {
  return (text || "").toString().trim().toLowerCase();
}

// [6g] Continue/Skip intent detector for the "Dalje" answer.
// Messenger Web sends the Quick Reply payload ("Dalje") as plain text, but the
// Android Messenger app sends back the visible TITLE instead, which used to be
// "➡️ Dalje". Strict matching (=== "dalje") then failed and the photo prompt
// looped. This helper strips emoji/symbol/punctuation noise and keeps only
// letters/numbers/spaces, so any harmless decoration around the word "dalje"
// (arrows, dots, exclamation marks, surrounding spaces) is accepted.
// Uses a character class without Unicode property escapes for maximum Node
// compatibility: keep BHS/ASCII letters, digits and spaces, drop everything
// else (which covers emoji, arrow glyphs and punctuation).
function isContinueAnswer(text) {
  const cleaned = normalizeText(text)
    .replace(/[^a-z0-9čćđšžáàâäéèêëíìîïóòôöúùûü\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned === "dalje";
}

// ── Channel/session adapter foundation (Task [7a]) ──────────────────────────
// Builds a channel-aware session key so different channels never collide on
// the same raw user id. Messenger user "12345" and a future Web/Viber user
// "12345" must map to DIFFERENT sessions, e.g. "messenger:12345" vs
// "web:12345". Pure string helper — no side effects, safe to unit-test.
// NOTE: switching Messenger from the raw senderId to "messenger:<senderId>"
// resets active in-memory sessions on the next deploy. This is harmless
// because sessions already live only in memory and reset on every Render
// restart/deploy.
function buildSessionKey(channel, userId) {
  return `${channel}:${userId}`;
}

// Keyword-based branch classifier — no AI, plain text matching
// Returns "DEVICES", "INSTALLATIONS", or "UNKNOWN"
function classifyBranch(text) {
  const input = normalizeText(text);

  // [4c-UX-keyword-matrix] DEVICES priority guard — an appliance fault that
  // is described together with an electrical symptom (e.g. a washing machine
  // that trips the fuse) is a DEVICE repair, NOT an electrical installation.
  // This must run BEFORE the INSTALLATIONS intent pre-check so phrases like
  // "izbacuje osigurač" don't misroute the appliance fault to B2/B3.
  // Requires BOTH an appliance device phrase AND a fault phrase, so a purely
  // local electrical case ("Izbacuje osigurač kad upalim svjetlo.") — which
  // has no appliance phrase — correctly stays in INSTALLATIONS (B2).
  const applianceDevicePhrases = [
    "veš maš",
    "ves mas",
    "veš mašin",
    "ves masin",
    "mašina",
    "masina",
    "mašin",
    "masin",
    "sudomašin",
    "sudomasin",
    "frižider",
    "frizider",
    "bojler",
    "šporet",
    "sporet",
    "štednjak",
    "stednjak",
  ];
  const applianceFaultPhrases = [
    "izbacuje osigura",
    "izbaci osigura",
    "iskače osigura",
    "iskace osigura",
    "pada osigura",
    "ispada osigura",
    "kad je uključim",
    "kad je ukljucim",
    "kad uključim",
    "kad ukljucim",
    "kad stisnem dugme",
    "kada stisnem dugme",
    "dugme za paljenje",
  ];
  if (
    applianceDevicePhrases.some((d) => input.includes(d)) &&
    applianceFaultPhrases.some((f) => input.includes(f))
  ) {
    return "DEVICES";
  }

  // [4c-UX] INSTALLATIONS intent pre-check — stems that unambiguously signal
  // an installation/montage request even when a device name also appears in
  // the text. Example: "Kupio sam bojler, treba ugradnja" must route to
  // INSTALLATIONS, not DEVICES. Stems are used to catch declined forms
  // (e.g. "slavinu" from "slavina") that the original keyword list misses.
  const installationIntent = [
    // Assembly / installation verbs
    "montaž",
    "montaz",
    "montir",
    "namontir",
    "smontir",
    "ugradnj",
    "ugradi",
    "ugrađ",
    "ugradj",
    "instalacij",
    "postav",
    "postavlj",
    "priključ",
    "prikljuc",
    "spojiti",
    "spajanj",
    "povezati",
    "povezat",
    "sastav",
    "sastavlj",
    "sklop",
    "sklap",
    "pričvrst",
    "pricvrst",
    "učvrst",
    "ucvrst",
    "zamijen",
    "zamjen",
    "zamijena",
    "zamjena",
    // Endpoint plumbing items (B3)
    "slavin",
    "česm",
    "cesm",
    "pipa",
    "ventil",
    "sifon",
    "vodokotlić",
    "vodokotlic",
    "wc kotlić",
    "wc kotlic",
    "fleks crijev",
    "fleksibiln",
    "lavabo",
    "umivaonik",
    "sudoper",
    "tuš kabin",
    "tus kabin",
    "tuš baterij",
    "tus baterij",
    "wc šolj",
    "wc solj",
    "wc školjk",
    "wc skoljk",
    "vc šolj",
    "vc solj",
    "bide",
    // Endpoint electrical items (B2)
    "utičnic",
    "uticnic",
    "prekidač",
    "prekidac",
    "luster",
    "plafonjer",
    "rasvjetn",
    "grlo sijal",
    "grlo",
    "sijalic",
    "žarulj",
    "zarulj",
    "svjetlo",
    "svijetlo",
    "svetlo",
    "svjetl",
    "svijetl",
    "svetl",
    "ne radi svjetlo",
    "ne radi svijetlo",
    "ne radi svetlo",
    "osigurač",
    "osigurac",
    // Furniture / assembly items (B1)
    "karniš",
    "karnis",
    "garniš",
    "garnis",
    "regal",
  ];
  for (const kw of installationIntent) {
    if (input.includes(kw)) return "INSTALLATIONS";
  }

  // [polish-fix] Combined-stem checks for declined phrases like
  // "kuhinjskih elemenata" / "viseće elemente" that don't survive as a
  // single substring.
  if (
    (input.includes("kuhinjsk") ||
      input.includes("viseć") ||
      input.includes("visec")) &&
    input.includes("elemen")
  ) {
    return "INSTALLATIONS";
  }

  // [4d-UX] DEVICES fault guard — a recognized appliance/electronics phrase
  // described together with a fault symptom is a DEVICE repair, even when a
  // word like "električna" would otherwise look like an installation keyword.
  // Runs AFTER the installation-intent pre-check, so explicit install verbs
  // ("ugradnja ploče") still win. Requires BOTH a device phrase AND a fault
  // phrase, so generic faults ("imam problem", "neće") never route here alone.
  const deviceFaultDevicePhrases = [
    "indukciona ploč",
    "indukciona ploc",
    "električna ploč",
    "elektricna ploc",
    "frižider",
    "frizider",
    "frižder",
    "frizder",
    "zamrzivač",
    "zamrzivac",
    "škrinja",
    "skrinja",
    "sušilica",
    "susilica",
    "printer",
    "štampač",
    "stampač",
    "stampac",
    "šparet",
    "sparet",
    "šporet",
    "sporet",
    "štednjak",
    "stednjak",
    "veš maš",
    "ves mas",
    "sudomašin",
    "sudomasin",
    "bojler",
    "televizor",
    "laptop",
    "loptop",
    "računar",
    "racunar",
    "monitor",
    "usisivač",
  ];
  const deviceFaultPhrases = [
    "ne radi",
    "neće da radi",
    "nece da radi",
    "neće da se pokrene",
    "nece da se pokrene",
    "ne uključuje",
    "ne ukljucuje",
    "neće da se upali",
    "nece da se upali",
    "ne pali",
    "gasi se",
    "pokvaren",
    "u kvaru",
    "izbacuje grešku",
    "izbacuje gresku",
    "nema sliku",
    "ne prikazuje sliku",
    "ne štampa",
    "ne stampa",
    "ne hladi",
    "ne grije",
    "ne izbacuje vodu",
  ];
  if (
    deviceFaultDevicePhrases.some((d) => input.includes(d)) &&
    deviceFaultPhrases.some((f) => input.includes(f))
  ) {
    return "DEVICES";
  }

  const deviceKeywords = [
    "mašina",
    "veš",
    "perilica",
    "pranje",
    "suđe",
    "sudomašina",
    "sudomasina",
    "dishwasher",
    "frižider",
    "hladnjak",
    "frizider",
    "bojler",
    "boiler",
    "grijač",
    "šporet",
    "štednjak",
    "rerma",
    "tv",
    "televizor",
    "televizija",
    "kompjuter",
    "laptop",
    "računar",
    "pc",
    "monitor",
    "usisivač",
    "pegla",
    "mikser",
    "blender",
    "aparat",
    "uređaj",
    "klima",
    "zamrzivač",
    // [4d-UX] extra DEVICES variants / typos
    "škrinja",
    "skrinja",
    "sušilica",
    "susilica",
    "frižder",
    "frizder",
    "printer",
    "štampač",
    "stampač",
    "stampac",
    "šparet",
    "sparet",
    "loptop",
  ];

  const installationKeywords = [
    "montaž",
    "montira",
    "ugradnja",
    "instalacija",
    "postavljanje",
    "namještaj",
    "ormar",
    "polica",
    "krevet",
    "komoda",
    "tv nosač",
    "nosač",
    "zidni",
    "slavina",
    "česma",
    "slavine",
    "cijev",
    "crijevo",
    "ventil",
    "sifon",
    "wc",
    "toalet",
    "utičnica",
    "prekidač",
    "struja",
    "električna",
    "rasvjeta",
    "lustera",
    "lampa",
    "svjetiljka",
    "reflektor",
    "vodovod",
    "vodovodne",
    "sanitarni",
    "ugradnja bojlera",
    "ugradnja šporeta",
  ];

  for (const keyword of deviceKeywords) {
    if (input.includes(keyword)) return "DEVICES";
  }

  for (const keyword of installationKeywords) {
    if (input.includes(keyword)) return "INSTALLATIONS";
  }

  return "UNKNOWN";
}

// Tries to extract a specific device type from user text
// Returns a canonical device name string, or null if not recognized
// "aparat" and "uređaj" are intentionally excluded — too generic to be useful
function extractDeviceType(text) {
  const input = normalizeText(text);

  const deviceTypes = [
    // Dishwasher must be checked before washing machine —
    // "mašina za suđe" contains "mašina" which would otherwise match first
    {
      keywords: [
        "sudomašina",
        "sudomasina",
        "mašina za suđe",
        "mašina za suđa",
        "mašina za pranje suđa",
        "mašina za pranje posuđa",
        "masina za sudja",
        "masina za posudja",
        "perilica suđa",
        "perilica posuđa",
        "perilica posudja",
        "perilica za posuđe",
        "perilica za posudje",
        "sudna perilica",
        "suđerica",
        "sudjerica",
        "suđe",
        "suđa",
        "sudja",
        "posuđa",
        "posudja",
        "dishwasher",
      ],
      type: "sudomašina",
    },
    // Tumble dryer must be checked before washing machine — "sušilica veša"
    // contains "veš", which would otherwise match the washing-machine entry.
    {
      keywords: ["sušilica veša", "susilica vesa", "sušilica", "susilica"],
      type: "sušilica",
    },
    {
      keywords: [
        "veš mašina",
        "mašina za pranje",
        "perilica rublja",
        "perilica",
        "veš",
        "mašina",
        "pranje",
      ],
      type: "veš mašina",
    },
    // Induction / electric hob — multi-word phrases checked before generic ones.
    {
      keywords: ["indukciona ploča", "indukciona ploca"],
      type: "indukciona ploča",
    },
    {
      keywords: ["električna ploča", "elektricna ploca"],
      type: "električna ploča",
    },
    { keywords: ["zamrzivač", "škrinja", "skrinja"], type: "zamrzivač" },
    {
      keywords: ["frižider", "hladnjak", "frizider", "frižder", "frizder"],
      type: "frižider",
    },
    { keywords: ["bojler", "boiler", "grijač"], type: "bojler" },
    {
      keywords: ["šporet", "šparet", "sparet", "štednjak", "rerma"],
      type: "šporet",
    },
    {
      keywords: ["printer", "štampač", "stampač", "stampac", "štampac"],
      type: "printer",
    },
    { keywords: ["televizor", "televizija", "tv"], type: "televizor" },
    { keywords: ["laptop", "loptop"], type: "laptop" },
    { keywords: ["kompjuter", "računar", "pc"], type: "računar" },
    { keywords: ["monitor"], type: "monitor" },
    { keywords: ["usisivač"], type: "usisivač" },
    { keywords: ["pegla"], type: "pegla" },
    { keywords: ["mikser"], type: "mikser" },
    { keywords: ["blender"], type: "blender" },
    { keywords: ["klima"], type: "klima uređaj" },
  ];

  for (const entry of deviceTypes) {
    for (const keyword of entry.keywords) {
      if (input.includes(keyword)) return entry.type;
    }
  }

  return null;
}

// Returns true if the installation type text suggests furniture assembly
function isFurniture(text) {
  const input = normalizeText(text);
  const furnitureKeywords = [
    "namještaj",
    "ormar",
    "polica",
    "krevet",
    "komoda",
    "ladičar",
    "vitrina",
  ];
  return furnitureKeywords.some((kw) => input.includes(kw));
}

// Returns the instrumental (BHS "sa + instrumental") form of a device name
function getDeviceInstrumental(deviceType) {
  const forms = {
    bojler: "bojlerom",
    frižider: "frižiderom",
    zamrzivač: "zamrzivačem",
    sudomašina: "sudomašinom",
    "veš mašina": "veš mašinom",
    sušilica: "sušilicom",
    printer: "printerom",
    "indukciona ploča": "indukcionom pločom",
    "električna ploča": "električnom pločom",
    televizor: "televizorom",
    računar: "računarom",
    laptop: "laptopom",
    monitor: "monitorom",
    usisivač: "usisivačem",
    mikser: "mikserom",
    blender: "blenderom",
    pegla: "peglom",
    "klima uređaj": "klima uređajem",
    šporet: "šporetom",
  };
  return forms[deviceType] || deviceType;
}

// Returns a device-specific hint about where to find the model label
function getModelHint(deviceType) {
  const hints = {
    "veš mašina": "Model se često nalazi na naljepnici unutar vrata bubnja.",
    sudomašina: "Model se često nalazi na unutrašnjoj ivici vrata mašine.",
    bojler: "Model se obično nalazi na prednjoj ili bočnoj strani uređaja.",
    frižider: "Model se često nalazi unutar frižidera, na bočnom zidu.",
    zamrzivač: "Model se obično nalazi na unutrašnjoj strani vrata.",
    laptop: "Model se obično nalazi na naljepnici s donje strane.",
    šporet: "Model se obično nalazi na naljepnici sa stražnje strane.",
    televizor: "Model se obično nalazi na naljepnici s poleđine TV-a.",
    računar: "Model se obično nalazi na naljepnici na kućištu računara.",
  };
  return (
    hints[deviceType] ||
    "Model možete naći na naljepnici uređaja ili računu o kupovini."
  );
}

// [4d-UX] Returns true only for devices where "ugradbeni vs samostojeći"
// actually changes the intervention (built-in kitchen appliances, hobs,
// kitchen boilers). For računar, laptop, monitor, TV, printer and similar,
// this question is irrelevant — we skip straight to the photo step.
function shouldAskDeviceInstallType(deviceType) {
  const relevant = [
    "sudomašina",
    "veš mašina",
    "sušilica",
    "frižider",
    "zamrzivač",
    "šporet",
    "električna ploča",
    "indukciona ploča",
    "bojler",
  ];
  return relevant.includes(deviceType);
}

// [4d-UX] Standard DEVICES photo step prompt — aligned with the INSTALLATIONS
// photo prompt: max 2 photos, video not supported, "Dalje" guidance. Quick
// Reply ("Dalje") is attached in the Messenger webhook when state is
// ASK_PHOTOS.
function devicesPhotoPrompt() {
  return (
    "Bot: Hvala. Ako želite, pošaljite fotografiju uređaja, mjesta kvara ili " +
    "naljepnice sa modelom kroz Messenger (maksimalno 2 fotografije). " +
    "Video trenutno nije podržan. Ako ne želite poslati fotografiju, kliknite Dalje."
  );
}

// ── INSTALLATIONS v2 helpers ──────────────────────────────────────────────

// Detects installation sub-category (B1/B2/B3/B4) from free text.
// Returns "B1" | "B2" | "B3" | "B4" | null.
function extractInstallationType(text) {
  const input = normalizeText(text);

  // [polish] B3-priority items — endpoint plumbing fittings. If any appears,
  // classify as B3 even when a device name (e.g. bojler) is also mentioned
  // — the work is on the fitting, not the device.
  const b3PriorityKeywords = [
    "slavin",
    "česm",
    "cesm",
    "pipa",
    "ventil",
    "sifon",
    "vodokotlić",
    "vodokotlic",
    "wc kotlić",
    "wc kotlic",
    "wc šolj",
    "wc solj",
    "wc školjk",
    "wc skoljk",
    "vc šolj",
    "vc solj",
    "vc školjk",
    "vc skoljk",
    "bide",
    "tuš baterij",
    "tus baterij",
    "tuš kabin",
    "tus kabin",
    // [4c-UX-keyword-matrix] "tuš kad" covers tuš kada/kadu/kade — a real
    // bathtub/shower-tray plumbing item. Plain "kada" is intentionally NOT
    // listed because it also means "when" in BHS (false positives).
    "tuš kad",
    "tus kad",
    "fleksibiln",
    "fleks crijev",
    "lavabo",
    "umivaonik",
    "sudoper",
  ];
  if (b3PriorityKeywords.some((w) => input.includes(w))) return "B3";

  // B4 — device installation/connection: device name + install/connection intent
  const installIntent = [
    "ugradnj",
    "ugradi",
    "ugrađ",
    "ugradj",
    "montaž",
    "montira",
    "namontir",
    "instalacij",
    "postav",
    "postavlj",
    "kupio",
    "kupili",
    "kupila",
    "kupljen",
    "planiram",
    "priključ",
    "prikljuc",
    "spojiti",
    "spajanj",
    "povezati",
    "povezat",
    "sklop",
    "sklap",
    "sastav",
    "zamijen",
    "zamjen",
  ];
  const devices = [
    "bojler",
    "kuhinjski bojler",
    "mali bojler",
    "protočni bojler",
    "protocni bojler",
    "šporet",
    "sporet",
    "stednjak",
    "štednjak",
    "električni šporet",
    "elektricni sporet",
    "električni štednjak",
    "elektricni stednjak",
    // [fix-2] Stem-based ploč* covers ploča/ploče/ploči/ploču/plocu in all
    // BHS declensions ("ploče za kuhanje", "ploču za kuhanje", etc.).
    "ploč",
    "ploc",
    "indukciona ploč",
    "indukciona ploc",
    "ugradbena ploč",
    "ugradbena ploc",
    "električna ploč",
    "elektricna ploc",
    "sudomašin",
    "sudomasin",
    "perilica za suđe",
    "perilica za sudje",
    "mašina za suđe",
    "masina za sudje",
    "sudna mašin",
    "sudna masin",
    "mašina za pranje suđa",
    "masina za pranje sudja",
    "mašina za pranje posuđa",
    "masina za pranje posudja",
    "veš mašin",
    "ves masin",
    "vešna mašin",
    "vesna masin",
    "mašina za veš",
    "masina za ves",
    "mašina za pranje veša",
    "masina za pranje vesa",
    "mašin",
    "masin",
    "klima",
    "zamrziv",
    "frižider",
    "frizider",
    // [fix-2] napa/napu/nape covers BHS declensions of "napa".
    "napa",
    "napu",
    "nape",
  ];
  const hasInstall = installIntent.some((w) => input.includes(w));
  const hasDevice = devices.some((w) => input.includes(w));
  if (hasInstall && hasDevice) return "B4";

  // B3 — minor plumbing (visible/end-point components only)
  const b3Keywords = [
    "slavin",
    "česm",
    "cesm",
    "pipa",
    "ventil",
    "sifon",
    "toalet",
    "tuš baterij",
    "tus baterij",
    "tuš kabin",
    "tus kabin",
    // [4c-UX-keyword-matrix] Bathtub/shower-tray: unambiguous declined forms
    // only (kadu/kade/kadi/kadom) plus the "tuš kad" phrase. Plain "kada" is
    // omitted on purpose — it collides with the temporal word "kada" = "when".
    "tuš kad",
    "tus kad",
    "kadu",
    "kade",
    "kadi",
    "kadom",
    "vodokotlić",
    "vodokotlic",
    "wc kotlić",
    "wc kotlic",
    "wc šolj",
    "wc solj",
    "wc školjk",
    "wc skoljk",
    "vc šolj",
    "vc solj",
    "vc školjk",
    "vc skoljk",
    "bide",
    "kotlić",
    "kotlic",
    "fleksibiln",
    "fleks crijev",
    "fleks crijevo",
    "crijev",
    "crjev",
    "lavabo",
    "umivaonik",
    "sudoper",
    "vodovod",
    "cijev",
    "odvod",
    "curi ispod",
    "curenj",
    "pušta vodu",
    "pusta vodu",
    "kapanj",
  ];
  if (b3Keywords.some((w) => input.includes(w))) return "B3";

  // B2 — minor electrical (visible/end-point items only)
  const b2Keywords = [
    "utičnic",
    "uticnic",
    "prekidač",
    "prekidac",
    "rasvjet",
    "rasvjetn",
    "luster",
    "plafonjer",
    "lampa",
    "svjetiljk",
    "reflektor",
    "grlo sijal",
    "grlo",
    "sijalic",
    "žarulj",
    "zarulj",
    "svjetlo",
    "svijetlo",
    "svetlo",
    "svjetl",
    "svijetl",
    "svetl",
    "ne sija",
    "ne svijetli",
    "ne svjetli",
    "napon",
    "naponsk",
    "osigurač",
    "osigurac",
    "izbacuje osigura",
    "ispada osigura",
    "iskače osigura",
    "iskace osigura",
    "pada osigura",
    "kratki spoj",
    "kratak spoj",
    // [4c-UX-keyword-matrix] "tv nosač" intentionally removed from B2 — a TV
    // wall mount is furniture-style wall-mounting work, handled as B1 below.
    "električn",
    "elektricn",
    "struj",
  ];
  if (b2Keywords.some((w) => input.includes(w))) return "B2";

  // B1 — furniture assembly/disassembly
  const b1Keywords = [
    "namještaj",
    "namjesta",
    "ormar",
    "regal",
    "polic",
    "krevet",
    "komod",
    "ladič",
    "ladic",
    "vitrin",
    "stolic",
    "radni sto",
    "ogledal",
    "karniš",
    "karnis",
    "garniš",
    "garnis",
    "stalaž",
    "stalaz",
    // [4c-UX-keyword-matrix] TV wall mount = furniture-style wall mounting.
    "tv nosač",
    "tv nosac",
    "nosač za tv",
    "nosac za tv",
    // [4c-UX-keyword-matrix] Kitchen furniture (cabinets / hanging units /
    // kitchen block). Checked AFTER B4 (device install) and B3 (plumbing),
    // so "kuhinjsku napu" → B4 and "pipa u kuhinji" → B3 still win.
    "kuhinj",
  ];
  if (b1Keywords.some((w) => input.includes(w))) return "B1";

  // Combined-stem check for "kuhinjsk* element*" / "viseć* element*" in any
  // BHS declension.
  if (
    (input.includes("kuhinjsk") ||
      input.includes("viseć") ||
      input.includes("visec")) &&
    input.includes("elemen")
  ) {
    return "B1";
  }

  return null;
}

// Extracts the likely item name from the first user message.
// Returns canonical item name string, or null if not recognized.
function extractInstallationItem(text) {
  const input = normalizeText(text);

  // Multi-word / specific items first so they win over generic stems.
  const items = [
    { keywords: ["tv nosač", "tv nosac"], item: "TV nosač" },
    { keywords: ["tuš baterij", "tus baterij"], item: "tuš baterija" },
    { keywords: ["tuš kabin", "tus kabin"], item: "tuš kabina" },
    { keywords: ["radni sto"], item: "radni sto" },
    {
      keywords: ["fleksibilna crijev", "fleksibilno crijev", "fleks crijev"],
      item: "fleksibilna crijeva",
    },
    {
      keywords: [
        "vodokotlić",
        "vodokotlic",
        "wc kotlić",
        "wc kotlic",
        "kotlić",
        "kotlic",
      ],
      item: "vodokotlić",
    },
    {
      keywords: [
        "wc šolj",
        "wc solj",
        "wc školjk",
        "wc skoljk",
        "vc šolj",
        "vc solj",
        "vc školjk",
        "vc skoljk",
      ],
      item: "WC šolja",
    },
    { keywords: ["bide"], item: "bide" },
    {
      keywords: ["indukciona ploč", "indukciona ploc"],
      item: "indukciona ploča",
    },
    { keywords: ["ugradbena ploč", "ugradbena ploc"], item: "ugradbena ploča" },
    {
      keywords: ["električna ploč", "elektricna ploc"],
      item: "električna ploča",
    },
    {
      keywords: ["električni šporet", "elektricni sporet"],
      item: "električni šporet",
    },
    {
      keywords: ["električni štednjak", "elektricni stednjak"],
      item: "električni štednjak",
    },
    { keywords: ["kuhinjski bojler"], item: "kuhinjski bojler" },
    {
      keywords: ["protočni bojler", "protocni bojler"],
      item: "protočni bojler",
    },
    { keywords: ["mali bojler"], item: "mali bojler" },
    {
      keywords: ["kuhinjski element", "kuhinjske element", "kuhinjsk element"],
      item: "kuhinjski element",
    },
    {
      keywords: ["viseći element", "viseci element", "viseće element"],
      item: "viseći element",
    },
    { keywords: ["karniš", "karnis", "garniš", "garnis"], item: "karniša" },
    { keywords: ["grlo sijal"], item: "grlo sijalice" },
    { keywords: ["rasvjetno tijel"], item: "rasvjetno tijelo" },
    {
      keywords: [
        "sudomašin",
        "sudomasin",
        "mašina za suđe",
        "masina za sudje",
        "sudna mašin",
        "sudna masin",
        "perilica za suđe",
        "perilica za sudje",
      ],
      item: "sudomašina",
    },
    {
      keywords: [
        "veš mašin",
        "ves masin",
        "vešna mašin",
        "vesna masin",
        "mašina za veš",
        "masina za ves",
        "mašina za pranje veša",
        "masina za pranje vesa",
      ],
      item: "veš mašina",
    },
    { keywords: ["ogledalo"], item: "ogledalo" },
    { keywords: ["luster"], item: "luster" },
    { keywords: ["plafonjer"], item: "plafonjera" },
    { keywords: ["reflektor"], item: "reflektor" },
    { keywords: ["lampa"], item: "lampa" },
    { keywords: ["svjetiljk"], item: "svjetiljka" },
    { keywords: ["sijalic"], item: "sijalica" },
    { keywords: ["žarulj", "zarulj"], item: "sijalica" },
    { keywords: ["svjetlo", "svijetlo", "svetlo"], item: "svjetlo" },
    { keywords: ["rasvjetn"], item: "rasvjetno tijelo" },
    { keywords: ["osigurač", "osigurac"], item: "osigurač" },
    { keywords: ["utičnic", "uticnic"], item: "utičnica" },
    { keywords: ["prekidač", "prekidac"], item: "prekidač" },
    { keywords: ["slavin"], item: "slavina" },
    { keywords: ["česm", "cesm", "pipa"], item: "česma" },
    { keywords: ["ventil"], item: "ventil" },
    { keywords: ["sifon"], item: "sifon" },
    { keywords: ["crijev", "crjev"], item: "crijevo" },
    { keywords: ["lavabo"], item: "lavabo" },
    { keywords: ["umivaonik"], item: "umivaonik" },
    { keywords: ["sudoper"], item: "sudoper" },
    // [4c-UX-keyword-matrix] Bathtub/shower tray — unambiguous forms only.
    {
      keywords: ["tuš kad", "tus kad", "kadu", "kade", "kadi", "kadom"],
      item: "tuš kada",
    },
    { keywords: ["napa", "napu", "nape"], item: "napa" },
    { keywords: ["bojler"], item: "bojler" },
    { keywords: ["štednjak", "stednjak"], item: "štednjak" },
    { keywords: ["šporet", "sporet"], item: "šporet" },
    { keywords: ["ploč", "ploc"], item: "ploča" },
    { keywords: ["mašin", "masin"], item: "mašina" },
    { keywords: ["klima"], item: "klima uređaj" },
    { keywords: ["zamrziv"], item: "zamrzivač" },
    { keywords: ["frižider", "frizider"], item: "frižider" },
    { keywords: ["ormar"], item: "ormar" },
    { keywords: ["regal"], item: "regal" },
    { keywords: ["komod"], item: "komoda" },
    { keywords: ["krevet"], item: "krevet" },
    { keywords: ["polic"], item: "polica" },
    { keywords: ["vitrin"], item: "vitrina" },
    { keywords: ["ladič", "ladic"], item: "ladičar" },
    { keywords: ["stalaž", "stalaz"], item: "stalaža" },
    { keywords: ["stolic"], item: "stolica" },
    // [4c-UX-keyword-matrix] Kitchen furniture. Specific phrases first; the
    // bare "kuhinjski element" / declined "kuhinjskih elemenata" still resolve
    // via the existing element entry / combined fallback below.
    {
      keywords: ["kuhinjski blok", "kuhinjskog blok", "kuhinjsk blok"],
      item: "kuhinjski blok",
    },
    {
      keywords: [
        "viseća kuhinj",
        "viseca kuhinj",
        "viseću kuhinj",
        "visecu kuhinj",
        "viseće kuhinj",
        "visece kuhinj",
      ],
      item: "viseća kuhinja",
    },
    { keywords: ["kuhinju", "kuhinje", "kuhinja"], item: "kuhinja" },
    // [4c-UX-keyword-matrix] Generic furniture fallback so "rastavljanje
    // starog namještaja" yields a non-null item and skips ASK_ITEM_NAME.
    { keywords: ["namještaj", "namjesta"], item: "namještaj" },
  ];

  for (const entry of items) {
    for (const kw of entry.keywords) {
      if (input.includes(kw)) return entry.item;
    }
  }

  // [polish-fix] Combined-stem fallback for "kuhinjsk* elemen*" /
  // "viseć* elemen*" so we recognize declined plurals like
  // "kuhinjskih elemenata" (BHS genitive plural "elemen-AT-a" drops the t
  // before declension endings).
  if (input.includes("elemen")) {
    if (input.includes("viseć") || input.includes("visec"))
      return "viseći element";
    if (input.includes("kuhinjsk")) return "kuhinjski element";
  }

  return null;
}

// Determines whether an item is wall-mounted, ceiling-mounted, freestanding,
// or unknown. Drives whether the bot asks for wall type and dimensions.
function detectMountingMode(itemName) {
  if (!itemName) return "unknown";
  const input = normalizeText(itemName);

  const ceilingItems = ["luster", "plafonjer"];
  if (ceilingItems.some((w) => input.includes(w))) return "ceiling";

  const wallItems = [
    "tv nosač",
    "tv nosac",
    "polic",
    "ogledalo",
    "utičnic",
    "uticnic",
    "prekidač",
    "prekidac",
    "zidni bojler",
    "tuš baterij",
    "tus baterij",
    "viseć",
    "visec",
    "lampa",
    "svjetiljk",
    "reflektor",
    "karniš",
    "karnis",
    "garniš",
    "garnis",
    "kuhinjski element", // typically wall-mounted upper kitchen elements
  ];
  if (wallItems.some((w) => input.includes(w))) return "wall";

  const freestandingItems = [
    "ormar",
    "regal",
    "stalaž",
    "stalaz",
    "komod",
    "krevet",
    "vitrin",
    "stolic",
    "radni sto",
    "ladič",
    "ladic",
  ];
  if (freestandingItems.some((w) => input.includes(w))) return "freestanding";

  return "unknown";
}

// Parses combined "is item already purchased + new/used" answer.
// Returns { itemReady: true|false|null, itemCondition: "novo"|"polovno"|null }.
function parseItemReadyAndCondition(text) {
  const input = normalizeText(text);
  let itemReady = null;
  let itemCondition = null;

  // Check "not yet purchased" first — many of these contain words that would
  // otherwise match the "ready" phrases (e.g. "tek planiram kupiti").
  const readyFalsePhrases = [
    "nije kupljen",
    "nije kupljeno",
    "nisam kupio",
    "nismo kupili",
    "tek planiram",
    "planiram kupit",
    "planiram da kupim",
    "treba kupiti",
    "još nisam",
    "jos nisam",
    "nemam još",
    "nemam jos",
    "trebam kupiti",
  ];
  const readyTruePhrases = [
    "kupljen",
    "kupljeno",
    "kupio",
    "kupili",
    "kupila",
    "imamo ga",
    "imam ga",
    "spreman",
    "spremno",
    "već je tu",
    "vec je tu",
    "tu je",
    "već imam",
    "vec imam",
  ];

  if (readyFalsePhrases.some((p) => input.includes(p))) {
    itemReady = false;
  } else if (readyTruePhrases.some((p) => input.includes(p))) {
    itemReady = true;
  }

  // Condition: check polovno-family first so "novi predmet polovan" doesn't
  // misclassify on "nov".
  const polovnoMarkers = [
    "polovn",
    "polovan",
    "korišten",
    "koristen",
    "rabljen",
    "upotreblj",
    "star ",
    "stari",
    "staro",
  ];
  if (polovnoMarkers.some((m) => input.includes(m)) || input === "star") {
    itemCondition = "polovno";
  } else if (input.includes("nov")) {
    itemCondition = "novo";
  }

  return { itemReady, itemCondition };
}

// ── [4c-UX-polish] Out-of-scope detectors for B2/B3 major jobs ───────────

// Plumbing requests outside our scope (sewer, in-wall pipework, full
// reconstructions, main drains, vertical risers). Returns true ONLY for
// strong major-work signals. Endpoint clogs near siphon/sink/lavabo/umivaonik
// remain B3 because the work is local and visible.
function detectOutOfScopePlumbing(text) {
  const t = normalizeText(text);

  // Local endpoint context — if any of these appears, the request stays B3
  // even when a general "začepljen odvod" phrase is present. The work is on
  // a visible siphon/sink/lavabo/etc., not on a buried drain pipe.
  const localEndpointContext = [
    "sifon",
    "sudoper",
    "lavabo",
    "umivaonik",
    "ispod lavabo",
    "ispod sudoper",
    "ispod umivaonik",
    "u lavabou",
    "u sudoperu",
    "u umivaoniku",
  ];
  const hasLocalContext = localEndpointContext.some((p) => t.includes(p));

  // Strong major-work triggers — always out-of-scope.
  const strongTriggers = [
    "kanalizacij",
    "začepljena cijev",
    "zacepljena cijev",
    "začepljena odvodna cijev",
    "zacepljena odvodna cijev",
    "odvodna cijev",
    "cijev u zidu",
    "pukla cijev",
    "pucanj cijev",
    "pucanje cijev",
    "mijenjanj cijev",
    "izmjena cijev",
    "zamjena cijev",
    "nova vodovodna instalacij",
    "nova vodovodna",
    "vodovodna instalacij u stan",
    "glavni odvod",
    "vertikala",
    "odštopavanj kanalizacij",
    "odstopavanj kanalizacij",
  ];
  if (strongTriggers.some((p) => t.includes(p))) return true;

  // Generic "začepljen odvod" / "ne otiče voda" — out-of-scope only when no
  // local endpoint context appears alongside it.
  const genericClogTriggers = [
    "začepljen odvod",
    "zacepljen odvod",
    "začepljeni odvod",
    "zacepljeni odvod",
    "ne otiče voda",
    "ne otice voda",
  ];
  if (genericClogTriggers.some((p) => t.includes(p)) && !hasLocalContext) {
    return true;
  }

  return false;
}

// Electrical requests outside our scope (new installations, rewiring,
// junction boxes, full renovation wiring). Returns true ONLY for strong
// major-work signals. Local endpoint problems (osigurač izbacuje, ne radi
// svjetlo, kratki spoj na lusteru) remain B2.
function detectOutOfScopeElectrical(text) {
  const t = normalizeText(text);
  const strongTriggers = [
    "nova instalacij",
    "nova elektro instalacij",
    "kompletna instalacij",
    "cijela instalacij",
    "razvlačenj",
    "razvlacenj",
    "provlačenj",
    "provlacenj",
    "štemanj",
    "stemanj",
    "razvodne kutij",
    "razvodna kutij",
    "nova razvodna tabl",
    "glavni osigura",
    "glavni vod",
    "trofazna instalacij",
    "renoviram stan",
    "renoviranj stan",
    "rekonstrukcij struj",
    "rekonstrukcij instalacij",
    "novi raspored utičnic",
    "novi raspored uticnic",
    "nov raspored utičnic",
    "nov raspored uticnic",
  ];
  if (strongTriggers.some((p) => t.includes(p))) return true;

  // Combined-stem: cable wires through walls or across the whole apartment.
  if (
    (t.includes("kabl") || t.includes("žic")) &&
    (t.includes("u zid") || t.includes("po stan") || t.includes("u stan"))
  ) {
    return true;
  }

  // Wiring change verbs combined with cables.
  if (
    (t.includes("mijenjanj") ||
      t.includes("izmjen") ||
      t.includes("izmijen")) &&
    t.includes("kabl")
  ) {
    return true;
  }

  // "kratki spoj" alone is B2 unless the user qualifies it as in-wall / whole
  // apartment / inside the installation.
  if (
    (t.includes("kratki spoj") || t.includes("kratak spoj")) &&
    (t.includes("u zidu") ||
      t.includes("u stanu") ||
      t.includes("u cijelom stan") ||
      t.includes("u cijeloj instalacij") ||
      t.includes("u instalacij"))
  ) {
    return true;
  }

  return false;
}

// Detects demolition / removal of old item phrasing — kept for backwards
// compatibility but no longer the primary signal. Prefer the more specific
// detectDemolitionRequested + detectAlreadyRemovedOrReady helpers below.
function detectDemolition(text) {
  const t = normalizeText(text);
  const triggers = [
    "demontaž",
    "demontir",
    "rastavi",
    "skidanj star",
    "skinuti star",
    "skinut star",
    "uklanjanj star",
    "ukloniti star",
    "iznošenj",
    "iznosenj",
    "iznijeti",
    "iznesi",
    "stari namještaj",
    "stari namjestaj",
    "stari ormar",
    "stara kuhinj",
    "stari uređaj",
    "stari uredaj",
    "stari bojler",
    "demontira star",
  ];
  return triggers.some((p) => t.includes(p));
}

// True when the user clearly requests demolition/removal of an old item.
// Use this (not detectDemolition) to drive flow decisions.
function detectDemolitionRequested(text) {
  const t = normalizeText(text);

  // [fix-2] If the user is signalling "already removed / area is ready",
  // do NOT treat that as a request for demolition. The check inside ASK_
  // WORK_READY already guards this too, but we double-protect here so the
  // up-front detector doesn't push a false note from "Stari ormar je
  // demontiran i sklonjen.".
  if (detectAlreadyRemovedOrReady(t)) return false;

  // Direct trigger phrases — explicit "removal/demolition is needed" wording.
  const directTriggers = [
    "treba demontaž",
    "treba demontir",
    "treba demontira",
    "trebam demontaž",
    "trebam demontir",
    "treba skinuti star",
    "treba ukloniti star",
    "treba iznijeti star",
    "treba rastavi",
    "treba rastav",
    "treba rastavljanj",
    "trebam rastav",
    "skidanj starog",
    "skidanje starog",
    "skidanje stare",
    "skidanje staro",
    "demontaža starog",
    "demontaza starog",
    "demontaža stare",
    "demontaza stare",
    "demontaža staro",
    "demontažu starog",
    "demontazu starog",
    "demontažu stare",
    "demontazu stare",
    "demontažu ormara",
    "demontazu ormara",
    "demontažu starog ormara",
    "demontazu starog ormara",
    "rastavljanje starog",
    "rastavljanj starog",
    "uklanjanj starog",
    "ukloniti starog",
    "uklon starog",
    "iznošenj starog",
    "iznosenj starog",
    "iznijeti star",
    "majstor treba demontir",
    "treba sklonit star",
    "treba demontaža",
    "trebam demontažu",
    "trebam demontazu",
    "potrebna demontaža",
    "potrebna demontaza",
    "potrebno uklanjanj",
    "treba uklanjanj",
    "rastavljate li",
    "stari treba sklonit",
    "stari treba ukloni",
    "stari treba iznij",
  ];
  if (directTriggers.some((p) => t.includes(p))) return true;

  // [fix-2] Word-order variations — "stari/stara/staro/starog ... treba ...
  // <demolition verb>" and "da prvo stari rastavite". BHS lets the object
  // come before the verb, so the simple substring list above misses these.
  // [4c-UX-keyword-matrix] Verb set widened to also cover "uklanj"
  // (uklanjanje), "skinu" (skinuti), "skid" (skidanje), "iznoš" (iznošenje).
  const oldItemMentioned = /\bstar(?:i|a|o|e|u|og|oj|om|ih|im)?\b/i.test(t);
  const demolitionVerb =
    /(rastav|demonti|demontaž|demontaz|ukloni|uklanj|sklon|iznij|iznes|iznoš|skid|skinu)/i.test(
      t,
    );
  const needsIntent =
    /\b(treba|trebam|trebamo|treba mi|hocu|hoću|želim|zelim|prvo|moramo|moram)\b/i.test(
      t,
    );
  if (oldItemMentioned && demolitionVerb && needsIntent) return true;

  // [4c-UX-keyword-matrix] Removal verb + explicit new replacement — e.g.
  // "Trebam uklanjanje regala i montažu novog." The item being removed is
  // implicitly the old one even when the word "star" never appears. The
  // already-removed/ready guard at the top prevents false positives on
  // "Stari ... je već uklonjen, treba montirati novi."
  const newReplacement = /\bnov(?:i|a|o|e|u|og|om|oj|ih|im)?\b/i.test(t);
  if (demolitionVerb && newReplacement && needsIntent) return true;

  // "Da prvo stari rastavite" — short form, no explicit "treba".
  if (/\bprvo\b.*\bstar/i.test(t) && demolitionVerb) return true;
  if (/\bstar.*\bprvo\b/i.test(t) && demolitionVerb) return true;

  return false;
}

// True when the user signals the work area is already ready / old item
// already removed. Used in ASK_WORK_READY to avoid mis-tagging the answer
// as a "demolition requested" note.
function detectAlreadyRemovedOrReady(text) {
  const t = normalizeText(text);
  const triggers = [
    "je demontiran",
    "je demontirano",
    "je demontirana",
    "su demontirani",
    "demontiran i sklonjen",
    "demontirano i sklonjen",
    "već demontiran",
    "vec demontiran",
    "već skinut",
    "vec skinut",
    "već uklonjen",
    "vec uklonjen",
    "je sklonjen",
    "je sklonjeno",
    "je sklonjena",
    "je uklonjen",
    "je uklonjeno",
    "je uklonjena",
    "sve je sklonjen",
    "sve je uklonjen",
    "sve je spremno",
    "spreman za montaž",
    "spremno za montaž",
    "spremna za montaž",
    "prostor je oslobođen",
    "prostor je oslobodjen",
    "prostor je spreman",
    "već je uklonj",
    "vec je uklonj",
    "već je sklonj",
    "vec je sklonj",
  ];
  return triggers.some((p) => t.includes(p));
}

// Pushes a clean BHS note onto session.summaryNotes (initialized lazily).
// Internal notes (raw user text, debug labels) must never end up in the
// client-facing summary — only these curated BHS strings are.
function addBhsNote(session, bhsText) {
  if (!session.summaryNotes) session.summaryNotes = [];
  // Deduplicate identical BHS notes.
  if (!session.summaryNotes.includes(bhsText)) {
    session.summaryNotes.push(bhsText);
  }
}

// True if a work-readiness answer signals the area is not ready (e.g. "ne",
// "nije pripremljen", "staro nije sklonjeno"). Used to trigger the optional
// demolition follow-up question.
function isNegativeWorkReadyAnswer(text) {
  const t = normalizeText(text);
  if (t === "ne" || t === "nije") return true;
  if (
    t.startsWith("ne ") ||
    t.startsWith("ne,") ||
    t.startsWith("ne.") ||
    t.startsWith("ne-")
  )
    return true;
  if (t.startsWith("nije ") || t.startsWith("nije,") || t.startsWith("nije."))
    return true;
  if (t.includes("nije pripremljen")) return true;
  if (t.includes("nije spreman")) return true;
  if (t.includes("nije sklonjen")) return true;
  if (t.includes("nije uklonjen")) return true;
  if (
    t.includes("staro je tu") ||
    t.includes("stari je tu") ||
    t.includes("stara je tu")
  )
    return true;
  return false;
}

// For B4 devices where the standalone/built-in distinction is meaningful
// (stove, cooktop, dishwasher, washing machine, fridge).
function shouldAskStandaloneOrBuiltIn(itemName) {
  const item = normalizeText(itemName || "");
  const relevant = [
    "šporet",
    "sporet",
    "štednjak",
    "stednjak",
    "ploča",
    "ploca",
    "sudomašin",
    "sudomasin",
    "veš mašin",
    "ves masin",
    "mašin",
    "masin",
    "frižider",
    "frizider",
  ];
  return relevant.some((w) => item.includes(w));
}

// Standard INSTALLATIONS photo step prompt. Used by all paths converging at
// ASK_PHOTOS. Quick Reply ("Dalje") is attached in the Messenger webhook.
function installationsPhotoPrompt() {
  return (
    "Bot: Ako želite, pošaljite fotografiju trenutnog stanja ili mjesta montaže kroz Messenger " +
    "(maksimalno 2 fotografije). Video trenutno nije podržan. " +
    "Ako ne želite poslati fotografiju, kliknite Dalje."
  );
}

// Builds the access question wording per sub-category and item type.
// B2/B3 ask only about end-point/visible installations; B4 asks about
// device-specific connections.
function buildAccessQuestionForInstallations(session) {
  const itemLower = normalizeText(session.itemName || "");
  if (session.installationType === "B2") {
    return "Bot: Hvala. Da li je razvodna tabla sa osiguračima dostupna i da li su električne instalacije na mjestu rada u funkciji?";
  }
  if (session.installationType === "B3") {
    return "Bot: Hvala. Da li je ventil za zatvaranje vode dostupan i da li su postojeći priključci za vodu i odvod u funkciji?";
  }
  if (session.installationType === "B4") {
    if (itemLower.includes("bojler")) {
      return "Bot: Hvala. Da li je ventil za zatvaranje vode dostupan i da li su postojeći priključci za vodu i struju u funkciji?";
    }
    if (
      itemLower.includes("sudomašin") ||
      itemLower.includes("sudomasin") ||
      itemLower.includes("veš mašin") ||
      itemLower.includes("ves masin") ||
      itemLower.includes("mašin") ||
      itemLower.includes("masin")
    ) {
      return "Bot: Hvala. Da li su postojeći priključci za vodu, odvod i struju u funkciji?";
    }
    if (
      itemLower.includes("šporet") ||
      itemLower.includes("sporet") ||
      itemLower.includes("štednjak") ||
      itemLower.includes("stednjak") ||
      itemLower.includes("ploča") ||
      itemLower.includes("ploca")
    ) {
      return "Bot: Hvala. Da li postoji električni priključak za šporet/ploču i da li je u funkciji?";
    }
    if (itemLower.includes("napa")) {
      return "Bot: Hvala. Da li je električni priključak za napu dostupan i u funkciji?";
    }
    return "Bot: Hvala. Da li su potrebni priključci dostupni i u funkciji na mjestu rada?";
  }
  return "Bot: Hvala. Da li su potrebni uslovi pripremljeni na mjestu rada?";
}

// ── INSTALLATIONS flow dispatcher ─────────────────────────────────────────
// Centralised step router. Given the state just completed, returns the next
// prompt and updates session.state. Keeps state-machine handlers small.
function continueInstallationsFlow(session, fromState) {
  const isWall =
    session.mountingMode === "wall" || session.mountingMode === "ceiling";
  const type = session.installationType;

  if (
    fromState === "ASK_WORK_READY" ||
    fromState === "ASK_DEMOLITION_FOLLOWUP"
  ) {
    if (type === "B4") {
      if (shouldAskStandaloneOrBuiltIn(session.itemName)) {
        session.state = "ASK_STANDALONE_OR_BUILTIN";
        return "Bot: Razumijem. Da li je uređaj samostojeći ili ugradbeni?";
      }
      session.state = "ASK_ACCESS";
      return buildAccessQuestionForInstallations(session);
    }
    // B1
    if (isWall) {
      session.state = "ASK_WALL_TYPE";
      return "Bot: Razumijem. Kakav je zid ili površina? (beton, cigla, knauf/gips, drvo, ytong)";
    }
    session.state = "ASK_DIMENSIONS";
    return "Bot: Razumijem. Koje su dimenzije predmeta? (širina x visina x dubina)";
  }

  if (fromState === "ASK_STANDALONE_OR_BUILTIN") {
    session.state = "ASK_ACCESS";
    return buildAccessQuestionForInstallations(session);
  }

  if (fromState === "ASK_ACCESS") {
    if (type === "B2" || type === "B3") {
      session.state = "ASK_PHOTOS";
      return installationsPhotoPrompt();
    }
    // B4
    if (isWall) {
      session.state = "ASK_WALL_TYPE";
      return "Bot: Razumijem. Kakav je zid ili površina? (beton, cigla, knauf/gips, drvo, ytong)";
    }
    session.state = "ASK_BRAND";
    return "Bot: Hvala. Koji je brend (proizvođač) uređaja?";
  }

  if (fromState === "ASK_WALL_TYPE") {
    if (type === "B1") {
      session.state = "ASK_DIMENSIONS";
      return "Bot: Razumijem. Koje su dimenzije predmeta? (širina x visina x dubina)";
    }
    // B4
    session.state = "ASK_BRAND";
    return "Bot: Hvala. Koji je brend (proizvođač) uređaja?";
  }

  if (fromState === "ASK_MODEL") {
    // INSTALLATIONS B4 only — DEVICES path handled separately.
    if (isWall) {
      session.state = "ASK_DIMENSIONS";
      return "Bot: Razumijem. Koje su dimenzije ili težina predmeta koji se montira?";
    }
    session.state = "ASK_PHOTOS";
    return installationsPhotoPrompt();
  }

  if (fromState === "ASK_DIMENSIONS") {
    session.state = "ASK_PHOTOS";
    return installationsPhotoPrompt();
  }

  // [4c-UX-keyword-matrix] ASK_HAS_PART is DISABLED in the active v2 B2/B3
  // flow: asking "Da li već imate dio..." right after the problem description
  // added UX friction without clear value. The state + handler are kept in the
  // file for a possible V3 reintroduction, but this dispatcher no longer routes
  // into ASK_HAS_PART. The branch below is therefore unreachable in v2.
  if (fromState === "ASK_HAS_PART") {
    session.state = "ASK_ACCESS";
    return buildAccessQuestionForInstallations(session);
  }

  if (fromState === "ASK_PROBLEM_DESCRIPTION") {
    // v2: go straight to the access question, skipping ASK_HAS_PART.
    session.state = "ASK_ACCESS";
    return buildAccessQuestionForInstallations(session);
  }

  // Fallback — should not happen.
  session.state = "ASK_PHOTOS";
  return installationsPhotoPrompt();
}

// True if the session already carries a clean BHS note that demolition/
// removal of an old item is part of the job.
function sessionHasDemolitionRequestNote(session) {
  if (!session.summaryNotes) return false;
  return session.summaryNotes.some(
    (n) => n.includes("demontažu") || n.includes("uklanjanj"),
  );
}

// Initial step router after the bot recognises sub-category + item. Returns
// the intro prompt and sets the first real question state.
function nextAfterRecognitionInstallations(session) {
  const type = session.installationType;

  // [polish-fix] If demolition was already declared up-front, skip the
  // generic "Da li je prostor pripremljen..." question entirely — it would
  // contradict what the user just said. Record a clean workReady value and
  // route via the dispatcher to the next useful step.
  if (
    (type === "B1" || type === "B4") &&
    sessionHasDemolitionRequestNote(session)
  ) {
    session.workReady =
      "Prostor nije potpuno pripremljen — klijent traži demontažu/uklanjanje starog predmeta prije montaže/priključenja novog.";
    const intro =
      type === "B1"
        ? "Bot: Dobro, trebate montažu namještaja. Razumijem da je potrebno i uklanjanje starog predmeta. "
        : "Bot: Dobro, trebate ugradnju/priključenje uređaja. Razumijem da je potrebno i uklanjanje starog uređaja. ";
    const next = continueInstallationsFlow(session, "ASK_WORK_READY");
    // Strip the leading "Bot: " from the dispatcher reply so we can splice it.
    const nextStripped = next.replace(/^Bot:\s*/, "");
    return (
      intro +
      "Da bismo Vas što prije spojili sa majstorom, trebam još nekoliko informacija. " +
      nextStripped
    );
  }

  if (type === "B1") {
    session.state = "ASK_WORK_READY";
    return (
      "Bot: Dobro, trebate montažu namještaja. " +
      "Da bismo Vas što prije spojili sa majstorom, trebam još nekoliko informacija. " +
      "Da li je prostor pripremljen za rad? (stari predmet uklonjen, površina slobodna, mjesto pristupačno)"
    );
  }

  if (type === "B4") {
    session.state = "ASK_WORK_READY";
    return (
      "Bot: Dobro, trebate ugradnju/priključenje uređaja. " +
      "Da bismo Vas što prije spojili sa majstorom, trebam još nekoliko informacija. " +
      "Da li je prostor pripremljen za rad? (stari predmet uklonjen, površina slobodna, mjesto pristupačno)"
    );
  }

  if (type === "B2") {
    session.state = "ASK_PROBLEM_DESCRIPTION";
    return (
      "Bot: Dobro, trebate manju elektro intervenciju. " +
      "Da bismo Vas što prije spojili sa majstorom, trebam još nekoliko informacija. " +
      "Molim Vas da što detaljnije opišete problem koji imate."
    );
  }

  if (type === "B3") {
    session.state = "ASK_PROBLEM_DESCRIPTION";
    return (
      "Bot: Dobro, trebate manju vodoinstalatersku intervenciju. " +
      "Da bismo Vas što prije spojili sa majstorom, trebam još nekoliko informacija. " +
      "Molim Vas da što detaljnije opišete problem koji imate."
    );
  }

  // Type still unknown — ask user.
  session.state = "ASK_INSTALLATION_TYPE";
  return (
    "Bot: Dobro, vidim da Vam treba intervencija. Da bismo Vas što prije spojili sa majstorom, " +
    "trebam još nekoliko informacija. O kojoj vrsti radova se radi? " +
    "(npr. montaža namještaja, manja elektro intervencija, manja vodoinstalaterska intervencija, ugradnja/priključenje uređaja)"
  );
}

app.use(express.json());

// Token must match what you set in Meta App Dashboard → Webhooks
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "majstor_bl_verify_token";

// Facebook page token — set in Render environment variables, never hardcode
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// ── ASK_SERVICE logic — shared by START and ASK_SERVICE states ────────────
// Extracted so the first user message is processed immediately without forcing
// the user to repeat themselves after the initial greeting.
function handleAskService(session, tekst) {
  const inputLower = normalizeText(tekst);
  const greetings = [
    "zdravo",
    "dobar dan",
    "dobro jutro",
    "dobar vecer",
    "dobar vece",
    "dobar večer",
    "dobar veče",
    "pozdrav",
    "hej",
    "hey",
    "cao",
    "ćao",
    "ciao",
    "alo",
    "selam",
  ];
  const isGreetingOnly = greetings.some(
    (g) => inputLower === g || inputLower === g + "!" || inputLower === g + ".",
  );
  const contactIntentPhrases = [
    "kako da vas kontaktiram",
    "kako da vam se javim",
    "kako se možemo čuti",
    "kako se mozemo cuti",
    "kako da se čujemo",
    "kako da se cujemo",
    "kako da kontaktiram",
    "kako kontaktirati",
  ];
  const isContactIntent = contactIntentPhrases.some((p) =>
    inputLower.includes(p),
  );
  if (isGreetingOnly || isContactIntent) {
    return "Bot: Dobar dan! Kako Vam možemo pomoći?";
  }

  // [polish-fix] Out-of-scope guards run BEFORE classifyBranch so messages
  // like "začepljena odvodna cijev" don't fall into UNKNOWN. The guards are
  // nuanced (local endpoint context preserves B3/B2) and won't reject small
  // jobs.
  if (detectOutOfScopePlumbing(tekst)) {
    session.state = "END";
    return (
      "Bot: Žao nam je, trenutno ne obavljamo radove na kanalizaciji, cijevima u zidu " +
      "niti veće vodoinstalaterske rekonstrukcije. Radimo manje vodoinstalaterske intervencije " +
      "kao što su slavine, sifoni, ventili, fleksibilna crijeva, vodokotlići i slični vidljivi elementi."
    );
  }
  if (detectOutOfScopeElectrical(tekst)) {
    session.state = "END";
    return (
      "Bot: Žao nam je, trenutno ne radimo nove elektro instalacije, razvlačenje kablova, " +
      "razvodne kutije niti rekonstrukciju struje u stanu. Radimo manje elektro intervencije " +
      "kao što su zamjena utičnica, prekidača, osigurača i rasvjetnih tijela."
    );
  }

  const branch = classifyBranch(tekst);

  if (branch === "UNKNOWN") {
    return (
      "Bot: Nisam siguran o kakvoj se usluzi radi. Možete li precizirati? " +
      "Npr: 'popravka veš mašine', 'montaža ormara', 'zamjena slavine', 'ugradnja utičnice'."
    );
  }

  session.service = tekst;
  session.branch = branch;

  if (branch === "DEVICES") {
    const detectedType = extractDeviceType(tekst);
    if (detectedType) {
      session.deviceType = detectedType;
      session.state = "ASK_BRAND";
      const deviceText = getDeviceInstrumental(session.deviceType);
      return `Bot: Dobro, vidim da imate problem sa ${deviceText}. Da bismo Vas što prije spojili sa serviserom, trebam još nekoliko informacija. Koji je brend (proizvođač)?`;
    }
    session.state = "ASK_DEVICE_TYPE";
    return "Bot: Koji je tačno uređaj u pitanju? (npr. veš mašina, bojler, frižider, laptop)";
  }

  // [polish-fix] Detect demolition/removal request up-front. Use the new
  // nuanced helper so "stari ormar je demontiran i sklonjen" (already done)
  // does not get tagged as a removal request.
  if (detectDemolitionRequested(tekst)) {
    addBhsNote(
      session,
      "Klijent traži demontažu/uklanjanje starog predmeta prije montaže/priključenja novog.",
    );
  }

  // Detect sub-category and item from the first message so we can skip
  // redundant questions.
  const detectedType = extractInstallationType(tekst);
  if (detectedType) session.installationType = detectedType;

  const detectedItem = extractInstallationItem(tekst);
  if (detectedItem) {
    session.itemName = detectedItem;
    session.mountingMode = detectMountingMode(detectedItem);
  }

  // Sub-category unknown → ask the user.
  if (!session.installationType) {
    return nextAfterRecognitionInstallations(session);
  }

  // Sub-category known but item unknown → for B1/B4 we still need the item;
  // for B2/B3 a description-first approach is OK without a canonical item.
  if (
    !session.itemName &&
    (session.installationType === "B1" || session.installationType === "B4")
  ) {
    session.state = "ASK_ITEM_NAME";
    return (
      "Bot: Dobro, vidim da Vam treba intervencija. Da bismo Vas što prije spojili sa majstorom, " +
      "trebam još nekoliko informacija. Šta je tačno potrebno montirati, ugraditi ili priključiti?"
    );
  }

  return nextAfterRecognitionInstallations(session);
}

// Short BHS phrase describing the requested intervention. Accusative case so
// the reply reads naturally after "trebate ...".
function describeIntervention(session) {
  if (session.installationType === "B1") return "montažu namještaja";
  if (session.installationType === "B2") return "manju elektro intervenciju";
  if (session.installationType === "B3")
    return "manju vodoinstalatersku intervenciju";
  if (session.installationType === "B4") return "ugradnju/priključenje uređaja";
  return "intervenciju";
}

// ── Technician email notification (Task [5]) ───────────────────────────────
// Builds a plain-text email summary of a completed request. Returns
// { subject, text }. Pure function — does not touch the session or network,
// so it is safe to unit-test in isolation.
function buildTechnicianEmail(session) {
  const dash = "—";
  const branch = session.branch || dash;
  const timestamp = new Date().toISOString();

  const typeLabels = {
    B1: "B1 — montaža namještaja",
    B2: "B2 — manja elektro intervencija",
    B3: "B3 — manja vodoinstalaterska intervencija",
    B4: "B4 — ugradnja/priključenje uređaja",
  };

  // Guard for old sessions that may predate the summaryNotes field.
  const summaryNotes = Array.isArray(session.summaryNotes)
    ? session.summaryNotes
    : [];
  const photos = Array.isArray(session.photos) ? session.photos : [];
  const location = session.location || dash;

  // ── Subject line ──────────────────────────────────────────────────────
  let subjectDetail;
  if (branch === "DEVICES") {
    subjectDetail = session.deviceType || session.service || "uređaj";
  } else if (branch === "INSTALLATIONS") {
    subjectDetail =
      typeLabels[session.installationType] ||
      session.installationType ||
      "intervencija";
  } else {
    subjectDetail = "zahtjev";
  }
  const subjectLocation = session.location || "bez lokacije";
  const subject = `[NOVI ZAHTJEV] ${branch} — ${subjectDetail} — ${subjectLocation}`;

  // ── Request body lines ────────────────────────────────────────────────
  const lines = [];
  lines.push("NOVI ZAHTJEV — MAJSTOR BANJA LUKA");
  lines.push("");
  lines.push(`Vrijeme prijave: ${timestamp}`);
  lines.push(`Branch: ${branch}`);
  lines.push("");
  lines.push("--- PODACI O ZAHTJEVU ---");

  if (branch === "DEVICES") {
    lines.push(`Uređaj: ${session.deviceType || session.service || dash}`);
    lines.push(`Brend: ${session.brand || dash}`);
    lines.push(`Model: ${session.model || dash}`);
    lines.push(`Problem: ${session.description || dash}`);
    lines.push(`Učestalost kvara: ${session.faultPattern || dash}`);
    lines.push(`Tip uređaja: ${session.installType || dash}`);
  } else if (branch === "INSTALLATIONS") {
    lines.push(
      `Vrsta radova: ${
        typeLabels[session.installationType] || session.installationType || dash
      }`,
    );
    lines.push(`Predmet/intervencija: ${session.itemName || dash}`);
    lines.push(`Opis problema: ${session.description || dash}`);
    lines.push(`Prostor pripremljen: ${session.workReady || dash}`);
    lines.push(
      `Napomene: ${summaryNotes.length > 0 ? summaryNotes.join(" ") : dash}`,
    );
    lines.push(`Zid/površina: ${session.wallType || dash}`);
    lines.push(`Pristup instalacijama: ${session.accessInfo || dash}`);
    lines.push(`Brend: ${session.brand || dash}`);
    lines.push(`Model: ${session.model || dash}`);
    lines.push(`Dimenzije: ${session.dimensions || dash}`);
  } else {
    lines.push(`Usluga: ${session.service || dash}`);
  }

  lines.push("");
  lines.push("--- KONTAKT ---");
  lines.push(`Telefon: ${session.phone || dash}`);
  lines.push(`Lokacija/adresa: ${location}`);
  lines.push(`Ime: ${session.name || dash}`);

  lines.push("");
  lines.push("--- FOTOGRAFIJE ---");
  lines.push(`Broj fotografija: ${photos.length}`);
  if (photos.length === 0) {
    lines.push("Nema fotografija.");
  } else {
    photos.forEach((url, i) => lines.push(`${i + 1}. ${url}`));
  }

  return { subject, text: lines.join("\n") };
}

// Sends the technician notification email. NON-BLOCKING, SAFE, IDEMPOTENT:
// callers do not await it, it never throws, it skips silently when env vars
// are missing, and it marks emailSent only after a successful send so a failed
// attempt can be retried in the future.
async function sendSummaryEmail(session) {
  if (!session || session.emailSent) return;

  const { BREVO_API_KEY, EMAIL_FROM, EMAIL_TO, EMAIL_FROM_NAME } = process.env;
  if (!BREVO_API_KEY || !EMAIL_FROM || !EMAIL_TO) {
    console.warn(
      "Email notification skipped: missing BREVO_API_KEY, EMAIL_FROM or EMAIL_TO.",
    );
    return;
  }

  try {
    const email = buildTechnicianEmail(session);

    const payload = {
      sender: {
        email: EMAIL_FROM,
        name: EMAIL_FROM_NAME || "Majstor Banja Luka",
      },
      to: [{ email: EMAIL_TO }],
      subject: email.subject,
      textContent: email.text,
    };

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      throw new Error(`Brevo API error ${response.status}: ${responseBody}`);
    }

    session.emailSent = true;
    console.log("Technician email notification sent.");
  } catch (err) {
    console.error("Technician email notification failed:", err.message);
  }
}

// ── Core chatbot logic ─────────────────────────────────────────────────────
// Receives a userId and the user's text, runs it through the state machine,
// and returns the bot's reply as a string (with "Bot: " prefix).
// Called by both GET /next (browser testing) and POST /webhook (Messenger).
function processMessage(userId, tekst) {
  // Initialize session for this user if one doesn't exist yet
  if (!sessions[userId]) {
    sessions[userId] = createSession();
  }

  const session = sessions[userId];

  // Block empty input for all states except START and END.
  // START is triggered without tekst intentionally (first /next call); END
  // is post-completion and has its own polite handler below.
  if (
    session.state !== "START" &&
    session.state !== "END" &&
    normalizeText(tekst) === ""
  ) {
    return "Bot: Molim Vas unesite odgovor kako bismo nastavili.";
  }

  if (session.state === "START") {
    session.state = "ASK_SERVICE";
    // Empty first call (e.g. /next with no tekst) — return the standard opening
    if (normalizeText(tekst) === "") {
      return "Bot: Zdravo! Koju uslugu trebate? Opišite ukratko šta Vam treba.";
    }
    // First message contains real content — process immediately so user doesn't repeat
    return handleAskService(session, tekst);
  } else if (session.state === "ASK_SERVICE") {
    return handleAskService(session, tekst);
  } else if (session.state === "ASK_DEVICE_TYPE") {
    session.deviceType = tekst;
    session.state = "ASK_BRAND";
    return "Bot: Razumijem. Koji je brend (proizvođač) uređaja?";
  } else if (session.state === "ASK_BRAND") {
    session.brand = tekst;
    session.state = "ASK_MODEL";
    // DEVICES uses deviceType for the label hint; INSTALLATIONS B4 uses itemName.
    const hintKey =
      session.branch === "DEVICES" ? session.deviceType : session.itemName;
    const modelHint = getModelHint(hintKey);
    return `Bot: Hvala. Koji je model uređaja? ${modelHint}`;
  } else if (session.state === "ASK_MODEL") {
    const modelUnknown = [
      "ne znam",
      "neznam",
      "ne znam model",
      "nemam",
      "nisam siguran",
      "nisam sigurna",
    ];
    const isUnknown = modelUnknown.some((u) =>
      normalizeText(tekst).includes(u),
    );
    session.model = isUnknown ? "nepoznat" : tekst;

    if (session.branch === "INSTALLATIONS") {
      return continueInstallationsFlow(session, "ASK_MODEL");
    }

    session.state = "ASK_DESCRIPTION";
    return "Bot: Dobro. Opišite nam problem — šta se tačno dešava sa uređajem?";
  } else if (session.state === "ASK_DESCRIPTION") {
    // DEVICES-only step (INSTALLATIONS v2 does not collect a description).
    session.description = tekst;
    session.state = "ASK_FAULT_PATTERN";
    return "Bot: Razumijem. Da li se problem javlja stalno ili povremeno?";
  } else if (session.state === "ASK_FAULT_PATTERN") {
    session.faultPattern = tekst;
    // [4d-UX] Ask "ugradbeni/samostojeći" ONLY for devices where it matters
    // (built-in kitchen appliances). The room/location question was removed —
    // address is collected later in the contact block. Other devices skip
    // straight to the photo step.
    if (shouldAskDeviceInstallType(session.deviceType)) {
      session.state = "ASK_INSTALL_TYPE";
      return "Bot: Dobro. Da li je uređaj ugradbeni ili samostojeći?";
    }
    session.state = "ASK_PHOTOS";
    return devicesPhotoPrompt();
  } else if (session.state === "ASK_LOCATION") {
    // Contact-block location step — shared by DEVICES v2 and INSTALLATIONS v2.
    // Optional in both branches: user can type "dalje" to skip.
    if (!isContinueAnswer(tekst)) {
      session.location = tekst;
    }
    session.state = "ASK_NAME";
    return "Bot: Na koje ime da evidentiramo zahtjev? Ako ne želite, napišite Dalje.";
  } else if (session.state === "ASK_INSTALL_TYPE") {
    session.installType = tekst;
    session.state = "ASK_PHOTOS";
    return devicesPhotoPrompt();

    // ── INSTALLATIONS v2 polish state machine ────────────────────────────────
  } else if (session.state === "ASK_INSTALLATION_TYPE") {
    // Re-classify from the user's clarification.
    const detectedType = extractInstallationType(tekst);
    if (detectedType) session.installationType = detectedType;

    // Try to also extract an item from the same message.
    const detectedItem = extractInstallationItem(tekst);
    if (detectedItem && !session.itemName) {
      session.itemName = detectedItem;
      session.mountingMode = detectMountingMode(detectedItem);
    }

    if (detectDemolitionRequested(tekst)) {
      addBhsNote(
        session,
        "Klijent traži demontažu/uklanjanje starog predmeta prije montaže/priključenja novog.",
      );
    }

    if (!session.installationType) {
      // Still couldn't classify — keep asking, no infinite loop because the
      // next message has another chance.
      session.installationType = tekst; // raw fallback so summary isn't empty
    }

    if (
      !session.itemName &&
      (session.installationType === "B1" || session.installationType === "B4")
    ) {
      session.state = "ASK_ITEM_NAME";
      return "Bot: Razumijem. Šta je tačno potrebno montirati, ugraditi ili priključiti?";
    }

    return nextAfterRecognitionInstallations(session);
  } else if (session.state === "ASK_ITEM_NAME") {
    // Store the item name and infer mountingMode.
    const detectedItem = extractInstallationItem(tekst);
    session.itemName = detectedItem || tekst;
    session.mountingMode = detectMountingMode(session.itemName);

    // Try to also lock in installationType from this message if still missing.
    if (!["B1", "B2", "B3", "B4"].includes(session.installationType || "")) {
      const detectedType = extractInstallationType(tekst);
      if (detectedType) session.installationType = detectedType;
    }

    if (detectDemolitionRequested(tekst)) {
      addBhsNote(
        session,
        "Klijent traži demontažu/uklanjanje starog predmeta prije montaže/priključenja novog.",
      );
    }

    return nextAfterRecognitionInstallations(session);
  } else if (session.state === "ASK_PROBLEM_DESCRIPTION") {
    // B2/B3 problem-first flow: store description, then ask whether client
    // already has the replacement part.
    session.description = tekst;
    return continueInstallationsFlow(session, "ASK_PROBLEM_DESCRIPTION");
  } else if (session.state === "ASK_HAS_PART") {
    const lower = normalizeText(tekst);
    const userHas = [
      "imam",
      "imamo",
      "kod mene",
      "kupljen",
      "nabavljen",
      "već imam",
      "vec imam",
    ];
    const majstorBrings = [
      "donese",
      "donesite",
      "donesi",
      "nemam",
      "neka donese",
      "neka majstor",
    ];
    if (userHas.some((w) => lower.includes(w))) {
      session.itemReady = true;
      addBhsNote(
        session,
        "Klijent već ima dio koji treba ugraditi/zamijeniti.",
      );
    } else if (majstorBrings.some((w) => lower.includes(w)) || lower === "ne") {
      session.itemReady = false;
      addBhsNote(
        session,
        "Klijent je naveo da majstor treba donijeti dio/materijal.",
      );
    }
    return continueInstallationsFlow(session, "ASK_HAS_PART");
  } else if (session.state === "ASK_WALL_TYPE") {
    session.wallType = tekst;
    return continueInstallationsFlow(session, "ASK_WALL_TYPE");
  } else if (session.state === "ASK_ACCESS") {
    session.accessInfo = tekst;
    return continueInstallationsFlow(session, "ASK_ACCESS");
  } else if (session.state === "ASK_STANDALONE_OR_BUILTIN") {
    const lower = normalizeText(tekst);
    if (lower.includes("ugradb") || lower.includes("ugradn")) {
      addBhsNote(session, "Uređaj je naveden kao ugradbeni.");
    } else if (lower.includes("samostoj") || lower.includes("slobod")) {
      addBhsNote(session, "Uređaj je naveden kao samostojeći.");
    }
    return continueInstallationsFlow(session, "ASK_STANDALONE_OR_BUILTIN");
  } else if (session.state === "ASK_WORK_READY") {
    session.workReady = tekst;

    // [polish-fix] Distinguish "old item is already removed" (work area is
    // ready) from "demolition still needs to happen". Only the latter
    // qualifies as a demolition request worth a separate note.
    const alreadyRemoved = detectAlreadyRemovedOrReady(tekst);
    const askingForDemolition =
      detectDemolitionRequested(tekst) ||
      (detectDemolition(tekst) && !alreadyRemoved);

    if (askingForDemolition) {
      addBhsNote(
        session,
        "Klijent traži demontažu/uklanjanje starog predmeta prije montaže/priključenja novog.",
      );
    }

    const alreadyNotedDemolition = sessionHasDemolitionRequestNote(session);
    if (
      isNegativeWorkReadyAnswer(tekst) &&
      !alreadyNotedDemolition &&
      !alreadyRemoved
    ) {
      session.state = "ASK_DEMOLITION_FOLLOWUP";
      return "Bot: Da li Vam je potrebno uklanjanje/demontaža starog predmeta prije montaže/priključenja novog?";
    }

    return continueInstallationsFlow(session, "ASK_WORK_READY");
  } else if (session.state === "ASK_DEMOLITION_FOLLOWUP") {
    const lower = normalizeText(tekst);
    if (
      lower === "da" ||
      lower.startsWith("da ") ||
      lower.startsWith("da,") ||
      lower.includes("treba")
    ) {
      addBhsNote(
        session,
        "Klijent traži demontažu/uklanjanje starog predmeta prije montaže/priključenja novog.",
      );
    }
    return continueInstallationsFlow(session, "ASK_DEMOLITION_FOLLOWUP");
  } else if (session.state === "ASK_DIMENSIONS") {
    session.dimensions = tekst;
    return continueInstallationsFlow(session, "ASK_DIMENSIONS");
  } else if (session.state === "ASK_PHOTOS") {
    if (isContinueAnswer(tekst)) {
      // Both branches converge on ASK_CONFIRMATION.
      session.state = "ASK_CONFIRMATION";
      if (session.branch === "INSTALLATIONS") {
        return "Bot: Hvala na informacijama. Da li želite da Vas naš majstor kontaktira radi dogovora oko dolaska na teren i izvođenja radova? (da/ne)";
      }
      return "Bot: Hvala na informacijama. Da li želite da Vas naš serviser kontaktira radi dogovora termina posjete i popravke uređaja? (da/ne)";
    }

    if (session.photos.length >= 2) {
      return "Bot: Primili smo maksimalan broj fotografija (2). Napišite 'dalje' za nastavak.";
    }

    // Text in ASK_PHOTOS is NOT a photo — photos only arrive as attachments via POST /webhook.
    // Any other text: remind the user to send a photo or write Dalje.
    if (session.branch === "INSTALLATIONS") {
      return installationsPhotoPrompt();
    }
    return "Bot: Ako želite, pošaljite fotografiju. Ako nemate fotografiju, napišite Dalje.";

    // ── Contact block (shared by DEVICES v2 + INSTALLATIONS v2) ──────────────
  } else if (session.state === "ASK_CONFIRMATION") {
    const confirmAnswer = normalizeText(tekst);
    const isYes = [
      "da",
      "može",
      "hocu",
      "hoću",
      "naravno",
      "ok",
      "svakako",
      "jeste",
    ].some(
      (w) =>
        confirmAnswer === w ||
        confirmAnswer.startsWith(w + " ") ||
        confirmAnswer.includes(w),
    );
    if (isYes) {
      session.state = "ASK_PHONE";
      if (session.branch === "INSTALLATIONS") {
        return "Bot: Molimo Vas pošaljite broj telefona na koji Vas majstor može kontaktirati.";
      }
      return "Bot: Molimo Vas pošaljite broj telefona na koji Vas serviser može kontaktirati.";
    }
    // Negative answer — close politely
    session.state = "END";
    return "Bot: U redu. Hvala Vam što ste nas kontaktirali. Sretno!";
  } else if (session.state === "ASK_PHONE") {
    // Phone is mandatory; allow one retry if user refuses before closing session
    const hasDigit = /\d/.test(tekst);
    const phoneAnswer = normalizeText(tekst);
    const refusalWords = ["ne", "nema", "neću", "ne dam", "nemam"];
    const isRefusal =
      !hasDigit &&
      refusalWords.some(
        (w) =>
          phoneAnswer === w ||
          phoneAnswer.startsWith(w + " ") ||
          phoneAnswer === w + ".",
      );

    if (isRefusal) {
      if (!session.phoneRefusedOnce) {
        session.phoneRefusedOnce = true;
        if (session.branch === "INSTALLATIONS") {
          return "Bot: Razumijem, ali broj telefona je potreban da bi Vas majstor mogao kontaktirati i dogovoriti detalje. Molimo pošaljite broj telefona.";
        }
        return "Bot: Razumijem, ali broj telefona je potreban da bi Vas serviser mogao kontaktirati. Molimo pošaljite broj telefona.";
      }
      // Second refusal — close politely
      session.state = "END";
      if (session.branch === "INSTALLATIONS") {
        return "Bot: Razumijemo Vaš stav. Bez broja telefona ne možemo proslijediti zahtjev majstoru. Hvala Vam što ste nas kontaktirali.";
      }
      return "Bot: Razumijemo Vaš stav. Hvala Vam što ste nas kontaktirali. Sretno!";
    }

    session.phone = tekst;
    session.state = "ASK_LOCATION";
    if (session.branch === "INSTALLATIONS") {
      return "Bot: Možete li poslati adresu ili lokaciju gdje bi se radovi obavljali? Ako ne želite tačnu adresu, napišite samo naselje ili dio grada. Ako želite preskočiti, napišite Dalje.";
    }
    return "Bot: Možete li poslati adresu ili naselje gdje bi serviser trebao doći? Ako ne želite tačnu adresu, napišite samo naselje ili dio grada. Ako želite preskočiti, napišite Dalje.";
  } else if (session.state === "ASK_NAME") {
    // Optional — "dalje" skips name; summary is generated immediately after
    if (!isContinueAnswer(tekst)) {
      session.name = tekst;
    }
    session.state = "END";

    const photoCount = session.photos.length;

    if (session.branch === "INSTALLATIONS") {
      const typeLabels = {
        B1: "B1 — montaža namještaja",
        B2: "B2 — manja elektro intervencija",
        B3: "B3 — manja vodoinstalaterska intervencija",
        B4: "B4 — ugradnja/priključenje uređaja",
      };
      const typeLine =
        typeLabels[session.installationType] || session.installationType || "—";

      // Build summary by appending only populated fields — keeps the message
      // short for small jobs and grows naturally when more was collected.
      const lines = ["--- REZIME ---", `Vrsta radova: ${typeLine}`];
      if (session.itemName)
        lines.push(`Predmet/intervencija: ${session.itemName}`);
      if (session.description)
        lines.push(`Opis problema: ${session.description}`);
      if (session.workReady)
        lines.push(`Prostor pripremljen: ${session.workReady}`);
      // [polish-fix] Napomene — only the curated BHS notes from summaryNotes,
      // and only those whose meaning isn't already implied by workReady.
      if (session.summaryNotes && session.summaryNotes.length > 0) {
        const workReadyLower = normalizeText(session.workReady || "");
        const usefulNotes = session.summaryNotes.filter((note) => {
          // Skip demolition note if workReady already conveys it.
          const isDemoNote =
            note.includes("demontažu") || note.includes("uklanjanj");
          if (
            isDemoNote &&
            (workReadyLower.includes("demontir") ||
              workReadyLower.includes("demontaž") ||
              workReadyLower.includes("uklanjanj") ||
              workReadyLower.includes("uklonjen") ||
              workReadyLower.includes("sklonjen") ||
              workReadyLower.includes("klijent traži demontažu"))
          ) {
            return false;
          }
          return true;
        });
        if (usefulNotes.length > 0) {
          lines.push(`Napomene: ${usefulNotes.join(" ")}`);
        }
      }
      if (session.wallType) lines.push(`Zid/površina: ${session.wallType}`);
      if (session.accessInfo)
        lines.push(`Pristup instalacijama: ${session.accessInfo}`);
      if (session.brand) lines.push(`Brend: ${session.brand}`);
      if (session.model) lines.push(`Model: ${session.model}`);
      if (session.dimensions) lines.push(`Dimenzije: ${session.dimensions}`);
      lines.push(`Broj fotografija: ${photoCount}`);
      lines.push(`Telefon: ${session.phone}`);
      if (session.location) lines.push(`Lokacija/adresa: ${session.location}`);
      if (session.name) lines.push(`Ime: ${session.name}`);
      lines.push("----------------");

      const finalReply = `Bot: Hvala Vam! Vaš zahtjev je primljen.

${lines.join("\n")}

Naš majstor će Vas kontaktirati u najkraćem roku!`;

      // Non-blocking technician notification — self-catches all errors so a
      // failed/skipped email never affects the user-facing reply.
      sendSummaryEmail(session);

      return finalReply;
    }

    // DEVICES summary (v2). installType is only collected for built-in
    // appliances (shouldAskDeviceInstallType), so show it only when present.
    const deviceInstallLine = session.installType
      ? `\nTip uređaja: ${session.installType}`
      : "";
    const finalReply = `Bot: Hvala Vam! Vaš zahtjev je primljen.

--- REZIME ---
Uređaj: ${session.deviceType || session.service}
Brend: ${session.brand}
Model: ${session.model}
Problem: ${session.description}
Učestalost kvara: ${session.faultPattern}${deviceInstallLine}
Broj fotografija: ${photoCount}
Telefon: ${session.phone}
Lokacija/adresa: ${session.location || "—"}
Ime: ${session.name || "—"}
----------------

Naš serviser će Vas kontaktirati u najkraćem roku!`;

    // Non-blocking technician notification — self-catches all errors so a
    // failed/skipped email never affects the user-facing reply.
    sendSummaryEmail(session);

    return finalReply;
  } else if (session.state === "END") {
    // Post-completion handler — never leak internal state names to the user.
    const lower = normalizeText(tekst);
    if (lower.includes("hvala")) {
      return "Bot: Hvala Vama.";
    }
    return "Bot: Hvala Vam. Ako budete imali novi zahtjev, slobodno nam ponovo pišite.";
  }

  // Fallback — should not normally be reached. Always reply politely; never
  // expose the internal state name.
  return "Bot: Hvala Vam. Ako budete imali novi zahtjev, slobodno nam ponovo pišite.";
}

// ── Channel-agnostic entry point (Task [7a]) ────────────────────────────────
// Thin wrapper that builds the channel-aware session key and delegates to the
// existing processMessage() state machine, returning EXACTLY the same reply
// string. Behavior is unchanged — this only standardises how any channel hands
// an incoming text message to the core bot, so future channels (Web, Viber,
// WhatsApp) can reuse the same flow without raw user-id collisions.
function handleIncomingText({ channel, userId, text }) {
  const sessionKey = buildSessionKey(channel, userId);
  return processMessage(sessionKey, text);
}

// ── Sends a text reply to a Messenger user via the Facebook Send API ───────
// Makes a POST to graph.facebook.com/v18.0/me/messages with the reply text.
// Uses PAGE_ACCESS_TOKEN from environment variables — never hardcoded.
function sendMessengerReply(recipientId, messageText) {
  const body = JSON.stringify({
    recipient: { id: recipientId },
    message: { text: messageText },
  });

  const options = {
    hostname: "graph.facebook.com",
    path: `/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  };

  const req = https.request(options, (fbRes) => {
    let data = "";
    fbRes.on("data", (chunk) => {
      data += chunk;
    });
    fbRes.on("end", () => {
      if (fbRes.statusCode !== 200) {
        console.error("Facebook Send API error:", fbRes.statusCode, data);
      }
    });
  });

  req.on("error", (err) => {
    console.error("Failed to send Messenger reply:", err.message);
  });

  req.write(body);
  req.end();
}

// ── Sends a Messenger reply with Quick Reply buttons ──────────────────────
// Used on the ASK_PHOTOS step for BOTH DEVICES and INSTALLATIONS branches.
// quickReplies is an array of { title, payload } objects; Messenger sends back
// the payload as the user's next message when the button is clicked.
function sendMessengerQuickReply(recipientId, messageText, quickReplies) {
  const body = JSON.stringify({
    recipient: { id: recipientId },
    message: {
      text: messageText,
      quick_replies: quickReplies.map((qr) => ({
        content_type: "text",
        title: qr.title,
        payload: qr.payload,
      })),
    },
  });

  const options = {
    hostname: "graph.facebook.com",
    path: `/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  };

  const req = https.request(options, (fbRes) => {
    let data = "";
    fbRes.on("data", (chunk) => {
      data += chunk;
    });
    fbRes.on("end", () => {
      if (fbRes.statusCode !== 200) {
        console.error(
          "Facebook Send API error (quick reply):",
          fbRes.statusCode,
          data,
        );
      }
    });
  });

  req.on("error", (err) => {
    console.error("Failed to send Messenger quick reply:", err.message);
  });

  req.write(body);
  req.end();
}

// ── Meta verification endpoint ─────────────────────────────────────────────
// Meta calls this once when you register the webhook URL in the dashboard.
// It sends hub.mode, hub.verify_token, and hub.challenge as query params.
// We confirm our token matches, then echo back hub.challenge to complete setup.
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified by Meta.");
    return res.status(200).send(challenge);
  }

  console.warn("Webhook verification failed — token mismatch or wrong mode.");
  return res.status(403).send("Forbidden");
});

// ── Incoming Messenger events endpoint ────────────────────────────────────
// Meta sends all Messenger events here via POST.
// res.send() is called AFTER the forEach so that all sendMessengerReply()
// calls are initiated before Render's proxy closes the inbound connection.
app.post("/webhook", (req, res) => {
  // DEBUG [4a]: confirm every Meta call reaches this handler
  console.log("[webhook] POST /webhook hit");

  const body = req.body;

  // DEBUG [4a]: shows whether Meta labelled this as a page subscription event
  console.log("[webhook] body.object:", body?.object);

  // Non-page events (e.g. Instagram) — acknowledge and stop immediately
  if (body.object !== "page") {
    res.status(200).send("EVENT_RECEIVED");
    return;
  }

  // Messenger payloads are structured as: body.entry[].messaging[]
  body.entry?.forEach((entry) => {
    entry.messaging?.forEach((event) => {
      const senderId = event.sender?.id;

      // Log and skip non-message events (delivery receipts, read receipts, reactions)
      if (!event.message) {
        const eventType = event.delivery
          ? "delivery"
          : event.read
            ? "read"
            : event.reaction
              ? "reaction"
              : "unknown";
        console.log(
          `[webhook] non-message event from ${senderId}: ${eventType} — skipped`,
        );
        return;
      }

      // DEBUG [4a]: log the raw event shape before any type checks
      console.log(`[webhook] event — senderId: ${senderId}`);
      console.log(
        `[webhook] event.message keys: [${Object.keys(event.message || {}).join(", ")}]`,
      );
      const dbgHasAttachments = Array.isArray(event.message?.attachments);
      console.log(`[webhook] has attachments: ${dbgHasAttachments}`);
      if (dbgHasAttachments) {
        const dbgTypes = event.message.attachments
          .map((a) => a.type)
          .join(", ");
        console.log(`[webhook] attachment types: ${dbgTypes}`);
      }

      if (!senderId) return;

      // [7a] Channel-aware session key. BOTH the text path and the photo/
      // attachment path below MUST use this exact same key, otherwise photos
      // and text would land in two different sessions for the same Messenger
      // user. buildSessionKey is deterministic, so handleIncomingText() (text)
      // and sessions[sessionKey] (attachments) always resolve to the same
      // "messenger:<senderId>" session.
      const sessionKey = buildSessionKey("messenger", senderId);

      const attachments = event.message?.attachments;
      const text = event.message?.text;

      // ── Image/attachment handling ──────────────────────────────────────
      // If the event contains attachments, handle them and skip text processing.
      // Messenger sends photos as attachments with type "image".
      if (attachments && attachments.length > 0) {
        // Ensure a session exists for this user (same channel-aware key as text)
        if (!sessions[sessionKey]) {
          sessions[sessionKey] = createSession();
        }
        const session = sessions[sessionKey];

        let imageCount = 0; // how many image attachments were in this event
        let storedCount = 0; // how many we actually saved (respecting the 2-photo cap)
        let nonImageCount = 0;

        for (const attachment of attachments) {
          if (attachment.type !== "image") {
            nonImageCount++;
            console.log(
              `Non-image attachment from ${senderId}: type="${attachment.type}" — ignored.`,
            );
            continue;
          }

          imageCount++;
          const imageUrl = attachment.payload?.url;

          if (!imageUrl) {
            console.log(
              `Image attachment from ${senderId} has no URL — skipped.`,
            );
            continue;
          }

          console.log(`Image received from ${senderId}: ${imageUrl}`);

          if (session.photos.length < 2) {
            session.photos.push(imageUrl);
            storedCount++;
          }
        }

        // Send one reply summarising the result of this attachment event
        if (imageCount > 0) {
          if (storedCount > 0 && session.photos.length < 2) {
            // Photo accepted, slot still open
            console.log(
              `[webhook] → sendMessengerReply: photo accepted, slot open`,
            );
            sendMessengerReply(
              senderId,
              "Fotografija je primljena. Možete poslati još jednu fotografiju ili napišite Dalje.",
            );
          } else if (storedCount > 0 && session.photos.length >= 2) {
            // Photo accepted, now at the cap
            console.log(
              `[webhook] → sendMessengerReply: photo accepted, cap reached`,
            );
            sendMessengerReply(
              senderId,
              "Fotografija je primljena. Primili smo maksimalan broj fotografija. Molimo napišite Dalje za nastavak.",
            );
          } else {
            // Already at cap before this event — nothing stored
            console.log(`[webhook] → sendMessengerReply: already at cap`);
            sendMessengerReply(
              senderId,
              "Primili smo maksimalan broj fotografija. Molimo napišite Dalje za nastavak.",
            );
          }
        } else if (nonImageCount > 0) {
          // Event had attachments but none were images (video, audio, file, sticker…)
          console.log(`[webhook] → sendMessengerReply: non-image rejected`);
          sendMessengerReply(
            senderId,
            "Trenutno možemo primiti samo fotografije. Molimo pošaljite fotografiju ili napišite Dalje.",
          );
        }

        // Do not advance the text flow in the same event as an attachment
        return;
      }

      // ── Text message handling ──────────────────────────────────────────
      // No attachments — process as a regular text message. Quick Reply
      // button clicks arrive with event.message.quick_reply.payload set; we
      // treat the payload as plain text so the state machine sees it the
      // same as if the user typed it.
      const quickReplyPayload = event.message?.quick_reply?.payload;
      const inputText = quickReplyPayload || text;
      if (!inputText) return; // delivery receipts, read receipts, reactions, etc.

      console.log(`Messenger message from ${senderId}: ${inputText}`);

      // [7a] Run through the same state machine used by GET /next, via the
      // channel-aware wrapper. handleIncomingText() builds the identical
      // "messenger:<senderId>" key used by the attachment path above.
      const reply = handleIncomingText({
        channel: "messenger",
        userId: senderId,
        text: inputText,
      });

      // Strip the "Bot: " prefix — it is only for the browser testing endpoint
      const messengerText = reply.trim().replace(/^Bot:\s*/, "");

      // Send with Quick Reply on the photo step so the user has a clear
      // "Dalje" button without having to type the word.
      const sessionAfter = sessions[sessionKey];
      if (sessionAfter && sessionAfter.state === "ASK_PHOTOS") {
        console.log(
          `[webhook] → sendMessengerQuickReply: ASK_PHOTOS to ${senderId}`,
        );
        sendMessengerQuickReply(senderId, messengerText, [
          { title: "Dalje", payload: "Dalje" },
        ]);
      } else {
        console.log(
          `[webhook] → sendMessengerReply: text reply to ${senderId}`,
        );
        sendMessengerReply(senderId, messengerText);
      }
    });
  });

  // Acknowledge receipt AFTER all processing and sendMessengerReply() calls.
  // This ensures outbound reply requests are queued before the proxy closes
  // the inbound connection — fixing the delayed-reply issue with attachments.
  res.status(200).send("EVENT_RECEIVED");
});

// ── Testing routes (browser-based, temporary) ─────────────────────────────
app.get("/next", (req, res) => {
  if (req.url === "/favicon.ico") return res.end();

  const userId = req.query.userId || "test-user";
  const tekst = req.query.tekst;

  // [7a] Browser testing uses the "test" channel internally. Behavior is
  // unchanged from the caller's point of view — only the internal session key
  // becomes "test:<userId>". /next and /reset use the same channel, so a reset
  // still clears the exact session that /next reads.
  const reply = handleIncomingText({ channel: "test", userId, text: tekst });
  return res.send(reply);
});

app.get("/reset", (req, res) => {
  const userId = req.query.userId || "test-user";

  // Reset only this user's session, leave all others untouched. Same "test"
  // channel key as GET /next so the reset targets the right session. [7a]
  sessions[buildSessionKey("test", userId)] = createSession();

  res.send(`Bot session resetovana za korisnika: ${userId}`);
});

module.exports = app;
// Exposed for isolated unit testing (Task [5]) — does not affect server.js,
// which only consumes the Express app instance.
module.exports.buildTechnicianEmail = buildTechnicianEmail;
module.exports.createSession = createSession;
// [6g] Exposed for the Quick Reply "Dalje" regression unit test.
module.exports.isContinueAnswer = isContinueAnswer;
// [7a] Exposed for the channel adapter foundation regression test. These do
// not change server behavior — server.js only consumes the Express app.
module.exports.buildSessionKey = buildSessionKey;
module.exports.handleIncomingText = handleIncomingText;
