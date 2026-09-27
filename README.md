# Deploy Plastic Remains

The site is built for `http://campaign.thedailystar.net/plastic-pollution/`.
All page assets use relative URLs and are published inside `plastic-pollution/`.

## GitHub and Vercel

1. Upload the project files to a GitHub repository. Do not upload `node_modules`, `checks`, `dist`, `_previous-version`, or original full-resolution photographs. The prepared GitHub upload ZIP contains only the files needed to build the site.
2. Import that repository into Vercel. Select **Other** as the framework and the directory containing `package.json` as the Root Directory.
3. The included `vercel.json` sets the build command to `npm run build` and Output Directory to `dist`. Vercel installs the locked npm dependencies automatically.
4. Open `https://YOUR-PROJECT.vercel.app/plastic-pollution/`. The domain root redirects there.

The Vercel preview deliberately retains the Daily Star canonical and social URLs. These URLs will resolve to the final article and OG image once the production folder is uploaded. Vercel deployment protection, if enabled in your account, must allow access before external Lighthouse or social preview tools can inspect a preview deployment.

## Existing Daily Star hosting

Run `npm ci` and `npm run build`, then upload the contents of `dist/plastic-pollution/` into the server's `plastic-pollution/` folder. No Node server is required in production. The site is static.

The domain owner should add the sitemap URL to the domain's existing root `robots.txt`; do not overwrite the shared campaign site's robots file. A sample root `robots.txt` is included in `dist` for the standalone Vercel deployment. The sitemap is also available inside the report folder.

Vercel cache and security headers are configured in `vercel.json`. Other hosting must configure equivalent response headers itself. If the final canonical changes to HTTPS, update the canonical, Open Graph, structured-data, sitemap and robots URLs together before rebuilding.

## Reproduce checks

```sh
npm ci
npm run build
npm run preview
```

In a second terminal, run `npm run audit`. It writes mobile and desktop Lighthouse reports to `checks/`. Chrome must be installed; optionally set `CHROME_PATH` to its executable. Local browser automation scripts use the workspace's Playwright installation.

The caption identifies the location and activity supplied with the photograph. The relative word “yesterday” is omitted because no calendar date was supplied. Article publication is shown as September 2026; structured data does not invent an exact publication day.

Configuration references: [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json), [Lighthouse scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring).
