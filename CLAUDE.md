# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Tutor's portal (UI and data in Russian): a static frontend served by GitHub Pages, a Google Apps Script web app as the API ([Code.gs](Code.gs)), and Google Sheets as the database. There is no build step, package manager, linter, or test suite — edit files directly and open the HTML pages in a browser (or push to the branch GitHub Pages publishes).

## Deployment (the two halves deploy separately)

- **Frontend** (`*.html`, `css/`, `js/`): publishing via GitHub Pages is enough.
- **Backend** ([Code.gs](Code.gs)): must be pasted manually into the Apps Script editor, then Deploy → Manage deployments → Edit → *New version*. Changes to Code.gs have no effect on the live API until this is done. If the `/exec` URL changes, update `APPS_SCRIPT_URL` in [js/auth.js](js/auth.js).
- `SPREADSHEET_ID` in Code.gs stays empty when the script is bound to the spreadsheet.

## Architecture

**API contract** (Code.gs): one `doGet` and one `doPost`, no routing by path.
- `doGet` requires `username` + `token` query params and returns the whole dataset in a single JSON object (`users, materials, homework, schedule, grades, lessonNotes, payments, achievements, messages, topics`), **filtered by role on the server**: admin gets everything; student/parent get only rows for the relevant student (a parent's `child` field maps to the student's username).
- `doPost` dispatches on `action` in a `switch` (`login` is the only unauthenticated action). Admin-only actions call `requireAdmin_`. Body is JSON sent as `text/plain` to avoid a CORS preflight — keep that when changing [js/auth.js](js/auth.js) `apiPost`.
- Errors are returned as `{ok:false, error}` with HTTP 200; the client helpers throw on `ok === false`.
- Sessions are tokens stored server-side with TTL `SESSION_TTL_SECONDS` (`validateSession_` / `login_`); the client keeps `{username,name,role,grade,token}` in `localStorage` under `tutor_user`.

**Schema**: the `HEADERS` constant in Code.gs is the source of truth for sheet columns; `ensureSchema_` creates missing sheets/columns on each request. `appendRecord_` writes by header name, `readSheet_` reads rows into objects keyed by header — so adding a field means updating `HEADERS`, the relevant `doPost` case, and the frontend. The README's sheet list is out of date (it omits `lessonNotes`, `payments`, `achievements`, `messages`, `topics` and several columns).

**Frontend**: one HTML page per role — [index.html](index.html) (login), [dashboard.html](dashboard.html) (student), [parent.html](parent.html), [admin.html](admin.html) — each with a matching script in `js/`. All include [js/auth.js](js/auth.js) first, which provides `requireAuth(role)`, `apiGet`, `apiPost`, `logout`, and the light/dark theme toggle. [js/calendar.js](js/calendar.js) is shared schedule-rendering code. Styles are in a single [css/style.css](css/style.css) using a `data-theme` attribute.

## Notes

- Passwords are stored as plain text in the `users` sheet (documented as an accepted limitation in the README); don't send them to the client — `publicUser_` strips them.
- Code.gs helpers at the bottom of the file are intentionally minified one-liners; match that style when adding small helpers there.
- [test.txt](test.txt) is a scratch file, not part of the app.
