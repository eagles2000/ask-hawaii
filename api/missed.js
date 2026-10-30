// Ask Hawaiʻi: private list of unanswered questions.
// Open https://www.askaihawaii.com/api/missed?key=YOUR_KEY (set MISSED_KEY in Vercel's Environment Variables).
const { listMissed } = require("../lib/log");

module.exports = async function (req, res) {
  const url = new URL(req.url, "http://localhost");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const key = process.env.MISSED_KEY;
  if (!key || url.searchParams.get("key") !== key) { res.statusCode = 401; return res.end(JSON.stringify({ error: "Not authorized" })); }
  try {
    const data = await listMissed(Number(url.searchParams.get("limit")) || 500);
    const counts = {};
    // Count the same question together even if it was typed with quotes, punctuation or different capitals.
    const clean = (s) => String(s || "").toLowerCase().replace(/[“”"‘’'`.,!?;:()]/g, "").replace(/\s+/g, " ").trim();
    const hst = (t) => { try { return new Date(t).toLocaleString("en-US", { timeZone: "Pacific/Honolulu", dateStyle: "medium", timeStyle: "short" }) + " HST"; } catch (e) { return t; } };
    data.items.forEach((i) => { const k = clean(i.q); if (k) counts[k] = (counts[k] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 100).map(([q, n]) => ({ q, times: n }));
    res.end(JSON.stringify({ storage_connected: data.connected, total: data.items.length, most_asked: top, latest: data.items.slice(0, 100).map((i) => ({ q: i.q, island: i.island, via: i.via, when: hst(i.t) })) }, null, 2));
  } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
};
