# First-time setup of the nessynet.io server

For the Dedirock server (Ubuntu 26.04 LTS, IPv4 `23.95.234.233`, hosts only this site). Run it once, in order. Every step ends with a **Verify** line: do not go on until it passes. Nothing here is run by CI or by the agents; you run it.

Replace `<owner mail>` and `<your public key>` where they appear. Commands run as `root` unless a step says otherwise. Files named `deploy/...` are in the repository; copy them to the box with `scp` (or paste them).

**Keep your first root SSH session open until step 5 is verified.** If anything goes wrong earlier, that session is your way back in.

## 1. Update

```
apt update && apt full-upgrade
ls /var/run/reboot-required      # if this file exists, a restart is needed
reboot                           # run as root; the SSH session drops, then reconnect after about a minute
```

If SSH does not come back after a few minutes, restart the server from the Dedirock provider panel instead.

`unattended-upgrades` is already enabled. Optional: set `Unattended-Upgrade::Automatic-Reboot "true";` in `/etc/apt/apt.conf.d/50unattended-upgrades` and a quiet `Automatic-Reboot-Time`.

**Verify:** after any restart, log in again; `ls /var/run/reboot-required` says no such file.

## 2. Packages

```
apt install nginx rsync ufw certbot logrotate
rm -f /etc/nginx/sites-enabled/default
```

**Verify:**
- `nginx -v` prints 1.28.3.
- `nginx -V 2>&1 | grep -o http_gzip_static_module` prints the module name.
- `ls /usr/bin/rrsync` exists, and `rrsync --help 2>&1 | head` mentions `-wo` (write-only).
- `systemctl list-timers | grep certbot` shows `certbot.timer` (renewal runs from systemd).
- `cat /etc/logrotate.d/nginx` shows the stock rotation for `/var/log/nginx/*.log` only. Site logs live in a subdirectory (step 3), so they are not matched twice.

## 3. Users and directories

```
adduser admin
usermod -aG sudo admin
install -d -m 700 -o admin -g admin /home/admin/.ssh
echo '<your public key>' > /home/admin/.ssh/authorized_keys
chown admin:admin /home/admin/.ssh/authorized_keys && chmod 600 /home/admin/.ssh/authorized_keys

adduser --disabled-password --gecos '' deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh

install -d -o deploy -g deploy -m 755 /srv/nessynet /srv/nessynet/releases
install -d -o root -g root -m 755 /srv/nessynet/bin /srv/nessynet/holding
install -d -m 755 /var/www/letsencrypt
install -d -o www-data -g adm -m 750 /var/log/nginx/nessynet
```

The `current` symlink (owned by `deploy`) is created in step 9. `bin/` stays root-owned so the deploy key can never edit its own gate.

**Verify:** `id admin deploy` shows both; `ls -ld /srv/nessynet/bin` shows `root root`; `ls -ld /srv/nessynet/releases` shows `deploy deploy`.

## 4. Firewall

Allow SSH **before** enabling the firewall.

```
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

No 443/udp: HTTP/3 is off.

**Verify:** `ufw status verbose` lists exactly OpenSSH, 80 and 443; open a **new** terminal and `ssh root@23.95.234.233` still connects (do not close the first session).

## 5. SSH hardening (safe order)

1. In a **second** terminal on your own machine: `ssh admin@23.95.234.233`, then `sudo -v`. Both must work. If not, stop and fix step 3.
2. On the box, check `grep -rn 'PermitRootLogin\|PasswordAuthentication\|AllowUsers' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/` (the first value read wins, so an earlier file can override yours). Then write `/etc/ssh/sshd_config.d/10-hardening.conf`:
   ```
   PermitRootLogin no
   PasswordAuthentication no
   KbdInteractiveAuthentication no
   PubkeyAuthentication yes
   AllowUsers admin deploy
   ```
3. `sshd -t` (must print nothing), then `systemctl reload ssh`. Then check what sshd really uses: `sshd -T | grep -Ei 'permituserenvironment|acceptenv|permitrootlogin|passwordauthentication|allowusers'`. It must show `permituserenvironment no`, and any `acceptenv` lines must be only `LANG` and `LC_*` (nothing else): the deploy gate relies on a client not being able to pass environment variables to the forced command. It must also show `permitrootlogin no`, `passwordauthentication no` and `allowusers admin deploy`.
4. In a **third** terminal: `ssh admin@23.95.234.233` works; `ssh root@23.95.234.233` and any password login are refused. Only then close the first root session.

fail2ban is deliberately not installed: key-only logins and no root login mean brute force cannot succeed.

**Verify:** the `sshd -T` output is as described in item 3; the third terminal works as `admin`; `ssh -o PreferredAuthentications=password admin@23.95.234.233` is refused.

## 6. DNS

At your DNS provider create **A records only**: `nessynet.io` and `www.nessynet.io` to `23.95.234.233` (www may be a CNAME to `nessynet.io`). **Do not create AAAA records**: the box has no IPv6 and one would break ACME and IPv6 visitors. Optional: `CAA 0 issue "letsencrypt.org"`.

**Verify:** from your own machine `dig +short nessynet.io www.nessynet.io` prints `23.95.234.233` (twice, or via the CNAME); `dig +short AAAA nessynet.io` prints nothing.

## 7. nginx, bootstrap (HTTP only)

```
scp -r deploy/nginx admin@23.95.234.233:/tmp/nginx-config      # from your machine
# on the box, as root:
install -m 644 /tmp/nginx-config/snippets/*.conf /etc/nginx/snippets/
install -m 644 /tmp/nginx-config/nessynet.io.bootstrap.conf /etc/nginx/sites-available/nessynet.io
ln -sfn /etc/nginx/sites-available/nessynet.io /etc/nginx/sites-enabled/nessynet.io
install -m 644 /tmp/nginx-config/logrotate-nessynet /etc/logrotate.d/nessynet
nginx -t && systemctl reload nginx
```

The bootstrap file serves only port 80 (the ACME challenge and a redirect), because the HTTPS blocks need a certificate that does not exist yet.

**Verify:** `nginx -t` says ok; `curl -sI http://nessynet.io/` returns 301 to `https://nessynet.io/`; `logrotate -d /etc/logrotate.d/nessynet` reports no errors.

## 8. First certificate

```
certbot certonly --webroot -w /var/www/letsencrypt -d nessynet.io -d www.nessynet.io -m <owner mail> --agree-tos
install -m 755 /dev/stdin /etc/letsencrypt/renewal-hooks/deploy/reload-nginx <<'HOOK'
#!/bin/sh
nginx -t && systemctl reload nginx
HOOK
```

**Verify:** `certbot renew --dry-run` ends with "all simulated renewals succeeded"; `ls /etc/letsencrypt/live/nessynet.io/fullchain.pem` exists.

## 9. Full nginx config and the holding page

```
# on the box, as root:
install -m 644 /tmp/nginx-config/nessynet.io.conf /etc/nginx/sites-available/nessynet.io
install -m 644 /tmp/nginx-config/00-default.conf /etc/nginx/conf.d/00-default.conf   # catch-all: this box serves only this site
scp -r deploy/holding admin@23.95.234.233:/tmp/holding                              # from your machine
install -m 644 /tmp/holding/* /srv/nessynet/holding/
ln -sfn /srv/nessynet/holding /srv/nessynet/current && chown -h deploy:deploy /srv/nessynet/current
nginx -t && systemctl reload nginx
```

Until the first release, `current` points at the "coming soon" page. nginx resolves the symlink on every request, so later swaps need no reload.

**Verify:** `curl -sI https://nessynet.io/` returns 200; `curl -sI https://www.nessynet.io/x` returns 301 to `https://nessynet.io/x`.

## 10. The deploy gate and the pinned host key

1. On your machine create a dedicated key used for nothing else, no passphrase: `ssh-keygen -t ed25519 -N '' -C github-actions-deploy -f deploy_key`.
2. Install the gate scripts (from `deploy/` in the repository) and the key line. First `scp deploy/deploy-gate deploy/activate admin@23.95.234.233:/tmp/deploy-scripts/` from your machine, then on the box:
   ```
   install -m 755 -o root -g root /tmp/deploy-scripts/deploy-gate /tmp/deploy-scripts/activate /srv/nessynet/bin/
   echo 'restrict,command="/srv/nessynet/bin/deploy-gate" <contents of deploy_key.pub>' > /home/deploy/.ssh/authorized_keys
   chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys
   ```
   The box needs `python3`; it is there as a certbot dependency (`python3 --version`).
3. Record the server's host key for GitHub: on your machine `ssh-keyscan -t ed25519 nessynet.io`, and compare its fingerprint (`ssh-keygen -lf` on the scanned line) with the one printed **on the box** by `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`. They must match. The scanned line is the value of `DEPLOY_KNOWN_HOSTS` (step 13).

**Verify** (from your machine, with the new key):
- `ssh -i deploy_key deploy@nessynet.io id` is refused (the gate only allows three forms).
- `ssh -i deploy_key deploy@nessynet.io rollback` fails cleanly (no previous release), without a shell.

## 11. Verification commands (also the deploy smoke set)

```
curl -sI http://nessynet.io/                      # 301 to https://nessynet.io/
curl -sI https://www.nessynet.io/x                # 301 to https://nessynet.io/x
curl -sI https://nessynet.io/                     # 200, with Content-Security-Policy, Strict-Transport-Security, Cache-Control: no-cache
curl -sI https://nessynet.io/__nope__/            # 404, same headers
curl -sI https://nessynet.io/ffxiv                # 301, Location: /ffxiv/   (once a release is live)
curl -sI -H 'Accept-Encoding: gzip' https://nessynet.io/    # Content-Encoding: gzip   (once a release is live)
openssl s_client -connect nessynet.io:443 -tls1_2 </dev/null 2>/dev/null | grep -E 'Protocol|Cipher'
openssl s_client -connect nessynet.io:443 -tls1_3 </dev/null 2>/dev/null | grep -E 'Protocol|Cipher'
```

TLS: both handshakes must succeed. Compare the cipher list in `deploy/nginx/nessynet.io.conf` with the current Mozilla SSL Configuration Generator output (nginx, intermediate profile, TLS 1.2 + 1.3, nginx 1.28.3) and note the date you compared them in the pull request or in your own notes.

**Verify:** every line above gives the expected result. The `/ffxiv` and gzip lines need the first real release (step 14).

## 12. Rollback and recovery

- **A bad release:** run the deploy workflow with `action = rollback` (optionally a `release_id`), or on the box `sudo -u deploy /srv/nessynet/bin/activate --previous`.
- **A bad nginx config:** reinstall the previous `deploy/nginx/` files from git, `nginx -t`, `systemctl reload nginx`.
- **A lost server:** rebuild with this checklist and redeploy from CI. If a Dedirock snapshot exists, restore `/etc/letsencrypt` from it to avoid certificate rate limits. Nothing else on the box is unique.

**Verify:** `ls -l /srv/nessynet/current` points at the release you expect.

## 13. The GitHub side

In the repository settings:

1. **Environment `production`**, with the deployment branch rule set to `main` only. (Required reviewers are optional and need a public repo or a paid plan; they are not needed for safety.)
2. Environment **secret** `DEPLOY_SSH_KEY`: the full contents of the private key file `deploy_key` from step 10. Then delete the local copy of the private key.
3. Environment **variables**: `DEPLOY_HOST` = `nessynet.io`, `DEPLOY_USER` = `deploy`, `DEPLOY_KNOWN_HOSTS` = the `ssh-keyscan` line from step 10.
4. **Repository variable** `DEPLOY_ENABLED` = `false`. Leave it `false` until `npm run samples` prints no items.
5. **S13 check:** open a pull request and confirm that the `deploy` workflow is skipped (its `release` job does not run). Also confirm a `main` push runs `ci` and not a deploy while `DEPLOY_ENABLED` is `false`.

**Verify:** the S13 check above.

## 14. First release

When `npm run samples` is empty and `release-readiness` is green: set `DEPLOY_ENABLED` to `true`; the next green push to `main` deploys. Watch the workflow, then run the step 11 commands again.

Even if the flag were flipped early, the build is strict and the server's `activate` refuses any release that was not built strict, without samples, from `main`: the gate holds three times.
