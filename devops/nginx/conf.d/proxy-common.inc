proxy_http_version 1.1;
proxy_set_header Host $host;
# $remote_addr is already the REAL client address here (realip module, nginx.conf): X-Forwarded-For is overwritten with it,
# not appended, so the backend (TRUSTED_PROXY_CIDRS = this container only) sees exactly one hop and a client cannot spoof
# the office-IP check (ADR-016).
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Real-IP $remote_addr;
# The public site is HTTPS only; TLS ends at the host's proxy, so this container only ever sees plain HTTP.
proxy_set_header X-Forwarded-Proto https;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
# proxy_read_timeout / proxy_send_timeout are set at server level in udigity.conf (60 s) so a location can override them (exports).
# The edge owns Referrer-Policy (map in nginx.conf); drop the app's copy so the response never carries two values.
proxy_hide_header Referrer-Policy;
# T-05 / T-07 / gap 14: ONE source for the security headers. The edge (security-headers.inc) emits Strict-Transport-Security,
# X-Content-Type-Options, X-Frame-Options, Permissions-Policy and Cross-Origin-Opener-Policy; the copies Next and Express add
# (helmet) are dropped here so each header reaches the browser exactly once with one value. Content-Security-Policy is the
# exception: the per-request nonce policy comes from the Next proxy (frontend/proxy.ts) and is NOT hidden. Referrer-Policy is
# hidden above. X-Powered-By is never sent (also off in next.config and Express).
proxy_hide_header X-Powered-By;
proxy_hide_header Strict-Transport-Security;
proxy_hide_header X-Content-Type-Options;
proxy_hide_header X-Frame-Options;
proxy_hide_header Permissions-Policy;
proxy_hide_header Cross-Origin-Opener-Policy;
