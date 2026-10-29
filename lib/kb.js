// Ask Hawaiʻi: lookup logic used by the MCP endpoint and the REST endpoint.
const DATA = require("../data/hawaii.json");
const R = require("./rank");
const INDEX = R.prepare(DATA.entries);

function brief(e) {
  return { id: e.id, type: e.type, title: e.title, island: e.island, summary: e.summary, sources: e.sources, last_checked: e.last_checked };
}

function search({ query = "", island = "", type = "", limit = 5 } = {}) {
  const lim = Math.max(1, Math.min(20, Number(limit) || 5));
  const results = R.rank(INDEX, query, { island, type, limit: lim }).map(brief);
  return { query, island: island || null, type: type || null, count: results.length, results, disclaimer: DATA.disclaimer };
}

function get(id) {
  const e = DATA.entries.find((x) => x.id === id);
  return e ? Object.assign({}, e, { disclaimer: DATA.disclaimer }) : null;
}

function topics() {
  const by = {};
  for (const e of DATA.entries) (by[e.type] = by[e.type] || []).push({ id: e.id, title: e.title, island: e.island });
  return { name: DATA.name, version: DATA.version, last_updated: DATA.last_updated, types: by, disclaimer: DATA.disclaimer };
}

module.exports = { search, get, topics, norm: R.norm, DATA };
