// Run: node test.js   (weather calls are mocked here; they hit the real National Weather Service once deployed)
const realFetch = global.fetch;
const { handle } = require("./api/mcp");
const kb = require("./lib/kb");
let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) pass++; else { fail++; console.log("FAIL:", label); } };
const call = (m, p, id = 1) => handle({ jsonrpc: "2.0", id, method: m, params: p });
const search = async (query, island = "") => (await call("tools/call", { name: "search_hawaii", arguments: { query, island, limit: 3 } })).result.structuredContent.results.map((r) => r.id);

(async () => {
  const init = await call("initialize", { protocolVersion: "2025-06-18" });
  ok(init.result.serverInfo.name === "ask-hawaii", "initialize");
  ok((await handle({ jsonrpc: "2.0", method: "notifications/initialized" })) === null, "notification");
  const tools = (await call("tools/list")).result.tools.map((t) => t.name);
  ok(tools.length === 5, "5 tools");
  const cases = [
    ["Do I need a reservation for Hanauma Bay?", "", "place-hanauma-bay"],
    ["Diamond Head hike reservation", "oahu", "place-diamond-head"],
    ["can I bring a backpack to Pearl Harbor", "", "place-pearl-harbor"],
    ["Haleakala sunrise", "maui", "place-haleakala-sunrise"],
    ["Road to Hana black sand beach", "", "place-waianapanapa"],
    ["Iao Needle", "", "place-iao-valley"],
    ["Is the Kalalau trail open", "kauai", "place-haena"],
    ["which places need reservations", "", "guide-reservations-by-island"],
    ["can I take sand home", "", "rule-taking-sand-rocks"],
    ["lei etiquette", "", "culture-visitor-etiquette"],
    ["bus fare honolulu", "", "transport-thebus-skyline"],
    ["why is sales tax 4.712", "", "tax-general-excise"],
    ["hotel tax", "", "tax-transient-accommodations-2026"],
    ["how close can I get to a sea turtle", "maui", "rule-marine-wildlife-distances"],
    ["sunscreen lanai", "lanai", "rule-sunscreen-maui-county"],
    ["is kalakaua in waikiki and whats the history about it", "", "history-kalakaua-avenue"],
    ["why is it called Kalakaua Avenue", "", "history-kalakaua-avenue"],
    ["Manoa Falls", "", "hike-manoa-falls"],
    ["Koko Head stairs how many steps", "", "hike-koko-crater-stairs"],
    ["where do I park for Lanikai pillbox", "", "hike-lanikai-pillbox"],
    ["can I hike the Stairway to Heaven", "", "rule-haiku-stairs"],
    ["can I bring my dog to Kaena Point", "", "hike-kaena-point"],
    ["Makapuu lighthouse whales", "", "hike-makapuu-lighthouse"],
    ["which beaches have lifeguards", "maui", "beaches-lifeguarded-maui"],
    ["lifeguard at Poipu beach", "", "beaches-lifeguarded-kauai"],
    ["safe beach for kids big island", "Hawaii Island", "beaches-lifeguarded-hawaii-island"],
    ["what time do lifeguards leave Waikiki", "", "beaches-lifeguarded-oahu"],
    ["what does a red flag mean at the beach", "", "safety-beach-hazard-ratings"],
    ["is the volcano erupting", "", "park-hawaii-volcanoes"],
    ["Akaka Falls hours", "", "place-akaka-falls"],
    ["is Waimea Canyon open", "", "park-waimea-canyon"],
    ["is Secret Falls open", "", "notice-state-parks-oct-2026"],
    ["Iolani Palace tickets", "", "place-iolani-palace"],
    ["history of the Bishop Museum", "", "place-bishop-museum"],
  ];
  for (const [q, isl, want] of cases) { const got = await search(q, isl); ok(got[0] === want, `"${q}" -> ${got.join(",")} (wanted ${want})`); }
  { const r = await search("I'm on the island of Oahu. What is one of the easiest spots to hike?"); ok(r.slice(0, 2).includes("hike-oahu-by-difficulty") && r.slice(0, 2).includes("hike-manoa-falls"), "easiest Oahu hike -> Manoa Falls + hikes guide: " + r); }
  ok((await search("best ramen in kona", "Hawaii Island")).length === 0, "no fake match for ramen");
  ok((await search("history of the Shangri La museum")).length === 0, "no fake match for an uncovered place");
  ok((await search("what is the history of Kuhio Avenue in Waikiki")).indexOf("place-pearl-harbor") === -1, "no Pearl Harbor for street history");
  ok((await search("Diamond Head", "maui")).indexOf("place-diamond-head") === -1, "island filter excludes Oahu place on Maui");

  // Weather with a mocked National Weather Service
  global.fetch = async (url) => ({ ok: true, json: async () =>
    url.includes("/points/") ? { properties: { forecast: "https://api.weather.gov/gridpoints/HFO/1,1/forecast" } }
    : url.includes("/alerts/") ? { features: [{ properties: { event: "High Surf Advisory", severity: "Moderate", areaDesc: "Oahu North Shore; Kauai Northwest", headline: "HSA", ends: null, expires: "x", instruction: "Stay out" } }, { properties: { event: "Wind Advisory", severity: "Minor", areaDesc: "Big Island Summits", headline: "WA", ends: "y", instruction: "" } }] }
    : { properties: { periods: [{ name: "Today", temperature: 84, temperatureUnit: "F", windSpeed: "10 mph", windDirection: "NE", detailedForecast: "Sunny." }] } } });
  const w = (await call("tools/call", { name: "get_hawaii_weather", arguments: { place: "Haleakalā" } })).result.structuredContent;
  ok(w.place === "Haleakalā summit" && w.periods[0].temperature === "84°F", "weather forecast");
  const bad = (await call("tools/call", { name: "get_hawaii_weather", arguments: { place: "Atlantis" } })).result;
  ok(bad.isError, "unknown place is an error");
  const al = (await call("tools/call", { name: "get_hawaii_alerts", arguments: { island: "Oahu" } })).result.structuredContent;
  ok(al.count === 1 && al.alerts[0].event === "High Surf Advisory", "alerts filtered to Oahu");
  const al2 = (await call("tools/call", { name: "get_hawaii_alerts", arguments: { island: "Big Island" } })).result.structuredContent;
  ok(al2.count === 1 && al2.alerts[0].event === "Wind Advisory", "alerts filtered to Big Island");
  global.fetch = async () => { throw new Error("offline"); };
  const down = (await call("tools/call", { name: "get_hawaii_weather", arguments: { place: "Hilo" } })).result;
  ok(down.isError, "weather outage handled");
  global.fetch = realFetch;

  // Every entry has a source and a date
  ok(kb.DATA.entries.every((e) => e.sources && e.sources.length && e.last_checked), "all entries sourced and dated");
  console.log(`${pass} passed, ${fail} failed, ${kb.DATA.entries.length} entries`);
  process.exit(fail ? 1 : 0);
})();
