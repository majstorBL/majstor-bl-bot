const express = require("express");
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
    // INSTALLATIONS-only fields
    installationType: null,
    itemName: null,
    itemCondition: null,
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
    contact: null,
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

  const deviceKeywords = [
    "mašina",
    "veš",
    "perilica",
    "pranje",
    "suđe",
    "sudomašina",
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
    {
      keywords: [
        "veš mašina",
        "mašina za pranje",
        "perilica",
        "veš",
        "mašina",
        "pranje",
      ],
      type: "veš mašina",
    },
    { keywords: ["sudomašina", "suđe", "dishwasher"], type: "sudomašina" },
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

app.use(express.json());

// Token must match what you set in Meta App Dashboard → Webhooks
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "majstor_bl_verify_token";

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
// For now we just log the payload and acknowledge receipt.
// Actual reply logic will be added in the next task.
app.post("/webhook", (req, res) => {
  console.log("Incoming webhook event:");
  console.log(JSON.stringify(req.body, null, 2));

  // Always return 200 quickly — Meta will retry if we don't acknowledge fast
  return res.status(200).send("EVENT_RECEIVED");
});

// ── Testing routes (browser-based, temporary) ─────────────────────────────
app.get("/next", (req, res) => {
  if (req.url === "/favicon.ico") return res.end();

  const userId = req.query.userId || "test-user";
  const tekst = req.query.tekst;

  // Initialize session for this user if one doesn't exist yet
  if (!sessions[userId]) {
    sessions[userId] = createSession();
  }

  const session = sessions[userId];

  // Block empty input for all states except START
  // START is triggered without tekst intentionally (first /next call)
  if (session.state !== "START" && normalizeText(tekst) === "") {
    return res.send("Bot: Molim Vas unesite odgovor kako bismo nastavili.");
  }

  if (session.state === "START") {
    session.state = "ASK_SERVICE";
    return res.send(
      "Bot: Zdravo! Koju uslugu trebate? Opišite ukratko šta Vam treba.",
    );
  } else if (session.state === "ASK_SERVICE") {
    const branch = classifyBranch(tekst);

    if (branch === "UNKNOWN") {
      // Stay in ASK_SERVICE and ask the user to clarify
      return res.send(
        "Bot: Nisam siguran o kakvoj se usluzi radi. Možete li precizirati? " +
          "Npr: 'popravka veš mašine', 'montaža ormara', 'zamjena slavine', 'ugradnja utičnice'.",
      );
    }

    session.service = tekst;
    session.branch = branch;

    if (branch === "DEVICES") {
      const detectedType = extractDeviceType(tekst);

      if (detectedType) {
        // Device type already clear from first message — skip ASK_DEVICE_TYPE
        session.deviceType = detectedType;
        session.state = "ASK_BRAND";
        return res.send(
          `Bot: Uređaj "${session.deviceType}" zabilježen. Koji je brend?`,
        );
      }

      // Device type not clear — ask explicitly
      session.state = "ASK_DEVICE_TYPE";
      return res.send(
        `Bot: Usluga "${session.service}" zabilježena. ` +
          "Koji je tačno uređaj u pitanju? (npr. veš mašina, bojler, frižider, laptop)",
      );
    }

    // INSTALLATIONS — start extended flow
    session.state = "ASK_INSTALLATION_TYPE";
    return res.send(
      `Bot: Usluga "${session.service}" zabilježena. ` +
        "O kojoj vrsti usluge se radi? (npr. montaža namještaja, električne instalacije, vodovod, ugradnja uređaja)",
    );
  } else if (session.state === "ASK_DEVICE_TYPE") {
    session.deviceType = tekst;
    session.state = "ASK_BRAND";
    return res.send(
      `Bot: Uređaj "${session.deviceType}" zabilježen. Koji je brend?`,
    );
  } else if (session.state === "ASK_BRAND") {
    session.brand = tekst;
    session.state = "ASK_MODEL";
    return res.send(`Bot: Brend ${session.brand} zabilježen. Koji je model?`);
  } else if (session.state === "ASK_MODEL") {
    session.model = tekst;
    session.state = "ASK_DESCRIPTION";
    return res.send(`Bot: Model ${session.model} zabilježen. Opišite problem.`);
  } else if (session.state === "ASK_DESCRIPTION") {
    session.description = tekst;

    if (session.branch === "DEVICES") {
      session.state = "ASK_FAULT_PATTERN";
      return res.send(
        `Bot: Problem "${session.description}" zabilježen. ` +
          "Da li se problem javlja stalno ili povremeno?",
      );
    }

    // INSTALLATIONS
    session.state = "ASK_LOCATION";
    return res.send(
      `Bot: Problem "${session.description}" zabilježen. Koja je Vaša lokacija?`,
    );
  } else if (session.state === "ASK_FAULT_PATTERN") {
    session.faultPattern = tekst;
    session.state = "ASK_LOCATION";
    return res.send(
      `Bot: "${session.faultPattern}" zabilježeno. Koja je Vaša lokacija?`,
    );
  } else if (session.state === "ASK_LOCATION") {
    session.location = tekst;

    if (session.branch === "DEVICES") {
      session.state = "ASK_INSTALL_TYPE";
      return res.send(
        `Bot: Lokacija "${session.location}" zabilježena. ` +
          "Da li je uređaj ugradbeni ili samostojeći?",
      );
    }

    // INSTALLATIONS
    session.state = "ASK_FLOOR";
    return res.send(
      `Bot: Lokacija "${session.location}" zabilježena. Koji je sprat i da li postoji lift?`,
    );
  } else if (session.state === "ASK_INSTALL_TYPE") {
    session.installType = tekst;
    session.state = "ASK_PHOTOS";
    return res.send(
      `Bot: "${session.installType}" zabilježeno. Pošaljite fotografiju kvara ili uređaja.`,
    );
  } else if (session.state === "ASK_INSTALLATION_TYPE") {
    session.installationType = tekst;
    session.state = "ASK_ITEM_NAME";
    return res.send(
      `Bot: "${session.installationType}" zabilježeno. ` +
        "Šta je tačno predmet radova? (npr. ormar, TV nosač, slavina, bojler)",
    );
  } else if (session.state === "ASK_ITEM_NAME") {
    session.itemName = tekst;
    session.state = "ASK_ITEM_CONDITION";
    return res.send(
      `Bot: "${session.itemName}" zabilježen. Da li je predmet nov ili već korišten?`,
    );
  } else if (session.state === "ASK_ITEM_CONDITION") {
    session.itemCondition = tekst;
    session.state = "ASK_WALL_TYPE";
    return res.send(
      `Bot: "${session.itemCondition}" zabilježeno. Kakav je zid ili površina? (beton, cigla, knauf, drvo)`,
    );
  } else if (session.state === "ASK_WALL_TYPE") {
    session.wallType = tekst;
    session.state = "ASK_ACCESS";
    return res.send(
      `Bot: "${session.wallType}" zabilježen. Da li imate pristup glavnim instalacijama (struja/voda)?`,
    );
  } else if (session.state === "ASK_ACCESS") {
    session.accessInfo = tekst;
    session.state = "ASK_WORK_READY";
    return res.send(
      `Bot: "${session.accessInfo}" zabilježeno. Da li je prostor spreman za rad?`,
    );
  } else if (session.state === "ASK_WORK_READY") {
    session.workReady = tekst;

    if (isFurniture(session.installationType)) {
      session.state = "ASK_DIMENSIONS";
      return res.send(
        `Bot: "${session.workReady}" zabilježeno. Koje su dimenzije predmeta (širina x visina x dubina)?`,
      );
    }

    session.state = "ASK_LOCATION";
    return res.send(
      `Bot: "${session.workReady}" zabilježeno. Koja je Vaša lokacija?`,
    );
  } else if (session.state === "ASK_DIMENSIONS") {
    session.dimensions = tekst;
    session.state = "ASK_LOCATION";
    return res.send(
      `Bot: Dimenzije "${session.dimensions}" zabilježene. Koja je Vaša lokacija?`,
    );
  } else if (session.state === "ASK_FLOOR") {
    session.floorInfo = tekst;
    session.state = "ASK_PARKING";
    return res.send(
      `Bot: "${session.floorInfo}" zabilježeno. Da li postoji parking u blizini?`,
    );
  } else if (session.state === "ASK_PARKING") {
    session.parkingInfo = tekst;
    session.state = "ASK_PHOTOS";
    return res.send(
      `Bot: "${session.parkingInfo}" zabilježeno. ` +
        "Pošaljite fotografiju ako imate. Ako nemate, napišite 'dalje'.",
    );
  } else if (session.state === "ASK_PHOTOS") {
    if (normalizeText(tekst) === "dalje") {
      session.state = "ASK_CONTACT";
      return res.send("Bot: Ostavite vaš kontakt telefon.");
    }

    if (session.photos.length >= 2) {
      return res.send(
        "Bot: Primili smo maksimalan broj fotografija (2). Napišite 'dalje' za nastavak.",
      );
    }

    session.photos.push(tekst);

    return res.send(
      "Bot: Fotografija primljena. Ako imate još, pošaljite. Ako ne, napišite 'dalje'.",
    );
  } else if (session.state === "ASK_CONTACT") {
    session.contact = tekst;
    session.state = "CONFIRM_REQUEST";
    return res.send("Bot: Hvala! Želite li potvrditi zahtjev? (da/ne)");
  } else if (session.state === "CONFIRM_REQUEST") {
    session.state = "END";

    if (session.branch === "DEVICES") {
      return res.send(`
Bot: Hvala Vam! Vaš zahtjev je zabilježen.

--- REZIME ---
Grana: ${session.branch}
Usluga: ${session.service}
Uređaj: ${session.deviceType}
Brend: ${session.brand}
Model: ${session.model}
Problem: ${session.description}
Učestalost kvara: ${session.faultPattern}
Lokacija: ${session.location}
Tip ugradnje: ${session.installType}
Kontakt: ${session.contact}
----------------

Serviser će Vas kontaktirati u najkraćem roku!
      `);
    }

    // INSTALLATIONS summary
    const dimLine = session.dimensions
      ? `Dimenzije: ${session.dimensions}\n`
      : "";
    return res.send(`
Bot: Hvala Vam! Vaš zahtjev je zabilježen.

--- REZIME ---
Grana: ${session.branch}
Usluga: ${session.service}
Vrsta usluge: ${session.installationType}
Predmet radova: ${session.itemName}
Stanje predmeta: ${session.itemCondition}
Zid/površina: ${session.wallType}
Pristup instalacijama: ${session.accessInfo}
Prostor spreman: ${session.workReady}
${dimLine}Lokacija: ${session.location}
Sprat/lift: ${session.floorInfo}
Parking: ${session.parkingInfo}
Kontakt: ${session.contact}
----------------

Serviser će Vas kontaktirati u najkraćem roku!
    `);
  }

  // Fallback — should not normally be reached
  res.send(`Bot: Trenutno stanje je ${session.state}`);
});

app.get("/reset", (req, res) => {
  const userId = req.query.userId || "test-user";

  // Reset only this user's session, leave all others untouched
  sessions[userId] = createSession();

  res.send(`Bot session resetovana za korisnika: ${userId}`);
});

module.exports = app;
