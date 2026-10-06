# CSRF / Session-Fixation CTF Lab — Full Scenario Notes

A deliberately vulnerable **task-management web app** used as a teaching
environment for CSRF and session-fixation defense. The victim is an automated
admin bot; the attack is delivered by email.

> **Doc status (2026-10-05):** rewritten against the *current* codebase. Two
> things earlier drafts described are no longer in scope:
> - **No SQL injection.** The password-change query is parameterized and keyed
>   solely off the session (`connect.sid` → `req.session.userID`). The old
>   "chained SQLi via `newPassword`" path is gone. The star vuln is the CSRF,
>   full stop.
> - **The SameSite first-run failure is resolved.** The Selenium harness now
>   re-authenticates on every inbound mail, so the CSRF POST always fires inside
>   Chrome's 2-minute `Lax-allow-unsafe` window (see §5/§6). It is kept below as
>   background because it explains *why* the harness is built the way it is.

---

## 1. Stack & architecture

- **Backend:** Node.js / Express
- **Sessions:** `express-session` with the default `MemoryStore` (intentional fragility)
- **Front proxy:** Apache reverse proxy; Node app binds `127.0.0.1`
- **Victim automation:** headless Chrome driven by Selenium, running as the
  `seleniumAutomation.service` systemd unit
- **Delivery channel:** a Maildir that the Selenium bot watches for incoming
  "phishing" email; links in the mail are visited by the bot
- **Host:** Ubuntu server, no GUI
- **Victim identity:** the bot is logged in as admin **`john`** (the CSRF target)

---

## 2. The teaching centerpiece — `/api/change-password`

Every other state-changing endpoint (`create-task`, `delete-task`,
`mark-done`) is wrapped in `validateToken`, which requires a matching
`x-csrf-token` **request header**. A cross-site page can't set a custom header,
so those endpoints are CSRF-safe *by design*. `change-password` conspicuously is
**not** wrapped — it's guarded only by `requireLogin`. That asymmetry is the
whole point: it's a textbook CSRF sink sitting next to correctly-defended peers.

- **No CSRF token** on this endpoint — no `x-csrf-token` check at all, so a
  simple cross-site form/`fetch` POST reaches it.
- **No `oldPassword` check** — the session is the sole authority for whose
  password changes. A forged cross-site POST carrying the victim's `connect.sid`
  flips the password with no secret the attacker needs to know. (The legit UI
  still *sends* an `oldPassword` field; the server simply ignores it.)
- **Parameterized query — no SQLi.** The write is:
  ```js
  const query = "UPDATE users SET password = ? WHERE id = ?";
  db.query(query, [newPassword, req.session.userID], ...);
  ```
  `newPassword` is a bound parameter and the target row comes from the session,
  not from attacker input. There is no injection surface here; the vulnerability
  is purely the missing CSRF defense.
- **Session destroyed on success.** After the update the handler calls
  `req.session.destroy()` and clears `connect.sid`. That teardown is exactly
  what the Selenium monitor watches for as its success oracle (see §7).

---

## 3. Session handling — fixation defended, CSRF left open

`req.session.regenerate()` is called on login. This is the **correct**
anti-fixation pattern being demonstrated: the pre-login session is destroyed and
a fresh SID is minted at the auth boundary. Participants see fixation *defended*
on login even as CSRF sits wide open on the very next endpoint.

Mechanics worth remembering:
- `connect.sid` is an **opaque pointer** to server-side session data, not a
  container of state. Its stability across requests is what lets a cross-site
  request carry the victim's authenticated session.
- `saveUninitialized: true` hands a `connect.sid` to *any* first-time visitor —
  relevant to the `requireLogin` weakness below.

---

## 4. Intended attack flow

1. Attacker crafts a malicious page with a hidden **auto-submitting form**
   targeting `http://<app-ip>/api/change-password`.
2. Attacker delivers the link via **email → Maildir**.
3. The Selenium bot (authenticated as `john`) detects the mail and **visits the
   link**.
4. The bot's browser auto-submits the form; the POST carries `john`'s
   `connect.sid`; the admin password changes.
5. The server destroys the session; the monitor observes `connect.sid`
   disappear/rotate and confirms success (then flips the scoreboard — see §7).

---

## 5. The SameSite timing trap — RESOLVED (kept as background)

> **Status: fixed.** The harness now re-authenticates on every inbound mail
> before visiting its links (§6 Option 1, implemented in `handle_attack()`), so
> the CSRF POST always fires within the grace window and there is no first-run
> failure anymore. The analysis below is retained because it explains why the
> harness re-logs in and why the "obvious" fixes in §6 don't work.

**Historical symptom:** on the first run, the CSRF POST reached the backend with
**no `connect.sid`** (`requireLogin` 403). After `systemctl restart` of the
Selenium service, a retry succeeded consistently.

**Root cause:** Chrome's **`SameSite=Lax`-by-default** plus its **2-minute
"Lax-allow-unsafe" grace window** (`kLaxAllowUnsafeMaxAge = 2 minutes`).

The session cookie is set with **no `sameSite` attribute**:

```js
cookie: { httpOnly: true, secure: false, maxAge: ... }  // no sameSite
```

Chrome treats unspecified `SameSite` as `Lax`. A Lax cookie is **not** sent on
cross-site top-level POSTs — exactly what this CSRF is (attacker page on a
different IP). The *only* reason it ever works is the transitional
`Lax-allow-unsafe` intervention: a cookie with no explicit SameSite still rides
a cross-site top-level POST, **but only if it was set less than ~120 seconds
ago**.

Mapped onto the timeline:

- **First try (fails):** bot logs in at boot, captures `baseline_sid`. The
  participant then does recon, crafts the page, sends the mail — usually well
  over 2 minutes later. The login cookie has aged past the window → Chrome
  withholds it → backend logs **no `connect.sid`**.
- **After restart (works):** restart forces a fresh login → new cookie value
  with a new creation timestamp → prompt retry lands inside the window.

So "restart fixes it" isn't structural — it just resets the cookie's age clock.

**Red herrings ruled out:**
- The pre-login → post-login SID change is *correct* `regenerate()` behavior, not
  the cause.
- `no connect.sid` is specifically the `requireLogin` **cookie-absence** branch —
  distinct from a wiped session. A lost MemoryStore session (e.g. backend
  restart) would instead log the `change-password` "no userID in session"
  message. Seeing the former means it's purely cookie-attachment (SameSite).
- Chrome **preserves a cookie's original creation time** when it's overwritten
  with the **same value** (specifically to stop sites refreshing this grace
  window). So `rolling: true` / keep-alives that re-send the same SID do **not**
  reset the clock — only a genuine value change (real re-login / `regenerate`)
  does.

**30-second confirmation:** grep the server log for the delta between login
success (T0) and the blocked POST (T1). If `T1 − T0 > ~120s`, confirmed.

---

## 6. Fixes (HTTP + cross-origin constraints)

You fundamentally cannot make a cross-site POST reliably carry a cookie on plain
HTTP in current Chrome — `SameSite=None` requires `Secure`, which requires HTTPS.

**Option 1 — Re-login when mail arrives (IMPLEMENTED; smallest change, keeps
HTTP + cross-origin realism).** This is the shipped fix. In the mail handler
(`handle_attack()`, called from `on_created`), the harness re-authenticates
*before* visiting the attacker links, adopts the freshly-rotated SID as the new
`baseline_sid`, then visits every link — so the CSRF POST always fires seconds
after a fresh `Set-Cookie`, well inside the 2-minute window. Sketch:

```python
def on_created(self, event):
    ...
    if links:
        new_sid = perform_login()      # refactor the boot login into this
        if new_sid:
            global baseline_sid
            baseline_sid = new_sid      # keep the monitor from false-positiving
        for link_url in links:
            self.visit_link(link_url)
```

Gotchas:
- Update `baseline_sid` to the freshly rotated value, or the monitor reads the
  re-login rotation as "session destroyed → CSRF confirmed" and exits early.
- `threading.Lock` isn't reentrant — don't nest `driver_lock` acquisitions
  across `perform_login()` and `visit_link()`, or you'll deadlock.

**Option 2 — Move the app to HTTPS with `sameSite: 'none', secure: true`.** Most
robust: the cookie rides every cross-site request with no time window.

```js
cookie: {
  httpOnly: true,
  secure: true,          // required for SameSite=None
  sameSite: "none",
  maxAge: 2 * 60 * 60 * 1000,
}
```

Required supporting changes: self-signed cert on Apache; `app.set("trust proxy", 1)`
in Express (the Node app sees an insecure `127.0.0.1` hop behind Apache and will
otherwise refuse to set a `Secure` cookie); Apache forwards
`X-Forwarded-Proto: https`; Selenium gets `--ignore-certificate-errors`. The
attacker page may stay HTTP — an HTTP→HTTPS form POST isn't blocked as mixed
content, and the Secure cookie is sent because the request *to the target* is
HTTPS.

**Option 3 — Pin an older Chrome and disable SameSite enforcement
(discouraged; version-fragile).** `--disable-features=SameSiteByDefaultCookies,
CookiesWithoutSameSiteMustBeSecure`, or the
`LegacySameSiteCookieBehaviorEnabledForDomainList` managed policy — both removed
from modern Chrome (policy gone in ~128) and may be silently ignored. You'll
fight it again on the next image rebuild.

### What won't work (don't chase these)
- Setting `sameSite: "lax"` **explicitly** — the 2-minute grace only applies to
  cookies with *no* SameSite attribute; an explicit `Lax` gets no window and
  blocks the cross-site POST **every** time (makes it worse).
- `sameSite: "none"` over plain HTTP — Chrome rejects a `None` cookie without
  `Secure` and won't store it at all, breaking login itself.
- Re-logging in **within the same browser / cookie jar** — same-value overwrite
  preserves the original creation time; only a fresh cookie jar (service
  restart) or a real value change resets the clock.

---

## 7. Selenium harness notes

- Watches the Maildir; `on_created` handler parses links and calls
  `visit_link()`.
- Boot login captured as `baseline_sid`; the monitor compares current SID vs
  baseline to detect session destruction (the CSRF success oracle).
- Restructured around a `do_login_flow()` / `perform_login()` pattern and
  `driver_lock` for thread safety.
- `wait_for_app_ready` polling at cold boot contributes to the delay that pushes
  the first attempt past the 120s window.

---

## 8. Other issues flagged during review (mostly out of intended scope)

1. **`/api/export-csv` is near-unauthenticated RCE, not just SSTI.** `template`
   comes from the query string into `pug.render()`, and `require` is passed into
   template locals:
   ```js
   const csvData = pug.render(defaultTemplate, { tasks, require });
   ```
   `?template=- require('child_process').execSync('id')` is direct command
   execution. If SSTI is intended, at least drop `require` from locals so
   participants reach RCE the hard way (`global.process.mainModule`, etc.). This
   endpoint is guarded only by the weak `requireLogin`, so the real barrier is
   "possess any `connect.sid`" — which every visitor gets free via
   `saveUninitialized: true`. Blast radius overshadows the intended CSRF→SQLi
   path.

2. **`requireLogin` only checks that a cookie *exists*,** not that a user is
   logged in:
   ```js
   if (!req.cookies || !req.cookies["connect.sid"]) { return 403 }
   next();
   ```
   It never inspects `req.session.userID`. Endpoints that re-query by `userID`
   fail closed; `export-csv` doesn't re-check, which is what makes the RCE
   reachable pre-auth. Gate on `req.session.userID` if that's not deliberate.

3. **MemoryStore fragility.** A backend restart silently invalidates the admin
   session mid-exercise. Swap for a persistent store if you want the lab robust
   against Node bounces. (The harness is already resilient to this: it re-logs in
   per mail, so a bounce between mails self-heals on the next delivery.)

> Two items from earlier drafts were **removed as stale** after checking the
> current code: the `maxAge` value is `1000 * 60 * 60` (a correct 1 hour, comment
> matches), and `app.listen` binds `0.0.0.0` (not loopback), so neither the
> "2-hour comment" nor the "binds 127.0.0.1 but logs HOST" note applies anymore.

---

## 9. Settled design decisions

- **Star vuln:** the CSRF on `/api/change-password`, on its own. There is no
  SQLi escalation — the query is parameterized and session-scoped (§2).
- **Flag / scoreboard:** success is signalled through
  `/var/www/html/assets/users.json`. When the monitor confirms the session was
  destroyed, `confirm_attack_once()` flips the first `true` → `false` in that
  file (see `autoLogin.py`); the shutdown reset (`reset.sh` / `resetPasswords.py`)
  flips it back for the next run. This is the observable "you won" signal.
- **Delivery:** attacker → SMTP → Postfix on the victim → local delivery into
  `/home/john/Maildir/new`. A `watchdog` observer in `autoLogin.py` fires on new
  files whose path contains `.NewtBug`, extracts `http://` links from the mail
  body, and the bot (logged in as `john`) visits each one.

## 10. Code reconstructions applied during this pass

The local `-main` snapshot was stale in the auth path; two handlers were
reconstructed to the intended (documented) behavior so the scenario runs:

- **`/api/change-password`** — rewritten to a parameterized, session-only update
  with `req.session.destroy()` on success (no `oldPassword`, no SQLi). See §2.
- **`/api/login`** — now calls `req.session.regenerate()` at the auth boundary
  before populating the session, so the SID rotates on login. This is the
  anti-fixation pattern §3 describes *and* what `autoLogin.py` relies on to
  confirm a successful login (it checks that `connect.sid` changed). Without it
  the harness can't validate its own login and never proceeds to the attack.