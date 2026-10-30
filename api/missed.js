// Ask Hawaiʻi: private list of unanswered questions, with "mark as resolved".
// Open https://www.askaihawaii.com/api/missed?key=YOUR_KEY (set MISSED_KEY in Vercel's Environment Variables).
//   ...&resolve=QUESTION    hides that question (it comes back only if someone asks it again later and it still isn't answered)
//   ...&unresolve=QUESTION  puts it back on the list
//   ...&show=resolved       lists what you've resolved
//   ...&format=json         raw data instead of the page
const { listMissed, resolveMissed, unresolveMissed, listResolved, isResolved, clean } = require("../lib/log");

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hst = (t) => { try { return new Date(t).toLocaleString("en-US", { timeZone: "Pacific/Honolulu", dateStyle: "medium", timeStyle: "short" }) + " HST"; } catch (e) { return t || ""; } };

module.exports = async function (req, res) {
  const url = new URL(req.url, "http://localhost");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  const key = process.env.MISSED_KEY;
  if (!key || url.searchParams.get("key") !== key) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ error: "Not authorized" }));
  }
  const base = "/api/missed?key=" + encodeURIComponent(key);
  try {
    let notice = "";
    const r = url.searchParams.get("resolve"), u = url.searchParams.get("unresolve");
    if (r) notice = (await resolveMissed(r)) ? "Marked as resolved: " + r : "Storage isn't connected, so nothing was changed.";
    if (u) notice = (await unresolveMissed(u)) ? "Put back on the list: " + u : "Storage isn't connected, so nothing was changed.";

    const data = await listMissed(Number(url.searchParams.get("limit")) || 2000);
    const resolved = await listResolved();
    const open = data.items.filter((i) => !isResolved(i, resolved));
    const counts = {}, sample = {};
    open.forEach((i) => { const k = clean(i.q); if (!k) return; counts[k] = (counts[k] || 0) + 1; if (!sample[k]) sample[k] = i; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 150)
      .map(([q, n]) => ({ q, times: n, island: sample[q].island, via: sample[q].via, last: hst(sample[q].t) }));
    const done = Object.entries(resolved).sort((a, b) => Date.parse(b[1]) - Date.parse(a[1])).map(([q, t]) => ({ q, resolved: hst(t) }));

    if (url.searchParams.get("format") === "json") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ storage_connected: data.connected, unresolved_total: open.length, resolved_total: done.length, most_asked: top, resolved: done }, null, 2));
    }

    // If a question was just resolved, go back to the clean list so a refresh doesn't repeat it.
    if ((r || u) && !url.searchParams.get("show")) {
      res.statusCode = 303;
      res.setHeader("Location", base + "&msg=" + encodeURIComponent(notice));
      return res.end();
    }
    notice = notice || url.searchParams.get("msg") || "";
    const showResolved = url.searchParams.get("show") === "resolved";

    const rows = showResolved
      ? done.map((d) => `<tr><td>${esc(d.q)}</td><td>${esc(d.resolved)}</td><td><a class="btn ghost" href="${base}&show=resolved&unresolve=${encodeURIComponent(d.q)}">Put back</a></td></tr>`).join("")
      : top.map((t) => `<tr><td>${esc(t.q)}<small>${esc([t.island, t.via === "ai" ? "asked by an AI assistant" : "asked on the website"].filter(Boolean).join(" · "))}</small></td><td class="n">${t.times}</td><td>${esc(t.last)}</td><td><a class="btn" href="${base}&resolve=${encodeURIComponent(t.q)}">Resolved</a></td></tr>`).join("");

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Unanswered questions · Ask Hawaiʻi</title>
<style>
body{margin:0;font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;background:#F7F5F1;color:#15212A}
.wrap{max-width:960px;margin:0 auto;padding:24px 16px}
h1{font-size:24px;margin:0 0 4px}.sub{color:#5D6870;margin:0 0 16px}
.tabs a{display:inline-block;margin-right:8px;padding:6px 12px;border-radius:999px;border:1px solid #E3DED6;color:#15212A;text-decoration:none;background:#fff}
.tabs a.on{background:#0D5C6B;color:#fff;border-color:#0D5C6B}
.note{background:#E8F4EC;border:1px solid #B9DCC4;border-radius:10px;padding:10px 12px;margin:14px 0}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #E3DED6;border-radius:12px;overflow:hidden;margin-top:14px}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #EEE9E1;vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#5D6870;background:#FBFAF8}
td small{display:block;color:#5D6870;font-size:12.5px}
td.n{font-weight:700;text-align:center}
.btn{display:inline-block;padding:6px 12px;border-radius:8px;background:#0D5C6B;color:#fff;text-decoration:none;font-weight:600;white-space:nowrap}
.btn.ghost{background:#fff;color:#0D5C6B;border:1px solid #0D5C6B}
.empty{padding:24px;text-align:center;color:#5D6870}
@media (max-width:640px){th:nth-child(3),td:nth-child(3){display:none}}
</style></head><body><div class="wrap">
<h1>Unanswered questions</h1>
<p class="sub">${data.connected ? `${open.length} unanswered asks · ${done.length} resolved` : "Storage isn't connected in Vercel, so only Vercel's logs have these questions."}</p>
<p class="tabs"><a href="${base}" class="${showResolved ? "" : "on"}">To answer</a><a href="${base}&show=resolved" class="${showResolved ? "on" : ""}">Resolved</a><a href="${base}&format=json">JSON</a></p>
${notice ? `<p class="note">${esc(notice)}</p>` : ""}
${showResolved
  ? `<table><thead><tr><th>Question</th><th>Resolved</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="3" class="empty">Nothing resolved yet.</td></tr>'}</tbody></table>`
  : `<table><thead><tr><th>Question</th><th>Times</th><th>Last asked</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="empty">No unanswered questions. Nice work.</td></tr>'}</tbody></table>`}
<p class="sub" style="margin-top:14px">Tap Resolved after the answer is live on the site. If someone asks the same question again later and the site still can't answer it, it comes back here.</p>
</div></body></html>`);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: e.message }));
  }
};
