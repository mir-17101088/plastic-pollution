# A city changes. Plastic remains.

A Daily Star visual report on plastic pollution in the Buriganga.

- **Publishes:** Tuesday, 29 September 2026
- **Live address:** https://campaign.thedailystar.net/plastic-pollution/
- **What it is:** a static website: HTML, CSS, JavaScript and images. No build step, no Node.js,
  no database, no server code, no third-party scripts, cookies or trackers.

---

## Folder structure

```
index.html            ┐
favicon.svg           │
logo.svg              │
sitemap.xml           │  THE WEBSITE: these go on the server
css/                  │  story.css (opening), report.css, report-charts.css
js/                   │  hero.js (opening animation), report.js (charts, photos, counters)
assets/               ┘
  hero/               pictures and data for the opening animation
  photos/             the six photographs in the carousel (WebP in 3 sizes + a JPEG fallback)
  report/             chart backgrounds
  fonts/              Newsreader, self-hosted (SIL Open Font License)
  icons/              social icons (Tabler Icons, MIT licence)
  og-image.jpg        social sharing image, 1200 × 675

README.md             this file            ┐
vercel.json           Vercel preview only  │  NOT uploaded to the server
.vercelignore         Vercel preview only  │
.gitignore                                 │
tools/                optional helpers     ┘
  serve.cjs           local preview server
  make_images.py      remakes the carousel photos and OG image from the originals
```

---

## Hosting on the Daily Star server

1. Download this repository from GitHub (**Code → Download ZIP**) and unzip it.
2. Upload `index.html`, `favicon.svg`, `logo.svg`, `sitemap.xml` and the folders `css/`, `js/`
   and `assets/` into a folder `plastic-pollution/` in the web root of
   `campaign.thedailystar.net`, so that this address shows the page:
   `https://campaign.thedailystar.net/plastic-pollution/index.html`
3. Do not upload `README.md`, `vercel.json`, `.vercelignore`, `.gitignore` or `tools/`.

All links inside the site are relative, so nothing needs editing. The canonical URL, social
sharing tags and structured data already point to
`https://campaign.thedailystar.net/plastic-pollution/`.

### Server settings (recommended)

The page works on any static web server. For the best loading speed, please make sure:

| Setting | Value |
| --- | --- |
| HTTPS | on (the canonical and sharing URLs use `https://`) |
| Compression | gzip or Brotli for `.html`, `.css`, `.js`, `.json`, `.svg`, `.xml` |
| MIME types | `.webp` → `image/webp`, `.woff2` → `font/woff2`, `.json` → `application/json`, `.svg` → `image/svg+xml` |
| Cache: `assets/` | `Cache-Control: public, max-age=604800` (7 days) |
| Cache: `css/`, `js/` | `Cache-Control: public, max-age=3600` (they are versioned with `?v=` in `index.html`) |
| Cache: `index.html` | `Cache-Control: no-cache` (so corrections appear immediately) |

Example for **nginx** (inside the `server { }` block of campaign.thedailystar.net):

```nginx
location /plastic-pollution/ {
    gzip on;
    gzip_types text/css application/javascript text/javascript application/json image/svg+xml application/xml;
    location ~* ^/plastic-pollution/assets/ { add_header Cache-Control "public, max-age=604800"; }
    location ~* ^/plastic-pollution/(css|js)/ { add_header Cache-Control "public, max-age=3600"; }
    location = /plastic-pollution/index.html { add_header Cache-Control "no-cache"; }
}
```

Example for **Apache** (an `.htaccess` file inside `plastic-pollution/`):

```apache
AddType image/webp .webp
AddType font/woff2 .woff2
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript text/javascript application/json image/svg+xml application/xml
</IfModule>
<IfModule mod_headers.c>
  <FilesMatch "\.(webp|jpg|woff2|svg)$">Header set Cache-Control "public, max-age=604800"</FilesMatch>
  <FilesMatch "\.(css|js|json)$">Header set Cache-Control "public, max-age=3600"</FilesMatch>
  <FilesMatch "\.html$">Header set Cache-Control "no-cache"</FilesMatch>
</IfModule>
```

Optional: add this line to the domain's existing root `robots.txt` (do not replace that file):
`Sitemap: https://campaign.thedailystar.net/plastic-pollution/sitemap.xml`

### Checklist for 29 September

- [ ] The page opens at https://campaign.thedailystar.net/plastic-pollution/ over HTTPS.
- [ ] Scroll the opening on a phone and a desktop: 1610 scene, the bag falls, the years count
      up to 2026, the present-day photograph appears, then the title section.
- [ ] The photo carousel changes every 2 seconds and the dots work.
- [ ] Paste the address into the Facebook Sharing Debugger
      (https://developers.facebook.com/tools/debug/) and press **Scrape Again**, so Facebook
      picks up the sharing image. Check an X/Twitter post preview as well.
- [ ] The publication date is set in `index.html` as `2026-09-29` (`article:published_time` and
      `datePublished`). The byline shows "September 2026". If the date moves, change those two
      values.

---

## Vercel preview

The repository deploys to Vercel as it is: `vercel.json` tells Vercel there is nothing to install
or build, so it publishes the files exactly as they are in the repository.

1. Upload everything in this folder to the root of a GitHub repository (the website files sit at
   the top level, next to `vercel.json`).
2. In Vercel: **Add New → Project**, import the repository, Framework Preset **Other**, and leave
   Build Command, Output Directory and Root Directory at their defaults. Deploy.
3. The page is at the root of the Vercel address (`https://<your-project>.vercel.app/`);
   `/plastic-pollution/` redirects there.

The preview sends `X-Robots-Tag: noindex`, so search engines will not index it. Social previews
from the Vercel address will not show the image until the page is live on
campaign.thedailystar.net, because the sharing tags point to the final address.

---

## Previewing on your own computer

From this folder, with Node.js installed:

```bash
node tools/serve.cjs
```

then open http://localhost:4173/. Without Node.js, `python -m http.server 4173` also works.

---

## Making changes after launch

- **Text, captions, credits:** edit `index.html`. The carousel captions are in
  the section `id="photos"`; the credits are in the `<footer>`.
- **CSS or JavaScript:** after editing, change `?v=20260929` to a new value (for example
  `?v=20261001`) on the five `<link>`/`<script>` lines in the `<head>` of `index.html`, so
  readers' browsers fetch the new files.
- **Replacing a carousel photograph:** put the originals in a folder and run
  `python tools/make_images.py "path/to/originals"` (needs `pip install pillow`). It writes the
  web sizes into `assets/photos/`. File names are listed at the top of the script.
- **Please keep the JavaScript free of syntax newer than 2017** (no `?.` or `??`, no build step).
  That is what lets the opening animation run on older phones.

---

## How the page stays fast on older phones

- The first screen is a plain image, so the page is readable immediately. The animation is
  prepared a moment after loading (or as soon as the reader scrolls) and fades in over the
  identical first frame.
- The opening is drawn with WebGL. Phones in portrait load smaller, cropped pictures (about
  1.9 MB in total; desktop about 3.5 MB). If a device cannot keep up, the animation lowers its
  own resolution while the reader scrolls instead of stuttering. If the phone takes the GPU away
  (low memory, switching apps), the animation rebuilds itself when it gets it back. Without
  WebGL, readers see the 1610 scene fade into the present-day photograph instead.
- Nothing reads the page layout while scrolling; the carousel is scrolled natively by the
  browser; each photograph is only downloaded just before it is shown.
- Tested in Chromium, WebKit (Safari's engine) and Firefox, on phone and desktop sizes. The code
  runs on browsers back to Chrome 61, Safari 12 and Firefox 60. Pictures are WebP; browsers
  without WebP (Safari before 14, i.e. iPhones on iOS 13 or older) get JPEG copies of the
  opening and present-day photographs with the simple crossfade, and JPEG carousel photos.

---

Report by Pinaki Roy. Planning & Design: Zyma Islam. Photographs: Rashed Sumon, Mehedi Hasan,
Palash Khan. Chart: Abdullah Hel Bubun. Development: Mir Rownak. © 2026 The Daily Star.
