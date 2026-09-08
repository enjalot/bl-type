import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/home/enjalot/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(process.env.BASE_URL||'http://127.0.0.1:5186');await page.waitForSelector('.letter');
 assert.equal(await page.locator('.intro,#jitter').count(),0);
 await page.locator('#sentence').fill('Aa Bb Cc Dd');
 await page.screenshot({path:'artifacts/tone-before.png'});
 await page.locator('#normalize').check();
 await expect(page.locator('#render')).toHaveAttribute('data-tone','ready');
 assert(await page.locator('.letter img').evaluateAll(els=>els.every(el=>el.src.startsWith('data:image/png'))));
 await page.locator('.letter').first().click();await expect(page.locator('#letter-picker')).toHaveValue('A');
 await page.locator('#fade').fill('35');await page.locator('#fade').dispatchEvent('input');
 await expect(page.locator('.letter').first()).toHaveCSS('opacity','0.65');
 await page.screenshot({path:'artifacts/tone-normalized.png'});
 for(const mode of ['original','clean','vector']){
  await page.locator(`[data-mode="${mode}"]`).click();
  await expect(page.locator('#render')).toHaveAttribute('data-tone','ready');
  if(mode==='clean')assert((await page.locator('.letter').first().evaluate(el=>el.style.getPropertyValue('--tile'))).includes('data:image/png'));
  await page.locator('#export-format').selectOption('svg');const pending=page.waitForEvent('download');await page.locator('#export').click();
  const path='artifacts/tone-'+mode+'.svg';await(await pending).saveAs(path);const svg=await fs.readFile(path,'utf8');
  assert(svg.includes('opacity="0.65"'));assert(!svg.includes('/glyphs/'));
  assert(svg.includes(mode==='vector'?'<path':'data:image/png;base64,'));
 }
 await page.locator('[data-mode="clean"]').click();await page.locator('#export-format').selectOption('png');
 let pending=page.waitForEvent('download');await page.locator('#export').click();await(await pending).saveAs('artifacts/tone-clean.png');
 pending=page.waitForEvent('download');await page.locator('#save').click();await(await pending).saveAs('artifacts/tone-alphabet.json');
 await page.locator('#normalize').uncheck();await page.locator('#file').setInputFiles('artifacts/tone-alphabet.json');
 await expect(page.locator('#normalize')).toBeChecked();await expect(page.locator('#fade')).toHaveValue('35');
 await page.reload();await expect(page.locator('#normalize')).toBeChecked();await expect(page.locator('#fade')).toHaveValue('35');
 await page.locator('[data-mode="original"]').click();
 // Rapid toggle/typing must not allow an old normalization job to replace the new tiles.
 await page.evaluate(()=>{document.querySelector('#sentence').value='XYZ';document.querySelector('#sentence').dispatchEvent(new Event('input'));document.querySelector('#normalize').click();});
 await expect(page.locator('#render')).toHaveAttribute('data-tone','ready');
 await expect(page.locator('.letter img').first()).toHaveAttribute('src',/\.webp$/);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/tone-mobile.png'});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('PASS: tone normalization, fade, exports, restored settings, selection, toggle race, removed intro/wobble, mobile.');
}finally{await browser.close();}
