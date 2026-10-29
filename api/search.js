// Ask Hawaiʻi: web lookup used by the website.
// GET /api/search?q=turtles&island=oahu&full=1   |   GET /api/search?id=place-hanauma-bay   |   GET /api/search (topics)
const kb = require("../lib/kb");
const { logMissed } = require("../lib/log");

module.exports = async function (req, res) {
  const url = new URL(req.url, "http://localhost");
  const q = (url.searchParams.get("q") || "").slice(0, 300);
  const id = url.searchParams.get("id");
  const island = url.searchParams.get("island") || "";
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  let out;
  if (id) out = kb.get(id) || { error: "No entry with id " + id };
  else if (q) {
    out = kb.search({ query: q, island, type: url.searchParams.get("type") || "", limit: url.searchParams.get("limit") || 6 });
    if (url.searchParams.get("full") === "1") out.results = out.results.map((r) => kb.get(r.id));
    if (!out.count && url.searchParams.get("log") !== "0") await logMissed(q, island, "web");
    res.setHeader("Cache-Control", "no-store");
  } else { out = kb.topics(); res.setHeader("Cache-Control", "public, max-age=300"); }
  res.statusCode = out.error ? 404 : 200;
  res.end(JSON.stringify(out, null, 2));
};
