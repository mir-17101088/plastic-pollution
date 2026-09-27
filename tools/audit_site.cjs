const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const { default: lighthouse } = await import('lighthouse');
  const { launch } = await import('chrome-launcher');
  let chromePath = process.env.CHROME_PATH;
  if (!chromePath) {
    try { chromePath = require('C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright').chromium.executablePath(); } catch {}
  }
  const chrome = await launch({ chromePath, chromeFlags: ['--headless', '--no-sandbox'] });
  const dest = path.resolve(__dirname, '../checks');
  fs.mkdirSync(dest, { recursive: true });
  try {
    for (const mode of process.env.AUDIT_MODE ? [process.env.AUDIT_MODE] : ['mobile', 'desktop']) {
      const options = { port: chrome.port, output: ['html', 'json'], logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] };
      const config = mode === 'desktop' ? (await import('lighthouse/core/config/desktop-config.js')).default : undefined;
      const result = await lighthouse(process.env.AUDIT_URL || 'http://127.0.0.1:4174/plastic-pollution/', options, config);
      fs.writeFileSync(path.join(dest, `lighthouse-${mode}.html`), result.report[0]);
      fs.writeFileSync(path.join(dest, `lighthouse-${mode}.json`), result.report[1]);
      fs.writeFileSync(path.join(dest, `trace-${mode}.json`), JSON.stringify(result.artifacts.Trace));
      console.log(mode, Object.fromEntries(Object.entries(result.lhr.categories).map(([k,v])=>[k, Math.round(v.score*100)])));
      console.log('Metrics', Object.fromEntries(['first-contentful-paint','largest-contentful-paint','total-blocking-time','cumulative-layout-shift'].map(k=>[k,result.lhr.audits[k].displayValue])));
      console.log('Failed audits', Object.values(result.lhr.audits).filter(a=>a.score!==null && a.score<.9).map(a=>({id:a.id,value:a.displayValue,title:a.title})));
    }
  } finally {
    try { await chrome.kill(); } catch (error) {
      if (error.code !== 'EPERM') throw error;
      console.warn('Audit complete; Windows retained the temporary Chrome profile.');
    }
  }
})().catch(e=>{ console.error(e); process.exitCode=1; });
