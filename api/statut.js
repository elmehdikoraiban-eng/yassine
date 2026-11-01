// Reçoit les changements de statut du Google Sheet et les renvoie à Meta (API Conversions).
// Variables d'environnement Vercel : META_CAPI_TOKEN, STATUT_SECRET (partagé avec l'Apps Script),
// META_TEST_EVENT_CODE (facultatif).
const crypto = require("crypto");

const PIXEL_ID = "1121433940618331";
const GRAPH = "https://graph.facebook.com/v23.0/" + PIXEL_ID + "/events";
// Statut du Sheet -> nom de l'événement Meta
const EVENTS = { "Qualifié": "LeadQualifie", "RDV": "Schedule", "Signé": "ContratSigne" };

const sha = (v) => (v ? crypto.createHash("sha256").update(String(v).trim().toLowerCase()).digest("hex") : undefined);
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
function phone(p) {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "212" + d.slice(1);
  return d || undefined;
}
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));
function same(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};

  if (!process.env.STATUT_SECRET || !same(b.secret, process.env.STATUT_SECRET)) return res.status(401).json({ ok: false });
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return res.status(500).json({ ok: false, reason: "no_token" });

  const event_name = EVENTS[b.statut];
  if (!event_name) return res.status(200).json({ ok: true, skipped: b.statut || "" });

  const l = b.lead || {};
  if (!l.email && !l.tel) return res.status(400).json({ ok: false, reason: "no_user_data" });
  const parts = String(l.nom || "").trim().split(/\s+/);
  const leadId = String(l.event_id || sha((l.email || "") + (l.tel || "")).slice(0, 32));

  const event = {
    event_name,
    event_time: Math.floor(Date.now() / 1000),
    event_id: (leadId + "-" + event_name).slice(0, 100),
    action_source: "system_generated",
    user_data: clean({
      em: sha(l.email),
      ph: sha(phone(l.tel)),
      fn: sha(norm(parts[0])),
      ln: sha(norm(parts.slice(1).join(""))),
      ct: sha(norm(l.ville)),
      country: sha("ma"),
      external_id: l.event_id ? sha(l.event_id) : undefined,
    }),
    custom_data: clean({
      lead_event_source: "Google Sheet",
      event_source: "crm",
      statut: b.statut,
      content_name: l.projet,
      content_category: l.ville,
    }),
  };

  const payload = { data: [event] };
  if (process.env.META_TEST_EVENT_CODE) payload.test_event_code = process.env.META_TEST_EVENT_CODE;

  try {
    const r = await fetch(GRAPH + "?access_token=" + encodeURIComponent(token), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) console.error("Statut CAPI error", r.status, JSON.stringify(j.error || j));
    else console.log("Statut CAPI ok", event_name, "received=" + (j.events_received || 0));
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, event: event_name, received: j.events_received || 0 });
  } catch (e) {
    console.error("Statut CAPI fetch failed", e.message);
    return res.status(502).json({ ok: false });
  }
};
