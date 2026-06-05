// Task [5] — isolated unit tests for buildTechnicianEmail().
// Pure-function tests: no server, no network, no env vars required.
// Run with: node test-email-builder.js

const app = require("./src/app");
const { buildTechnicianEmail, createSession } = app;

let pass = 0;
let fail = 0;

function check(name, condition) {
  if (condition) {
    pass++;
    console.log(`PASS: ${name}`);
  } else {
    fail++;
    console.log(`FAIL: ${name}`);
  }
}

// ── DEVICES request ────────────────────────────────────────────────────────
const devSession = createSession();
devSession.branch = "DEVICES";
devSession.deviceType = "veš mašina";
devSession.brand = "Bosch";
devSession.model = "WAE24460BY";
devSession.description = "Ne izbacuje vodu";
devSession.faultPattern = "Stalno";
devSession.installType = "samostojeći";
devSession.phone = "065123456";
devSession.location = "Borik";
devSession.name = "Aleksandar";
devSession.photos = ["https://example.com/1.jpg", "https://example.com/2.jpg"];

const devEmail = buildTechnicianEmail(devSession);
check("DEVICES: returns subject+text", !!devEmail.subject && !!devEmail.text);
check(
  "DEVICES: subject has branch + device + location",
  devEmail.subject.includes("DEVICES") &&
    devEmail.subject.includes("veš mašina") &&
    devEmail.subject.includes("Borik"),
);
check("DEVICES: body has device", devEmail.text.includes("Uređaj: veš mašina"));
check("DEVICES: body has brand", devEmail.text.includes("Brend: Bosch"));
check("DEVICES: body has phone", devEmail.text.includes("Telefon: 065123456"));
check(
  "DEVICES: body lists 2 photos",
  devEmail.text.includes("Broj fotografija: 2") &&
    devEmail.text.includes("1. https://example.com/1.jpg") &&
    devEmail.text.includes("2. https://example.com/2.jpg"),
);
check(
  "DEVICES: body has install type",
  devEmail.text.includes("Tip uređaja: samostojeći"),
);

// ── INSTALLATIONS request (with summaryNotes, no photos) ────────────────────
const instSession = createSession();
instSession.branch = "INSTALLATIONS";
instSession.installationType = "B1";
instSession.itemName = "ormar";
instSession.workReady = "Da, prostor je spreman";
instSession.summaryNotes = ["Klijent traži demontažu starog ormara."];
instSession.dimensions = "200x220x60";
instSession.phone = "065123456";
instSession.location = "Starčevica";
instSession.name = "Marko";

const instEmail = buildTechnicianEmail(instSession);
check(
  "INSTALLATIONS: subject has type label + location",
  instEmail.subject.includes("INSTALLATIONS") &&
    instEmail.subject.includes("B1") &&
    instEmail.subject.includes("Starčevica"),
);
check(
  "INSTALLATIONS: body has work type label",
  instEmail.text.includes("Vrsta radova: B1 — montaža namještaja"),
);
check(
  "INSTALLATIONS: body has item",
  instEmail.text.includes("Predmet/intervencija: ormar"),
);
check(
  "INSTALLATIONS: body has summary notes",
  instEmail.text.includes("Klijent traži demontažu starog ormara."),
);
check(
  "INSTALLATIONS: no photos message",
  instEmail.text.includes("Broj fotografija: 0") &&
    instEmail.text.includes("Nema fotografija."),
);

// ── Robustness: empty/fresh session must not throw ──────────────────────────
let threw = false;
try {
  const empty = createSession();
  buildTechnicianEmail(empty);
} catch (e) {
  threw = true;
}
check("Empty session does not throw", !threw);

// ── Robustness: legacy session without summaryNotes field ───────────────────
let threw2 = false;
try {
  const legacy = createSession();
  legacy.branch = "INSTALLATIONS";
  legacy.installationType = "B3";
  delete legacy.summaryNotes; // simulate pre-Task-[5] session
  legacy.phone = "065";
  const e = buildTechnicianEmail(legacy);
  if (!e.text.includes("Napomene")) threw2 = true;
} catch (e) {
  threw2 = true;
}
check("Legacy session (no summaryNotes) handled safely", !threw2);

// ── Result ──────────────────────────────────────────────────────────────────
console.log(`\nEMAIL BUILDER: ${pass}/${pass + fail} PASS`);
if (fail > 0) process.exit(1);
