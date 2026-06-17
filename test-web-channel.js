// Task [7c] — Web/Internal Channel API MVP regression suite
// -----------------------------------------------------------------------------
// Boots the Express app on an ephemeral port and drives the real
// POST /channels/web/message endpoint over HTTP. No external env vars needed
// (email is non-blocking and skips silently when unconfigured).
// Run with: node test-web-channel.js
//
// Verifies the minimal text-only Web/Internal channel introduced in [7c]:
//   - POST /channels/web/message with a valid {userId, text} returns 200 and
//     JSON { reply: "<bot reply string>" }, routed through the same core flow.
//   - two different web userIds do NOT share a session.
//   - the SAME raw userId on the web channel does NOT collide with the test or
//     messenger channels (session keys are channel-aware: "web:<userId>").
//   - missing/invalid userId returns HTTP 400 JSON error.
//   - missing/invalid text returns HTTP 400 JSON error.
//   - CHANNEL_WEB constant is exposed and equals "web".
// -----------------------------------------------------------------------------

const app = require("./src/app");
const { buildSessionKey, handleIncomingText, CHANNEL_WEB } = app;

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

async function postWeb(baseUrl, body) {
  const res = await fetch(`${baseUrl}/channels/web/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch (e) {
    json = null;
  }
  return { status: res.status, json };
}

async function run() {
  // ── CHANNEL_WEB constant (pure) ───────────────────────────────────────────
  check(
    '[7c] CHANNEL_WEB constant === "web"',
    CHANNEL_WEB === "web",
    `got ${CHANNEL_WEB}`,
  );
  check(
    '[7c] buildSessionKey("web", "abc") === "web:abc"',
    buildSessionKey("web", "abc") === "web:abc",
    `got ${buildSessionKey("web", "abc")}`,
  );

  // Boot the app on an ephemeral port (port 0 → OS picks a free port).
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ── Valid request → 200 + JSON { reply } ────────────────────────────────
    const uidA = `7c-A-${process.pid}`;
    const r1 = await postWeb(baseUrl, { userId: uidA, text: "" });
    check(
      "[7c] valid first message returns 200",
      r1.status === 200,
      `status ${r1.status}`,
    );
    check(
      "[7c] response is JSON with a string reply field",
      r1.json && typeof r1.json.reply === "string",
      `json ${JSON.stringify(r1.json)}`,
    );
    check(
      "[7c] first empty message returns the opening prompt",
      r1.json && r1.json.reply.includes("Koju uslugu trebate"),
      `reply ${r1.json && r1.json.reply}`,
    );

    // Second message on the SAME web userId continues the SAME session.
    const r2 = await postWeb(baseUrl, {
      userId: uidA,
      text: "popravka veš mašine",
    });
    check(
      "[7c] second message continues the same web session (advances flow)",
      r2.json && r2.json.reply.includes("brend"),
      `reply ${r2.json && r2.json.reply}`,
    );

    // ── Two different web userIds do NOT share a session ─────────────────────
    const uidB = `7c-B-${process.pid}`;
    const rB = await postWeb(baseUrl, { userId: uidB, text: "" });
    check(
      "[7c] a different web userId is a fresh, independent session",
      rB.json && rB.json.reply.includes("Koju uslugu trebate"),
      `reply ${rB.json && rB.json.reply}`,
    );
    // uidA is mid-flow; confirm it is still mid-flow (unaffected by uidB).
    const rAcont = await postWeb(baseUrl, { userId: uidA, text: "Bosch" });
    check(
      "[7c] first web session unaffected by the second web user",
      rAcont.json && rAcont.json.reply.includes("model"),
      `reply ${rAcont.json && rAcont.json.reply}`,
    );

    // ── Same raw userId on web vs test/messenger must NOT collide ────────────
    const sharedId = `7c-shared-${process.pid}`;
    // Start a messenger session for the same raw id and advance it past START.
    handleIncomingText({ channel: "messenger", userId: sharedId, text: "" });
    handleIncomingText({
      channel: "messenger",
      userId: sharedId,
      text: "Laptop ne radi",
    });
    // The web channel with the same raw id must be a brand-new session.
    const rShared = await postWeb(baseUrl, { userId: sharedId, text: "" });
    check(
      "[7c] same raw userId on web does not collide with messenger session",
      rShared.json && rShared.json.reply.includes("Koju uslugu trebate"),
      `reply ${rShared.json && rShared.json.reply}`,
    );
    check(
      "[7c] web/messenger session keys differ for the same raw userId",
      buildSessionKey("web", sharedId) !==
        buildSessionKey("messenger", sharedId),
      `web=${buildSessionKey("web", sharedId)} messenger=${buildSessionKey("messenger", sharedId)}`,
    );

    // Also verify the same raw userId on web does NOT collide with the
    // browser-test channel ("test:<userId>").
    const sharedTestId = `7c-shared-test-${process.pid}`;

    handleIncomingText({ channel: "test", userId: sharedTestId, text: "" });
    handleIncomingText({
      channel: "test",
      userId: sharedTestId,
      text: "Laptop ne radi",
    });

    const rSharedTest = await postWeb(baseUrl, {
      userId: sharedTestId,
      text: "",
    });

    check(
      "[7c] same raw userId on web does not collide with test session",
      rSharedTest.json &&
        rSharedTest.json.reply.includes("Koju uslugu trebate"),
      `reply ${rSharedTest.json && rSharedTest.json.reply}`,
    );

    check(
      "[7c] web/test session keys differ for the same raw userId",
      buildSessionKey("web", sharedTestId) !==
        buildSessionKey("test", sharedTestId),
      `web=${buildSessionKey("web", sharedTestId)} test=${buildSessionKey("test", sharedTestId)}`,
    );

    // ── Validation: missing / invalid userId → 400 ──────────────────────────
    const rNoUser = await postWeb(baseUrl, { text: "zdravo" });
    check(
      "[7c] missing userId returns HTTP 400",
      rNoUser.status === 400,
      `status ${rNoUser.status}`,
    );
    check(
      "[7c] missing userId returns a JSON error field",
      rNoUser.json && typeof rNoUser.json.error === "string",
      `json ${JSON.stringify(rNoUser.json)}`,
    );
    const rEmptyUser = await postWeb(baseUrl, {
      userId: "   ",
      text: "zdravo",
    });
    check(
      "[7c] empty/whitespace userId returns HTTP 400",
      rEmptyUser.status === 400,
      `status ${rEmptyUser.status}`,
    );
    const rNumUser = await postWeb(baseUrl, { userId: 123, text: "zdravo" });
    check(
      "[7c] non-string userId returns HTTP 400",
      rNumUser.status === 400,
      `status ${rNumUser.status}`,
    );

    // ── Validation: missing / invalid text → 400 ────────────────────────────
    const rNoText = await postWeb(baseUrl, { userId: "web-x" });
    check(
      "[7c] missing text returns HTTP 400",
      rNoText.status === 400,
      `status ${rNoText.status}`,
    );
    const rNumText = await postWeb(baseUrl, { userId: "web-x", text: 5 });
    check(
      "[7c] non-string text returns HTTP 400",
      rNumText.status === 400,
      `status ${rNumText.status}`,
    );

    // Empty-string text is VALID (it is the documented "first message" trigger).
    const rEmptyText = await postWeb(baseUrl, {
      userId: `7c-empty-${process.pid}`,
      text: "",
    });
    check(
      "[7c] empty-string text is accepted (200) — it is the START trigger",
      rEmptyText.status === 200 &&
        rEmptyText.json &&
        typeof rEmptyText.json.reply === "string",
      `status ${rEmptyText.status} json ${JSON.stringify(rEmptyText.json)}`,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  // ── Result ────────────────────────────────────────────────────────────────
  console.log(`\nWEB CHANNEL: ${pass}/${pass + fail} PASS`);
  if (fail > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Unexpected test error:", err);
  process.exit(1);
});
