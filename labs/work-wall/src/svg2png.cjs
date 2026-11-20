const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const [root, out] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  const dirs = ['styles', 'layouts'].flatMap(d => fs.readdirSync(path.join(root, d)).map(x => path.join(root, d, x)));
  for (const d of dirs) {
    const pv = path.join(d, 'images/preview'); if (!fs.existsSync(pv)) continue;
    for (const f of fs.readdirSync(pv).filter(f => f.endsWith('.svg'))) {
      const o = path.join(out, `${path.basename(d)}--${f.replace('.svg', '.jpg')}`); if (fs.existsSync(o)) continue;
      await p.goto('file://' + path.join(pv, f)); await p.waitForTimeout(300);
      await p.screenshot({ path: o, type: 'jpeg', quality: 90 });
    }
  }
  await b.close();
})();
