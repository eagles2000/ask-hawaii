# Ask Hawaiʻi (version 0.4.0)

Checked Hawaiʻi facts that AI assistants can look up. Every entry has an official
source link and a "last checked" date.

## What's inside

- `data/hawaii.json`: the facts (34 entries so far). Add new entries here.
- `lib/rank.js` and `lib/kb.js`: the search logic (handles ʻokina and kahakō, so "oahu" finds "Oʻahu").
- `lib/weather.js`: live forecasts and alerts from the National Weather Service (free, no key).
- `api/mcp.js`: the endpoint AI assistants connect to (MCP, the standard Claude and others use).
  Tools: `search_hawaii`, `get_hawaii_entry`, `get_hawaii_weather`, `get_hawaii_alerts`, `list_hawaii_topics`.
- `api/search.js`: a plain web lookup, e.g. `/api/search?q=turtles&island=oahu`.
- `index.html`: the demo page with a search box.
- `test.js`: run `node test.js` to check everything works.

No database, no Supabase, no API keys, no monthly cost on Vercel's free plan.

## Put it online (Vercel, free)

1. Create a new GitHub repository (for example `ask-hawaii`) and upload the files inside this folder.
2. In Vercel, click **Add New > Project**, pick that repository, leave every setting as is, and click **Deploy**.
3. Your address will look like `https://ask-hawaii.vercel.app` (and later your own domain, www.askaihawaii.com).
   - Demo page: `https://<your-address>/`
   - AI endpoint: `https://<your-address>/api/mcp`

## Connect it to Claude (to try it yourself)

In Claude, open **Settings > Connectors > Add custom connector**, name it
"Ask Hawaiʻi", and paste `https://<your-address>/api/mcp`.
Then ask Claude something like "Do I need a reservation for Hanauma Bay?" or "What's the weather at Haleakalā tomorrow morning?"

## Adding facts

Copy an existing entry in `data/hawaii.json`, give it a new `id`, fill in the
fields, and always include at least one source link and today's `last_checked` date.
Only add facts you have checked against the source.

## Unanswered-question log (free)

Questions with no checked answer are saved so we know what to add next (question text only, nothing about who asked).

1. In Vercel, open the ask-hawaii project and click **Storage**, then **Create** (or **Connect**) and choose the free **Redis** option (Upstash). Connect it to this project. Vercel adds the settings automatically.
2. In **Settings > Environment Variables**, add `MISSED_KEY` with any private password you make up.
3. Redeploy (Deployments > ... > Redeploy).
4. View the list anytime at `https://www.askaihawaii.com/api/missed?key=YOUR_PASSWORD`.

Without step 1, missed questions still appear in Vercel's **Logs** tab (search for MISSED_QUESTION).
