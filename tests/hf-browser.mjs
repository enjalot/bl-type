import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/home/enjalot/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 await page.goto('https://huggingface.co/spaces/enjalot/bl-type');
 const app=page.frameLocator('iframe.space-iframe');
 await expect(app.locator('#sentence')).toBeVisible({timeout:30000});
 await app.locator('#sentence').fill('Found type');await app.locator('#normalize').check();
 await expect(app.locator('#render')).toHaveAttribute('data-tone','ready');
 await expect(app.locator('.source-link')).toHaveAttribute('href','https://github.com/enjalot/bl-type');
 await app.locator('#style-map').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
 await expect(app.locator('.nearest-mini')).toHaveCount(26,{timeout:30000});
 await app.locator('#assign-nearest').click();await expect(app.locator('#lock-count')).toHaveText('26 pinned');
 await app.locator('#undo-use').click();await expect(app.locator('#lock-count')).toHaveText('0 pinned');
 await app.locator('#redo-use').click();await expect(app.locator('#lock-count')).toHaveText('26 pinned');
 await app.locator('[data-mode="clean"]').click();await expect(app.locator('#render')).toHaveAttribute('data-tone','ready');
 await app.locator('#export-format').selectOption('png');
 const pending=page.waitForEvent('download');await app.locator('#export').click();await(await pending).saveAs('artifacts/hf-wrapper-export.png');
 assert((await fs.stat('artifacts/hf-wrapper-export.png')).size>1000);
 const frame=page.frames().find(frame=>frame.url().includes('enjalot-bl-type.static.hf.space'));
 assert(frame,'HF embeds the static app');
 const broken=await frame.locator('img').evaluateAll(els=>els.filter(e=>e.complete&&e.naturalWidth===0).map(e=>e.src));assert.deepEqual(broken,[]);
 await app.locator('#sentence').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/hf-wrapper.png'});
 console.log('PASS: public HF iframe, GCS images, canvas normalization, style matching, bulk assignment, undo/redo, PNG download, GitHub backlink.');
}finally{await browser.close();}
