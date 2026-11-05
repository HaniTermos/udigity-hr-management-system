# Included in every TLS location (nginx does not inherit add_header into a location that sets its own).
# `always` so error responses carry them too.
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
# Referrer-Policy: single source. proxy-common.inc hides the upstream header; $edge_referrer_policy (nginx.conf map)
# is "no-referrer" for /reset-password and /session-ended, otherwise strict-origin-when-cross-origin.
add_header Referrer-Policy $edge_referrer_policy always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
# CSP: the Next proxy (frontend/proxy.ts) sends the per-request nonce policy with script-src/style-src/etc. Browsers
# enforce EVERY CSP header they receive, so the edge must not carry default-src/script-src (an edge default-src
# 'self' would block the nonce'd inline scripts). The edge adds only directives that cannot conflict (DEV-4, FE1-INC2).
add_header Content-Security-Policy "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" always;
