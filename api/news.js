// Ask Hawaiʻi: GET /api/news returns the current twice-daily headline edition (7 a.m. and 7 p.m. HST).
const news = require("../lib/news");

module.exports = async function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    const out = await news.headlines(new Date());
    // Cache until the next edition so everyone sees the same headlines for 12 hours.
    const secs = Math.max(60, Math.floor((Date.parse(out.next_edition) - Date.now()) / 1000));
    res.setHeader("Cache-Control", out.items.length ? "public, max-age=300, s-maxage=" + secs : "public, max-age=60, s-maxage=120");
    res.statusCode = 200;
    res.end(JSON.stringify(out));
  } catch (e) {
    res.statusCode = 200;
    res.setHeader("Cache-Control", "public, max-age=60");
    res.end(JSON.stringify({ edition: "", items: [], error: "Headlines are unavailable right now." }));
  }
};
