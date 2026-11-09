# HisabTracker

A Bengali/English personal finance app for receivables, payables, income, expenses and wallets.

## Main files

- `index.html`, `script.js`, `style.css`: application UI and accounting flows.
- `expense.css`: Expense tab styling.
- `sync.js`: confirmed online saves and concurrent-write handling.
- `safety.js`: imported/account data validation and output escaping.
- `vendor/supabase.min.js`: bundled Supabase browser SDK for authentication and cloud storage.
- `sw.js`, `manifest.json`, `icon.png`: installable app shell and asset caching.
- `.htaccess`: private-file access rules for Apache hosting.
- `CNAME`: custom domain configuration.

## Local use and publishing

Serve the folder with a web server. With XAMPP, start Apache and open `http://localhost/hisabtracker/`.

Publish all application assets together. The app uses Supabase; server-side ownership/access policies must be configured and reviewed separately. The app-shell cache can display previously loaded pages when the local server is stopped.

The current application does not use the old PHP/MySQL backend. Legacy backend files, optional database utilities and local test fixtures are excluded from Git. Local copies are retained.

Recent changes were not tested, following the owner's request. Review locally before publishing. A GitHub push does not apply Supabase database changes.

Created by [profess0r.null](https://www.profess0r-null.xyz/).
