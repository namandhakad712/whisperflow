// Render bestdesignsonx.com (SPA) and dump its visible card text.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 2200 } });
  await page.goto('https://bestdesignsonx.com/', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(6000);
  // scroll a few screens to trigger lazy loads
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 1600);
    await page.waitForTimeout(1200);
  }
  const items = await page.evaluate(() => {
    const out = [];
    // grab any repeated card-ish elements' text
    const sel = ['article', '[class*="card"]', '[class*="Card"]', 'a[href*="/status/"]', 'h2', 'h3'];
    for (const s of sel) {
      document.querySelectorAll(s).forEach((el) => {
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (t && t.length > 3 && t.length < 220) out.push(t);
      });
    }
    return [...new Set(out)];
  });
  console.log(JSON.stringify(items.slice(0, 120), null, 1));
  await browser.close();
})();
