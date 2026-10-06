# CSRF Scenario — Installation Guide

Living deployment guide for the **NewtBug Task-Manager** CSRF lab. Target: a
single Ubuntu VM that runs the vulnerable app **and** the automated admin victim.

- **Target host (reference deploy):** `192.168.1.11` — Ubuntu 24.04.4 LTS, x86_64, 3.9 GB RAM
- **SSH:** `john:ubuntu` (user `john` has `sudo`)
- **Source:** this repo (`csrfScenario-main`)

> Status legend: ✅ done & verified · 🚧 in progress · ⬜ not started

## Component map

| Component | Where | Service |
|-----------|-------|---------|
| MySQL (`userdb`) | localhost:3306 | `mysql` |
| Node backend | `/opt/task-manager-backend` → 127.0.0.1:3000 | `jsServer.service` |
| React SPA (built) | `/var/www/html` | served by Apache |
| Apache front proxy | :80, proxies `/api` → node | `apache2` |
| Selenium admin bot | `/usr/local/bin/autoLogin.py` | `seleniumAutomation.service` |
| chromedriver + Chrome | `/opt/chromedriver-linux64/`, `/opt/chrome-linux64/` | (used by bot) |
| Postfix + Maildir | `/home/john/Maildir/new` | `postfix` |
| Scoreboard flag | `/var/www/html/assets/users.json` | flipped by bot on win |
| Shutdown reset | `reset.sh` + `resetPasswords.py` | (reset unit, optional) |

## Credentials / constants

- Admin victim: `john@newtbug.com` / `Z8ctUXdmoIxsgG0wqMWU` (DB id=1, isAdmin=1)
- MySQL app user: `john` / `johnPassword!@#$%` (hardcoded in `db.js`), db `userdb`
- Backend `.env`: `PORT=3000`, `DB_USER=john`, `DB_NAME=userdb`, `SESSION_SECRET=…`

---

## Phase 0 — Code reconstructions (done in repo before deploy) ✅
The local `-main` snapshot was stale in the auth path. Fixed in
`task-manager-backend/server.js`:
- `/api/login` now calls `req.session.regenerate()` so the SID rotates on login
  (anti-fixation + required by the bot's login check).
- `/api/change-password` rewritten to a **parameterized, session-only** update
  (no `oldPassword`, no SQLi) that destroys the session on success.

All server commands assume you've cached sudo once per session:
`echo <sudo-pass> | sudo -S -v`. The repo is unpacked to `/home/john/csrfScenario`.

## Phase 1 — Base packages ✅
```bash
sudo hostnamectl set-hostname NewtBug
echo "127.0.1.1 NewtBug.newtbug.com NewtBug" | sudo tee -a /etc/hosts
# preseed postfix as an Internet Site before install
echo "postfix postfix/mailname string newtbug.com"       | sudo debconf-set-selections
echo "postfix postfix/main_mailer_type string Internet Site" | sudo debconf-set-selections
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
     mysql-server apache2 postfix mailutils \
     python3-venv python3-pip python3-full unzip curl wget ca-certificates gnupg
# Node 20 (Vite 7 needs Node >= 20):
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```
Hostname MUST contain `NewtBug` — Maildir filenames derive from it and the bot's
watcher only reacts to paths containing `.NewtBug`.

## Phase 2 — MySQL + seed ✅
Fresh MySQL root uses `auth_socket`, so seed as root via sudo. **Gotcha:** don't
pipe SQL into `sudo -S mysql` — the file redirect steals stdin from the password
prompt. Cache sudo first, then redirect:
```bash
echo <sudo-pass> | sudo -S -v
sudo mysql < /home/john/csrfScenario/deploy/seed.sql
# verify app user (password hardcoded in db.js):
mysql -ujohn -p'johnPassword!@#$%' -e "SELECT COUNT(*) FROM userdb.users;"
```
Seeds users 1–5 (id=1 `john` admin) + a few tasks. Passwords match
`resetPasswords.py` so the shutdown reset restores them.

## Phase 3 — Node backend + jsServer.service ✅
```bash
sudo cp -r /home/john/csrfScenario/task-manager-backend /opt/task-manager-backend
sudo cp /home/john/csrfScenario/deploy/backend.env /opt/task-manager-backend/.env
sudo sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$(head -c32 /dev/urandom|base64|tr -dc A-Za-z0-9)|" \
     /opt/task-manager-backend/.env
sudo chown -R john:john /opt/task-manager-backend
cd /opt/task-manager-backend && npm install --no-audit --no-fund
# db.js uses mysql.createPool (self-healing) — survives boot races, idle
# wait_timeout, and MySQL restarts. jsServer.service orders After/Requires mysql.
sudo cp /home/john/csrfScenario/services/jsServer.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now jsServer.service
```
**Verified:** `/api/csrf-token` → 401 w/o session; login as `john@newtbug.com`
rotates `connect.sid` (regenerate works) and `/api/adminMe` → 200; a
form-urlencoded `newPassword=…` POST to `/api/change-password` with only the
session cookie (no token) overwrites the password and destroys the session.

## Phase 4 — Frontend build + Apache ✅
```bash
cd /home/john/csrfScenario/task-manager-frontend && npm install && npm run build
sudo rm -rf /var/www/html/* && sudo cp -r dist/* /var/www/html/
sudo a2enmod proxy proxy_http rewrite headers
sudo cp /home/john/csrfScenario/deploy/apache-taskmanager.conf /etc/apache2/sites-available/taskmanager.conf
sudo a2dissite 000-default.conf && sudo a2ensite taskmanager.conf
sudo systemctl restart apache2
```
**Verified via :80:** `/` and `/login` → 200 (SPA fallback), `/api/*` proxied
to the node backend, login succeeds through the proxy.

## Phase 5 — Scoreboard (users.json) ✅
```bash
sudo mkdir -p /var/www/html/assets
sudo cp /home/john/csrfScenario/deploy/users.json /var/www/html/assets/users.json
sudo chown -R www-data:www-data /var/www/html
```
`[{ "username":"john","role":"admin","active":true }]` — the bot flips the first
`true`→`false` on a confirmed CSRF; the shutdown reset flips it back.

## Phase 6 — Chrome + chromedriver + Selenium bot 🚧
```bash
# Chrome (pulls all headless deps + puts google-chrome in PATH):
wget -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt-get install -y /tmp/chrome.deb
# chromedriver matching Chrome's version, to the path autoLogin.py pins:
#   /opt/chromedriver-linux64/chromedriver   (from Chrome-for-Testing)
# Selenium venv the service uses:
sudo python3 -m venv /opt/selenium_venv
sudo /opt/selenium_venv/bin/pip install selenium watchdog
sudo ln -sfn /opt/selenium_venv /home/john/selenium_venv   # reset.sh expects this path
# autoLogin.py + startup.py to /usr/local/bin (service paths):
sudo cp /home/john/csrfScenario/scripts/autoLogin.py   /usr/local/bin/autoLogin.py
sudo cp /home/john/csrfScenario/scripts/startupKali.py /usr/local/bin/startup.py
sudo cp /home/john/csrfScenario/services/seleniumAutomation.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now seleniumAutomation.service
```

## Phase 7 — Postfix + Maildir ✅
```bash
sudo postconf -e "home_mailbox = Maildir/"
sudo postconf -e "myhostname = NewtBug.newtbug.com"
sudo postconf -e "mydestination = \$myhostname, newtbug.com, NewtBug, localhost.localdomain, localhost"
sudo postconf -e "inet_interfaces = all"
sudo postconf -e "inet_protocols = ipv4"
sudo -u john mkdir -p /home/john/Maildir/{new,cur,tmp}
sudo systemctl restart postfix
```
**Verified:** mail to `john@newtbug.com` lands in `/home/john/Maildir/new/` with a
filename like `…M312930.NewtBug` — it contains `.NewtBug`, which is exactly what
the watcher keys on. (Short hostname `NewtBug` is the Maildir host segment.)

## Phase 8 — Reset tooling ✅
`resetPasswords.py` imports `mysql.connector`. The apt package
(`python3-mysql.connector`) is too old for Python 3.12 (uses the removed
`ssl.wrap_socket`). Install the modern wheel instead:
```bash
sudo apt-get remove -y python3-mysql.connector
sudo pip install --break-system-packages "mysql-connector-python>=9"
sudo python3 /home/john/csrfScenario/scripts/resetPasswords.py   # resets pw id 1-5, deletes id>5
```
Repo lives at `/home/john/csrfScenario` so `reset.sh`'s script path resolves
as-is, and the `/home/john/selenium_venv` symlink satisfies its venv `source`.
**Note:** `reset.sh` stops Apache — it's a *shutdown* script, don't run it on a
live lab. For a live re-arm use the manual reset in "Lab lifecycle" below.

## Phase 9 — End-to-end verification ✅
Verified the complete intended chain on the live deploy:
1. PoC (`deploy/attacker/poc.html`, auto-submitting cross-site form) served from
   `192.168.1.28:8000` (a different IP ⇒ genuinely cross-site).
2. Phishing mail sent attacker→victim over SMTP (`.28` → `.11:25`), landed in
   `/home/john/Maildir/new/…NewtBug`.
3. Bot: `New mail detected` → `refreshing admin session` (fresh cookie) →
   `Visiting link` → `connect.sid GONE … CSRF confirmed` → flipped `users.json`
   `true`→`false` → graceful shutdown.
4. DB confirmed: `john` password became the attacker value; scoreboard flipped.

Then reset to a clean armed state (pw restored, scoreboard `true`, bot
re-`active`, Maildir cleared).

---

## Lab lifecycle

**Current state:** fully deployed and **armed** on `192.168.1.11`. Services
(`jsServer`, `apache2`, `postfix`, `mysql`, `seleniumAutomation`) are enabled and
running; the bot re-logs in on boot and watches the Maildir.

**Manual re-arm (after a solve, keeps services up):**
```bash
mysql -ujohn -p'johnPassword!@#$%' -e \
  "UPDATE userdb.users SET password='Z8ctUXdmoIxsgG0wqMWU' WHERE id=1;"   # or run resetPasswords.py
sudo cp /home/john/csrfScenario/deploy/users.json /var/www/html/assets/users.json
sudo chown www-data:www-data /var/www/html/assets/users.json
sudo rm -f /home/john/Maildir/new/* /home/john/Maildir/cur/*
sudo systemctl restart seleniumAutomation.service   # bot exits on win; restart to re-arm
```

**Win signal:** `/var/www/html/assets/users.json` `active` flips `true`→`false`,
and the `seleniumAutomation` service exits (goes `inactive`).

## Participant-facing attack (what the solver does)
1. Stand up an attacker page on a host with a **different IP** than the app that
   auto-submits a cross-site POST to `http://192.168.1.11/api/change-password`
   with a `newPassword` field (form-urlencoded — no token, no `oldPassword`).
2. Email `john@newtbug.com` (SMTP to the victim:25) with a link to that page.
3. The admin bot visits it; its session rides the request; password changes.

## Troubleshooting
- **All DB endpoints 500 ("Error registering user" / "Error logging in"); log says
  `Can't add new command when connection is in closed state`:** the DB connection
  died and didn't reconnect. Root causes: (a) `jsServer` started before MySQL was
  ready at boot, or (b) idle `wait_timeout` / a MySQL restart dropped the socket.
  **Fixed** by `db.js` now using a self-healing `mysql.createPool` (instead of a
  lone `createConnection`) **and** `jsServer.service` ordering `After=/Requires=
  mysql.service`. If seen again, just `sudo systemctl restart jsServer`. Note the
  vuln surface is unchanged — the pool only affects connection management.
- **IP changed:** the VM uses DHCP (was `192.168.1.11`, now `10.10.30.108`).
  Nothing in the app hardcodes it (backend derives it, frontend uses relative
  `/api`, bot derives it). Only external references need updating: the attacker
  PoC's target URL (`deploy/attacker/poc.html`) and any docs. Re-discover with
  `curl -s http://<ip>/assets/users.json` returning the scoreboard JSON.
- **Bot never reacts to mail:** confirm the Maildir filename contains `.NewtBug`
  (`ls /home/john/Maildir/new`). It derives from the hostname — must be `NewtBug`.
- **CSRF 403 "no connect.sid":** the cookie aged past Chrome's 2-min window. The
  harness re-logs in per mail to avoid this; if seen, check `handle_attack()` is
  present and `baseline_sid` is updated after re-login.
- **`ssl.wrap_socket` error:** old mysql connector — use the pip wheel (Phase 8).
- **Vite build fails:** needs Node ≥ 20 (Phase 1 uses NodeSource 20.x).
- **chromedriver/Chrome mismatch:** keep both on the same major (Chrome 154 ↔
  chromedriver 154 here; patch may differ slightly within the same build).

---

## Known issues / notes
- `scripts/resetPasswords.py` uses `re.*` in `reset_users_json()` but never
  `import re` → that function raises and is caught (logs an error). Password
  reset still works; `users.json` reset is handled by `reset.sh`'s `sed` instead.
- `reset.sh` references `/home/john/csrfScenario/scripts/...` (no `-main`) and
  `/home/john/selenium_venv`, while `seleniumAutomation.service` uses
  `/opt/selenium_venv`. Paths normalized during deploy (see phases).
