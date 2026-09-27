// Ship only browser assets, never source photographs, notes or QA files.
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist', 'plastic-pollution');
fs.mkdirSync(out, { recursive: true });
for (const name of ['index.html', 'logo.svg', 'favicon.svg', 'sitemap.xml']) {
  fs.copyFileSync(path.join(root, name), path.join(out, name));
}
for (const dir of ['hero', 'fonts', 'icons', 'report']) {
  fs.cpSync(path.join(root, 'assets', dir), path.join(out, 'assets', dir), { recursive: true });
}
for (const dir of ['css', 'js']) {
  for (const name of fs.readdirSync(path.join(root, dir))) {
    if (!name.endsWith(`.${dir}`)) continue;
    esbuild.buildSync({ entryPoints: [path.join(root, dir, name)], outfile: path.join(out, dir, name),
      minify: true, target: 'es2020', legalComments: 'none' });
  }
}
for (const name of ['robots.txt', 'sitemap.xml']) fs.copyFileSync(path.join(root, name), path.join(root, 'dist', name));
console.log('Production files: dist/plastic-pollution/');
