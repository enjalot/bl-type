import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { choose, initialState, restore, candidates, glyphScale } from '../src/model.js';
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
