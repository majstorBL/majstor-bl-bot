// test-devices-flow-polish.js
//
// DEVICES flow polish regression test
//
// Purpose:
// 1. Detect which device keywords are currently recognized.
// 2. Verify that "ugradbeni/samostojeći" is asked ONLY for relevant devices.
// 3. Verify that room/location inside the home is NOT asked in DEVICES flow.
// 4. Verify that DEVICES photo prompt is aligned with INSTALLATIONS quality:
//    max 2 photos, video not supported, "Dalje" guidance.
//
// Run:
//   Terminal 1: npm run dev
//   Terminal 2: node .\test-devices-flow-polish.js

const BASE_URL = "http://localhost:3000";

let passed = 0;
let failed = 0;

function normalize(text) {
  return (text || "").toString().toLowerCase();
}

function containsAny(text, patterns) {
  const input = normalize(text);
  return patterns.some((p) => input.includes(p.toLowerCase()));
}

async function next(userId, tekst) {
  const url =
    `${BASE_URL}/next?userId=${encodeURIComponent(userId)}` +
    `&tekst=${encodeURIComponent(tekst)}`;

  const res = await fetch(url);
  return await res.text();
}

async function reset(userId) {
  const url = `${BASE_URL}/reset?userId=${encodeURIComponent(userId)}`;
  const res = await fetch(url);
  return await res.text();
}

function assertReply(label, reply, expected = [], forbidden = []) {
  const missing = expected.filter(
    (p) => !normalize(reply).includes(p.toLowerCase()),
  );
  const foundForbidden = forbidden.filter((p) =>
    normalize(reply).includes(p.toLowerCase()),
  );

  if (missing.length === 0 && foundForbidden.length === 0) {
    console.log(`✅ PASS: ${label}`);
    passed++;
    return;
  }

  console.log(`❌ FAIL: ${label}`);
  if (missing.length > 0) {
    console.log(`   Missing expected: ${missing.join(" | ")}`);
  }
  if (foundForbidden.length > 0) {
    console.log(`   Forbidden found: ${foundForbidden.join(" | ")}`);
  }
  console.log(`   Reply: ${reply}`);
  failed++;
}

async function runDeviceFlowUntilAfterFaultPattern(userId, firstMessage) {
  await reset(userId);

  const r1 = await next(userId, firstMessage);
  const r2 = await next(userId, "Beko");
  const r3 = await next(userId, "Model X");
  const r4 = await next(userId, "Ne radi kako treba");
  const r5 = await next(userId, "Stalno");

  return { r1, r2, r3, r4, r5 };
}

async function testKeywordRecognition(
  label,
  userId,
  firstMessage,
  expectedDeviceWords = [],
) {
  await reset(userId);
  const reply = await next(userId, firstMessage);

  assertReply(
    label,
    reply,
    ["brend"],
    ["nisam siguran", "možete li precizirati", "o kojoj vrsti radova"],
  );

  if (expectedDeviceWords.length > 0) {
    const ok = containsAny(reply, expectedDeviceWords);
    if (ok) {
      console.log(`✅ PASS: ${label} — device wording`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${label} — device wording`);
      console.log(`   Expected one of: ${expectedDeviceWords.join(" | ")}`);
      console.log(`   Reply: ${reply}`);
      failed++;
    }
  }
}

async function testNonInstallTypeDevice(label, userId, firstMessage) {
  const { r5 } = await runDeviceFlowUntilAfterFaultPattern(
    userId,
    firstMessage,
  );

  assertReply(
    label,
    r5,
    ["fotograf"],
    [
      "ugradbeni",
      "samostojeći",
      "kojem dijelu prostora",
      "kuhinja",
      "kupatilo",
      "ostava",
    ],
  );
}

async function testInstallTypeRelevantDevice(label, userId, firstMessage) {
  const { r5 } = await runDeviceFlowUntilAfterFaultPattern(
    userId,
    firstMessage,
  );

  assertReply(
    label,
    r5,
    ["ugradbeni", "samostojeći"],
    ["kojem dijelu prostora", "kuhinja, kupatilo, ostava"],
  );
}

async function testDevicesPhotoPrompt(label, userId, firstMessage) {
  await reset(userId);

  await next(userId, firstMessage);
  await next(userId, "Beko");
  await next(userId, "Model X");
  await next(userId, "Ne radi kako treba");
  const afterFaultPattern = await next(userId, "Stalno");

  let photoPrompt = afterFaultPattern;

  // Current code may still ask "ugradbeni/samostojeći"; if so, answer it to reach ASK_PHOTOS.
  if (
    normalize(afterFaultPattern).includes("ugradbeni") ||
    normalize(afterFaultPattern).includes("samostojeći")
  ) {
    photoPrompt = await next(userId, "Samostojeći");
  }

  assertReply(
    label,
    photoPrompt,
    ["fotograf", "maksimalno 2", "video", "nije podržan", "dalje"],
    [],
  );
}

async function main() {
  console.log("==============================================");
  console.log("DEVICES FLOW POLISH REGRESSION TEST");
  console.log("==============================================");
  console.log("");

  console.log(
    "A) Keyword recognition — device should route to DEVICES and ask for brand",
  );
  console.log("");

  await testKeywordRecognition(
    "A1 — frižider typo: frižder ne radi",
    "dev-keyword-1",
    "Frižder ne radi.",
    ["frižider", "frižder"],
  );

  await testKeywordRecognition(
    "A2 — škrinja / freezer chest",
    "dev-keyword-2",
    "Škrinja se ne hladi.",
    ["zamrzivač", "škrinja"],
  );

  await testKeywordRecognition(
    "A3 — sušilica veša",
    "dev-keyword-3",
    "Sušilica veša neće da se upali.",
    // Bot replies with the BHS instrumental form ("sušilicom"), so match the stem.
    ["sušilic"],
  );

  await testKeywordRecognition(
    "A4 — printer / štampač",
    "dev-keyword-4",
    "Printer ne štampa.",
    ["printer", "štampač"],
  );

  await testKeywordRecognition(
    "A5 — indukciona ploča",
    "dev-keyword-5",
    "Indukciona ploča ne radi.",
    // Bot replies with the BHS instrumental form ("pločom"), so match the stem.
    ["ploč"],
  );

  await testKeywordRecognition(
    "A6 — električna ploča",
    "dev-keyword-6",
    "Električna ploča se ne uključuje.",
    // Bot replies with the BHS instrumental form ("pločom"), so match the stem.
    ["ploč"],
  );

  await testKeywordRecognition(
    "A7 — šparet local spelling",
    "dev-keyword-7",
    "Šparet ne radi.",
    ["šporet", "šparet"],
  );

  await testKeywordRecognition(
    "A8 — perilica posuđa",
    "dev-keyword-8",
    "Perilica posuđa ne izbacuje vodu.",
    ["sudomašin", "perilica"],
  );

  await testKeywordRecognition(
    "A9 — laptop typo: loptop",
    "dev-keyword-9",
    "Loptop neće da se pokrene.",
    ["laptop", "loptop"],
  );

  console.log("");
  console.log("B) Devices where install-type question should NOT be asked");
  console.log("");

  await testNonInstallTypeDevice(
    "B1 — računar should skip ugradbeni/samostojeći",
    "dev-non-install-1",
    "Računar neće da se upali.",
  );

  await testNonInstallTypeDevice(
    "B2 — laptop should skip ugradbeni/samostojeći",
    "dev-non-install-2",
    "Laptop se gasi sam od sebe.",
  );

  await testNonInstallTypeDevice(
    "B3 — monitor should skip ugradbeni/samostojeći",
    "dev-non-install-3",
    "Monitor nema sliku.",
  );

  await testNonInstallTypeDevice(
    "B4 — televizor should skip ugradbeni/samostojeći",
    "dev-non-install-4",
    "TV ne prikazuje sliku.",
  );

  console.log("");
  console.log("C) Devices where install-type question IS relevant");
  console.log("");

  await testInstallTypeRelevantDevice(
    "C1 — sudomašina should ask ugradbeni/samostojeći only",
    "dev-install-1",
    "Sudomašina ne izbacuje vodu.",
  );

  await testInstallTypeRelevantDevice(
    "C2 — frižider should ask ugradbeni/samostojeći only",
    "dev-install-2",
    "Frižider ne hladi.",
  );

  await testInstallTypeRelevantDevice(
    "C3 — šporet should ask ugradbeni/samostojeći only",
    "dev-install-3",
    "Šporet ne radi.",
  );

  await testInstallTypeRelevantDevice(
    "C4 — kuhinjski bojler should ask ugradbeni/samostojeći only",
    "dev-install-4",
    "Kuhinjski bojler ne grije vodu.",
  );

  await testInstallTypeRelevantDevice(
    "C5 — indukciona ploča should ask ugradbeni/samostojeći only",
    "dev-install-5",
    "Indukciona ploča izbacuje grešku.",
  );

  console.log("");
  console.log("D) DEVICES photo prompt quality");
  console.log("");

  await testDevicesPhotoPrompt(
    "D1 — photo prompt should mention max 2 photos, video not supported, Dalje",
    "dev-photo-1",
    "Veš mašina ne radi.",
  );

  console.log("");
  console.log("==============================================");
  console.log(`RESULT: Passed ${passed}, Failed ${failed}`);
  console.log("==============================================");

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Test runner error:", err);
  process.exitCode = 1;
});
