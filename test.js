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
  ok(tools.length === 6 && tools.includes("get_hawaii_headlines"), "6 tools incl. headlines");
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
  ok((await search("tattoo parlor in kona", "Hawaii Island")).length === 0, "no fake match for unknown topic");
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

  // Golf (v0.16)
  ok(top("ala wai golf course") === "golf-oahu-municipal", "ala wai");
  ok(top("ko olina golf") === "golf-ko-olina", "ko olina golf");
  ok(top("how much is golf in hawaii") === "golf-hawaii-basics", "golf cost");
  ok(top("wailua golf course") === "golf-kauai-value", "wailua golf");
  ok(top("golf tournament") === "event-sony-championship-golf", "golf tournament");

  // UH sports (v0.17)
  ok(top("uh football schedule") === "sport-uh-football-2026", "uh football");
  ok(top("hawaii bowl") === "sport-hawaii-bowl-2026", "hawaii bowl");
  ok(top("clear bag policy") === "sport-ching-complex-gameday", "clear bag");
  ok(top("mens volleyball national champions") === "sport-mens-volleyball", "mvb champs");
  ok(top("uh volleyball").includes("volleyball"), "uh volleyball");

  // Molokai and Lanai (v0.18)
  ok(top("how do I get to molokai") === "guide-molokai-getting-there", "get to molokai");
  ok(top("lanai ferry") === "guide-lanai-getting-there", "lanai ferry");
  ok(top("kalaupapa") === "place-molokai-kalaupapa", "kalaupapa");
  ok(top("garden of the gods") === "place-lanai-garden-of-gods", "garden of the gods");
  ok((top("things to do on molokai") || "").includes("molokai"), "things to do molokai");

  // Hawaii Island beaches and hikes (v0.19)
  ok(top("hapuna beach") === "beach-hapuna", "hapuna");
  ok(top("green sand beach") === "hike-papakolea-green-sand", "green sand");
  ok(top("black sand beach turtles") === "beach-punaluu-black-sand", "punaluu");
  ok(top("pololu valley") === "hike-pololu-valley", "pololu");
  ok(top("waipio valley") === "place-waipio-valley", "waipio");
  ok(top("mauna kea summit") === "place-mauna-kea-summit", "mauna kea");
  ok(top("kahaluu snorkeling") === "beach-kahaluu-snorkel", "kahaluu");
  ok(top("two step snorkeling") === "beach-two-step-honaunau", "two step");
  ok(top("kilauea iki trail") === "hike-kilauea-iki", "kilauea iki");
  ok(top("hilo snorkeling") === "beach-richardson-hilo", "richardson");

  // Maui and Kauai hikes (v0.20)
  ok(top("pipiwai trail") === "hike-pipiwai-trail", "pipiwai");
  ok(top("bamboo forest") === "hike-pipiwai-trail", "bamboo forest");
  ok(top("sliding sands") === "hike-sliding-sands-haleakala", "sliding sands");
  ok(top("waihee ridge") === "hike-waihee-ridge", "waihee");
  ok(top("kings highway trail") === "hike-hoapili-kings-trail", "hoapili");
  ok(top("kapalua coastal trail") === "hike-kapalua-coastal-trail", "kapalua");
  ok(top("hanakapiai falls") === "hike-hanakapiai-falls", "hanakapiai");
  ok(top("sleeping giant") === "hike-sleeping-giant", "sleeping giant");
  ok(top("awaawapuhi trail") === "hike-kokee-awaawapuhi", "awaawapuhi");
  ok(top("mahaulepu") === "hike-mahaulepu-heritage", "mahaulepu");

  // Neighbor island museums (v0.21)
  ok(top("imiloa") === "museum-imiloa", "imiloa");
  ok(top("planetarium in hilo") === "museum-imiloa", "planetarium");
  ok(top("tsunami museum") === "museum-pacific-tsunami", "tsunami museum");
  ok(top("lyman museum") === "museum-lyman", "lyman");
  ok(top("hulihee palace") === "museum-hulihee-palace", "hulihee");
  ok(top("kona coffee farm museum") === "museum-kona-coffee-farm", "coffee farm");
  ok(top("bailey house") === "museum-bailey-house", "bailey");
  ok(top("sugar museum") === "museum-sugar-maui", "sugar museum");
  ok(top("kauai museum") === "museum-kauai", "kauai museum");
  ok(top("grove farm") === "museum-grove-farm", "grove farm");
  ok(top("molokai museum") === "museum-molokai", "molokai museum");
  ok(top("lanai museum") === "museum-lanai-heritage", "lanai museum");
  ok(top("bishop museum") === "place-bishop-museum", "bishop still");

  // Moving to Hawaii (v0.22)
  ok(top("moving to hawaii checklist") === "living-checklist", "checklist");
  ok(top("transfer drivers license") === "living-drivers-license", "license");
  ok(top("out of state plates") === "living-car-registration", "plates");
  ok(top("ship my car to hawaii") === "living-ship-car", "ship car");
  ok(top("bring my dog to hawaii") === "living-pets", "pets");
  ok(top("security deposit") === "living-renting", "deposit");
  ok(top("oahu home prices") === "living-home-prices", "home prices");
  ok(top("electric bill") === "living-utilities", "electric");
  ok(top("health insurance") === "living-health-insurance", "insurance");
  ok(top("enroll kids in school") === "living-schools", "schools");
  ok(top("hurricane kit") === "living-hurricane-prep", "hurricane");

  // Holidays and military events (v0.23)
  ok(top("pearl harbor day ceremony") === "holiday-pearl-harbor-day", "pearl harbor day");
  ok(top("pearl harbor parade") === "holiday-pearl-harbor-parade", "ph parade");
  ok(top("veterans day") === "holiday-veterans-day", "veterans day");
  ok(top("memorial day") === "holiday-memorial-day", "memorial day");
  ok(top("fourth of july fireworks") === "holiday-fourth-of-july", "july 4");
  ok(top("battleship missouri ceremony") === "holiday-end-of-wwii-missouri", "missouri");
  ok(top("blue angels") === "holiday-kaneohe-air-show", "air show");
  ok(top("prince kuhio day") === "holiday-hawaii-state-holidays", "kuhio");
  ok(top("kamehameha day parade") === "holiday-kamehameha-day", "kamehameha day");
  ok(top("firecracker permit") === "holiday-fireworks-permits", "firecracker");
  ok(top("army museum") === "museum-army-museum-hawaii", "army museum");
  ok(top("pearl harbor") === "place-pearl-harbor", "pearl harbor still");

  // Hotels (v0.24)
  ok(top("halekulani") === "hotel-halekulani", "halekulani");
  ok(top("best family hotel") === "hotel-aulani", "aulani");
  ok(top("hotel near turtle bay") === "hotel-turtle-bay", "turtle bay");
  ok(top("where to stay on oahu") === "hotel-oahu-where-to-stay", "where to stay oahu");
  ok(top("adults only hotel maui") === "hotel-hotel-wailea", "hotel wailea");
  ok(top("hilo hotel") === "hotel-grand-naniloa-hilo", "hilo hotel");
  ok(top("four seasons lanai") === "hotel-four-seasons-lanai", "fs lanai");
  ok(top("hotel molokai") === "hotel-molokai", "hotel molokai");
  ok(kb.search({ query: "hotels on kauai", limit: 5 }).results.every((r) => r.id.startsWith("hotel-")), "kauai hotels list");
  ok(top("hanauma bay") === "place-hanauma-bay", "hanauma still");

  // Unanswered questions resolved (v0.25)
  ok(top("and what are the best seasons to come to hawaii theyre throughout the year") === "guide-best-time-to-visit", "best seasons");
  ok(top("best time to visit hawaii") === "guide-best-time-to-visit", "best time");
  ok(top("best ramen in kona") === "food-kona-ramen", "kona ramen");
  ok(top("how many botanical gardens are there on the island of oahu") === "guide-oahu-botanical-gardens", "how many gardens");
  ok(top("hello hello whats the fastest way to get from waikiki to the west side west coast town call waianae") === "route-waikiki-waianae-coast", "waianae long");

  ok(top("on Oahu there are two Haleiwa Joe's resturants where are they located?") === "food-haleiwa-joes", "haleiwa joes");
  ok((await search("on oahu there are two dentists where are they located", "")).length === 0, "unknown restaurant gives no answer");

  // Headlines (twice daily)
  const news = require("./lib/news");
  const e1 = news.edition(new Date("2026-10-29T18:30:00Z")); // 8:30 a.m. HST
  ok(e1.morning && e1.start.toISOString() === "2026-10-29T17:00:00.000Z", "morning edition");
  const e2 = news.edition(new Date("2026-10-30T08:00:00Z")); // 10 p.m. HST Oct 29
  ok(!e2.morning && e2.start.toISOString() === "2026-10-30T05:00:00.000Z", "evening edition");
  const e3 = news.edition(new Date("2026-10-29T15:00:00Z")); // 5 a.m. HST: still last night's edition
  ok(!e3.morning && e3.start.toISOString() === "2026-10-29T05:00:00.000Z", "before 7 a.m.");
  const xml = '<rss><channel><item><title><![CDATA[Road &amp; lanes reopen]]></title><link>https://x.test/a</link><pubDate>Thu, 29 Oct 2026 06:00:00 -1000</pubDate></item><item><title>Later story</title><link>https://x.test/b</link><pubDate>Thu, 29 Oct 2026 09:00:00 -1000</pubDate></item><item><title>Bad link</title><link>javascript:alert(1)</link><pubDate>Thu, 29 Oct 2026 05:00:00 -1000</pubDate></item></channel></rss>';
  const parsed = news.parse(xml, "Test");
  ok(parsed.length === 2 && parsed[0].title === "Road & lanes reopen", "rss parse");
  const picked = news.pick([parsed], e1, 3, 8);
  ok(picked.length === 1 && picked[0].link === "https://x.test/a", "edition cutoff");

  // Every entry has a source and a date
  ok(kb.DATA.entries.every((e) => e.sources && e.sources.length && e.last_checked), "all entries sourced and dated");
  console.log(`${pass} passed, ${fail} failed, ${kb.DATA.entries.length} entries`);
  process.exit(fail ? 1 : 0);
})();
