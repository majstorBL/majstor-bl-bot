// Task [7d] — Minimal Web Chat / Test UI regression suite
// -----------------------------------------------------------------------------
// Boots the Express app on an ephemeral port and verifies the static test UI
// served at GET /web-chat. No external env vars needed. This suite does NOT
// test bot behavior (that is covered by test-web-channel.js and the flow
// suites) — it only confirms the UI page exists, references the existing
// endpoint, contains the expected markers, and adds no photo upload control.
// It also re-confirms the underlying POST /channels/web/message still works.
// Run with: node test-web-ui.js
// -----------------------------------------------------------------------------

const app = require("./src/app");

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

async function run() {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ── GET /web-chat returns 200 HTML ────────────────────────────────────────
    const res = await fetch(`${baseUrl}/web-chat`);
    check("[7d] GET /web-chat returns HTTP 200", res.status === 200, `status ${res.status}`);

    const html = await res.text();

    check(
      "[7d] response looks like an HTML document",
      /<!doctype html>/i.test(html) && html.includes("</html>"),
      "missing html doctype / closing tag",
    );

    // ── Expected UI markers ───────────────────────────────────────────────────
    check(
      "[7d] page contains the Web Test Chat title marker",
      html.includes("Web Test Chat"),
      "title marker not found",
    );
    check(
      "[7d] page contains the photo guidance note marker",
      html.includes("Ako bot traži fotografiju"),
      "photo guidance note not found",
    );
    check(
      "[7d] page contains the reset button label",
      html.includes("Nova konverzacija"),
      "reset button label not found",
    );

    // ── References the existing [7c] endpoint ─────────────────────────────────
    check(
      "[7d] page references the /channels/web/message endpoint",
      html.includes("/channels/web/message"),
      "endpoint reference not found",
    );

    // ── No photo/file/video upload input present ──────────────────────────────
    check(
      "[7d] page contains NO file upload input",
      !/type\s*=\s*["']file["']/i.test(html),
      "an <input type=file> was found",
    );
    check(
      "[7d] page contains NO video element",
      !/<video[\s>]/i.test(html),
      "a <video> element was found",
    );

    // ── Safe rendering: textContent only, no innerHTML assignment ─────────────
    check(
      "[7d] page uses safe textContent rendering",
      html.includes("div.textContent = text"),
      "safe textContent rendering marker not found",
    );
    check(
      "[7d] page contains NO innerHTML assignment",
      !/\.innerHTML\s*=/.test(html),
      "innerHTML assignment found",
    );

    // ── Underlying endpoint still works (sanity, not a behavior test) ─────────
    const r = await fetch(`${baseUrl}/channels/web/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: `7d-${process.pid}`, text: "" }),
    });
    let json = null;
    try {
      json = await r.json();
    } catch (e) {
      json = null;
    }
    check(
      "[7d] POST /channels/web/message still returns 200 + JSON reply",
      r.status === 200 && json && typeof json.reply === "string",
      `status ${r.status} json ${JSON.stringify(json)}`,
    );
    check(
      "[7d] underlying endpoint still returns the opening prompt",
      json && json.reply.includes("Koju uslugu trebate"),
      `reply ${json && json.reply}`,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\nWEB UI: ${pass}/${pass + fail} PASS`);
  if (fail > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Unexpected test error:", err);
  process.exit(1);
});
