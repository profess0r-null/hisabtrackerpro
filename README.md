<div align="center">
  <img src="assets/images/icon.png" alt="Hisab Tracker PRO" width="76" height="76">
  <h1>Hisab Tracker PRO</h1>
  <p><strong>Your accounts, your control.</strong></p>
  <p>Know your balance. Track what you receive, what you owe, and where your money goes.</p>
  <p>পাওনা–দেনা, আয়–খরচ ও ওয়ালেটের হিসাব—এক জায়গায়।</p>
  <p>
    <a href="https://hisabtracker.profess0r-null.xyz/"><strong>Open the app</strong></a>
    &nbsp; · &nbsp;
    <a href="#getting-started">Getting started</a>
    &nbsp; · &nbsp;
    <a href="#features">Features</a>
    &nbsp; · &nbsp;
    <a href="https://www.profess0r-null.xyz/">Creator</a>
  </p>
  <p>
    <img alt="Interface: Bangla and English" src="https://img.shields.io/badge/Interface-Bangla%20%2B%20English-315de5?style=flat-square">
    <img alt="Layout: Mobile and desktop" src="https://img.shields.io/badge/Layout-Mobile%20%2B%20Desktop-64748b?style=flat-square">
    <img alt="Cloud: Supabase" src="https://img.shields.io/badge/Cloud-Supabase-3c9378?style=flat-square">
  </p>
</div>

---

## At a glance

**Hisab** keeps track of money people owe you and money you owe others. **Expense** puts your available balance first, with wallets, income, expenses and transfers underneath.

Separate books let you keep different sets of accounts without mixing their records.

## Features

| Area | What you can do |
| :--- | :--- |
| **Receivables & payables** | Keep separate lists, add more to an existing amount, record partial payments, settle balances and view each person's history. |
| **Available balance** | See the combined balance across your wallets, followed by each wallet's own balance. |
| **Income & expenses** | Record amounts, categories, notes and dates; edit entries and search or filter your transactions. |
| **Wallets & transfers** | Start with Cash, add wallets such as bKash, Nagad or Bank, create your own with an icon, and transfer money between them. |
| **Books / profiles** | Keep separate records for different purposes and switch between them from the header or menu. |
| **Reports & budgets** | Review income and expenses by period, explore category spending and set monthly budgets. |
| **Quick actions** | Record income, expenses, receivables, payables and payments from the central **+** button. |
| **Receipts & backups** | Share receipts or summaries, download a JSON backup and restore records from a backup. |
| **Personal preferences** | Switch between Bangla and English, use light or dark mode, and manage your PIN from the menu. |

### Designed for everyday use

- A balance-first Expense page with compact wallet cards.
- Layouts for phones and computers, with wallets kept on one horizontal row on small screens.
- Consistent SVG icons and subtle feedback for tabs, buttons, menus and dialogs.
- A brief highlight after a successful save, with support for the device's reduced-motion preference.

## Getting started

1. Open **[Hisab Tracker PRO](https://hisabtracker.profess0r-null.xyz/)**.
2. Register with your email and password. Complete email confirmation if prompted, then sign in.
3. **Create your own 4-digit PIN**, then enter it again to confirm.
4. Use **Hisab** for receivables and payables, or **Expense** for wallet balances and everyday transactions.
5. Open **Menu → Manage Wallets** to add the accounts you use.

> [!IMPORTANT]
> **There is no preset default PIN for new accounts.** You choose your PIN during first-time setup. The PIN locks the app screen; your account password is separate.

### Wallet rules

- New books start with **Cash only**.
- Each book can have **up to 5 enabled wallets, including Cash**.
- Cash always stays enabled.
- Custom wallets can have their own name and a selected icon.
- A wallet must have a **zero balance** before you remove it. Its past transactions are retained.

## How saving works

**An internet connection is required to save changes.**

The app shows updated account values after the online save succeeds. If saving fails, the form retains your input so you can retry. Unsaved changes are not silently queued for a later offline upload.

Saved records are stored through Supabase. You can sign in on another device to load your saved account data. The app also keeps local preferences and a copy of confirmed records in the browser.

> The app's **available balance** is the total across wallets. Changing the month, search or wallet filter changes the transaction view and its summary, rather than rewriting that total.

## Menu tools

**Manage Wallets** · **Switch / create books** · **Manage Categories** · **Reports & Analytics** · **Activity Log** · **Change Password** · **Change PIN** · **Lock App** · **Download / Restore Backup** · **About** · **Privacy Policy**

## Run locally

The current app is a static HTML, CSS and JavaScript frontend connected to Supabase. It does not require a local PHP or MySQL backend to serve the interface.

### With XAMPP

1. Put the project in your XAMPP web directory, for example:

   ~~~text
   C:\xampp\htdocs\hisabtracker
   ~~~

2. Start **Apache** in the XAMPP Control Panel.
3. Open **[localhost/hisabtracker](http://localhost/hisabtracker/)** in your browser.
4. Keep an internet connection available for authentication and saving records.

You can also serve the project with another local HTTP server. Use a web server rather than opening the HTML file directly.

<details>
<summary><strong>Project structure & deployment notes</strong></summary>

### Frontend files

~~~text
hisabtracker/
├── index.html                 # App interface
├── assets/
│   ├── css/
│   │   ├── style.css          # Shared styles
│   │   ├── expense.css        # Expense workspace
│   │   ├── mobile.css         # Responsive refinements
│   │   └── motion.css         # Interaction transitions
│   ├── js/
│   │   ├── app.js             # App features and Supabase configuration
│   │   ├── sync.js            # Confirmed online saves
│   │   ├── safety.js          # Data validation
│   │   ├── mobile.js          # Responsive amount fitting
│   │   └── motion.js          # Tab and confirmed-save feedback
│   ├── images/icon.png
│   └── vendor/                # Bundled Supabase browser SDK
├── manifest.json              # Installable web app metadata
├── sw.js                      # App asset caching
├── .htaccess                  # Apache configuration
├── CNAME                      # Custom domain
└── README.md
~~~

### Hosting your own copy

Serve the frontend files on a static host or web server. The current source points to the project's configured Supabase service; copying the frontend does not create an independent backend.

For a separate deployment, configure your own Supabase project in **assets/js/app.js**, including authentication redirect URLs and the account data tables and ownership policies expected by the app. A fresh-backend setup script is not bundled in this repository.

Use HTTPS for a public deployment. Service worker support requires HTTPS or localhost. Asset caching does **not** enable offline financial writes.

</details>

---

<div align="center">
  <p><strong>Hisab Tracker PRO</strong><br>Your accounts, your control.</p>
  <p>Created by <a href="https://www.profess0r-null.xyz/"><strong>profess0r.null</strong></a></p>
  <p><a href="https://hisabtracker.profess0r-null.xyz/">Website</a> &nbsp; · &nbsp; <a href="https://github.com/profess0r-null/hisabtrackerpro/issues">Report an issue</a></p>
</div>
