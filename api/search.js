// Ask Hawaiʻi: simple REST lookup for websites and testing.
// GET /api/search?q=turtles&island=oahu   |   GET /api/search?id=place-hanauma-bay   |   GET /api/search (topics)
const kb = require("../lib/kb");

module.exports = function (req, res) {
  const url = new URL(req.url, "http://localhost");
  const q = url.searchParams.get("q") || "";
  const id = url.searchParams.get("id");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  let out;
  if (id) out = kb.get(id) || { error: "No entry with id " + id };
  else if (q) out = kb.search({ query: q, island: url.searchParams.get("island") || "", type: url.searchParams.get("type") || "", limit: url.searchParams.get("limit") || 5 });
  else out = kb.topics();
  res.statusCode = out.error ? 404 : 200;
  res.end(JSON.stringify(out, null, 2));
};
