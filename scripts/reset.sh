#!/bin/bash
# Shutdown Reset Script - Stop Apache + Set john.active=true in users.json

set -e

LOG_FILE="/var/log/shutdown-reset.log"
USERS_JSON="/var/www/html/assets/users.json"
MYSQL_RESET_SCRIPT="/home/john/Trustfall/scripts/resetPasswords.py"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

error_exit() {
    log "ERROR: $1"
    exit 1
}

update_users_json() {
    if [ ! -f "$USERS_JSON" ]; then
        error_exit "users.json missing: $USERS_JSON"
    fi
    
    # Backup
    cp "$USERS_JSON" "${USERS_JSON}.backup.$(date +%s)"
    log "[*] Backup created"
    
    # Find john's "active": false and change to "active": true
    # Using sed with JSON-aware replacement (first john entry only)
    if sed -i \
        '/"username": "john"/,/}/s/"active":\s*false/"active": true/1' \
        "$USERS_JSON"; then
        log "[✅] john.active: false → true"
    else
        log "[!] john.active update failed - trying fallback"
        # Fallback: simple replace first john false
        sed -i \
            '0,/("username": "john".*"active":\s*)false/ s// \1true/' \
            "$USERS_JSON" && log "[✅] Fallback worked" || log "[!] All updates failed"
    fi
    
    # Verify
    if grep -A5 -B1 '"username": "john"' "$USERS_JSON" | grep -q '"active": true'; then
        log "[✅] Verified: john.active = true"
    else
        log "[!] Verification failed - showing john section:"
        grep -A5 -B1 '"username": "john"' "$USERS_JSON"
    fi
}

run_mysql_reset() {
    if [ ! -f "$MYSQL_RESET_SCRIPT" ]; then
        error_exit "MySQL script missing: $MYSQL_RESET_SCRIPT"
    fi
    
    log "[*] Running MySQL reset..."
    if sudo python3 "$MYSQL_RESET_SCRIPT"; then
        log "[✅] MySQL passwords reset"
    else
        log "[!] MySQL reset failed"
    fi
}

main() {
    log "=== Shutdown Reset Started ==="
    
    # 1. Stop Apache2
    if systemctl is-active --quiet apache2 2>/dev/null; then
        log "[*] Stopping apache2..."
        systemctl stop apache2
        log "[✅] Apache2 stopped"
    else
        log "[*] Apache2 already stopped"
    fi
    
    update_users_json
    run_mysql_reset

    log "[✅] === Reset Complete ==="
}

# Run
main "$@"