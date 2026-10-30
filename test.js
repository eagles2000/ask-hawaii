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

  // Batch 0.6 entries and category browsing
  const top = (q) => (kb.search({ query: q, limit: 3 }).results[0] || {}).id;
  ok(top("box jellyfish") === "safety-box-jellyfish", "box jellyfish");
  ok(top("what to do in a rip current") === "safety-rip-currents", "rip current");
  ok(top("can I swim in a waterfall") === "safety-leptospirosis-freshwater", "waterfall lepto");
  ok(top("can I take pineapple home") === "rule-leaving-hawaii-agriculture", "ag inspection");
  ok(top("what does mauka mean") === "culture-hawaiian-words", "hawaiian words");
  ok(top("time difference hawaii") === "guide-time-zone", "time zone");
  ok(kb.counts("").total === kb.DATA.entries.length, "counts total");
  ok(kb.list({ type: "hike" }).items.every((e) => e.type === "hike"), "list by type");
  ok(kb.list({ type: "safety", island: "Kauai" }).items.every((e) => e.island !== "Oʻahu"), "list island filter");

  // Routes (v0.7)
  ok(top("best route from waikiki to waianae") === "route-waikiki-waianae-coast", "route waianae");
  ok(top("how do I get to nanakuli") === "route-waikiki-waianae-coast", "route nanakuli");
  ok(top("how to drive to the north shore") === "route-waikiki-north-shore", "route north shore");
  ok(top("directions to kaneohe") === "route-waikiki-kaneohe", "route kaneohe");
  ok(top("drive to the airport") === "route-waikiki-airport", "route airport");
  ok(/google\.com\/maps\/dir/.test(kb.get("route-waikiki-mililani").google_maps), "maps link");
  ok(kb.DATA.entries.filter((e) => e.type === "route").every((e) => e.island === "Oʻahu"), "routes on Oahu");

  // Events (v0.8)
  ok(top("when is the merrie monarch") === "event-merrie-monarch", "merrie monarch");
  ok(top("what events are happening in september") === "event-aloha-festivals", "september events");
  ok(kb.search({ query: "what is happening in december", limit: 5 }).results.some((e) => e.id === "event-honolulu-marathon"), "december events");
  ok(top("eddie aikau") === "event-the-eddie", "eddie");
  ok(top("what time do lifeguards leave Waikiki") === "beaches-lifeguarded-oahu", "events don't crowd out");
  ok(kb.list({ type: "event" }).items[0].months[0] === 1, "events sorted by month");

  // Lunch wagons (v0.9)
  ok(top("garlic shrimp kahuku") === "food-kahuku-shrimp-trucks", "kahuku shrimp");
  ok(top("maui food trucks") === "food-maui-food-trucks", "maui trucks (island named in question)");
  ok(top("kona food trucks") === "food-big-island-food-trucks", "kona trucks");
  ok(top("malasadas") === "food-leonards-malasadamobile", "malasadas");
  ok(top("lifeguarded beaches on maui") === "beaches-lifeguarded-maui", "island named boosts");

  // Gardens (v0.10)
  ok(top("how many botanical gardens are there on the island of oahu") === "guide-oahu-botanical-gardens", "oahu gardens count");
  ok(top("botanical gardens on maui") === "garden-maui-gardens", "maui gardens");
  ok(top("hoomaluhia camping") === "garden-hoomaluhia", "hoomaluhia");

  // Animals (v0.11)
  ok(top("hawaiian owl") === "animal-pueo", "pueo");
  ok(top("state bird") === "animal-nene", "nene");
  ok(top("are there snakes in hawaii") === "animal-invasive-mongoose-snakes", "snakes");
  ok(top("when is whale season") === "animal-humpback-whales", "whales");

  // Shopping (v0.12)
  ok(top("ala moana center") === "shop-ala-moana-center", "ala moana");
  ok(top("shopping on kauai") === "shop-kauai-shopping", "kauai shopping");
  ok(top("swap meet") === "shop-aloha-stadium-swap-meet", "swap meet");
  ok(top("outlet mall") === "shop-waikele-premium-outlets", "outlets");

  // Tours (v0.13)
  ok(top("best luau on oahu") === "tour-oahu-luau", "oahu luau");
  ok(top("maui luau") === "tour-maui-luau", "maui luau");
  ok(top("booze cruise") === "tour-waikiki-cruises-submarine", "cruise");
  ok(top("manta rays") === "tour-kona-manta-night-snorkel", "manta");
  ok(top("hanauma bay") === "place-hanauma-bay", "hanauma stays first");

  // Day trips (v0.14)
  ok(top("drive around the island oahu") === "trip-oahu-circle-island", "circle island");
  ok(top("road to hana") === "trip-maui-road-to-hana", "road to hana");
  ok(top("day trip on kauai").startsWith("trip-kauai"), "kauai day trip");
  ok(top("pearl harbor") === "place-pearl-harbor", "trips don't crowd out");
  ok(/waypoints=/.test(kb.get("trip-oahu-circle-island").google_maps), "multi-stop maps link");
  ok(kb.DATA.entries.filter((e) => e.stops).every((e) => e.stops.length <= 11), "max 9 waypoints");

  // Hawaiian food (v0.15)
  ok(top("helenas") === "food-helenas-hawaiian-food", "helenas");
  ok(top("what is poi") === "food-hawaiian-dishes-guide", "poi explained");
  ok(top("saimin") === "food-saimin", "saimin");
  ok(top("lanai food") === "food-molokai-lanai", "lanai food");

  // Every entry has a source and a date
  ok(kb.DATA.entries.every((e) => e.sources && e.sources.length && e.last_checked), "all entries sourced and dated");
  console.log(`${pass} passed, ${fail} failed, ${kb.DATA.entries.length} entries`);
  process.exit(fail ? 1 : 0);
})();
