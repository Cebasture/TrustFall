# Kali attacker — Postfix configuration

Captured **2026-10-06** from the Kali box (`10.10.30.114`, `kali:kali`) after
repointing the lab to the new victim **`10.10.30.92`**.

Kali runs Postfix as a **send-only smarthost**: mail to `john@newtbug.com` is
relayed to the victim's Postfix (`relayhost`), which local-delivers it to the
admin bot's Maildir. Kali does not receive mail.

## Files
- `main.cf` — full Postfix main config (the live `/etc/postfix/main.cf`).
- `master.cf` — Postfix master process config (unchanged from the Debian/Kali default).
- `postconf-n.txt` — the non-default settings only (`postconf -n`), the concise "final state".

## The settings that make it a smarthost
```
relayhost = [10.10.30.92]:25        # route all mail to the victim's Postfix
inet_interfaces = loopback-only      # send-only; don't listen on the network
inet_protocols = ipv4
mydestination = $myhostname, localhost.localdomain, localhost   # newtbug.com NOT local -> relays
```

## Re-applying on a fresh Kali
```bash
sudo apt-get install -y postfix        # preseed "Internet Site"
sudo postconf -e "relayhost = [<VICTIM_IP>]:25"
sudo postconf -e "inet_interfaces = loopback-only"
sudo postconf -e "inet_protocols = ipv4"
sudo systemctl enable --now postfix && sudo systemctl reload postfix
```
Or copy `main.cf` to `/etc/postfix/main.cf` and `systemctl reload postfix`
(update `relayhost` if the victim IP differs).

## IMPORTANT — DHCP
`relayhost` is hardcoded to the victim's current DHCP IP (`10.10.30.92`). If the
victim moves, update it:
`sudo postconf -e "relayhost = [NEW_IP]:25" && sudo systemctl reload postfix`
(and the form `action` in `/home/kali/csrf.html`).
