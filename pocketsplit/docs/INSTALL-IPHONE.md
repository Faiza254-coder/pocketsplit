# Installing PocketSplit on the iPhone 11

PocketSplit is a **Progressive Web App (PWA)**. It is installed from Safari — not the App Store —
so it needs **no Apple Developer account** and **no payment of any kind**.

There are two stages: you publish the files once (on the PC), then the client installs them
(on the iPhone).

---

## Stage 1 — Publish the app (done once, on Windows)

You only need this so Safari can reach the app over HTTPS. iOS will not install a PWA from a
local file.

1. Create a free account at <https://github.com> (no card required).
2. Create a **new public repository** named `pocketsplit`.
   - *Public* is required because GitHub Pages on a **free personal account** only publishes from
     public repositories. The repository holds **code only** — never client records.
3. Upload the contents of the `pocketsplit` folder (the folder that contains `index.html`).
   - Easy way: on the repository page → **Add file → Upload files** → drag everything → **Commit**.
4. Repository **Settings → Pages**.
5. Under **Build and deployment → Source**, choose **Deploy from a branch**.
6. Set **Branch: `main`** and **Folder: `/ (root)`**, then **Save**.
7. Wait 1–2 minutes. The page shows: *Your site is live at*
   `https://YOUR-USERNAME.github.io/pocketsplit/`.
8. Open that address on your own phone or PC to confirm the app loads.

> If you later change a file, also increase `CACHE_VERSION` in `sw.js` (e.g. `v1.0.1`).
> That tells installed phones an update is available.

---

## Stage 2 — Install on the iPhone 11 (one time, needs internet)

1. Connect the iPhone to Wi-Fi or mobile data.
2. Open **Safari** (it must be Safari for a clean install).
3. Go to `https://YOUR-USERNAME.github.io/pocketsplit/`.
4. Wait for the dashboard to appear (a few seconds; the app is downloading its files).
5. Tap the **Share** button — the square with an arrow pointing up, at the bottom of the screen.
6. Scroll down the share sheet and tap **Add to Home Screen**.
   - On iOS 26 or newer, leave **Open as Web App** switched **on**.
7. Tap **Add** in the top-right corner.
8. A green PocketSplit icon appears on the Home Screen.
9. **Open the app from that icon** and let it sit for a few seconds so the offline files finish
   caching.

### Quick offline check
Turn on **Airplane Mode**, then open PocketSplit from the icon. The dashboard should appear and
you should be able to save an expense. Turn Airplane Mode off afterwards.

---

## Important: use the icon, not a Safari tab

On iPhone, a Home Screen web app keeps **its own storage**, separate from Safari.

- Data entered in a **Safari tab** will **not** appear inside the **Home Screen app**.
- Data entered in the **Home Screen app** will **not** appear in Safari.

So pick one: the Home Screen icon is the right choice. If records ever need to move between them,
use **Backup → Export** and then **Restore** in the other version.

---

## Everyday use

- Tap the icon → dashboard appears instantly, even with no internet.
- **Add expense** → type amount → type what it was for → **Save**. Date and time are automatic.
- Shop or Home is chosen with the two-button switch at the top of the form.
- To record a worker payment, open **Shop → Workers**, tap the worker, then **Record a payment**.

---

## Backups — set a routine

Records live only on this iPhone. A backup is the only protection against a lost, broken or
wiped phone.

1. Open **Backup** (bottom tab).
2. Tap **Save or share backup**.
3. In the share sheet choose **Save to Files** → *On My iPhone* or *iCloud Drive*.
4. Once a week, also send the file to the PC by AirDrop, email or WhatsApp document.
5. Keep the last few backups. They are small (a few hundred KB).

To restore on a new phone: install PocketSplit the same way, open **Backup → Choose backup file**,
pick the file, then choose **Merge** (recommended) or **Replace**.

---

## Troubleshooting

| Problem | What to do |
|---|---|
| “Add to Home Screen” is missing | You must use Safari, not Chrome or an in-app browser. Scroll the share sheet down. |
| Icon opens a Safari tab instead of an app | Delete the icon and add it again; keep **Open as Web App** on. |
| App shows a blank/offline screen | Connect to the internet once, open the app, wait ~10 seconds, close and reopen. |
| Records seem to have disappeared | Check you are opening the same icon. Otherwise restore the latest backup. |
| Can’t find the backup file | Check **Files → On My iPhone → Downloads**, or the iCloud Drive folder you picked. |
| “Save failed” message | Free some iPhone storage (Settings → General → iPhone Storage), and don’t use Private Browsing. |

---

## What requires internet, and what does not

| Action | Internet |
|---|---|
| First installation (Stage 2) | Yes |
| Opening the app afterwards | No |
| Adding, editing, deleting expenses | No |
| Worker payments and reports | No |
| Backup export and restore | No |
| Getting an app update | Yes (only when you publish one) |
