// Ask Hawaiʻi search ranking. Shared by the server (Node) and the demo page (browser), so both rank the same way.
(function (root) {
  // Lowercase, strip kahakō and ʻokina so "oahu" matches "Oʻahu" and "lanai" matches "Lānaʻi".
  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[ʻ‘’'`]/g, "").toLowerCase();
  }
  var STOP = new Set(["they", "them", "their", "theyre", "these", "those", "both", "two", "three", "located", "location", "locations", "were", "was", "be", "been", "the", "a", "an", "in", "on", "at", "of", "to", "for", "and", "or", "is", "are", "what", "how", "can", "i", "do", "with", "near", "about", "my", "you", "it", "need", "there", "any", "get", "go", "much", "does", "should", "when", "where", "which", "who", "why", "whats", "tell", "me", "info", "information", "know", "things", "thing", "about", "its", "this", "that", "there", "here", "some", "any", "please", "show", "find", "look", "want", "like", "im", "ive", "id", "one", "ones", "spot", "spots", "really", "just", "also", "going", "plan", "planning", "trip", "recommend", "suggest", "could", "would", "will", "we", "our", "us", "be", "was", "were", "if", "so", "than", "then", "from", "by", "as", "but", "not", "no", "yes", "ok", "okay", "hi", "hey", "aloha", "mahalo", "thanks"]);
  var ROUTEWORDS = new Set(["route", "routes", "drive", "driving", "directions", "direction", "traffic", "way", "highway", "freeway", "miles", "far", "long", "rush", "hov", "commute", "exit"]);
  var EVENTWORDS = new Set(["thingstodo", "event", "events", "festival", "festivals", "happening", "calendar", "parade", "contest", "contests", "competition", "race", "races", "tournament", "concert", "concerts", "show", "shows", "fireworks", "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "weekend", "tickets"]);
  var MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  var TOWN = { oahu: "Oahu", honolulu: "Oahu", kailua: "Oahu", kaneohe: "Oahu", kapolei: "Oahu", haleiwa: "Oahu", maui: "Maui", kauai: "Kauai", molokai: "Molokai", lanai: "Lanai", kona: "Hawaii Island", hilo: "Hawaii Island", hana: "Maui", lahaina: "Maui", kihei: "Maui", wailea: "Maui", paia: "Maui", kapaa: "Kauai", lihue: "Kauai", poipu: "Kauai", princeville: "Kauai", hanalei: "Kauai" };
  var TOURWORDS = new Set(["thingstodo", "tour", "tours", "luau", "luaus", "cruise", "cruises", "sail", "sunset", "snorkel", "snorkeling", "lesson", "lessons", "parasailing", "parasail", "helicopter", "activity", "activities", "things", "book", "booking", "excursion", "boat", "submarine", "manta", "dinner"]);
  var HISTWORDS = new Set(["history", "historic", "historical", "when", "who", "why", "how", "story", "ancient", "king", "queen", "kingdom", "monarchy", "war", "battle", "overthrow", "annexation", "statehood", "timeline", "century", "era", "voyaging", "missionaries", "whaling", "plantation", "plantations", "immigration", "renaissance", "martial", "attack", "1941", "unite", "united", "polynesians", "came", "come", "arrived", "discovered", "founded", "built"]);
  var TRIPWORDS = new Set(["day", "trip", "trips", "itinerary", "around", "loop", "circle", "plan", "stops", "sightseeing", "thingstodo", "hana", "island", "explore"]);
  var LISTWORD = new Set(["museum", "museums", "golf", "hikes", "hiking", "gardens", "malls", "shopping", "festivals", "luaus", "holidays", "hotel", "hotels", "resort", "resorts", "nightlife", "nightclubs", "clubs", "bars", "entertainers", "musicians", "singers"]);
  var HOLWORDS = new Set(["day", "ceremony", "ceremonies", "parade", "parades", "anniversary", "remembrance", "holiday", "holidays", "fireworks", "firecracker", "firecrackers", "permit", "air", "airshow", "show", "military", "veterans", "veteran", "december", "november", "july", "june", "september", "celebrate", "celebration", "angels", "kuhio", "statehood"]);
  var STAYWORDS = new Set(["hotel", "hotels", "resort", "resorts", "stay", "staying", "lodging", "accommodations", "room", "rooms", "night", "nightly", "sleep", "airbnb", "rental", "rentals", "family", "adults", "honeymoon"]);
  var TOWNISH = new Set(["kapolei", "ewa", "aiea", "pearl", "mililani", "wahiawa", "waipahu", "kailua", "kaneohe", "haleiwa", "waikiki", "honolulu", "waianae", "nanakuli", "makaha", "kahala", "hawaii", "kakaako", "manoa", "kaimuki", "laie", "kahuku", "kahului", "wailuku", "kihei", "lahaina", "paia", "hana", "kona", "hilo", "lihue", "kapaa", "poipu", "princeville", "hanalei", "kaunakakai", "town", "city", "area"]);
  var TYPEWORD = { golf: "golf", hike: "hike", hikes: "hike", hiking: "hike", garden: "garden", gardens: "garden", mall: "shop", malls: "shop", shopping: "shop", festival: "event", festivals: "event", luau: "tour", luaus: "tour", lunch: "food", restaurant: "food", restaurants: "food", football: "sport", volleyball: "sport", basketball: "sport", baseball: "sport", softball: "sport", soccer: "sport", uh: "sport", museum: "museum", museums: "museum", nightlife: "nightlife", entertainers: "entertainers", entertainer: "entertainers", entertainment: "entertainers", musicians: "entertainers", singers: "entertainers", nightclub: "nightlife", nightclubs: "nightlife", clubs: "nightlife", bars: "nightlife", camping: "camping", camp: "camping", campground: "camping", campgrounds: "camping", campsite: "camping", campsites: "camping", holiday: "holiday", holidays: "holiday", hotel: "hotel", hotels: "hotel", resort: "hotel", resorts: "hotel", stay: "hotel" };
  // Place words help filter but should never be the only reason a result matches.
  var PLACE = new Set(["oahu", "maui", "lanai", "molokai", "kauai", "hawaii", "island", "big", "kona", "hilo", "honolulu", "east", "west", "north", "south", "shore", "county", "statewide", "2026"]);
  // General words that describe a kind of thing. An answer must also match at least one specific word
  // (a name like "Hanauma" or "Kalakaua"), so "history of the Bishop Museum" doesn't return Pearl Harbor.
  var GENERAL = new Set(["reservation", "reservations", "reserve", "reserved", "ticket", "tickets", "admission", "parking", "entry", "history", "historic", "historical", "museum", "museums", "beach", "beaches", "park", "parks", "place", "places", "food", "restaurant", "restaurants", "eat", "hike", "hikes", "hiking", "trail", "trails", "tips", "rules", "rule", "cost", "costs", "price", "prices", "fee", "fees", "hours", "open", "closed", "visit", "visiting", "tourist", "tourists", "famous", "popular", "best", "good", "area", "areas", "street", "streets", "road", "roads", "avenue", "attraction", "attractions", "activities", "safe", "safety", "today", "tomorrow", "kids", "family", "free"]);
  // Join well-known area names so "North Shore" isn't dropped as two place words.
  function phrases(s) { return s.replace(/\b(north|south|west|east) (shore|side)\b/g, "$1$2").replace(/\bkailua[- ]kona\b/g, "kona").replace(/\bthings? to do\b/g, "thingstodo").replace(/\bcost of living\b/g, "costofliving").replace(/\bmountain west\b/g, "mountainwest"); }
  function tokens(s) { return phrases(norm(s)).split(/[^a-z0-9.]+/).map(function (t) { return t.replace(/^\.+|\.+$/g, ""); }).filter(function (t) { return t.length > 1 && !STOP.has(t); }); }
  function islandsOf(e) { return (Array.isArray(e.island) ? e.island : [e.island]).map(norm); }
  function bare(x) { return x.replace(/\s*island$/, ""); }

  function matchesIsland(e, island) {
    if (!island) return true;
    var want = bare(norm(island)), isl = islandsOf(e);
    return isl.indexOf("statewide") >= 0 || isl.some(function (x) { return bare(x) === want; }) || norm(e.county).indexOf(want) >= 0;
  }
  function specificIsland(e, island) {
    if (!island) return false;
    var want = bare(norm(island));
    return islandsOf(e).some(function (x) { return bare(x) === want; }) || norm(e.county).indexOf(want) >= 0;
  }

  function prepare(entries) {
    var docs = entries.map(function (e) {
      return {
        e: e,
        f: [
          [tokens(e.title), 3],
          [tokens((e.tags || []).concat((e.months || []).map(function (m) { return MONTHS[m - 1]; })).join(" ")), 3],
          [tokens(e.summary), 2],
          [tokens((e.details || []).join(" ")), 1],
        ],
      };
    });
    var df = {};
    docs.forEach(function (d) {
      var seen = new Set();
      d.f.forEach(function (f) { f[0].forEach(function (t) { seen.add(t); }); });
      seen.forEach(function (t) { df[t] = (df[t] || 0) + 1; });
    });
    return { docs: docs, df: df, n: docs.length };
  }

  function hit(list, t) { return list.some(function (x) { return x === t || (t.length > 3 && x.indexOf(t) === 0); }); }

  function rank(index, query, opts) {
    opts = opts || {};
    var raw = tokens(query);
    var qt = raw.filter(function (t) { return !PLACE.has(t); });
    // An island or town named in the question (with no island filter set) boosts that island's entries.
    var named = "";
    if (!opts.island) raw.forEach(function (t) { if (!named && TOWN[t]) named = TOWN[t]; });
    if (!named && /big island|hawaii island|island of hawaii/.test(norm(query))) named = "Hawaii Island";
    if (!qt.length) {
      // Only a place was asked about ("Molokai", "how do I get to Lanai"): show that island's key entries.
      var isl = named || opts.island;
      if (!isl) return [];
      var ORDER = ["guide", "trip", "place", "hike", "route", "food", "tour", "garden", "safety", "rule", "event", "golf", "shop", "culture", "history"];
      return index.docs.map(function (d) { return d.e; })
        .filter(function (e) { var w = bare(norm(isl)); return islandsOf(e).some(function (x) { return bare(x) === w; }) && (!opts.type || e.type === opts.type); })
        .sort(function (a, b) { var x = ORDER.indexOf(a.type), y = ORDER.indexOf(b.type); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); })
        .slice(0, opts.limit || 5);
    }
    // A question that is only a category word ("museums on Maui", "golf courses on Kauai"): list that category.
    var cat = qt.filter(function (t) { return !STOP.has(t) && ["course", "courses", "center", "centers", "best", "top", "list", "all"].indexOf(t) < 0; });
    if (cat.length && cat.every(function (t) { return LISTWORD.has(t) && TYPEWORD[t] === TYPEWORD[cat[0]]; })) {
      var ct = TYPEWORD[cat[0]], wi = named || opts.island;
      var hits = index.docs.map(function (d) { return d.e; }).filter(function (e) { return e.type === ct && (!wi || islandsOf(e).some(function (x) { return bare(x) === bare(norm(wi)); })) && (!opts.type || e.type === opts.type); });
      var towns = raw.filter(function (t) { return TOWN[t] && t !== bare(norm(TOWN[t])); });
      if (towns.length) hits = hits.map(function (e, i) { return { e: e, i: i, w: (e.tags || []).some(function (g) { return towns.indexOf(norm(g)) >= 0; }) ? 0 : 1 }; })
        .sort(function (a, b) { return a.w - b.w || a.i - b.i; }).map(function (x) { return x.e; });
      if (hits.length) return hits.slice(0, opts.limit || 5);
    }
    var scored = [];
    // Each question word's weight depends only on the word, so work it out once (not once per entry).
    var IDF = {};
    qt.forEach(function (t) {
      if (IDF[t] !== undefined) return;
      var dfT = 0;
      Object.keys(index.df).forEach(function (k) { if (k === t || (t.length > 3 && k.indexOf(t) === 0)) dfT = Math.max(dfT, index.df[k]); });
      IDF[t] = 1 + Math.log((index.n + 1) / (dfT + 1));
    });
    index.docs.forEach(function (d) {
      var e = d.e;
      if (!matchesIsland(e, opts.island) || (opts.type && e.type !== opts.type)) return;
      var s = 0, matched = 0, specific = 0, unmatchedTopic = false, topicHit = false;
      qt.forEach(function (t) {
        var idf = IDF[t];
        var any = false;
        d.f.forEach(function (f) { if (hit(f[0], t)) { s += f[1] * idf; any = true; } });
        if (any) { matched++; if (!GENERAL.has(t)) specific++; if (!TOWNISH.has(t) && !GENERAL.has(t)) topicHit = true; }
        else if (!GENERAL.has(t) && !TOWNISH.has(t)) unmatchedTopic = true;
      });
      if (!s) return;
      // The answer must cover at least half of the question's key words (e.g. "Kalakaua" AND "Waikiki"),
      // so a question about something we don't cover returns nothing instead of a loosely related entry.
      if (qt.length >= 2 && matched / qt.length < 0.5) return;
      if (!specific && qt.some(function (t) { return !GENERAL.has(t); })) return;
      // A town name alone isn't an answer: "best dentist in Kapolei" shouldn't return a Kapolei driving route.
      if (unmatchedTopic && !topicHit) return;
      s *= 0.5 + 0.5 * (matched / qt.length);
      if (specificIsland(e, opts.island)) s *= 1.3;
      if (named && islandsOf(e).some(function (x) { return bare(x) === bare(norm(named)); })) s *= 2;
      else if (named && islandsOf(e).indexOf("statewide") < 0) s *= 0.6;
      // A town named in the question (Hilo, Kona, Honolulu) favors entries tagged with that town.
      raw.forEach(function (t) { if (TOWN[t] && t !== bare(norm(TOWN[t])) && (e.tags || []).some(function (g) { return norm(g) === t; })) s *= 1.8; });
      if (e.type === "guide") s *= 0.85;
      // Driving routes rank first only when the question is about getting somewhere.
      if (e.type === "route" && !qt.some(function (t) { return ROUTEWORDS.has(t); })) s *= 0.6;
      // A question whose key words are all in an entry's title is most likely about that entry.
      var keyT = qt.filter(function (t) { return !GENERAL.has(t); });
      var inTitle = keyT.length && keyT.every(function (t) { return hit(d.f[0][0], t); });
      if (inTitle) s *= 1.25;
      // Events rank first only for event-style questions or when the event is named.
      if (e.type === "event" && !inTitle && !qt.some(function (t) { return EVENTWORDS.has(t); })) s *= 0.6;
      // Holiday and military observances rank first only when the question is about the day, ceremony or celebration.
      if (e.type === "holiday" && !qt.some(function (t) { return EVENTWORDS.has(t) || HOLWORDS.has(t); })) s *= 0.45;
      // A word that names a category (golf, hikes, gardens, malls...) favors that category.
      if (qt.some(function (t) { return TYPEWORD[t] === e.type; })) s *= 1.3;
      if (e.type === "trip" && !qt.some(function (t) { return TRIPWORDS.has(t); })) s *= 0.5;
      // Hotels rank first only for lodging questions or when the hotel is named.
      if (e.type === "hotel" && !inTitle && !qt.some(function (t) { return STAYWORDS.has(t); })) s *= 0.4;
      // History entries rank first only for history-style questions or when the topic is named.
      if (e.type === "history" && !inTitle && !qt.some(function (t) { return HISTWORDS.has(t); })) s *= 0.6;
      if (e.type === "tour" && !inTitle && !qt.some(function (t) { return TOURWORDS.has(t); })) s *= 0.6;
      scored.push({ e: e, s: s });
    });
    scored.sort(function (a, b) { return b.s - a.s; });
    var best = scored.length ? scored[0].s : 0;
    return scored.filter(function (x) { return x.s >= Math.max(2, best * 0.4); }).slice(0, opts.limit || 5).map(function (x) { return x.e; });
  }

  var api = { norm: norm, prepare: prepare, rank: rank, matchesIsland: matchesIsland };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.AskHawaiiRank = api;
})(typeof self !== "undefined" ? self : this);
