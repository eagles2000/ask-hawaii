// Ask Hawaiʻi: plain HTML pages search engines can read.
// One page per entry (/a/<id>), per category (/topics/<type>), per island (/island/<slug>),
// a topics index (/topics) and a sitemap (/sitemap.xml). Built on request from data/hawaii.json,
// so every new entry gets its own page automatically.
const kb = require("./kb");
const SITE = "https://www.askaihawaii.com";
const DATA = kb.DATA;

const CATNAME = {
  hotel: "Where to stay (hotels)", military: "Military lodging & campgrounds", camping: "Camping & permits", nightlife: "Nightlife & live music",
  trip: "Island day trips", tour: "Tours & activities", event: "Events calendar", food: "Hawaiian food & lunch wagons", place: "Places & parks",
  garden: "Botanical gardens", golf: "Golf courses", sport: "UH sports", holiday: "Holidays & military events", museum: "Museums",
  living: "Moving to Hawaiʻi", animal: "Animals & wildlife", shop: "Shopping centers", hike: "Hikes", route: "Routes & driving",
  safety: "Safety", rule: "Rules & laws", culture: "Culture & language", history: "History", guide: "Planning guides",
  transport: "Getting around", tax: "Taxes", contact: "Who to call"
};
const ORDER = Object.keys(CATNAME);
const ISLANDS = [
  { slug: "oahu", name: "Oʻahu", blurb: "Honolulu, Waikīkī, the North Shore and the Windward and Leeward coasts." },
  { slug: "maui", name: "Maui", blurb: "Haleakalā, the Road to Hāna, Wailea, Kāʻanapali and Upcountry." },
  { slug: "hawaii-island", name: "Hawaiʻi Island", blurb: "The Big Island: Kona, Hilo, Hawaiʻi Volcanoes National Park and Maunakea." },
  { slug: "kauai", name: "Kauaʻi", blurb: "The Garden Isle: Nāpali Coast, Waimea Canyon, Hanalei and Poʻipū." },
  { slug: "molokai", name: "Molokaʻi", blurb: "Quiet, rural and deeply Hawaiian, with the Kalaupapa Lookout and Hālawa Valley." },
  { slug: "lanai", name: "Lānaʻi", blurb: "A small island of red dirt roads, Hulopoʻe Bay and the Garden of the Gods." }
];

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const islandsOf = (e) => (Array.isArray(e.island) ? e.island : [e.island]);
const islandText = (e) => islandsOf(e).join(", ");
const bare = (s) => kb.norm(s).replace(/\s*island$/, "").replace(/\s+/g, "-");
const onIsland = (e, isl) => islandsOf(e).some((x) => bare(x) === bare(isl.name) || (isl.slug === "hawaii-island" && bare(x) === "hawaii"));
const MON = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
const fmtDate = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ""); return m ? MON[+m[2] - 1] + " " + +m[3] + ", " + m[1] : d || ""; };
const monthText = (m) => (!m || !m.length ? "" : m.length > 2 ? MON[m[0] - 1] + " to " + MON[m[m.length - 1] - 1] : m.map((x) => MON[x - 1]).join(" and "));
const mapsLink = (from, to) => "https://www.google.com/maps/dir/?api=1" + (from ? "&origin=" + encodeURIComponent(from) : "") + "&destination=" + encodeURIComponent(to) + "&travelmode=driving";
const cut = (s, n) => { s = String(s || ""); if (s.length <= n) return s; const t = s.slice(0, n); return t.slice(0, t.lastIndexOf(" ")).replace(/[\s,;:.(]+$/, "") + "..."; };

const CSS = `
:root{--bg:#F7F5F1;--surface:#fff;--sunk:#F0EDE7;--ink:#15212A;--muted:#5D6870;--line:#E3DED6;--accent:#0D5C6B;--display:"Fraunces",Georgia,serif;--body:"Inter",system-ui,-apple-system,"Segoe UI",sans-serif}
@media (prefers-color-scheme:dark){:root{--bg:#0E1417;--surface:#151D21;--sunk:#1B252A;--ink:#E9EDEF;--muted:#9BA7AD;--line:#26323A;--accent:#6CC0CD}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 var(--body)}
a{color:var(--accent)}.wrap{max-width:880px;margin:0 auto;padding:0 18px}
header{background:#0F2229;color:#fff}header .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:60px}
header a{color:#fff;text-decoration:none;font-family:var(--display);font-weight:600;font-size:20px;display:flex;align-items:center;gap:10px}
header img{border-radius:50%}header .ask{font-family:var(--body);font-size:14px;border:1px solid rgba(255,255,255,.4);border-radius:999px;padding:7px 14px}
main{padding:22px 0 40px}.crumbs{font-size:14px;color:var(--muted);margin:0 0 10px}.crumbs a{color:var(--muted)}
h1{font-family:var(--display);font-weight:600;font-size:clamp(28px,4vw,40px);line-height:1.15;margin:0 0 10px}
h2{font-family:var(--display);font-weight:600;font-size:22px;margin:28px 0 10px}
.meta{display:flex;flex-wrap:wrap;gap:8px 14px;color:var(--muted);font-size:14px;margin-bottom:14px}
.tag{font-weight:600;letter-spacing:.06em;text-transform:uppercase;font-size:12px;color:var(--ink)}
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:20px}
.summary{font-size:18px;margin:0}ul.details{margin:16px 0 0;padding-left:20px}ul.details li{margin:6px 0}
ol.stops{margin:14px 0 0;padding-left:22px}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:10px;padding:10px 14px;text-decoration:none;color:var(--ink);background:var(--surface);font-weight:600;font-size:15px}
.btn.primary{background:#0D5C6B;color:#fff;border-color:#0D5C6B}
.src{margin-top:16px;padding-top:12px;border-top:1px solid var(--line);font-size:14px;color:var(--muted)}
.note{font-size:14px;color:var(--muted);margin-top:14px}
ul.list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
ul.list li a{display:block;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 16px;text-decoration:none;color:var(--ink)}
ul.list li a b{display:block;font-size:17px}ul.list li a span{display:block;color:var(--muted);font-size:14px;margin-top:3px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.grid a{display:block;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 16px;text-decoration:none;color:var(--ink);font-weight:600}
.grid a small{display:block;color:var(--muted);font-weight:400}
.cta{margin-top:30px;background:var(--sunk);border-radius:14px;padding:18px 20px}
footer{border-top:1px solid var(--line);color:var(--muted);font-size:14px;padding:22px 0 40px}footer a{color:var(--muted)}
.crisis{margin-top:8px}.crisis b{color:var(--ink)}
`;

function shell({ title, description, path, body, jsonld, type, noindex }) {
  const url = SITE + path;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(url)}">`}
<meta property="og:type" content="${type || "website"}">
<meta property="og:site_name" content="Ask Hawaiʻi">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="https://images.unsplash.com/photo-1580193747522-61116809ccef?rect=525,666,907,907&amp;fit=crop&amp;auto=format&amp;q=80&amp;w=512&amp;h=512">
<meta name="twitter:card" content="summary">
<link rel="icon" href="https://images.unsplash.com/photo-1580193747522-61116809ccef?rect=525,666,907,907&amp;fit=crop&amp;auto=format&amp;q=80&amp;w=64&amp;h=64">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@400;600&display=swap">
<style>${CSS}</style>
${(jsonld || []).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head>
<body>
<header><div class="wrap"><a href="/"><img src="https://images.unsplash.com/photo-1580193747522-61116809ccef?rect=525,666,907,907&amp;fit=crop&amp;auto=format&amp;q=80&amp;w=72&amp;h=72" width="32" height="32" alt="">Ask Hawaiʻi</a><a class="ask" href="/">Ask a question</a></div></header>
<main><div class="wrap">
${body}
<div class="cta"><b>Have another question about Hawaiʻi?</b><br>Ask Hawaiʻi has ${DATA.entries.length} checked entries, each with its source and the date it was last checked. <a href="/">Ask a question</a> or <a href="/topics">browse all topics</a>.</div>
</div></main>
<footer><div class="wrap">
<p>Ask Hawaiʻi is a free guide by ShakaSoftware LLC, a veteran-owned business in Kapolei, Oʻahu. Hours, fees and rules change, so confirm time-sensitive details with the official source.</p>
<p><a href="/">Home</a> · <a href="/topics">All topics</a> · ${ISLANDS.map((i) => `<a href="/island/${i.slug}">${esc(i.name)}</a>`).join(" · ")}</p>
<p class="crisis">If you or someone you love is struggling, call or text <b>988</b>. In an emergency, call <b>911</b>.</p>
</div></footer>
</body>
</html>`;
}

const crumbs = (items) => '<p class="crumbs">' + items.map((c) => (c.href ? `<a href="${esc(c.href)}">${esc(c.name)}</a>` : esc(c.name))).join(" › ") + "</p>";
const crumbLd = (items) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((c, i) => Object.assign({ "@type": "ListItem", position: i + 1, name: c.name }, c.href ? { item: SITE + c.href } : {})) });
const entryLink = (e) => `<li><a href="/a/${esc(e.id)}"><b>${esc(e.title)}</b><span>${esc((e.months ? monthText(e.months) + " · " : "") + islandText(e))} · ${esc(cut(e.summary, 140))}</span></a></li>`;

function entryPage(id) {
  const e = DATA.entries.find((x) => x.id === id);
  if (!e) return null;
  const cat = CATNAME[e.type] || e.type;
  const trail = [{ name: "Home", href: "/" }, { name: cat, href: "/topics/" + e.type }, { name: e.title }];
  let maps = "";
  if (e.stops && e.stops.length > 1) {
    const g = kb.get(e.id).google_maps;
    maps = `<a class="btn primary" href="${esc(g)}" target="_blank" rel="noopener">Open all stops in Google Maps</a>`;
  } else if (e.directions) {
    maps = `<a class="btn primary" href="${esc(mapsLink(e.directions.from, e.directions.to))}" target="_blank" rel="noopener">Map from ${esc(e.directions.from_label || "start")}</a>` +
      `<a class="btn" href="${esc(mapsLink("", e.directions.to))}" target="_blank" rel="noopener">Directions from where I am</a>`;
  }
  const related = DATA.entries.filter((x) => x.id !== e.id && x.type === e.type && islandsOf(x).some((i) => islandsOf(e).includes(i))).slice(0, 6);
  const more = related.length < 6 ? DATA.entries.filter((x) => x.id !== e.id && x.type === e.type && !related.includes(x)).slice(0, 6 - related.length) : [];
  const body = crumbs(trail) +
    `<article class="card"><h1>${esc(e.title)}</h1>
<div class="meta"><span class="tag">${esc(cat)}</span><span>${esc(islandText(e))}</span>${e.months ? `<span>Usually ${esc(monthText(e.months))}</span>` : ""}<span>Checked ${esc(fmtDate(e.last_checked))}</span></div>
<p class="summary">${esc(e.summary)}</p>
${e.stops ? `<ol class="stops">${e.stops.map((s) => `<li>${esc(s.name)}</li>`).join("")}</ol>` : ""}
${(e.details || []).length ? `<ul class="details">${e.details.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
${maps ? `<div class="actions">${maps}</div>` : ""}
<p class="src">Source${(e.sources || []).length > 1 ? "s" : ""}: ${(e.sources || []).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join(" · ")}</p>
<p class="note">Last checked ${esc(fmtDate(e.last_checked))}. Hours, fees and rules can change, so confirm with the official source before you go.</p>
</article>` +
    (related.concat(more).length ? `<h2>More in ${esc(cat)}</h2><ul class="list">${related.concat(more).map(entryLink).join("")}</ul>` : "");
  const desc = cut(e.summary, 158);
  return shell({
    title: `${e.title} · Ask Hawaiʻi`, description: desc, path: "/a/" + e.id, body, type: "article",
    jsonld: [crumbLd(trail), {
      "@context": "https://schema.org", "@type": "Article", headline: e.title, description: desc, dateModified: e.last_checked,
      inLanguage: "en-US", about: islandText(e), mainEntityOfPage: SITE + "/a/" + e.id,
      author: { "@type": "Organization", name: "Ask Hawaiʻi (ShakaSoftware LLC)", url: SITE },
      publisher: { "@type": "Organization", name: "ShakaSoftware LLC", url: SITE },
      citation: (e.sources || []).map((s) => s.url)
    }]
  });
}

function topicPage(type) {
  if (!CATNAME[type] && !DATA.entries.some((e) => e.type === type)) return null;
  const cat = CATNAME[type] || type;
  const items = kb.list({ type }).items.map((i) => DATA.entries.find((e) => e.id === i.id));
  const trail = [{ name: "Home", href: "/" }, { name: "All topics", href: "/topics" }, { name: cat }];
  const byIsland = {};
  items.forEach((e) => { const k = islandText(e); (byIsland[k] = byIsland[k] || []).push(e); });
  const keys = Object.keys(byIsland).sort((a, b) => (a === "Statewide" ? -1 : b === "Statewide" ? 1 : a.localeCompare(b)));
  const body = crumbs(trail) + `<h1>${esc(cat)} in Hawaiʻi</h1><p class="meta">${items.length} checked ${items.length === 1 ? "entry" : "entries"}, each with sources and the date it was last checked.</p>` +
    keys.map((k) => `<h2>${esc(k)}</h2><ul class="list">${byIsland[k].map(entryLink).join("")}</ul>`).join("");
  return shell({ title: `${cat} in Hawaiʻi · Ask Hawaiʻi`, description: `${items.length} checked entries on ${cat.toLowerCase()} in Hawaiʻi: ${items.slice(0, 4).map((e) => e.title).join(", ")} and more.`.slice(0, 158), path: "/topics/" + type, body, jsonld: [crumbLd(trail)] });
}

function islandPage(slug) {
  const isl = ISLANDS.find((i) => i.slug === slug);
  if (!isl) return null;
  const items = DATA.entries.filter((e) => onIsland(e, isl));
  const trail = [{ name: "Home", href: "/" }, { name: isl.name }];
  const groups = ORDER.map((t) => ({ t, list: items.filter((e) => e.type === t) })).filter((g) => g.list.length);
  const body = crumbs(trail) + `<h1>${esc(isl.name)}: checked facts and things to do</h1><p class="summary">${esc(isl.blurb)}</p><p class="meta">${items.length} checked entries for ${esc(isl.name)}.</p>` +
    groups.map((g) => `<h2>${esc(CATNAME[g.t] || g.t)}</h2><ul class="list">${g.list.map(entryLink).join("")}</ul>`).join("");
  return shell({ title: `${isl.name} guide: things to do, where to stay, hikes and more · Ask Hawaiʻi`, description: `${items.length} checked facts about ${isl.name}: ${isl.blurb}`.slice(0, 158), path: "/island/" + slug, body, jsonld: [crumbLd(trail)] });
}

function topicsIndex() {
  const c = kb.counts("");
  const types = ORDER.filter((t) => c.types[t]).concat(Object.keys(c.types).filter((t) => !ORDER.includes(t)));
  const trail = [{ name: "Home", href: "/" }, { name: "All topics" }];
  const body = crumbs(trail) + `<h1>All Hawaiʻi topics</h1><p class="meta">${c.total} checked entries across ${types.length} categories.</p>` +
    `<div class="grid">${types.map((t) => `<a href="/topics/${esc(t)}">${esc(CATNAME[t] || t)}<small>${c.types[t]} ${c.types[t] === 1 ? "entry" : "entries"}</small></a>`).join("")}</div>` +
    `<h2>By island</h2><div class="grid">${ISLANDS.map((i) => `<a href="/island/${i.slug}">${esc(i.name)}<small>${esc(i.blurb)}</small></a>`).join("")}</div>`;
  return shell({ title: "All Hawaiʻi topics · Ask Hawaiʻi", description: `Browse ${c.total} checked Hawaiʻi entries by category and island: hotels, hikes, beaches, food, events, camping, museums and more.`, path: "/topics", body, jsonld: [crumbLd(trail)] });
}

function sitemap() {
  const latest = DATA.entries.map((e) => e.last_checked).sort().pop() || DATA.last_updated;
  const urls = [{ loc: "/", lastmod: latest }, { loc: "/topics", lastmod: latest }]
    .concat(Object.keys(kb.counts("").types).map((t) => ({ loc: "/topics/" + t, lastmod: latest })))
    .concat(ISLANDS.map((i) => ({ loc: "/island/" + i.slug, lastmod: latest })))
    .concat(DATA.entries.map((e) => ({ loc: "/a/" + e.id, lastmod: e.last_checked })));
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${esc(SITE + u.loc)}</loc>${/^\d{4}-\d{2}-\d{2}$/.test(u.lastmod || "") ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`).join("\n") + "\n</urlset>\n";
}

function notFound() {
  return shell({ noindex: true, title: "Page not found · Ask Hawaiʻi", description: "That page isn't on Ask Hawaiʻi.", path: "/", body: `<h1>We couldn't find that page</h1><p>It may have moved. Try <a href="/">asking a question</a> or <a href="/topics">browsing all topics</a>.</p>` });
}

module.exports = { entryPage, topicPage, islandPage, topicsIndex, sitemap, notFound, ISLANDS, CATNAME, SITE };
