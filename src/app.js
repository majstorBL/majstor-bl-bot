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
    contact: null, // legacy — retained for backwards compatibility, unused by v2 flow
  };
}

// Normalizes user input — trims whitespace, lowercases, handles null/undefined
function normalizeText(text) {
  return (text || "").toString().trim().toLowerCase();
}

// Keyword-based branch classifier — no AI, plain text matching
// Returns "DEVICES", "INSTALLATIONS", or "UNKNOWN"
function classifyBranch(text) {
  const input = normalizeText(text);

  // [4c-UX] INSTALLATIONS intent pre-check — stems that unambiguously signal
  // an installation/montage request even when a device name also appears in
  // the text. Example: "Kupio sam bojler, treba ugradnja" must route to
  // INSTALLATIONS, not DEVICES. Stems are used to catch declined forms
  // (e.g. "slavinu" from "slavina") that the original keyword list misses.
  const installationIntent = [
    "montaž",
    "montira",
    "ugradnj",
    "ugradi",
    "instalacij",
    "postavljanj",
    "zamijen",
    "zamjen",
    "slavin",
    "česm",
    "cesm",
    "utičnic",
    "uticnic",
    "prekidač",
    "prekidac",
    "luster",
    "plafonjer",
  ];
  for (const kw of installationIntent) {
    if (input.includes(kw)) return "INSTALLATIONS";
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
    { keywords: ["zamrzivač"], type: "zamrzivač" },
    { keywords: ["frižider", "hladnjak", "frizider"], type: "frižider" },
    { keywords: ["bojler", "boiler", "grijač"], type: "bojler" },
    { keywords: ["šporet", "štednjak", "rerma"], type: "šporet" },
    { keywords: ["televizor", "televizija", "tv"], type: "televizor" },
    { keywords: ["laptop"], type: "laptop" },
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

// ── INSTALLATIONS v2 helpers ──────────────────────────────────────────────

// Detects installation sub-category (B1/B2/B3/B4) from free text.
// Returns "B1" | "B2" | "B3" | "B4" | null.
function extractInstallationType(text) {
  const input = normalizeText(text);

  // B4 — device installation: device name + install intent
  const installIntent = [
    "ugradnj",
    "ugradi",
    "montaž",
    "montira",
    "instalacij",
    "kupio",
    "kupili",
    "kupljen",
    "planiram",
  ];
  const devices = [
    "bojler",
    "šporet",
    "stednjak",
    "štednjak",
    "ploča",
    "ploca",
    "mašin",
    "masin",
    "klima",
    "zamrziv",
    "frižider",
    "frizider",
  ];
  const hasInstall = installIntent.some((w) => input.includes(w));
  const hasDevice = devices.some((w) => input.includes(w));
  if (hasInstall && hasDevice) return "B4";

  // B3 — plumbing (external components only)
  const b3Keywords = [
    "slavin",
    "česm",
    "cesm",
    "ventil",
    "sifon",
    "toalet",
    "tuš baterij",
    "tus baterij",
    "vodovod",
    "cijev",
    "crijev",
    "odvod",
  ];
  if (b3Keywords.some((w) => input.includes(w))) return "B3";

  // B2 — electrical installations
  const b2Keywords = [
    "utičnic",
    "uticnic",
    "prekidač",
    "prekidac",
    "rasvjet",
    "luster",
    "plafonjer",
    "lampa",
    "svjetiljk",
    "reflektor",
    "tv nosač",
    "tv nosac",
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
    "polic",
    "krevet",
    "komod",
    "ladič",
    "ladic",
    "vitrin",
    "stolic",
    "radni sto",
    "ogledal",
  ];
  if (b1Keywords.some((w) => input.includes(w))) return "B1";

  return null;
}

// Extracts the likely item name from the first user message.
// Returns canonical item name string, or null if not recognized.
function extractInstallationItem(text) {
  const input = normalizeText(text);

  // Multi-word items first to avoid partial matches.
  const items = [
    { keywords: ["tv nosač", "tv nosac"], item: "TV nosač" },
    { keywords: ["tuš baterij", "tus baterij"], item: "tuš baterija" },
    { keywords: ["radni sto"], item: "radni sto" },
    { keywords: ["ogledalo"], item: "ogledalo" },
    { keywords: ["luster"], item: "luster" },
    { keywords: ["plafonjer"], item: "plafonjera" },
    { keywords: ["reflektor"], item: "reflektor" },
    { keywords: ["lampa"], item: "lampa" },
    { keywords: ["svjetiljk"], item: "svjetiljka" },
    { keywords: ["utičnic", "uticnic"], item: "utičnica" },
    { keywords: ["prekidač", "prekidac"], item: "prekidač" },
    { keywords: ["slavin"], item: "slavina" },
    { keywords: ["česm", "cesm"], item: "česma" },
    { keywords: ["ventil"], item: "ventil" },
    { keywords: ["sifon"], item: "sifon" },
    { keywords: ["bojler"], item: "bojler" },
    { keywords: ["šporet"], item: "šporet" },
    { keywords: ["štednjak"], item: "štednjak" },
    { keywords: ["ploča", "ploca"], item: "ploča" },
    { keywords: ["sudomašin", "sudomasin"], item: "sudomašina" },
    { keywords: ["veš mašin", "ves masin"], item: "veš mašina" },
    { keywords: ["mašin", "masin"], item: "mašina" },
    { keywords: ["klima"], item: "klima uređaj" },
    { keywords: ["zamrziv"], item: "zamrzivač" },
    { keywords: ["frižider", "frizider"], item: "frižider" },
    { keywords: ["ormar"], item: "ormar" },
    { keywords: ["komod"], item: "komoda" },
    { keywords: ["krevet"], item: "krevet" },
    { keywords: ["polic"], item: "polica" },
    { keywords: ["vitrin"], item: "vitrina" },
    { keywords: ["ladič", "ladic"], item: "ladičar" },
    { keywords: ["stolic"], item: "stolica" },
  ];

  for (const entry of items) {
    for (const kw of entry.keywords) {
      if (input.includes(kw)) return entry.item;
    }
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
    "lampa",
    "svjetiljk",
    "reflektor",
  ];
  if (wallItems.some((w) => input.includes(w))) return "wall";

  const freestandingItems = [
    "ormar",
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

// Returns the next-step prompt + state for INSTALLATIONS after work-readiness
// step. Used by both ASK_WORK_READY and ASK_MODEL (when B4 + itemReady=true).
function nextAfterInstallationsCore(session) {
  const wallOrCeiling =
    session.mountingMode === "wall" || session.mountingMode === "ceiling";
  if (session.installationType === "B1" || wallOrCeiling) {
    session.state = "ASK_DIMENSIONS";
    if (session.installationType === "B1") {
      return "Bot: Razumijem. Koje su dimenzije predmeta? (širina x visina x dubina)";
    }
    return "Bot: Razumijem. Koje su dimenzije ili težina predmeta koji se montira?";
  }
  session.state = "ASK_FLOOR";
  return "Bot: Razumijem. Na kojem spratu se obavljaju radovi i da li postoji lift?";
}

// Returns the next-step prompt + state after ASK_ACCESS / when access step
// is skipped (B1 furniture without wall mounting).
function nextAfterAccessForInstallations(session) {
  session.state = "ASK_WORK_READY";
  return "Bot: Hvala. Da li je prostor pripremljen za rad? (stari predmet uklonjen, površina slobodna, mjesto pristupačno)";
}

// Returns the next-step prompt + state after ASK_WALL_TYPE / mounting-mode
// branch is resolved. Asks the access question if installationType requires
// it (B2/B3/B4), otherwise skips straight to ASK_WORK_READY.
function nextAfterWallTypeForInstallations(session) {
  if (
    session.installationType === "B2" ||
    session.installationType === "B3" ||
    session.installationType === "B4"
  ) {
    session.state = "ASK_ACCESS";
    return buildAccessQuestionForInstallations(session);
  }
  return nextAfterAccessForInstallations(session);
}

// Returns the next-step prompt + state once mountingMode is known. Asks for
// wall type only when the item is fixed to wall or ceiling.
function nextAfterMountingModeForInstallations(session) {
  if (session.mountingMode === "wall" || session.mountingMode === "ceiling") {
    session.state = "ASK_WALL_TYPE";
    return "Bot: Razumijem. Kakav je zid ili površina? (beton, cigla, knauf/gips, drvo, ytong)";
  }
  return nextAfterWallTypeForInstallations(session);
}

// Builds the access question wording per sub-category and item type.
function buildAccessQuestionForInstallations(session) {
  const itemLower = normalizeText(session.itemName || "");
  if (session.installationType === "B2") {
    return "Bot: Hvala. Da li je razvodna tabla dostupna i da li postoji pripremljen električni priključak na mjestu montaže?";
  }
  if (session.installationType === "B3") {
    return "Bot: Hvala. Da li je ventil za zatvaranje vode dostupan i da li postoje potrebni priključci za vodu ili odvod?";
  }
  if (session.installationType === "B4") {
    if (itemLower.includes("bojler")) {
      return "Bot: Hvala. Da li su dostupni priključci za vodu i struju na mjestu montaže?";
    }
    if (
      itemLower.includes("šporet") ||
      itemLower.includes("štednjak") ||
      itemLower.includes("ploča") ||
      itemLower.includes("ploca")
    ) {
      return "Bot: Hvala. Da li postoji električni priključak za šporet/ploču na mjestu montaže?";
    }
    if (itemLower.includes("mašin") || itemLower.includes("masin")) {
      return "Bot: Hvala. Da li su dostupni priključci za vodu, odvod i struju na mjestu montaže?";
    }
    return "Bot: Hvala. Da li su potrebni priključci dostupni na mjestu montaže?";
  }
  return "Bot: Hvala. Da li su potrebni uslovi pripremljeni na mjestu montaže?";
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

  // INSTALLATIONS v2 — detect sub-category and item from the first message
  // so we can skip redundant questions. No "zabilježeno" wording.
  const detectedType = extractInstallationType(tekst);
  if (detectedType) session.installationType = detectedType;

  const detectedItem = extractInstallationItem(tekst);
  if (detectedItem) {
    session.itemName = detectedItem;
    session.mountingMode = detectMountingMode(detectedItem);
  }

  // If sub-category is still unknown, ask the user to clarify the type first.
  if (!session.installationType) {
    session.state = "ASK_INSTALLATION_TYPE";
    return (
      "Bot: Dobro, vidim da Vam treba intervencija. Da bismo Vas što prije spojili sa majstorom, " +
      "trebam još nekoliko informacija. O kojoj vrsti radova se radi? " +
      "(npr. montaža namještaja, električne instalacije, vodovod, ugradnja uređaja)"
    );
  }

  // If item is still unknown, ask for it explicitly.
  if (!session.itemName) {
    session.state = "ASK_ITEM_NAME";
    return (
      "Bot: Dobro, vidim da Vam treba intervencija. Da bismo Vas što prije spojili sa majstorom, " +
      "trebam još nekoliko informacija. Šta je tačno potrebno montirati, ugraditi ili zamijeniti?"
    );
  }

  // Both type and item known — jump straight to combined ready+condition step.
  session.state = "ASK_ITEM_CONDITION_AND_READY";
  return (
    `Bot: Dobro, trebate ${describeIntervention(session)}. ` +
    "Da bismo Vas što prije spojili sa majstorom, trebam još nekoliko informacija. " +
    "Da li je predmet već kupljen i spreman za montažu, i da li je nov ili polovan?"
  );
}

// Short BHS phrase describing the requested intervention. Accusative case so
// the reply reads naturally after "trebate ...".
function describeIntervention(session) {
  if (session.installationType === "B1") return "montažu namještaja";
  if (session.installationType === "B2") return "električne radove";
  if (session.installationType === "B3") return "vodoinstalaterske radove";
  if (session.installationType === "B4") return "ugradnju uređaja";
  return "intervenciju";
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

  // Block empty input for all states except START
  // START is triggered without tekst intentionally (first /next call)
  if (session.state !== "START" && normalizeText(tekst) === "") {
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
      // Continue INSTALLATIONS flow after brand/model: dimensions (B1 or
      // wall/ceiling) or straight to floor.
      return nextAfterInstallationsCore(session);
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
    // DEVICES v2: go directly to install-type question; location moved to contact block
    session.state = "ASK_INSTALL_TYPE";
    return "Bot: Dobro. Da li je uređaj ugradbeni ili samostojeći, i u kojem dijelu prostora se nalazi? (npr. kuhinja, kupatilo, ostava)";
  } else if (session.state === "ASK_LOCATION") {
    // Contact-block location step — shared by DEVICES v2 and INSTALLATIONS v2.
    // Optional in both branches: user can type "dalje" to skip.
    if (normalizeText(tekst) !== "dalje") {
      session.location = tekst;
    }
    session.state = "ASK_NAME";
    return "Bot: Na koje ime da evidentiramo zahtjev? Ako ne želite, napišite Dalje.";
  } else if (session.state === "ASK_INSTALL_TYPE") {
    session.installType = tekst;
    session.state = "ASK_PHOTOS";
    return "Bot: Hvala. Ako želite, možete nam poslati fotografiju uređaja, mjesta kvara ili naljepnice sa modelom (maksimalno 2 fotografije). Ako nemate fotografiju, napišite Dalje.";

    // ── INSTALLATIONS v2 state machine ───────────────────────────────────────
  } else if (session.state === "ASK_INSTALLATION_TYPE") {
    // Re-classify from the user's clarification.
    const detectedType = extractInstallationType(tekst);
    session.installationType = detectedType || tekst;

    // Try to also extract an item from the same message.
    const detectedItem = extractInstallationItem(tekst);
    if (detectedItem && !session.itemName) {
      session.itemName = detectedItem;
      session.mountingMode = detectMountingMode(detectedItem);
    }

    if (!session.itemName) {
      session.state = "ASK_ITEM_NAME";
      return "Bot: Razumijem. Šta je tačno potrebno montirati, ugraditi ili zamijeniti?";
    }

    session.state = "ASK_ITEM_CONDITION_AND_READY";
    return "Bot: Razumijem. Da li je predmet već kupljen i spreman za montažu, i da li je nov ili polovan?";
  } else if (session.state === "ASK_ITEM_NAME") {
    // Store the item name and infer mountingMode.
    const detectedItem = extractInstallationItem(tekst);
    session.itemName = detectedItem || tekst;
    session.mountingMode = detectMountingMode(session.itemName);

    // If installationType is still missing or non-canonical, try once more from this message.
    if (!["B1", "B2", "B3", "B4"].includes(session.installationType || "")) {
      const detectedType = extractInstallationType(tekst);
      if (detectedType) session.installationType = detectedType;
    }

    session.state = "ASK_ITEM_CONDITION_AND_READY";
    return "Bot: Razumijem. Da li je predmet već kupljen i spreman za montažu, i da li je nov ili polovan?";
  } else if (session.state === "ASK_ITEM_CONDITION_AND_READY") {
    const parsed = parseItemReadyAndCondition(tekst);
    session.itemCondition = parsed.itemCondition;
    session.itemReady = parsed.itemReady;
    // Keep raw answer in notes so nothing is lost when parsing is partial.
    session.notes.push(`condition+ready: ${tekst}`);

    if (session.mountingMode === "unknown" || !session.mountingMode) {
      session.state = "ASK_MOUNTING_MODE";
      return "Bot: Razumijem. Da li se predmet montira samostojeće, ili se fiksira na zid ili plafon?";
    }
    return nextAfterMountingModeForInstallations(session);
  } else if (session.state === "ASK_MOUNTING_MODE") {
    const lower = normalizeText(tekst);
    if (lower.includes("plafon") || lower.includes("strop")) {
      session.mountingMode = "ceiling";
    } else if (lower.includes("zid") || lower.includes("fiks")) {
      session.mountingMode = "wall";
    } else if (
      lower.includes("samostoj") ||
      lower.includes("slobod") ||
      lower.includes("ne fiks") ||
      lower.includes("nije fiks")
    ) {
      session.mountingMode = "freestanding";
    } else {
      // Couldn't parse — store the raw answer and treat as freestanding to keep flow moving.
      session.notes.push(`mountingMode raw: ${tekst}`);
      session.mountingMode = "freestanding";
    }
    return nextAfterMountingModeForInstallations(session);
  } else if (session.state === "ASK_WALL_TYPE") {
    session.wallType = tekst;
    return nextAfterWallTypeForInstallations(session);
  } else if (session.state === "ASK_ACCESS") {
    session.accessInfo = tekst;
    return nextAfterAccessForInstallations(session);
  } else if (session.state === "ASK_WORK_READY") {
    session.workReady = tekst;

    // INSTALLATIONS v2: only B4 with itemReady=true triggers brand/model.
    if (
      session.branch === "INSTALLATIONS" &&
      session.installationType === "B4" &&
      session.itemReady === true
    ) {
      session.state = "ASK_BRAND";
      return "Bot: Hvala. Koji je brend (proizvođač) uređaja?";
    }

    // Otherwise: dimensions step (if applicable) or straight to floor.
    return nextAfterInstallationsCore(session);
  } else if (session.state === "ASK_DIMENSIONS") {
    session.dimensions = tekst;
    session.state = "ASK_FLOOR";
    return "Bot: Hvala. Na kojem spratu se obavljaju radovi i da li postoji lift?";
  } else if (session.state === "ASK_FLOOR") {
    session.floorInfo = tekst;
    session.state = "ASK_PARKING";
    return "Bot: Razumijem. Da li je parking dostupan u blizini objekta?";
  } else if (session.state === "ASK_PARKING") {
    session.parkingInfo = tekst;
    session.state = "ASK_PHOTOS";
    return "Bot: Hvala. Ako želite, pošaljite fotografiju trenutnog stanja ili mjesta montaže (maksimalno 2 fotografije). Ako nemate fotografiju, napišite Dalje.";
  } else if (session.state === "ASK_PHOTOS") {
    if (normalizeText(tekst) === "dalje") {
      // Both branches converge on ASK_CONFIRMATION in v2.
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
      return "Bot: Ako želite, pošaljite fotografiju trenutnog stanja ili mjesta montaže. Ako nemate fotografiju, napišite Dalje.";
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
    return "Bot: Možete li poslati adresu ili lokaciju gdje se uređaj nalazi? Ako ne želite tačnu adresu, napišite samo naselje ili dio grada. Ako želite preskočiti, napišite Dalje.";
  } else if (session.state === "ASK_NAME") {
    // Optional — "dalje" skips name; summary is generated immediately after
    if (normalizeText(tekst) !== "dalje") {
      session.name = tekst;
    }
    session.state = "END";

    const photoCount = session.photos.length;

    if (session.branch === "INSTALLATIONS") {
      const typeLabels = {
        B1: "B1 — montaža namještaja",
        B2: "B2 — električne instalacije",
        B3: "B3 — vodoinstalaterski radovi",
        B4: "B4 — ugradnja uređaja",
      };
      const typeLine =
        typeLabels[session.installationType] || session.installationType || "—";
      const condLine = `${session.itemCondition || "—"} / ${
        session.itemReady === true
          ? "već kupljeno"
          : session.itemReady === false
            ? "nije još kupljeno"
            : "—"
      }`;
      return `Bot: Hvala Vam! Vaš zahtjev je primljen.

--- REZIME ---
Vrsta radova: ${typeLine}
Predmet radova: ${session.itemName || "—"}
Novo/polovno / kupljeno: ${condLine}
Način montaže: ${session.mountingMode || "—"}
Zid/površina: ${session.wallType || "—"}
Pristup instalacijama: ${session.accessInfo || "—"}
Brend: ${session.brand || "—"}
Model: ${session.model || "—"}
Prostor pripremljen: ${session.workReady || "—"}
Dimenzije: ${session.dimensions || "—"}
Sprat/lift: ${session.floorInfo || "—"}
Parking: ${session.parkingInfo || "—"}
Broj fotografija: ${photoCount}
Telefon: ${session.phone}
Lokacija/adresa: ${session.location || "—"}
Ime: ${session.name || "—"}
----------------

Naš majstor će Vas kontaktirati u najkraćem roku!`;
    }

    // DEVICES summary (v2 — unchanged wording)
    return `Bot: Hvala Vam! Vaš zahtjev je primljen.

--- REZIME ---
Uređaj: ${session.deviceType || session.service}
Brend: ${session.brand}
Model: ${session.model}
Problem: ${session.description}
Učestalost kvara: ${session.faultPattern}
Tip/lokacija uređaja: ${session.installType}
Broj fotografija: ${photoCount}
Telefon: ${session.phone}
Lokacija/adresa: ${session.location || "—"}
Ime: ${session.name || "—"}
----------------

Naš serviser će Vas kontaktirati u najkraćem roku!`;
  }

  // Fallback — should not normally be reached
  return `Bot: Trenutno stanje je ${session.state}`;
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

      const attachments = event.message?.attachments;
      const text = event.message?.text;

      // ── Image/attachment handling ──────────────────────────────────────
      // If the event contains attachments, handle them and skip text processing.
      // Messenger sends photos as attachments with type "image".
      if (attachments && attachments.length > 0) {
        // Ensure a session exists for this user
        if (!sessions[senderId]) {
          sessions[senderId] = createSession();
        }
        const session = sessions[senderId];

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
      // No attachments — process as a regular text message.
      if (!text) return; // delivery receipts, read receipts, reactions, etc.

      console.log(`Messenger message from ${senderId}: ${text}`);

      // Run through the same state machine used by GET /next
      const reply = processMessage(senderId, text);

      // Strip the "Bot: " prefix — it is only for the browser testing endpoint
      const messengerText = reply.trim().replace(/^Bot:\s*/, "");

      console.log(`[webhook] → sendMessengerReply: text reply to ${senderId}`);
      sendMessengerReply(senderId, messengerText);
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

  const reply = processMessage(userId, tekst);
  return res.send(reply);
});

app.get("/reset", (req, res) => {
  const userId = req.query.userId || "test-user";

  // Reset only this user's session, leave all others untouched
  sessions[userId] = createSession();

  res.send(`Bot session resetovana za korisnika: ${userId}`);
});

module.exports = app;
