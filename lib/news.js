// Ask Hawaiʻi: twice-daily Hawaiʻi headlines (titles and links only) from local newsroom RSS feeds.
// Editions are fixed at 7 a.m. and 7 p.m. Hawaiʻi time (HST, UTC-10, no daylight saving).
const FEEDS = [
  { name: "Hawaii News Now", url: "https://www.hawaiinewsnow.com/arc/outboundfeeds/rss/?outputType=xml" },
  { name: "KHON2", url: "https://www.khon2.com/feed/" },
  { name: "Civil Beat", url: "https://www.civilbeat.org/feed/" }
];
const HST = -10 * 3600 * 1000;

// The edition in effect at `now`: the latest 7:00 or 19:00 HST at or before it, plus when the next one starts.
function edition(now) {
  const t = (now instanceof Date ? now : new Date(now)).getTime();
  const local = new Date(t + HST);
  const day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - HST; // HST midnight, as UTC ms
  const am = day + 7 * 3600e3, pm = day + 19 * 3600e3;
  let start, morning;
  if (t >= pm) { start = pm; morning = false; } else if (t >= am) { start = am; morning = true; } else { start = pm - 24 * 3600e3; morning = false; }
  const startLocal = new Date(start + HST);
  const label = (morning ? "Morning" : "Evening") + " edition, " +
    startLocal.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }) +
    (morning ? ", 7 a.m." : ", 7 p.m.") + " HST";
  return { start: new Date(start), next: new Date(start + 12 * 3600e3), morning, label };
}

function decode(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
}

function tag(block, name) {
  const m = block.match(new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "i"));
  return m ? decode(m[1]) : "";
}

function parse(xml, source) {
  const items = [];
  const re = /<item[\s>][\s\S]*?<\/item>/gi;
  let m;
  while ((m = re.exec(xml || ""))) {
    const title = tag(m[0], "title"), link = tag(m[0], "link"), when = Date.parse(tag(m[0], "pubDate"));
    if (title && /^https:\/\//.test(link) && !isNaN(when)) items.push({ title, link, source, time: new Date(when).toISOString() });
  }
  return items;
}

// Up to `perSource` newest headlines from each feed published before the edition began, newest first.
function pick(lists, ed, perSource, total) {
  const cut = ed.start.getTime(), floor = cut - 36 * 3600e3;
  const out = [];
  lists.forEach((items) => {
    items.filter((i) => { const t = Date.parse(i.time); return t <= cut && t > floor; })
      .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
      .slice(0, perSource).forEach((i) => out.push(i));
  });
  const seen = new Set();
  return out.sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
    .filter((i) => { const k = i.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, total);
}

async function fetchFeed(f) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(f.url, { signal: ctl.signal, headers: { "User-Agent": "AskHawaii/1.0 (+https://www.askaihawaii.com)", Accept: "application/rss+xml, application/xml, text/xml" } });
    if (!r.ok) return [];
    return parse(await r.text(), f.name);
  } catch (e) { return []; } finally { clearTimeout(timer); }
}

async function headlines(now) {
  const ed = edition(now || new Date());
  const lists = await Promise.all(FEEDS.map(fetchFeed));
  return {
    edition: ed.label,
    edition_start: ed.start.toISOString(),
    next_edition: ed.next.toISOString(),
    items: pick(lists, ed, 3, 8),
    sources: FEEDS.map((f) => f.name),
    note: "Headlines link to the original news sites. Ask Hawaiʻi does not write or edit these stories."
  };
}

module.exports = { FEEDS, edition, parse, pick, headlines };
