// Ask Hawaiʻi: live National Weather Service data for the website.
// GET /api/weather?place=Hilo   |   GET /api/weather?alerts=1&island=Maui   |   GET /api/weather?places=1
const wx = require("../lib/weather");

module.exports = async function (req, res) {
  const url = new URL(req.url, "http://localhost");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  try {
    let out;
    if (url.searchParams.get("places")) out = { places: Object.values(wx.PLACES).map((p) => ({ name: p.name, island: p.island })) };
    else if (url.searchParams.get("alerts")) out = await wx.alerts(url.searchParams.get("island") || "");
    else out = await wx.forecast(url.searchParams.get("place") || "Honolulu");
    res.statusCode = out.error ? 404 : 200;
    res.end(JSON.stringify(out));
  } catch (e) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: "The weather service didn't answer. Try again in a minute." }));
  }
};
