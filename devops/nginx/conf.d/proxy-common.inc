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
proxy_read_timeout 60s;
proxy_send_timeout 60s;
# The edge owns Referrer-Policy (map in nginx.conf); drop the app's copy so the response never carries two values.
proxy_hide_header Referrer-Policy;
