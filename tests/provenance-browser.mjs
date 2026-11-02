import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const base=(process.env.BASE_URL||'http://gsv.local:5186').replace(/\/?$/,'/');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/home/enjalot/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:1100}});await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:new URL(base).origin});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base);await page.waitForSelector('#render .letter');
await page.locator('[data-preset="pangram"]').click();await page.locator('#assignment').selectOption('ransom');

// Clicking one occurrence rings that copy and tints the other copies of the letter.
const os=page.locator('#render .letter[data-letter="O"]');assert((await os.count())>=4);
const second=os.nth(1),id=await second.getAttribute('data-id');
assert.match(await second.getAttribute('title'),/^O · \d{4}/);
await second.click();
await expect(page.locator('#render .mark-inspected')).toHaveCount(1);await expect(page.locator('#render .mark-same')).toHaveCount(await os.count()-1);
const ring=await page.locator('#render .mark-inspected').boundingBox(),box=await second.boundingBox();assert(Math.abs(ring.x-box.x)<1&&Math.abs(ring.y-box.y)<1);
await expect(page.locator('.source-title b')).toHaveText('#'+id);
assert.equal(await page.evaluate(()=>location.hash),'#tile=O:'+id);

// The inspector names the book and links its Flickr page.
const catalog=await page.evaluate(async()=>(await fetch(document.querySelector('#render img').src.replace(/glyphs\/.*$/,'data/catalog.json'))).json()),glyph=catalog.glyphs[id];
await expect(page.locator('.prov-title')).not.toBeEmpty();await expect(page.locator('.prov-cite')).toContainText(glyph.date);
if(glyph.source)await expect(page.locator('.prov-links a').first()).toHaveAttribute('href',/^https:\/\/www\.flickr\.com\/photos\/britishlibrary\/\d+$/);
await page.locator('#copy-tile-link').click();assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/#tile=O:\d+$/);

// Inspecting another candidate moves the ring off the clicked copy.
const other=page.locator('#candidates .candidate:not(.inspected)').first(),otherId=await other.getAttribute('data-id');await other.click();
assert.equal(await page.evaluate(()=>location.hash),'#tile=O:'+otherId);
const onPage=await page.locator(`#render .letter[data-letter="O"][data-id="${otherId}"]`).count();await expect(page.locator('#render .mark-inspected')).toHaveCount(onPage);

// A shared link opens that tile, including one not currently in the text.
const target=catalog.sets.Q.at(-1).id,linked=await context.newPage();await linked.goto(base+'#tile=Q:'+target);await linked.waitForSelector('#source-detail .source-title');
await expect(linked.locator('#selected-char')).toHaveText('Q');await expect(linked.locator('.source-title b')).toHaveText('#'+target);
await linked.evaluate(t=>{location.hash='#tile=A:'+t;},target);await linked.waitForTimeout(100);await expect(linked.locator('#selected-char')).toHaveText('Q');// a tile from another letter's set is ignored
await linked.goto(base+'#tile=Z:not-a-tile');await linked.waitForSelector('#render .letter');assert.equal(errors.length,0);await linked.close();

// Sources tab lists each tile once, grouped by book, and stays in sync with the text.
await page.locator('[data-tab="sources"]').click();
const counts=await page.evaluate(()=>{const ids=[...document.querySelectorAll('#render .letter')].map(e=>e.dataset.id);return {letters:ids.length,unique:new Set(ids).size};});
await expect(page.locator('.source-tile')).toHaveCount(counts.unique);await expect(page.locator('.sources-head p')).toContainText(`${counts.letters} letters from ${counts.unique} images`);
await page.locator('#copy-credits').click();const credits=await page.evaluate(()=>navigator.clipboard.readText());assert.match(credits,/British Library book images \(CC0\)/);assert.equal((credits.match(/^  /gm)||[]).length,counts.unique);
const tile=page.locator('.source-tile button').nth(2),tileId=await tile.getAttribute('data-source-id');await tile.click();await expect(page.locator('.source-title b')).toHaveText('#'+tileId);await expect(page.locator(`.source-tile button[data-source-id="${tileId}"]`)).toHaveClass(/inspected/);
await page.locator('#sentence').fill('Ab');await expect(page.locator('.source-tile')).toHaveCount(2);
const download=page.waitForEvent('download');await page.locator('#download-credits').click();assert.equal((await download).suggestedFilename(),'bl-type-sources.txt');
await page.reload();await expect(page.locator('[data-tab="sources"]')).toHaveClass(/active/);await expect(page.locator('.source-tile')).toHaveCount(2);

// SVG export carries per-glyph sources.
await page.locator('#export-format').selectOption('svg');const svgDownload=page.waitForEvent('download');await page.locator('#export').click();
const svg=await(await svgDownload).createReadStream().then(async s=>{let t='';for await(const c of s)t+=c;return t;});
assert.match(svg,/<desc>BL Type specimen: image sources/);assert.equal((svg.match(/data-source-id=/g)||[]).length,2);assert.match(svg,/<g [^>]*><title>A · /);

await page.setViewportSize({width:390,height:844});await page.locator('#sentence').fill('Found type');await page.locator('.case').scrollIntoViewIfNeeded();
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'artifacts/sources-mobile.png',fullPage:true});
await page.setViewportSize({width:1440,height:1100});await page.locator('#render .letter').nth(1).click();await page.screenshot({path:'artifacts/provenance.png'});
assert.deepEqual(errors,[]);console.log('PASS: occurrence ring and tint, provenance inspector, Flickr links, tile hash links and copy, invalid hashes, Sources tab grouping/sync/inspect/credits/persistence, SVG source metadata, mobile.');await browser.close();
