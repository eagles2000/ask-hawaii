// Ask Hawaiʻi: MCP endpoint (Streamable HTTP, JSON responses).
// AI assistants such as Claude connect to https://<your-domain>/api/mcp and call these tools.
const kb = require("../lib/kb");
const wx = require("../lib/weather");
const { logMissed } = require("../lib/log");
const news = require("../lib/news");

const SERVER = { name: "ask-hawaii", title: "Ask Hawaiʻi", version: kb.DATA.version };
const TYPES = ["place", "hike", "history", "guide", "safety", "rule", "culture", "transport", "contact", "tax", "route", "event", "food", "garden", "animal", "shop", "tour", "trip", "golf", "sport", "museum", "living", "holiday", "hotel", "military", "camping", "nightlife", "entertainers"];

const TOOLS = [
  {
    name: "search_hawaii",
    description: "Search verified Hawaiʻi visitor and resident facts: beaches and parks, ocean safety, wildlife rules, sunscreen laws, lodging taxes and who to call. Every result includes official sources and a last-checked date. Use for questions like 'Do I need a reservation for Hanauma Bay?' or 'How close can I get to a sea turtle?'.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What the person wants to know, in plain words." },
        island: { type: "string", description: "Optional island filter: Oʻahu, Maui, Lānaʻi, Molokaʻi, Kauaʻi, or Hawaiʻi Island. Statewide facts are always included." },
        type: { type: "string", enum: TYPES, description: "Optional category filter." },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 5 }
      },
      required: ["query"]
    }
  },
  {
    name: "get_hawaii_entry",
    description: "Get the full details of one Ask Hawaiʻi entry by its id (from search_hawaii results), including every detail line and source link.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }
  },
  {
    name: "get_hawaii_weather",
    description: "Live forecast from the U.S. National Weather Service for a Hawaiʻi place, e.g. Honolulu, Haleʻiwa, Kahului, Haleakalā summit, Līhuʻe, Kona, Hilo or Hawaiʻi Volcanoes National Park.",
    inputSchema: { type: "object", properties: { place: { type: "string" } }, required: ["place"] }
  },
  {
    name: "get_hawaii_alerts",
    description: "Active National Weather Service alerts in Hawaiʻi (high surf, flash flood, wind, tsunami and more), optionally filtered by island.",
    inputSchema: { type: "object", properties: { island: { type: "string", description: "Optional: Oahu, Maui, Kauai, Molokai, Lanai, or Big Island." } } }
  },
  {
    name: "get_hawaii_headlines",
    description: "Today's Hawaiʻi news headlines (titles and links) from Hawaii News Now, KHON2 and Civil Beat. Updated twice a day, at 7 a.m. and 7 p.m. Hawaiʻi time.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "list_hawaii_topics",
    description: "List every topic Ask Hawaiʻi covers, grouped by category, with ids.",
    inputSchema: { type: "object", properties: {} }
  }
];

function result(id, value) { return { jsonrpc: "2.0", id, result: value }; }
function error(id, code, message) { return { jsonrpc: "2.0", id: id ?? null, error: { code, message } }; }
function toolText(obj, isError) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }], structuredContent: obj, isError: !!isError };
}

async function handle(msg) {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return error(msg && msg.id, -32600, "Invalid request");
  const isNotification = msg.id === undefined || msg.id === null;
  const p = msg.params || {};
  switch (msg.method) {
    case "initialize":
      return result(msg.id, {
        protocolVersion: p.protocolVersion || "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
        instructions: "Ask Hawaiʻi: checked Hawaiʻi facts with sources, plus live National Weather Service forecasts and alerts, and Hawaiʻi news headlines updated twice a day. Always tell the person the source (including the news outlet for headlines) and suggest confirming time-sensitive details (hours, fees, closures) on the official site."
      });
    case "ping":
      return result(msg.id, {});
    case "tools/list":
      return result(msg.id, { tools: TOOLS });
    case "tools/call": {
      const args = p.arguments || {};
      if (p.name === "search_hawaii") {
        if (!args.query) return result(msg.id, toolText({ error: "query is required" }, true));
        const found = kb.search(args);
        if (!found.count) await logMissed(args.query, args.island, "ai");
        return result(msg.id, toolText(found));
      }
      if (p.name === "get_hawaii_entry") {
        const e = kb.get(args.id);
        return result(msg.id, e ? toolText(e) : toolText({ error: "No entry with id " + args.id }, true));
      }
      if (p.name === "list_hawaii_topics") return result(msg.id, toolText(kb.topics()));
      if (p.name === "get_hawaii_headlines") {
        try {
          const out = await news.headlines(new Date());
          return result(msg.id, toolText(out.items.length ? out : Object.assign(out, { error: "Headlines are unavailable right now." }), !out.items.length));
        } catch (e) { return result(msg.id, toolText({ error: "Headlines are unavailable right now: " + e.message }, true)); }
      }
      if (p.name === "get_hawaii_weather" || p.name === "get_hawaii_alerts") {
        try {
          const out = p.name === "get_hawaii_weather" ? await wx.forecast(args.place) : await wx.alerts(args.island);
          return result(msg.id, toolText(out, !!out.error));
        } catch (e) { return result(msg.id, toolText({ error: "The weather service didn't answer: " + e.message }, true)); }
      }
      return error(msg.id, -32602, "Unknown tool: " + p.name);
    }
    default:
      if (isNotification) return null; // e.g. notifications/initialized
      return error(msg.id, -32601, "Method not found: " + msg.method);
  }
}

module.exports = async function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, mcp-protocol-version, mcp-session-id");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method !== "POST") { res.statusCode = 405; res.setHeader("Allow", "POST"); return res.end("Use POST (MCP Streamable HTTP)."); }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = undefined; } }
  if (body === undefined) {
    const raw = await new Promise((ok) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => ok(d)); });
    try { body = JSON.parse(raw); } catch (e) { res.statusCode = 400; res.setHeader("Content-Type", "application/json"); return res.end(JSON.stringify(error(null, -32700, "Parse error"))); }
  }
  const out = Array.isArray(body) ? (await Promise.all(body.map(handle))).filter(Boolean) : await handle(body);
  if (out === null || (Array.isArray(out) && out.length === 0)) { res.statusCode = 202; return res.end(); }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(out));
};
module.exports.handle = handle;
