// Records questions Ask Hawaiʻi couldn't answer, so we know what to add next.
// Saves only the question text, island filter and time. Nothing about who asked.
// Uses Vercel's free Redis storage (Upstash) when it's connected; otherwise it just writes to Vercel's logs.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd) {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error("storage " + r.status);
  return (await r.json()).result;
}

async function logMissed(question, island, via) {
  const q = String(question || "").trim().slice(0, 300);
  if (!q) return;
  const item = JSON.stringify({ q, island: island || null, via: via || "web", t: new Date().toISOString() });
  console.log("MISSED_QUESTION", item);
  if (!URL_ || !TOKEN) return;
  try {
    await redis(["LPUSH", "askhawaii:missed", item]);
    await redis(["LTRIM", "askhawaii:missed", "0", "1999"]);
  } catch (e) { console.warn("missed-question log failed:", e.message); }
}

async function listMissed(limit) {
  if (!URL_ || !TOKEN) return { connected: false, items: [] };
  const raw = await redis(["LRANGE", "askhawaii:missed", "0", String((limit || 500) - 1)]);
  return { connected: true, items: (raw || []).map((s) => { try { return JSON.parse(s); } catch (e) { return { q: s }; } }) };
}

module.exports = { logMissed, listMissed };
