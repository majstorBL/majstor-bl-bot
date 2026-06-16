// Task [7a] — Channel Adapter Foundation regression suite
// -----------------------------------------------------------------------------
// Pure-function / in-memory tests: NO server, NO network, NO env vars needed.
// Run with: node test-channel-adapter.js
//
// Verifies the minimal channel/session adapter foundation introduced in [7a]:
//   - buildSessionKey(channel, userId) produces "channel:userId"
//   - handleIncomingText({channel, userId, text}) keeps a continuous session
//     per (channel,userId), so Messenger text + Messenger photos that both use
//     buildSessionKey("messenger", senderId) share ONE session.
//   - different channels with the SAME raw userId stay isolated (no collision).
//   - the wrapper returns the same kind of reply strings the bot already used,
//     i.e. GET /next behavior (now routed through channel "test") is preserved.
// -----------------------------------------------------------------------------

const app = require("./src/app");
const { buildSessionKey, handleIncomingText } = app;

let pass = 0;
let fail = 0;

function check(name, condition, detail) {
  if (condition) {
    pass++;
    console.log(`PASS: ${name}`);
  } else {
    fail++;
    console.log(`FAIL: ${name}`);
    if (detail) console.log(`   ${detail}`);
  }
}

// ── buildSessionKey() ───────────────────────────────────────────────────────
check(
  'buildSessionKey("messenger", "12345") === "messenger:12345"',
  buildSessionKey("messenger", "12345") === "messenger:12345",
  `got ${buildSessionKey("messenger", "12345")}`,
);
check(
  'buildSessionKey("test", "abc") === "test:abc"',
  buildSessionKey("test", "abc") === "test:abc",
  `got ${buildSessionKey("test", "abc")}`,
);
check(
  'buildSessionKey("test", "test-user") === "test:test-user"',
  buildSessionKey("test", "test-user") === "test:test-user",
  `got ${buildSessionKey("test", "test-user")}`,
);

// ── handleIncomingText() session continuity (text + photos share one key) ────
// Use a unique userId so this run never clashes with anything else in memory.
const uid = `7a-${process.pid}-${pass}`;

// First message (empty) → START opening prompt, session created under
// "messenger:<uid>".
const r1 = handleIncomingText({ channel: "messenger", userId: uid, text: "" });
check(
  "handleIncomingText: first empty message returns the opening prompt",
  r1.includes("Koju uslugu trebate"),
  `Reply: ${r1}`,
);

// Second message on the SAME (channel,userId) must continue the SAME session
// (it advances into the DEVICES flow), proving the session key is stable —
// the same key a Messenger photo attachment would resolve to.
const r2 = handleIncomingText({
  channel: "messenger",
  userId: uid,
  text: "popravka veš mašine",
});
check(
  "handleIncomingText: second message continues the same session (advances flow)",
  r2.includes("brend"),
  `Reply: ${r2}`,
);

// ── Channel isolation — same raw userId, different channel = different session
// "test:<uid>" must be a brand-new session, NOT the in-progress messenger one.
const rIsolation = handleIncomingText({
  channel: "test",
  userId: uid,
  text: "",
});
check(
  "channel isolation: same userId on a different channel is a fresh session",
  rIsolation.includes("Koju uslugu trebate"),
  `Reply: ${rIsolation}`,
);

// And the messenger session is untouched by the test-channel call: a follow-up
// messenger message keeps progressing (it is now past ASK_BRAND).
const r3 = handleIncomingText({
  channel: "messenger",
  userId: uid,
  text: "Bosch",
});
check(
  "channel isolation: messenger session unaffected by test-channel call",
  r3.includes("model"),
  `Reply: ${r3}`,
);

// ── /next behavior preserved — GET /next now routes through channel "test".
// Driving a full DEVICES flow through the "test" channel must still reach the
// same summary the browser endpoint produced before [7a].
const tuid = `7a-next-${process.pid}`;
const t = (text) => handleIncomingText({ channel: "test", userId: tuid, text });
t(""); // START → ASK_SERVICE
t("Laptop ne radi"); // → ASK_BRAND
t("Lenovo"); // → ASK_MODEL
t("nepoznat"); // → ASK_DESCRIPTION
t("ne pali se"); // → ASK_FAULT_PATTERN
t("stalno"); // → ASK_PHOTOS (laptop skips install type)
t("Dalje"); // → ASK_CONFIRMATION
t("da"); // → ASK_PHONE
t("065123456"); // → ASK_LOCATION
t("Dalje"); // → ASK_NAME
const summary = t("Dalje"); // → END + summary
check(
  '/next-style flow (channel "test") still completes the summary',
  summary.includes("--- REZIME ---") &&
    summary.includes("Vaš zahtjev je primljen"),
  `Reply: ${summary}`,
);

// ── /reset key contract (Task [7a-hotfix]) ──────────────────────────────────
// GET /reset with no ?channel clears BOTH "test:<id>" and "messenger:<id>" so
// manual Messenger smoke testing (/reset?userId=<senderId>) works again; an
// explicit ?channel clears only that single channel. These are the exact keys
// the route builds — verified here without needing the server.
const rid = "12345";
check(
  '/reset default targets the test key "test:12345"',
  buildSessionKey("test", rid) === "test:12345",
  `got ${buildSessionKey("test", rid)}`,
);
check(
  '/reset default also targets the messenger key "messenger:12345"',
  buildSessionKey("messenger", rid) === "messenger:12345",
  `got ${buildSessionKey("messenger", rid)}`,
);
check(
  '/reset explicit ?channel=messenger targets only "messenger:12345"',
  buildSessionKey("messenger", rid) === "messenger:12345" &&
    buildSessionKey("messenger", rid) !== buildSessionKey("test", rid),
  `messenger=${buildSessionKey("messenger", rid)} test=${buildSessionKey("test", rid)}`,
);

// ── Channel Transport Adapter (Task [7b]) ────────────────────────────────────
// Pure helpers for the Messenger transport boundary. No server, no network.
const {
  CHANNEL_MESSENGER,
  buildMessengerSessionKey,
  extractMessengerInput,
} = app;

check(
  '[7b] CHANNEL_MESSENGER constant === "messenger"',
  CHANNEL_MESSENGER === "messenger",
  `got ${CHANNEL_MESSENGER}`,
);

check(
  '[7b] buildMessengerSessionKey("12345") === "messenger:12345"',
  buildMessengerSessionKey("12345") === "messenger:12345",
  `got ${buildMessengerSessionKey("12345")}`,
);

check(
  "[7b] buildMessengerSessionKey matches buildSessionKey(messenger, id)",
  buildMessengerSessionKey("987") === buildSessionKey("messenger", "987"),
  `got ${buildMessengerSessionKey("987")} vs ${buildSessionKey("messenger", "987")}`,
);

// extractMessengerInput prefers quick_reply.payload over message.text.
check(
  "[7b] extractMessengerInput prefers quick_reply.payload over text",
  extractMessengerInput({
    message: { text: "neki tekst", quick_reply: { payload: "Dalje" } },
  }) === "Dalje",
  `got ${extractMessengerInput({ message: { text: "neki tekst", quick_reply: { payload: "Dalje" } } })}`,
);

// Falls back to plain message text when there is no quick reply.
check(
  "[7b] extractMessengerInput returns message.text when no quick reply",
  extractMessengerInput({ message: { text: "popravka veš mašine" } }) ===
    "popravka veš mašine",
  `got ${extractMessengerInput({ message: { text: "popravka veš mašine" } })}`,
);

// Returns null for attachment-only / empty events (caller then skips it).
check(
  "[7b] extractMessengerInput returns null for an attachment-only event",
  extractMessengerInput({
    message: { attachments: [{ type: "image", payload: { url: "x" } }] },
  }) === null,
  `got ${extractMessengerInput({ message: { attachments: [{ type: "image" }] } })}`,
);

// ── Result ──────────────────────────────────────────────────────────────────
console.log(`\nCHANNEL ADAPTER: ${pass}/${pass + fail} PASS`);
if (fail > 0) process.exit(1);
