# HisabTracker — confirmed online saves

Local website: http://localhost/hisabtracker/

Saving now follows the requested online-only flow:
- Save prepares a temporary draft. The displayed total, confirmed account cache and success message do not change before a database acknowledgment.
- While saving, controls are disabled and the submitted button shows Saving / সেভ হচ্ছে.
- On success the account updates, the form clears/closes and the success message appears.
- On failure the confirmed amount remains unchanged, the form stays open with its inputs, and an inline Try again / আবার চেষ্টা করুন button appears.
- Reconnection never auto-saves. A retry is an explicit user action.
- There is no Keep this copy / Use online copy panel or persistent save banner.
- Concurrent conflicting edits are rejected with a refresh message. An uncertain response can be retried without duplicating the same operation.
- Offline-era local copies are retained as archives, never automatically uploaded. The database is authoritative.

Previous accounting, PIN, import validation, wallet Undo, monthly budgets, escaped output, private-file protection and offline app-shell fixes remain.

Tests: node --test tests/regression.test.cjs
Browser fixture: npm --prefix tests install; node tests/browser-test.cjs
Tests use fake accounts/cloud responses. No production records were changed.

Before live deployment: back up Supabase, review/apply supabase-hardening.sql, review per-user RLS ownership policies, and test one real test account. These database settings have not been applied remotely. Publish all frontend files together; reload old tabs. The new frontend stores cash and hisab together in hisab_users.data._cash; do not delete legacy hisab_cash yet.

The frontend ZIP excludes exports, old copies, tests and unused PHP endpoints. Private CSVs/old ZIP are preserved outside the document root in C:\xampp\hisabtracker-backups\private-exports-20261108. The prior online/offline implementation is backed up before replacement. Live hosting that does not support .htaccess needs equivalent private-file rules; remove old live exports explicitly.

Prior version verification (before v6.2): 26 regression tests passed. Browser checks passed for delayed acknowledgment, failed/offline submissions, preserved form, explicit retry without duplication, removed copy-choice panel and mobile layout. The actual Supabase SDK was tested on XAMPP with intercepted cloud responses; real production data was untouched.


v6.2 code update: broader search with Bengali digit support, complete card history, payment remainder preview, recoverable authentication errors, clearer empty states and mobile form sizing. No automated, browser or localhost tests were run for v6.2, at the user’s request. User will verify locally before deployment.

Additional v6.2 fixes: editing a wallet transfer updates both wallet balances, cash notes can be cleared, budget amounts reject non-finite values, password changes recover from failed requests, and timeout support is detected for older browsers.


UI rollback: v7 and v8 redesigns removed at user request. Restored the pre-redesign v6.2.1 layout, including profess0r.null credit and prior accounting/save fixes. Asset version 6.2.2 and cache v42 invalidate the redesign. Removed design.js/design.css after archiving them outside the web root. No tests run.


Quick Add v6.3.1: receivable/payable selection, explicit existing-person search, add to existing or create new accounts, and payment handoff to the existing wallet confirmation dialog. Exact duplicate names require choosing an existing result. Failed Quick Add forms are retained on reopening. Retry identity includes income/expense mode, wallet and category. No automated/browser/localhost tests run at user request; live site unchanged.


Quick Add v6.4: four-task chooser followed by a focused editor. Optional note disclosure, explicit new/existing person selection, full-payment shortcut, amount-specific save labels, and same-sheet payments using shared accounting logic. Back navigation preserves entered values. No tests run at user request; no live deployment.


Card actions v6.7: informed by Carbon button hierarchy and Atlassian related-action grouping. Recording money and adding amounts are grouped; receipt is a lower-emphasis document action; edit/delete are next to the summary; full settlement remains visible as a secondary text action. Desktop buttons use content width, mobile primary actions use two columns. No tests run at user request.


Expense v6.9 redesign: a dark teal available-balance panel, wallet selection cards, grouped income/expense/transfer controls, period-filtered cash-flow summary, monthly budget, expandable category breakdown and a redesigned date-grouped transaction list. Mobile wallet cards use two columns and transaction actions wrap below the amount. All-wallet view now exposes income and expense forms (default wallet is Cash), using existing confirmed-save handlers. New expense.css is required when publishing the frontend. No automated, browser or localhost tests run at user's request. No live deployment or database changes.


Wallet management v6.11: menu offers Cash (permanent), bKash, Nagad and Bank enable/remove controls per book, saved through confirmed online commands. Empty books default to Cash; funded legacy wallets remain visible. Non-Cash wallets require zero balance before removal; historical transactions and wallet records are retained. Active wallet choices propagate to overview, Expense and all entry/payment/transfer selectors. Import validates enabled-wallet settings. No tests run at user request. No live database or site updated.


Custom wallets v6.12: create named wallets per book with up to 5 active wallets including Cash. Built-in and custom wallets share this limit. Removing a zero-balance wallet disables it while retaining metadata/history; adding the same name again reuses its identity. Wallet selectors, transfers, payment receipts, backups and import validation support custom wallet IDs. Clearing cash history preserves wallet definitions and preferences. User-controlled wallet names are escaped for HTML. No automated/browser/localhost tests run at user request; no production changes.


v6.13: named wallet creation now offers six consistent SVG icon choices (wallet, mobile, bank, card, business, savings), persisted in customWallets.iconKind and validated on import. Existing custom wallets without an icon retain the generic wallet icon. First-login PIN setup replaces the implicit 1234 fallback: users without a stored PIN must enter and confirm their own four-digit PIN, saved through the confirmed online command before opening the app. Trusted-device preferences cannot skip missing-PIN setup. Previously stored PINs are preserved. Legacy cash is loaded before the initial PIN save. No tests run at user request; no production changes.
