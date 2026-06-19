// [8b] Web routes module — extracted from src/app.js with NO behavior change.
// Holds the two Web channel transport routes only:
//   POST /channels/web/message  (Task [7c] — text-only JSON endpoint)
//   GET  /web-chat              (Task [7d] — minimal static test UI)
// Both routes delegate to the same channel-agnostic handleIncomingText()
// wrapper used by the Messenger webhook and the /next test endpoint. This
// module adds NO new behavior: it is a pure structural extraction. No photo
// upload, no auth, no rate limiting, no AI, no CRM.
const path = require("path"); // built-in Node.js module — only /web-chat needs it

// Registers the Web channel routes on the given Express app. Dependencies are
// passed in (handleIncomingText, CHANNEL_WEB) so this module stays decoupled
// from the app.js session state and channel constants.
function registerWebRoutes(app, { handleIncomingText, CHANNEL_WEB }) {
  // ── Web/Internal Channel API (Task [7c]) ──────────────────────────────────
  // Minimal text-only HTTP endpoint for the Web/Internal channel. It is a thin
  // transport adapter only: it validates the JSON body, delegates to the same
  // channel-agnostic handleIncomingText() wrapper the Messenger webhook and the
  // /next test endpoint use, and returns the bot reply as JSON. No photo/file
  // upload, no Quick Reply, no AI, no scheduling, no pricing — those are not part
  // of this task. Web sessions are isolated as "web:<userId>" via the channel
  // passed to handleIncomingText() (CHANNEL_WEB), so they never collide with
  // Messenger or test sessions sharing the same raw id.
  app.post("/channels/web/message", (req, res) => {
    const body = req.body || {};
    const { userId, text } = body;

    // Validation: userId must be a non-empty string, text must be a string.
    // Errors are returned as simple, consistent JSON — never raw thrown errors.
    if (typeof userId !== "string" || userId.trim() === "") {
      return res.status(400).json({ error: "userId and text are required" });
    }
    if (typeof text !== "string") {
      return res.status(400).json({ error: "userId and text are required" });
    }

    const reply = handleIncomingText({ channel: CHANNEL_WEB, userId, text });
    return res.json({ reply });
  });

  // ── Minimal Web Chat / Test UI (Task [7d]) ────────────────────────────────
  // Serves a single static HTML page that lets the owner test the existing bot
  // flow in a browser. The page itself uses same-origin fetch() to the existing
  // POST /channels/web/message endpoint ([7c]). This route ONLY serves a file —
  // it does not touch processMessage(), sessions, DEVICES/INSTALLATIONS flows,
  // Messenger, or email. Text-only: no photo/video upload, no AI, no auth.
  // path is resolved relative to this file (src/web.js), which is inside src/,
  // so "..", "public", "web-chat.html" yields the same effective path as before.
  app.get("/web-chat", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "web-chat.html"));
  });
}

module.exports = {
  registerWebRoutes,
};
