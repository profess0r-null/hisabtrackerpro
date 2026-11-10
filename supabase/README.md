# Security and usage setup

This frontend version requires `migrations/20261110_security_and_usage.sql`, followed by `migrations/20261110_manual_lock_only.sql`.
No migration has been applied to the live Supabase project from this workspace.

## Install

1. Back up the existing Supabase database. Open the correct project in Supabase Dashboard.
2. Confirm that `sakibulhasantalukder2006@gmail.com` is an existing, verified Auth user.
3. In **SQL Editor → New query**, paste the full migration and run it as the database owner.
4. Deploy the matching frontend immediately after successful installation, in the same maintenance window. The old frontend cannot unlock records once the new gate policies are installed. Keep the new frontend ready before running SQL.
5. Sign in with an existing account and its existing PIN. The legacy hash is upgraded privately on first successful unlock. New accounts choose and confirm their own PIN.
6. Verify the owner’s **Menu → Website Usage** and verify that an ordinary test account cannot query `ht_usage_report`.

The migration replaces policies on `hisab_users` and `hisab_cash`, blocks anonymous access, restricts records to the authenticated owner with an unlocked Auth session, and makes legacy `hisab_cash` read-only. It creates private PIN/session/usage tables and tightly scoped RPCs. It does not delete financial rows or modify existing amounts. Do not upload this entire development folder to hosting; deploy tracked frontend assets only.

## What is counted

A signed-in account is counted after it successfully unlocks and uses this app version. Only first/last active time and the user ID are stored; the report joins the account email for the pinned owner. It does not collect financial records, IP addresses, browsing history, location or device fingerprints. A visible, recently interacted-with page sends a small heartbeat at most once a minute. “Last 5 minutes” is recent activity, not an exact live-online count. Historical use before installation cannot be reconstructed.

Owner access is pinned to the verified Auth UUID selected by the migration. Changing a frontend email/flag or changing another account’s email does not grant report access. Never add owner permissions to user-editable metadata.

## PIN and cache behavior

- PIN checks and failed-attempt limits run on the server. Five wrong attempts cause a 15-minute pause.
- A successful PIN unlock is bound to the actual Auth session ID without an inactivity timeout. Manual Lock App, logout, PIN changes that revoke other sessions, or revoking the Auth session still remove access. Usage reporting does not control lock timing.
- The existing signed-in server session can survive a reload within that window; the old local trusted flag has no authority.
- A PIN change requires an already-unlocked session and invalidates other device unlocks.
- Locking removes the current session’s unlock. Signing out also clears local sensitive state/caches.
- New server PIN hashes are never returned to the frontend. Legacy JSON PIN metadata is removed from client snapshots and downloaded backups, and is dropped from the account row on its next financial save. Imports cannot replace the private server PIN.
- A four-digit PIN is still a short secret. The server rate limit and gated data access are essential; this is not end-to-end encryption or protection against malicious code running inside an already-unlocked browser.
- Password recovery can open the password-change dialog without exposing financial records. Changing a password does not reset a forgotten PIN; a verified recovery process for PIN resets is not implemented in this change.

## Verification status

Browser flows were tested against a synthetic local backend, including lock bypass attempts, owner/non-owner visibility, report output escaping, confirmed financial saves, and logout cleanup. The SQL must still be executed and tested against the actual Supabase backend; local mock tests are not proof of deployed RLS behavior.

The Content Security Policy restricts external sources, object embeds, form targets and base URLs. Existing inline scripts/handlers still require `unsafe-inline`; migrating those handlers is remaining hardening work. Apache also blocks the unused local `api/` and setup directories. Static hosts ignore `.htaccess`, so the app includes the compatible CSP meta policy as well; frame restrictions need host response headers.

No service-role key belongs in the frontend. No financial or authentication data is sent to usage reports.
