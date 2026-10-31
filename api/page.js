// Ask Hawaiʻi: serves the search-engine-friendly pages. vercel.json maps the clean addresses here:
//   /a/<id>  /topics  /topics/<type>  /island/<slug>  /sitemap.xml
const pages = require("../lib/pages");

module.exports = function (req, res) {
  const url = new URL(req.url, "http://localhost");
  const kind = url.searchParams.get("kind") || "";
  const clean = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 120);
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  if (kind === "sitemap") {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    return res.end(pages.sitemap());
  }
  let html = null;
  if (kind === "entry") html = pages.entryPage(clean(url.searchParams.get("id")));
  else if (kind === "topic") html = pages.topicPage(clean(url.searchParams.get("type")));
  else if (kind === "island") html = pages.islandPage(clean(url.searchParams.get("island")));
  else if (kind === "topics") html = pages.topicsIndex();
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (!html) { res.statusCode = 404; return res.end(pages.notFound()); }
  res.end(html);
};
