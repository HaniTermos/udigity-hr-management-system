proxy_http_version 1.1;
proxy_set_header Host $host;
# Overwrite (do not append) X-Forwarded-For: the backend trusts exactly one proxy hop (TRUST_PROXY=true),
# so the office-IP check (ADR-016) sees the real client address and a client cannot spoof it.
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
proxy_read_timeout 60s;
proxy_send_timeout 60s;
# The edge owns Referrer-Policy (map in nginx.conf); drop the app's copy so the response never carries two values.
proxy_hide_header Referrer-Policy;
