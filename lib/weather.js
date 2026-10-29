// Live weather and alerts from the U.S. National Weather Service (free, no key). Cached for 10 minutes.
const UA = "AskHawaii/0.2 (https://www.askaihawaii.com)";
const PLACES = {
  "honolulu": { name: "Honolulu (Waikīkī)", island: "Oʻahu", lat: 21.2793, lon: -157.8292 },
  "kapolei": { name: "Kapolei", island: "Oʻahu", lat: 21.3356, lon: -158.0581 },
  "haleiwa": { name: "Haleʻiwa (North Shore)", island: "Oʻahu", lat: 21.5928, lon: -158.1031 },
  "kailua": { name: "Kailua (Windward Oʻahu)", island: "Oʻahu", lat: 21.4022, lon: -157.7394 },
  "kahului": { name: "Kahului", island: "Maui", lat: 20.8893, lon: -156.4729 },
  "lahaina": { name: "Lahaina", island: "Maui", lat: 20.8783, lon: -156.6825 },
  "kihei": { name: "Kīhei", island: "Maui", lat: 20.7644, lon: -156.445 },
  "haleakala": { name: "Haleakalā summit", island: "Maui", lat: 20.7148, lon: -156.2502 },
  "lihue": { name: "Līhuʻe", island: "Kauaʻi", lat: 21.9811, lon: -159.3711 },
  "princeville": { name: "Princeville", island: "Kauaʻi", lat: 22.2236, lon: -159.485 },
  "kona": { name: "Kailua-Kona", island: "Hawaiʻi Island", lat: 19.64, lon: -155.9969 },
  "hilo": { name: "Hilo", island: "Hawaiʻi Island", lat: 19.7241, lon: -155.0868 },
  "volcano": { name: "Hawaiʻi Volcanoes National Park (Kīlauea)", island: "Hawaiʻi Island", lat: 19.4294, lon: -155.2573 },
  "lanai": { name: "Lānaʻi City", island: "Lānaʻi", lat: 20.8275, lon: -156.9206 },
  "kaunakakai": { name: "Kaunakakai", island: "Molokaʻi", lat: 21.0906, lon: -157.0226 },
};
const ALIAS = { waikiki: "honolulu", oahu: "honolulu", "north shore": "haleiwa", maui: "kahului", kauai: "lihue", "big island": "kona", "hawaii island": "kona", molokai: "kaunakakai", "kailua-kona": "kona", "kailua kona": "kona" };
const cache = new Map();
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[ʻ‘’'`]/g, "").toLowerCase().trim();

async function getJSON(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < 600000) return hit.v;
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/geo+json" }, signal: ctl.signal });
    if (!r.ok) throw new Error("Weather service returned " + r.status);
    const v = await r.json(); cache.set(url, { t: Date.now(), v }); return v;
  } finally { clearTimeout(timer); }
}

function findPlace(place) {
  const k = norm(place);
  if (PLACES[k]) return PLACES[k];
  if (ALIAS[k]) return PLACES[ALIAS[k]];
  const key = Object.keys(PLACES).find((p) => k.includes(p) || norm(PLACES[p].name).includes(k));
  return key ? PLACES[key] : null;
}

async function forecast(place) {
  const p = findPlace(place);
  if (!p) return { error: "Unknown place. Try one of: " + Object.values(PLACES).map((x) => x.name).join(", ") };
  const pt = await getJSON(`https://api.weather.gov/points/${p.lat},${p.lon}`);
  const f = await getJSON(pt.properties.forecast);
  return {
    place: p.name, island: p.island,
    periods: f.properties.periods.slice(0, 4).map((x) => ({ name: x.name, temperature: x.temperature + "°" + x.temperatureUnit, wind: (x.windSpeed + " " + x.windDirection).trim(), forecast: x.detailedForecast })),
    source: { name: "National Weather Service", url: `https://forecast.weather.gov/MapClick.php?lat=${p.lat}&lon=${p.lon}` },
    fetched_at: new Date().toISOString(),
  };
}

async function alerts(island) {
  const a = await getJSON("https://api.weather.gov/alerts/active?area=HI");
  const want = norm(island);
  const list = (a.features || []).map((f) => f.properties)
    .filter((x) => !want || norm(x.areaDesc).includes(want.replace(/\s*island$/, "")) || (want.startsWith("hawaii") && norm(x.areaDesc).includes("big island")))
    .map((x) => ({ event: x.event, severity: x.severity, areas: x.areaDesc, headline: x.headline, until: x.ends || x.expires, instruction: x.instruction }));
  return { island: island || "All islands", count: list.length, alerts: list, source: { name: "National Weather Service alerts for Hawaiʻi", url: "https://alerts.weather.gov/" }, fetched_at: new Date().toISOString() };
}

module.exports = { forecast, alerts, PLACES };
