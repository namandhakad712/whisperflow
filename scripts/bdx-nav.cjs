// Map bestdesignsonx.com categories + screenshot the wall for VLM study.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 2000 } });
  await page.goto('https://bestdesignsonx.com/', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(7000);
  await page.screenshot({ path: '/tmp/refs2/bdx-wall.png' });
  // categories in nav?
  const nav = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a')].map((a) => ({ t: (a.textContent||'').trim(), h: a.getAttribute('href') })).filter((l) => l.t && l.h);
    return links.slice(0, 60);
  });
  console.log(JSON.stringify(nav, null, 1));
  await browser.close();
})();
