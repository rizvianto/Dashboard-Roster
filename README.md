# Shoot Roster Dashboard

A single-page dashboard for the **Production Roster** Google Sheet: shoot
sessions, videos, hours, brand breakdown, and per-talent monthly video caps.

It reads the sheet **live, client-side, on every page load**, and again
automatically every 5 minutes while left open. There's no backend, no build
step, and nothing to regenerate after logging a shoot.

## One-time setup (required before this works publicly)

Two manual steps — neither can be done from here, both are one-click:

1. **Share the sheet for live reads.** Open the
   [sheet](https://docs.google.com/spreadsheets/d/1R83tcGSZs8BgMHXt5hwByimyVUCKqyhKTUVZhNjTCbA/edit) →
   **Share** → **General access** → set to **"Anyone with the link" / Viewer**.
   The dashboard fetches the *Production Roster* and *Talent Tracker* tabs via
   Google's read-only `gviz` endpoint, which requires this. It only grants
   read access — nobody can edit via this link.
2. **Turn on GitHub Pages.** Repo → **Settings → Pages → Source: "GitHub
   Actions."** The included workflow (`.github/workflows/pages.yml`) then
   deploys automatically on every push to `main`. First deploy needs a push
   to `main` after Pages is enabled (or run the workflow manually from the
   **Actions** tab).

Once both are done, the Pages URL (shown in the repo's **Settings → Pages**
page, or the Actions run's deployment output) is a plain link anyone can open
— no login, no setup on their end.

## Files

- `index.html` — the dashboard. All markup, styles and logic in one file.
- `data.json` — a cached snapshot, used only as the instant first paint and
  as a fallback if the live fetch ever fails (sheet unreachable, sharing
  turned off, etc.). Not required for normal operation; safe to leave as-is.
- `.github/workflows/pages.yml` — deploys this repo to GitHub Pages on every
  push to `main`.

## How the live fetch works

On load, the dashboard renders the cached `data.json` immediately, then
fetches the sheet in the background via
`https://docs.google.com/spreadsheets/d/<id>/gviz/tq?tqx=out:json&sheet=<name>`
and replaces the view once that returns — typically well under a second. A
small **"Refresh now"** button forces an immediate re-fetch, and it also
re-fetches every 5 minutes on its own while the tab stays open. Per-talent
monthly caps are read live from the **Talent Tracker** sheet's `Cap` column,
falling back to a hardcoded default (70, 50 for Felicia) for any talent not
found there.

If the live fetch fails for any reason, a banner says so and the dashboard
keeps showing the last data it had (either the bundled `data.json` snapshot,
or the last successful live fetch this session) rather than going blank.

### Refreshing the bundled fallback snapshot

Not required for day-to-day use, but keeps the offline/first-paint fallback
reasonably current. Ask Claude Code to "refresh the roster dashboard's cached
snapshot" — it re-reads the sheet and regenerates `data.json`, then commit
and push.

## Notes on the data

Totals in this dashboard are computed directly from the raw session rows,
which occasionally differ slightly from the sheet's own manual "Talent
Tracker" / "Monthly History" pivot tables (those appear to lag a few rows
behind the raw log). Treat this dashboard's totals as the source of truth —
they're recomputed from the full row list on every load, live or cached.

`talent` is blank for a logged session with no talent recorded (shown as
"Unassigned"). A blank `videos` cell is treated as no data (excluded from
totals), not zero.
