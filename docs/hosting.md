# Hosting: compression, caching and security headers (rounds 86, 93)

The build writes `dist/_headers` from the CSP in `web/index.html` (one source). Netlify and Cloudflare Pages read it as is.
GitHub Pages ignores it: there only the `<meta>` CSP and referrer policy apply, and HTTPS/HSTS are GitHub's.

Check: `node scripts/headers.mjs` (the file) and `node scripts/headers.mjs https://<host>/<path>/` (the live host).

| Header | Value | Why |
|---|---|---|
| Content-Security-Policy | meta CSP + `frame-ancestors 'none'; upgrade-insecure-requests` | frame-ancestors only works as a header (clickjacking) |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains` | HTTPS only; add `preload` only if all of upou.edu.ph is HTTPS |
| X-Content-Type-Options | `nosniff` | |
| Referrer-Policy | `strict-origin-when-cross-origin` | same as the meta |
| Permissions-Policy | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` | the app uses none |
| Cross-Origin-Opener-Policy | `same-origin` | |
| Cache-Control | `assets/*`: 1 year immutable (hashed names); `index/*`: 1 h must-revalidate; `index.html`, `sw.js`: no-cache | a new build is picked up at once; the service worker shows "Reload" |

Compression: serve gzip or brotli for `.html .js .css .json .bin .svg` (the index JSON is ~1.5 MB raw, ~0.3 MB gzip). Not for `.webp .jpg .woff2 .wasm` (already compressed; wasm is optional, brotli helps if enabled).

## nginx (UPOU host)
```nginx
location /ijodel/ {
  gzip on; gzip_types text/css application/javascript application/json application/octet-stream image/svg+xml;
  add_header Content-Security-Policy "<copy the line from dist/_headers>" always;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;
  add_header Cross-Origin-Opener-Policy same-origin always;
  location ~ /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
  location ~ (index\.html|sw\.js)$ { add_header Cache-Control no-cache; }
}
```
(nginx drops parent `add_header` lines inside a nested location that has its own: repeat the security headers there or use an `include`.)

## Apache (.htaccess)
```apache
Header always set Content-Security-Policy "<copy the line from dist/_headers>"
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
Header always set X-Content-Type-Options nosniff
Header always set Referrer-Policy strict-origin-when-cross-origin
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json
<FilesMatch "\.(js|css|woff2|webp|jpg)$">Header set Cache-Control "public, max-age=31536000, immutable"</FilesMatch>
<FilesMatch "(index\.html|sw\.js)$">Header set Cache-Control "no-cache"</FilesMatch>
```
