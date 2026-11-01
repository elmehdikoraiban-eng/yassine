// API Conversions Meta : reçoit les événements du site et les renvoie à Meta côté serveur.
// Variables d'environnement Vercel :
//   META_CAPI_TOKEN      jeton d'accès (Gestionnaire d'événements > Paramètres > API Conversions)
//   META_TEST_EVENT_CODE facultatif, ex. TEST12345, pour voir les événements dans « Tester les événements »
const crypto = require("crypto");

const PIXEL_ID = "1121433940618331";
const GRAPH = "https://graph.facebook.com/v23.0/" + PIXEL_ID + "/events";
const ALLOWED = new Set(["PageView", "Lead", "Contact"]);
const HOSTS = /(^|\.)yassine-zerrouki-architecte(-[a-z0-9-]+)?\.vercel\.app$|^localhost$/;

const sha = (v) => (v ? crypto.createHash("sha256").update(String(v).trim().toLowerCase()).digest("hex") : undefined);
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
function phone(p) {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "212" + d.slice(1);
  return d || undefined;
}
function cookie(req, name) {
  const m = (req.headers.cookie || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : undefined;
}
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return res.status(200).json({ ok: false, reason: "no_token" });

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};
  if (!ALLOWED.has(b.event_name) || !b.event_id) return res.status(400).json({ ok: false });

  let url;
  try { url = new URL(b.url); } catch (e) { return res.status(400).json({ ok: false }); }
  if (!HOSTS.test(url.hostname)) return res.status(403).json({ ok: false });

  const u = b.user || {};
  const parts = String(u.nom || "").trim().split(/\s+/);
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || undefined;

  const user_data = clean({
    em: sha(u.email),
    ph: sha(phone(u.tel)),
    fn: sha(norm(parts[0])),
    ln: sha(norm(parts.slice(1).join(""))),
    ct: sha(norm(u.ville)),
    country: sha("ma"),
    external_id: u.external_id ? sha(u.external_id) : undefined,
    client_ip_address: ip,
    client_user_agent: req.headers["user-agent"],
    fbp: b.fbp || cookie(req, "_fbp"),
    fbc: b.fbc || cookie(req, "_fbc"),
  });

  const event = {
    event_name: b.event_name,
    event_time: Math.floor(Date.now() / 1000),
    event_id: String(b.event_id).slice(0, 100),
    action_source: "website",
    event_source_url: url.href,
    user_data,
    custom_data: clean({
      content_name: b.custom && b.custom.content_name,
      content_category: b.custom && b.custom.content_category,
      surface_m2: b.custom && Number(b.custom.surface_m2) || undefined,
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
    if (!r.ok) console.error("CAPI error", r.status, JSON.stringify(j.error || j));
    else console.log("CAPI ok", event.event_name, "received=" + (j.events_received || 0));
    return res.status(200).json({ ok: r.ok, received: j.events_received || 0 });
  } catch (e) {
    console.error("CAPI fetch failed", e.message);
    return res.status(200).json({ ok: false });
  }
};
