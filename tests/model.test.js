import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { choose, initialState, restore, candidates, glyphScale, provenance, composition, sourceGroups, creditsText } from '../src/model.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../public/data/catalog.json',import.meta.url)));
test('Every supported character has a usable reviewed seed and existing assets',()=>{
 for(const [c,hits] of Object.entries(catalog.sets)){
  assert(hits.length>0,c);assert(catalog.reviewed[c]?.length,c);
  for(const id of catalog.reviewed[c]){assert(hits.some(h=>h.id===id),c+':'+id);for(const ext of ['webp','png','svg'])assert(fs.existsSync(new URL('../public/glyphs/'+id+'.'+ext,import.meta.url)));}
  assert(catalog.reviewed[c].includes(choose(catalog,c,12,initialState()).id),c);
 }
});
test('Pins survive shuffle, case and a conflicting family; hidden choices are excluded',()=>{
 const s=initialState(),id=catalog.reviewed.A[0];s.pins.A=id;s.cluster=(catalog.glyphs[id].cluster+1)%8;s.seed=92;
 assert.equal(choose(catalog,'a',45,s).id,id);delete s.pins.A;s.hidden.push('A:'+id);s.cluster='all';
 assert(!candidates(catalog,'A',s).some(h=>h.id===id));for(let i=0;i<100;i++)assert.notEqual(choose(catalog,'A',i,s).id,id);
});
test('Stable alphabet and random occurrences are deterministic',()=>{
 const s=initialState();s.assignment='alphabet';assert.equal(choose(catalog,'A',1,s).id,choose(catalog,'A',2,s).id);
 s.assignment='ransom';assert(new Set(Array.from({length:25},(_,i)=>choose(catalog,'A',i,s).id)).size>1);
 assert.equal(choose(catalog,'A',8,s).id,choose(catalog,'A',8,{...s}).id);
});
test('Imported files cannot introduce invalid pins or layout values',()=>{
 const s=restore({text:'hello',size:999,mode:'evil',paper:'url(evil)',pins:{A:'nonsense',B:catalog.reviewed.B[0]},hidden:['A:3',{},null]},catalog);
 assert.equal(s.size,160);assert.equal(s.mode,'original');assert.equal(s.paper,initialState().paper);assert(!s.pins.A);assert.equal(s.pins.B,catalog.reviewed.B[0]);assert.deepEqual(s.hidden,['A:3']);
});
test('Unsupported characters are explicit fallbacks; punctuation has appropriate scale',()=>{
 assert.equal(choose(catalog,'☃',0,initialState()),null);assert(glyphScale('.')<glyphScale(':'));assert(glyphScale(':')<glyphScale('A'));
});
test('Provenance parses BL filenames, Flickr ids and derived cuts',()=>{
 const p=provenance(catalog.glyphs['509411']);
 assert.equal(p.systemNumber,'002976927');assert.equal(p.page,84);assert.equal(p.imageIndex,2);assert.equal(p.year,'1896');assert.equal(p.title,'Every day Characters Illustrated by C Aldin');
 assert.equal(p.flickrPage,'https://www.flickr.com/photos/britishlibrary/11141189943');assert(p.image.startsWith('https://'));
 const cover=provenance(catalog.glyphs['10745']);assert.equal(cover.systemNumber,'000976439');assert.equal(cover.page,null);assert.equal(cover.title,'Caribbean Verses');assert.equal(cover.flickrPage,null);
 const cut=provenance(catalog.glyphs['2000059']);assert(cut.derivation);assert.deepEqual(cut.sourceRows,[391136,297844]);
 let parsed=0;for(const g of Object.values(catalog.glyphs)){const q=provenance(g);if(q.systemNumber)parsed++;assert.equal(Boolean(q.flickrPage),Boolean(g.source));}
 assert.equal(parsed,Object.keys(catalog.glyphs).length);
});
test('Source groups follow specimen occurrence order and count repeats',()=>{
 const s=initialState(),text='Aa b\nA';const comp=composition(catalog,text,s);
 assert.deepEqual(comp.map(x=>x.index),[0,1,2,3]);assert.equal(comp[3].glyph.id,choose(catalog,'A',3,s).id);
 const groups=sourceGroups(catalog,text,s);assert.equal(groups.tiles.reduce((n,t)=>n+t.count,0),4);
 s.pins.A=catalog.reviewed.A[0];const pinned=sourceGroups(catalog,text,s).tiles.find(t=>t.glyph.id===s.pins.A);assert.equal(pinned.count,3);assert.deepEqual(pinned.chars,['A','a']);
 assert.match(creditsText(catalog,groups),/British Library book images/);
});
