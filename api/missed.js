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
    data.items.forEach((i) => { const k = String(i.q || "").toLowerCase().trim(); counts[k] = (counts[k] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 100).map(([q, n]) => ({ q, times: n }));
    res.end(JSON.stringify({ storage_connected: data.connected, total: data.items.length, most_asked: top, latest: data.items.slice(0, 100) }, null, 2));
  } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
};
