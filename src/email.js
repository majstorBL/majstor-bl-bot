// ── Email module (Task [8a]) ───────────────────────────────────────────────
// Extracted verbatim from src/app.js with no behavior change. Contains the
// technician email notification logic: a pure email builder and a
// non-blocking Brevo HTTP API sender. Email transport = Brevo HTTP API
// (POST https://api.brevo.com/v3/smtp/email) — see CLAUDE.md Section 5.

// ── Technician email notification (Task [5]) ───────────────────────────────
// Builds a plain-text email summary of a completed request. Returns
// { subject, text }. Pure function — does not touch the session or network,
// so it is safe to unit-test in isolation.
function buildTechnicianEmail(session) {
  const dash = "—";
  const branch = session.branch || dash;
  const timestamp = new Date().toISOString();

  const typeLabels = {
    B1: "B1 — montaža namještaja",
    B2: "B2 — manja elektro intervencija",
    B3: "B3 — manja vodoinstalaterska intervencija",
    B4: "B4 — ugradnja/priključenje uređaja",
  };

  // Guard for old sessions that may predate the summaryNotes field.
  const summaryNotes = Array.isArray(session.summaryNotes)
    ? session.summaryNotes
    : [];
  const photos = Array.isArray(session.photos) ? session.photos : [];
  const location = session.location || dash;

  // ── Subject line ──────────────────────────────────────────────────────
  let subjectDetail;
  if (branch === "DEVICES") {
    subjectDetail = session.deviceType || session.service || "uređaj";
  } else if (branch === "INSTALLATIONS") {
    subjectDetail =
      typeLabels[session.installationType] ||
      session.installationType ||
      "intervencija";
  } else {
    subjectDetail = "zahtjev";
  }
  const subjectLocation = session.location || "bez lokacije";
  const subject = `[NOVI ZAHTJEV] ${branch} — ${subjectDetail} — ${subjectLocation}`;

  // ── Request body lines ────────────────────────────────────────────────
  const lines = [];
  lines.push("NOVI ZAHTJEV — MAJSTOR BANJA LUKA");
  lines.push("");
  lines.push(`Vrijeme prijave: ${timestamp}`);
  lines.push(`Branch: ${branch}`);
  lines.push("");
  lines.push("--- PODACI O ZAHTJEVU ---");

  if (branch === "DEVICES") {
    lines.push(`Uređaj: ${session.deviceType || session.service || dash}`);
    lines.push(`Brend: ${session.brand || dash}`);
    lines.push(`Model: ${session.model || dash}`);
    lines.push(`Problem: ${session.description || dash}`);
    lines.push(`Učestalost kvara: ${session.faultPattern || dash}`);
    lines.push(`Tip uređaja: ${session.installType || dash}`);
  } else if (branch === "INSTALLATIONS") {
    lines.push(
      `Vrsta radova: ${
        typeLabels[session.installationType] || session.installationType || dash
      }`,
    );
    lines.push(`Predmet/intervencija: ${session.itemName || dash}`);
    lines.push(`Opis problema: ${session.description || dash}`);
    lines.push(`Prostor pripremljen: ${session.workReady || dash}`);
    lines.push(
      `Napomene: ${summaryNotes.length > 0 ? summaryNotes.join(" ") : dash}`,
    );
    lines.push(`Zid/površina: ${session.wallType || dash}`);
    lines.push(`Pristup instalacijama: ${session.accessInfo || dash}`);
    lines.push(`Brend: ${session.brand || dash}`);
    lines.push(`Model: ${session.model || dash}`);
    lines.push(`Dimenzije: ${session.dimensions || dash}`);
  } else {
    lines.push(`Usluga: ${session.service || dash}`);
  }

  lines.push("");
  lines.push("--- KONTAKT ---");
  lines.push(`Telefon: ${session.phone || dash}`);
  lines.push(`Lokacija/adresa: ${location}`);
  lines.push(`Ime: ${session.name || dash}`);

  lines.push("");
  lines.push("--- FOTOGRAFIJE ---");
  lines.push(`Broj fotografija: ${photos.length}`);
  if (photos.length === 0) {
    lines.push("Nema fotografija.");
  } else {
    photos.forEach((url, i) => lines.push(`${i + 1}. ${url}`));
  }

  return { subject, text: lines.join("\n") };
}

// Sends the technician notification email. NON-BLOCKING, SAFE, IDEMPOTENT:
// callers do not await it, it never throws, it skips silently when env vars
// are missing, and it marks emailSent only after a successful send so a failed
// attempt can be retried in the future.
async function sendSummaryEmail(session) {
  if (!session || session.emailSent) return;

  const { BREVO_API_KEY, EMAIL_FROM, EMAIL_TO, EMAIL_FROM_NAME } = process.env;
  if (!BREVO_API_KEY || !EMAIL_FROM || !EMAIL_TO) {
    console.warn(
      "Email notification skipped: missing BREVO_API_KEY, EMAIL_FROM or EMAIL_TO.",
    );
    return;
  }

  try {
    const email = buildTechnicianEmail(session);

    const payload = {
      sender: {
        email: EMAIL_FROM,
        name: EMAIL_FROM_NAME || "Majstor Banja Luka",
      },
      to: [{ email: EMAIL_TO }],
      subject: email.subject,
      textContent: email.text,
    };

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      throw new Error(`Brevo API error ${response.status}: ${responseBody}`);
    }

    session.emailSent = true;
    console.log("Technician email notification sent.");
  } catch (err) {
    console.error("Technician email notification failed:", err.message);
  }
}

module.exports = {
  buildTechnicianEmail,
  sendSummaryEmail,
};
