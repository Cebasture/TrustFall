#!/usr/bin/env bash
# reset-lab.sh — restore the NewtBug / TrustFall CSRF lab to its clean, armed
# baseline. Safe to run manually OR at boot (it waits for MySQL). Idempotent.
#
# Undoes everything a solved run changes:
#   - admin (+others) passwords in userdb        (CSRF sets john -> pwned-by-csrf-123)
#   - any self-registered users (id > 5)
#   - the tasks table (back to seed)
#   - the scoreboard /var/www/html/assets/users.json  (John active -> true)
#   - stale phishing mail in john's Maildir
#   - re-arms the Selenium bot (it exits on a confirmed win)
set -u

LOGFILE="/var/log/reset-lab.log"
exec >>"$LOGFILE" 2>&1
echo "========== reset-lab start $(date -Is) =========="

DBUSER="john"
DBPASS='johnPassword!@#$%'
DBNAME="userdb"
USERS_JSON="/var/www/html/assets/users.json"
MAILDIR="/home/john/Maildir"
BOT="seleniumAutomation.service"
rc_overall=0

# 1) Wait for MySQL (at boot this unit can start before mysqld is ready).
ok=0
for i in $(seq 1 60); do
  if mysql -u"$DBUSER" -p"$DBPASS" -e "SELECT 1" >/dev/null 2>&1; then ok=1; break; fi
  sleep 2
done
if [ "$ok" = 1 ]; then echo "[ok] mysql reachable"; else echo "[FAIL] mysql not reachable"; rc_overall=1; fi

# 2) Restore DB to the seed baseline (users 1-5 + tasks; drop id>5).
mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" <<'SQL'
SET FOREIGN_KEY_CHECKS=0;
TRUNCATE TABLE tasks;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS=1;
INSERT INTO users (id,username,email,password,isAdmin) VALUES
 (1,'john','john@newtbug.com','Z8ctUXdmoIxsgG0wqMWU',1),
 (2,'kevin','kevin@newtbug.com','dC9Zzr70eBBEBrC30JZn',0),
 (3,'ray','ray@newtbug.com','8dQNDAPGy0zipvqrpdZ8',0),
 (4,'camilla','camilla@newtbug.com','xQV57Bym4ySIkadGd6XF',0),
 (5,'olivia','olivia@newtbug.com','LIuckg3TaF0FbSVmALKF',0);
INSERT INTO tasks (id,userID,task,assigned,status) VALUES
 (8,5,'Refactor existing code module',1,'completed'),
 (9,5,'Review pull requests',1,NULL),
 (10,4,'Fix CI/CD pipeline issues',1,'completed'),
 (11,3,'Update Jira / task board',1,'completed'),
 (12,2,'Investigate reported bugs',1,NULL),
 (13,2,'Review security vulnerabilities',1,'completed'),
 (14,4,'Deploy changes to staging',1,NULL),
 (15,1,'Check build and deployment status',0,'completed'),
 (16,1,'Submit timesheet',0,NULL),
 (17,1,'Review weekly performance metrics',0,'completed');
SQL
if [ $? -eq 0 ]; then echo "[ok] db restored"; else echo "[FAIL] db restore"; rc_overall=1; fi

# 3) Reset scoreboard: John active=true, everyone else false (preserve structure).
if [ -f "$USERS_JSON" ]; then
  if python3 - "$USERS_JSON" <<'PY'
import json,sys
p=sys.argv[1]
d=json.load(open(p))
for u in d.get("users",[]):
    u["active"]=(u.get("username")=="John")
json.dump(d,open(p,"w"),indent=2)
PY
  then echo "[ok] users.json reset"; chown www-data:www-data "$USERS_JSON" 2>/dev/null
  else echo "[FAIL] users.json reset"; rc_overall=1; fi
else
  echo "[FAIL] $USERS_JSON missing"; rc_overall=1
fi

# 4) Clear stale phishing mail.
rm -f "$MAILDIR"/new/* "$MAILDIR"/cur/* "$MAILDIR"/tmp/* 2>/dev/null
echo "[ok] maildir cleared"

# 5) Re-arm the bot (it exits on a confirmed win). restart == start if inactive.
: > /home/john/autoLogin.log 2>/dev/null
systemctl restart "$BOT"
echo "[*] bot -> $(systemctl is-active "$BOT")"

echo "========== reset-lab done rc=$rc_overall $(date -Is) =========="
exit $rc_overall
