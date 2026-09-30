# Shoot Roster Dashboard

A static, single-page dashboard for the **Production Roster** Google Sheet: shoot
sessions, videos, hours, brand breakdown, and per-talent monthly video caps.

## Files

- `index.html` — the dashboard. Fully self-contained (no build step, no
  dependencies) other than fetching `data.json`.
- `data.json` — the roster data, plus per-talent monthly video caps. This is
  what needs updating after each shoot.

## Viewing it

Open `index.html` in a browser, or serve the folder with any static file
server, e.g.:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000/`. It also works as-is on GitHub Pages
(enable Pages for this repo, root of the default branch).

## Keeping it up to date

The dashboard reads a static snapshot (`data.json`), not the live sheet, so it
needs a manual refresh after new shoots are logged:

1. Log each new shoot session in the **Production Roster** tab of the sheet,
   as usual.
2. Ask Claude Code to "refresh the roster dashboard from the sheet" — it reads
   the current sheet and regenerates `data.json`.
3. Commit and push (Claude will do this as part of the refresh). If the
   dashboard is deployed (e.g. GitHub Pages), it updates automatically on
   push.

### `data.json` shape

```json
{
  "meta": {
    "sourceUrl": "...",
    "generatedAt": "YYYY-MM-DD",
    "talentCaps": { "TalentName": 70 },
    "defaultCap": 70
  },
  "rows": [
    { "no": 1, "brand": "...", "talent": "...", "date": "YYYY-MM-DD", "pic": "...", "videos": 2, "hours": 6 }
  ]
}
```

`talent` is `null` for a logged session with no talent recorded (shown as
"Unassigned" in the dashboard). `videos` is `null` when that cell was blank in
the sheet.

## Notes on the data

Totals in this dashboard are computed directly from the raw session rows in
`data.json`, which occasionally differ slightly from the sheet's own manual
"Talent Tracker" / "Monthly History" pivot tables (those appear to lag a few
rows behind the raw log). Treat this dashboard's totals as the source of
truth — they're recomputed from the full row list on every load.
