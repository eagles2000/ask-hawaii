// Records questions Ask Hawaiʻi couldn't answer, so we know what to add next.
// Saves only the question text, island filter and time. Nothing about who asked.
// Uses Vercel's free Redis storage (Upstash) when it's connected; otherwise it just writes to Vercel's logs.
// Vercel names these settings with whatever prefix was chosen when the database was connected
// (KV_REST_API_URL, STORAGE_REST_API_URL, UPSTASH_REDIS_REST_URL...), so accept any of them.
function findEnv(suffix) {
  const keys = Object.keys(process.env).filter((k) => k.endsWith(suffix) && !k.includes("READ_ONLY"));
  keys.sort((a, b) => (a.startsWith("KV_") ? -1 : 0) - (b.startsWith("KV_") ? -1 : 0));
  return keys.length ? process.env[keys[0]] : undefined;
}
const URL_ = findEnv("_REST_API_URL") || findEnv("_REDIS_REST_URL");
const TOKEN = findEnv("_REST_API_TOKEN") || findEnv("_REDIS_REST_TOKEN");

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

// Questions you've answered. Stored as question -> time resolved, so the same question asked again
// AFTER you resolved it shows up again (a sign the new answer isn't being found).
const clean = (s) => String(s || "").toLowerCase().replace(/[“”"‘’'`.,!?;:()]/g, "").replace(/\s+/g, " ").trim();

async function resolveMissed(question) {
  const k = clean(question);
  if (!k || !URL_ || !TOKEN) return false;
  await redis(["HSET", "askhawaii:resolved", k, new Date().toISOString()]);
  return true;
}

async function unresolveMissed(question) {
  const k = clean(question);
  if (!k || !URL_ || !TOKEN) return false;
  await redis(["HDEL", "askhawaii:resolved", k]);
  return true;
}

async function listResolved() {
  if (!URL_ || !TOKEN) return {};
  const flat = (await redis(["HGETALL", "askhawaii:resolved"])) || [];
  const out = {};
  for (let i = 0; i + 1 < flat.length; i += 2) out[flat[i]] = flat[i + 1];
  return out;
}

// Hide a logged question if it was resolved after it was asked.
function isResolved(item, resolved) {
  const when = resolved[clean(item.q)];
  return !!when && (!item.t || Date.parse(item.t) <= Date.parse(when));
}

module.exports = { logMissed, listMissed, resolveMissed, unresolveMissed, listResolved, isResolved, clean };
