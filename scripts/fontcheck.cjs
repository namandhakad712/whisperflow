const { chromium } = require('playwright');
const { createServer } = require('http');
const { readFile } = require('fs/promises');
const path = require('path');
const { bridgeStubFactory } = require('/home/z/my-project/scripts/console-qa-stub.cjs');
const OUT = '/home/z/my-project/apps/desktop/out/renderer';
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.json':'application/json'};
(async () => {
  const server = createServer(async (req, res) => {
    try {
      let p = req.url.split('?')[0];
      if (p === '/') p = '/settings.html';
      const file = path.join(OUT, p);
      const data = await readFile(file);
      if (file.endsWith('settings.html')) {
        const html = data.toString().replace('<head>', `<head><script>window.whisperflowReady=new Promise(r=>{ const bridgeStub = ${bridgeStubFactory.toString()}; const b = bridgeStub(); window.whisperflow = b.whisperflow; window.whisperflowExtras = b.whisperflowExtras; r(); })</script>`);
        res.writeHead(200, {'content-type':'text/html'}); res.end(html); return;
      }
      res.writeHead(200, {'content-type': MIME[path.extname(file)] || 'application/octet-stream'}); res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(4749, r));
  const browser = await chromium.launch({ args: ['--no-sandbox','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 } });
  for (const theme of ['lab','pressroom','nightink','letterpress','lino','daylight']) {
    await page.goto('http://localhost:4749/');
    await page.evaluate((t) => localStorage.setItem('wf-theme', t), theme);
    await page.evaluate(() => localStorage.setItem('wf-onboarded', '1'));
    await page.reload();
    await page.waitForSelector('.rail-item', { timeout: 8000 });
    const info = await page.evaluate(() => {
      const h = document.querySelector('.wf-display') || document.querySelector('h1') || document.querySelector('h2');
      const body = document.body;
      return {
        theme: document.documentElement.dataset.theme,
        display: h ? getComputedStyle(h).fontFamily.slice(0, 40) : null,
        body: getComputedStyle(body).fontFamily.slice(0, 40),
        serifLoaded: document.fonts.check('16px "Instrument Serif"'),
        specimenCount: document.querySelectorAll('.ascii-specimen').length,
        pickerCards: document.querySelectorAll('[aria-pressed]').length,
      };
    });
    console.log(theme.padEnd(13), JSON.stringify(info));
  }
  await browser.close(); server.close();
})();
