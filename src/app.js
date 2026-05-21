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
    contact: null, // used by INSTALLATIONS pre-refactor
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
    // Dishwasher must be checked before washing machine —
    // "mašina za suđe" contains "mašina" which would otherwise match first
    {
      keywords: [
        "sudomašina",
        "mašina za suđe",
        "perilica suđa",
        "perilica posuđa",
        "suđerica",
        "suđe",
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

app.use(express.json());

// Token must match what you set in Meta App Dashboard → Webhooks
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "majstor_bl_verify_token";

// Facebook page token — set in Render environment variables, never hardcode
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

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
    return "Bot: Zdravo! Koju uslugu trebate? Opišite ukratko šta Vam treba.";
  } else if (session.state === "ASK_SERVICE") {
    // Greeting-only detection — stay in ASK_SERVICE and invite description
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
      (g) =>
        inputLower === g || inputLower === g + "!" || inputLower === g + ".",
    );
    if (isGreetingOnly) {
      return "Bot: Dobar dan! Kako Vam možemo pomoći?";
    }

    const branch = classifyBranch(tekst);

    if (branch === "UNKNOWN") {
      // Stay in ASK_SERVICE and ask the user to clarify
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
        // Device type already clear from first message — skip ASK_DEVICE_TYPE
        session.deviceType = detectedType;
        session.state = "ASK_BRAND";
        return `Bot: Dobro, vidim da se radi o uređaju ${session.deviceType}. Koji je brend (proizvođač)?`;
      }

      // Device type not clear — ask explicitly
      session.state = "ASK_DEVICE_TYPE";
      return "Bot: Koji je tačno uređaj u pitanju? (npr. veš mašina, bojler, frižider, laptop)";
    }

    // INSTALLATIONS — start extended flow (unchanged)
    session.state = "ASK_INSTALLATION_TYPE";
    return (
      `Bot: Usluga "${session.service}" zabilježena. ` +
      "O kojoj vrsti usluge se radi? (npr. montaža namještaja, električne instalacije, vodovod, ugradnja uređaja)"
    );
  } else if (session.state === "ASK_DEVICE_TYPE") {
    session.deviceType = tekst;
    session.state = "ASK_BRAND";
    return "Bot: Razumijem. Koji je brend (proizvođač) uređaja?";
  } else if (session.state === "ASK_BRAND") {
    session.brand = tekst;
    session.state = "ASK_MODEL";
    const modelHint = getModelHint(session.deviceType);
    return `Bot: Hvala. Koji je model uređaja? ${modelHint}`;
  } else if (session.state === "ASK_MODEL") {
    session.model = tekst;
    session.state = "ASK_DESCRIPTION";
    return "Bot: Dobro. Opišite nam problem — šta se tačno dešava sa uređajem?";
  } else if (session.state === "ASK_DESCRIPTION") {
    session.description = tekst;

    if (session.branch === "DEVICES") {
      session.state = "ASK_FAULT_PATTERN";
      return "Bot: Razumijem. Da li se problem javlja stalno ili povremeno?";
    }

    // INSTALLATIONS — unchanged
    session.state = "ASK_LOCATION";
    return `Bot: Problem "${session.description}" zabilježen. Koja je Vaša lokacija?`;
  } else if (session.state === "ASK_FAULT_PATTERN") {
    session.faultPattern = tekst;
    // DEVICES v2: go directly to install-type question; location moved to contact block
    session.state = "ASK_INSTALL_TYPE";
    return "Bot: Dobro. Da li je uređaj ugradbeni ili samostojeći, i u kojem dijelu prostora se nalazi? (npr. kuhinja, kupatilo, ostava)";
  } else if (session.state === "ASK_LOCATION") {
    if (session.branch === "DEVICES") {
      // DEVICES v2 — optional contact block step; "dalje" skips address collection
      if (normalizeText(tekst) !== "dalje") {
        session.location = tekst;
      }
      session.state = "ASK_NAME";
      return "Bot: Na koje ime da evidentiramo zahtjev? Ako ne želite, napišite Dalje.";
    }

    // INSTALLATIONS — unchanged
    session.location = tekst;
    session.state = "ASK_FLOOR";
    return `Bot: Lokacija "${session.location}" zabilježena. Koji je sprat i da li postoji lift?`;
  } else if (session.state === "ASK_INSTALL_TYPE") {
    session.installType = tekst;
    session.state = "ASK_PHOTOS";
    return "Bot: Hvala. Ako želite, možete nam poslati fotografiju uređaja, mjesta kvara ili naljepnice sa modelom (maksimalno 2 fotografije). Ako nemate fotografiju, napišite Dalje.";
  } else if (session.state === "ASK_INSTALLATION_TYPE") {
    session.installationType = tekst;
    session.state = "ASK_ITEM_NAME";
    return (
      `Bot: "${session.installationType}" zabilježeno. ` +
      "Šta je tačno predmet radova? (npr. ormar, TV nosač, slavina, bojler)"
    );
  } else if (session.state === "ASK_ITEM_NAME") {
    session.itemName = tekst;
    session.state = "ASK_ITEM_CONDITION";
    return `Bot: "${session.itemName}" zabilježen. Da li je predmet nov ili već korišten?`;
  } else if (session.state === "ASK_ITEM_CONDITION") {
    session.itemCondition = tekst;
    session.state = "ASK_WALL_TYPE";
    return `Bot: "${session.itemCondition}" zabilježeno. Kakav je zid ili površina? (beton, cigla, knauf, drvo)`;
  } else if (session.state === "ASK_WALL_TYPE") {
    session.wallType = tekst;
    session.state = "ASK_ACCESS";
    return `Bot: "${session.wallType}" zabilježen. Da li imate pristup glavnim instalacijama (struja/voda)?`;
  } else if (session.state === "ASK_ACCESS") {
    session.accessInfo = tekst;
    session.state = "ASK_WORK_READY";
    return `Bot: "${session.accessInfo}" zabilježeno. Da li je prostor spreman za rad?`;
  } else if (session.state === "ASK_WORK_READY") {
    session.workReady = tekst;

    if (isFurniture(session.installationType)) {
      session.state = "ASK_DIMENSIONS";
      return `Bot: "${session.workReady}" zabilježeno. Koje su dimenzije predmeta (širina x visina x dubina)?`;
    }

    session.state = "ASK_LOCATION";
    return `Bot: "${session.workReady}" zabilježeno. Koja je Vaša lokacija?`;
  } else if (session.state === "ASK_DIMENSIONS") {
    session.dimensions = tekst;
    session.state = "ASK_LOCATION";
    return `Bot: Dimenzije "${session.dimensions}" zabilježene. Koja je Vaša lokacija?`;
  } else if (session.state === "ASK_FLOOR") {
    session.floorInfo = tekst;
    session.state = "ASK_PARKING";
    return `Bot: "${session.floorInfo}" zabilježeno. Da li postoji parking u blizini?`;
  } else if (session.state === "ASK_PARKING") {
    session.parkingInfo = tekst;
    session.state = "ASK_PHOTOS";
    return (
      `Bot: "${session.parkingInfo}" zabilježeno. ` +
      "Pošaljite fotografiju ako imate. Ako nemate, napišite 'dalje'."
    );
  } else if (session.state === "ASK_PHOTOS") {
    if (normalizeText(tekst) === "dalje") {
      if (session.branch === "DEVICES") {
        // DEVICES v2 — move to confirmation before contact block
        session.state = "ASK_CONFIRMATION";
        return "Bot: Hvala na informacijama. Da li želite da Vas naš serviser kontaktira radi dogovora termina posjete i popravke uređaja? (da/ne)";
      }
      // INSTALLATIONS — pre-refactor path unchanged
      session.state = "ASK_CONTACT";
      return "Bot: Ostavite vaš kontakt telefon.";
    }

    if (session.photos.length >= 2) {
      return "Bot: Primili smo maksimalan broj fotografija (2). Napišite 'dalje' za nastavak.";
    }

    // Text in ASK_PHOTOS is NOT a photo — photos only arrive as attachments via POST /webhook.
    // Any other text: remind the user to send a photo or write Dalje.
    return "Bot: Ako želite, pošaljite fotografiju. Ako nemate fotografiju, napišite Dalje.";

    // ── DEVICES v2 — contact block ─────────────────────────────────────────────
  } else if (session.state === "ASK_CONFIRMATION") {
    // User decides whether they want the technician to contact them
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
        return "Bot: Razumijem, ali broj telefona je potreban da bi Vas serviser mogao kontaktirati. Molimo pošaljite broj telefona.";
      }
      // Second refusal — close politely
      session.state = "END";
      return "Bot: Razumijemo Vaš stav. Hvala Vam što ste nas kontaktirali. Sretno!";
    }

    session.phone = tekst;
    session.state = "ASK_LOCATION";
    return "Bot: Možete li poslati adresu ili lokaciju gdje se uređaj nalazi? Ako ne želite tačnu adresu, napišite samo naselje ili dio grada. Ako želite preskočiti, napišite Dalje.";
  } else if (session.state === "ASK_NAME") {
    // Optional — "dalje" skips name; summary is generated immediately after
    if (normalizeText(tekst) !== "dalje") {
      session.name = tekst;
    }
    session.state = "END";

    const photoCount = session.photos.length;
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
  } else if (session.state === "ASK_CONTACT") {
    session.contact = tekst;
    session.state = "CONFIRM_REQUEST";
    return "Bot: Hvala! Želite li potvrditi zahtjev? (da/ne)";
  } else if (session.state === "CONFIRM_REQUEST") {
    session.state = "END";

    if (session.branch === "DEVICES") {
      return `Bot: Hvala Vam! Vaš zahtjev je zabilježen.

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

Serviser će Vas kontaktirati u najkraćem roku!`;
    }

    // INSTALLATIONS summary
    const dimLine = session.dimensions
      ? `Dimenzije: ${session.dimensions}\n`
      : "";
    return `Bot: Hvala Vam! Vaš zahtjev je zabilježen.

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

Serviser će Vas kontaktirati u najkraćem roku!`;
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
