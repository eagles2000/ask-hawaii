// Ask Hawaiʻi: lookup logic used by the MCP endpoint and the REST endpoint.
const DATA = require("../data/hawaii.json");
const R = require("./rank");
const INDEX = R.prepare(DATA.entries);

function mapsUrl(d) {
  return "https://www.google.com/maps/dir/?api=1&origin=" + encodeURIComponent(d.from) + "&destination=" + encodeURIComponent(d.to) + "&travelmode=driving";
}

function tripUrl(stops) {
  const q = (x) => encodeURIComponent(x.q);
  const mid = stops.slice(1, -1).slice(0, 9).map(q).join("%7C");
  return "https://www.google.com/maps/dir/?api=1&origin=" + q(stops[0]) + "&destination=" + q(stops[stops.length - 1]) + (mid ? "&waypoints=" + mid : "") + "&travelmode=driving";
}

function brief(e) {
  const b = { id: e.id, type: e.type, title: e.title, island: e.island, summary: e.summary, sources: e.sources, last_checked: e.last_checked };
  if (e.directions) b.google_maps = mapsUrl(e.directions);
  if (e.stops) b.google_maps = tripUrl(e.stops);
  if (e.months) b.months = e.months;
  return b;
}

function search({ query = "", island = "", type = "", limit = 5 } = {}) {
  const lim = Math.max(1, Math.min(20, Number(limit) || 5));
  const results = R.rank(INDEX, query, { island, type, limit: lim }).map(brief);
  return { query, island: island || null, type: type || null, count: results.length, results, disclaimer: DATA.disclaimer };
}

function get(id) {
  const e = DATA.entries.find((x) => x.id === id);
  return e ? Object.assign({}, e, e.directions ? { google_maps: mapsUrl(e.directions) } : e.stops ? { google_maps: tripUrl(e.stops) } : {}, { disclaimer: DATA.disclaimer }) : null;
}

function topics() {
  const by = {};
  for (const e of DATA.entries) (by[e.type] = by[e.type] || []).push({ id: e.id, title: e.title, island: e.island });
  return { name: DATA.name, version: DATA.version, last_updated: DATA.last_updated, types: by, disclaimer: DATA.disclaimer };
}

function list({ type = "", island = "" } = {}) {
  const items = DATA.entries.filter((e) => (!type || e.type === type) && R.matchesIsland(e, island))
    .map((e) => ({ id: e.id, type: e.type, title: e.title, island: e.island, months: e.months }))
    .sort((a, b) => (a.months && b.months ? a.months[0] - b.months[0] : 0) || a.title.localeCompare(b.title));
  return { type: type || null, island: island || null, count: items.length, items };
}

function counts(island) {
  const c = {};
  DATA.entries.forEach((e) => { if (R.matchesIsland(e, island)) c[e.type] = (c[e.type] || 0) + 1; });
  return { total: Object.values(c).reduce((a, b) => a + b, 0), types: c };
}

module.exports = { search, get, topics, list, counts, norm: R.norm, DATA };
