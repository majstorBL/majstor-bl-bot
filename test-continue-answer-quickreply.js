// [6g] Quick Reply "Dalje" regression suite
// -----------------------------------------------------------------------------
// Two parts:
//   PART A — pure unit tests for isContinueAnswer() (NO server needed).
//   PART B — HTTP flow tests proving "Dalje" and "➡️ Dalje" both advance the
//            flow at every skip point (ASK_PHOTOS, ASK_LOCATION, ASK_NAME).
//            PART B requires the server running on localhost:3000.
//
// Background: Android Messenger sends the Quick Reply TITLE back as text, not
// the payload. The old title "➡️ Dalje" then failed strict === "dalje" match
// and the photo prompt looped. isContinueAnswer() now strips emoji/punctuation.
// -----------------------------------------------------------------------------

const http = require("http");
const { isContinueAnswer } = require("./src/app");

const BASE_URL = "http://localhost:3000";

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`✅ PASS: ${name}`);
  } else {
    failed++;
    console.log(`❌ FAIL: ${name}`);
    if (detail) console.log(`   ${detail}`);
  }
}

// ── PART A — isContinueAnswer() unit tests (no server) ──────────────────────
function runUnitTests() {
  console.log("=== PART A — isContinueAnswer() unit tests ===");

  const shouldBeTrue = [
    "dalje",
    "Dalje",
    "DALJE",
    " dalje ",
    "Dalje.",
    "dalje!",
    "➡️ Dalje",
    "➜ Dalje",
    "➡ Dalje",
    "  ➡️   Dalje  ",
  ];
  shouldBeTrue.forEach((input) => {
    check(
      `isContinueAnswer(${JSON.stringify(input)}) === true`,
      isContinueAnswer(input) === true,
      `got ${isContinueAnswer(input)}`,
    );
  });

  const shouldBeFalse = [
    "",
    null,
    undefined,
    "ne",
    "Lenovo",
    "dalje molim",
    "idemo dalje",
    "065123456",
    "da",
  ];
  shouldBeFalse.forEach((input) => {
    check(
      `isContinueAnswer(${JSON.stringify(input)}) === false`,
      isContinueAnswer(input) === false,
      `got ${isContinueAnswer(input)}`,
    );
  });
}

// ── HTTP helpers ────────────────────────────────────────────────────────────
function request(path) {
  return new Promise((resolve, reject) => {
    http
      .get(`${BASE_URL}${path}`, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

async function send(userId, tekst) {
  return request(
    `/next?userId=${encodeURIComponent(userId)}&tekst=${encodeURIComponent(tekst)}`,
  );
}

// Drives a DEVICES flow (laptop — skips ASK_INSTALL_TYPE) up to ASK_PHOTOS.
// Returns the userId so the caller can continue the flow.
async function driveDevicesToPhotos(userId) {
  await request(`/reset?userId=${encodeURIComponent(userId)}`);
  await send(userId, "Laptop ne radi"); // → ASK_BRAND
  await send(userId, "Lenovo"); // → ASK_MODEL
  await send(userId, "nepoznat"); // → ASK_DESCRIPTION
  await send(userId, "ne pali se"); // → ASK_FAULT_PATTERN
  await send(userId, "stalno"); // → ASK_PHOTOS (laptop skips install type)
}

// ── PART B — HTTP flow tests (server required) ──────────────────────────────
async function runFlowTests() {
  console.log("");
  console.log("=== PART B — HTTP flow tests (server required) ===");

  // 1. ASK_PHOTOS + plain "Dalje" → ASK_CONFIRMATION
  {
    const userId = `qr-photos-plain-${Date.now()}`;
    await driveDevicesToPhotos(userId);
    const reply = await send(userId, "Dalje");
    check(
      'ASK_PHOTOS: plain "Dalje" advances to ASK_CONFIRMATION',
      reply.includes("kontaktira") && reply.includes("(da/ne)"),
      `Reply: ${reply}`,
    );
  }

  // 2. ASK_PHOTOS + "➡️ Dalje" → ASK_CONFIRMATION
  {
    const userId = `qr-photos-emoji-${Date.now()}`;
    await driveDevicesToPhotos(userId);
    const reply = await send(userId, "➡️ Dalje");
    check(
      'ASK_PHOTOS: "➡️ Dalje" advances to ASK_CONFIRMATION (Android case)',
      reply.includes("kontaktira") && reply.includes("(da/ne)"),
      `Reply: ${reply}`,
    );
    // Must NOT loop the photo prompt.
    check(
      'ASK_PHOTOS: "➡️ Dalje" does NOT repeat the photo prompt',
      !reply.includes("Ako nemate fotografiju"),
      `Reply: ${reply}`,
    );
  }

  // 3. ASK_LOCATION + "➡️ Dalje" → ASK_NAME (location skipped)
  {
    const userId = `qr-location-emoji-${Date.now()}`;
    await driveDevicesToPhotos(userId);
    await send(userId, "➡️ Dalje"); // ASK_PHOTOS → ASK_CONFIRMATION
    await send(userId, "da"); // → ASK_PHONE
    await send(userId, "065123456"); // → ASK_LOCATION
    const reply = await send(userId, "➡️ Dalje"); // → ASK_NAME
    check(
      'ASK_LOCATION: "➡️ Dalje" skips location, asks for name',
      reply.includes("Na koje ime"),
      `Reply: ${reply}`,
    );
  }

  // 4. ASK_NAME + "➡️ Dalje" → END + summary (name skipped, location skipped)
  {
    const userId = `qr-name-emoji-${Date.now()}`;
    await driveDevicesToPhotos(userId);
    await send(userId, "➡️ Dalje"); // ASK_PHOTOS → ASK_CONFIRMATION
    await send(userId, "da"); // → ASK_PHONE
    await send(userId, "065123456"); // → ASK_LOCATION
    await send(userId, "➡️ Dalje"); // → ASK_NAME (location skipped)
    const reply = await send(userId, "➡️ Dalje"); // → END + summary
    check(
      'ASK_NAME: "➡️ Dalje" completes the summary',
      reply.includes("--- REZIME ---") &&
        reply.includes("Vaš zahtjev je primljen"),
      `Reply: ${reply}`,
    );
    check(
      'ASK_NAME: skipped name shows "Ime: —" in summary',
      reply.includes("Ime: —"),
      `Reply: ${reply}`,
    );
    check(
      'ASK_LOCATION: skipped location shows "Lokacija/adresa: —" in summary',
      reply.includes("Lokacija/adresa: —"),
      `Reply: ${reply}`,
    );
  }

  // 5. Existing plain "Dalje" at ASK_NAME still completes the summary
  {
    const userId = `qr-name-plain-${Date.now()}`;
    await driveDevicesToPhotos(userId);
    await send(userId, "Dalje"); // ASK_PHOTOS → ASK_CONFIRMATION
    await send(userId, "da"); // → ASK_PHONE
    await send(userId, "065123456"); // → ASK_LOCATION
    await send(userId, "Banja Luka, Centar"); // location provided
    const reply = await send(userId, "Dalje"); // ASK_NAME → END + summary
    check(
      'ASK_NAME: plain "Dalje" still completes the summary',
      reply.includes("--- REZIME ---") &&
        reply.includes("Lokacija/adresa: Banja Luka, Centar"),
      `Reply: ${reply}`,
    );
  }
}

async function main() {
  runUnitTests();
  try {
    await runFlowTests();
  } catch (err) {
    console.log("");
    console.log(
      "⚠️  PART B skipped — server not reachable on localhost:3000.",
    );
    console.log(`   ${err.message}`);
    failed++;
  }

  console.log("");
  console.log("----------------");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main();
