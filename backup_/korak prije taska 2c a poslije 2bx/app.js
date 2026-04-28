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
    // Shared fields
    brand: null,
    model: null,
    description: null,
    location: null,
    photos: [],
    contact: null,
  };
}

// Keyword-based branch classifier — no AI, plain text matching
// Returns "DEVICES", "INSTALLATIONS", or "UNKNOWN"
function classifyBranch(text) {
  const input = text.toLowerCase();

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
  const input = text.toLowerCase();

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

app.use(express.json());

app.get("/next", (req, res) => {
  if (req.url === "/favicon.ico") return res.end();

  const userId = req.query.userId || "test-user";
  const tekst = req.query.tekst;

  // Initialize session for this user if one doesn't exist yet
  if (!sessions[userId]) {
    sessions[userId] = createSession();
  }

  const session = sessions[userId];

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

    // INSTALLATIONS — original next step
    session.state = "ASK_BRAND";
    return res.send(
      `Bot: Usluga ${session.service} zabilježena. Koji je brend?`,
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
    session.state = "ASK_PHOTOS";
    return res.send(
      `Bot: Lokacija "${session.location}" zabilježena. Pošaljite fotografiju kvara ili uređaja.`,
    );
  } else if (session.state === "ASK_INSTALL_TYPE") {
    session.installType = tekst;
    session.state = "ASK_PHOTOS";
    return res.send(
      `Bot: "${session.installType}" zabilježeno. Pošaljite fotografiju kvara ili uređaja.`,
    );
  } else if (session.state === "ASK_PHOTOS") {
    if (tekst === "dalje") {
      session.state = "ASK_CONTACT";
      return res.send("Bot: Ostavite vaš kontakt telefon.");
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

    // INSTALLATIONS summary (original format)
    return res.send(`
Bot: Hvala Vam! Vaš zahtjev je zabilježen.

--- REZIME ---
Grana: ${session.branch}
Usluga: ${session.service}
Brend: ${session.brand}
Model: ${session.model}
Problem: ${session.description}
Lokacija: ${session.location}
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
