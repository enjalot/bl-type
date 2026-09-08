import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {rankMatches,visiblePoint} from '../src/style-math.js';
import {restore} from '../src/model.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../public/data/catalog.json',import.meta.url)));
const map=JSON.parse(fs.readFileSync(new URL('../public/data/style-map.json',import.meta.url)));
test('Style map has one real source embedding per glyph and valid projections/groups',()=>{
 assert.equal(new Set(map.points.map(p=>p.id)).size,map.points.length);
 for(const p of map.points){assert(catalog.sets[p.letter].some(h=>h.id===p.id));assert(!catalog.glyphs[p.id].derivation);}
 for(const xy of Object.values(map.coords)){assert.equal(xy.length,map.points.length);assert(xy.every(p=>p.length===2&&p.every(Number.isFinite)));}
 for(const layer of map.layers){assert.equal(layer.labels.length,map.points.length);assert.equal(layer.strengths.length,map.points.length);assert.equal(layer.noise,layer.labels.filter(l=>l===-1).length);}
 const binary=fs.readFileSync(new URL('../public'+map.vectors.url,import.meta.url));assert.equal(binary.byteLength,map.vectors.bytes);
});
test('Exact cosine matching is letter-wise, excludes hidden/self and honors review filter',()=>{
 const points=[{id:'1',letter:'A',reviewed:true},{id:'2',letter:'B',reviewed:false},{id:'3',letter:'B',reviewed:true},{id:'4',letter:'C',reviewed:true},{id:'1',letter:'D',reviewed:true}];
 const vectors=Float32Array.from([1,0, 1,0, .8,.6, 0,1, 1,0]);
 let r=rankMatches(vectors,points,2,0);assert.equal(r.B[0].index,1);assert.equal(r.B[1].index,2);assert.equal(r.C[0].score,0);assert.equal(r.A.length,0);assert.equal(r.D.length,0);
 r=rankMatches(vectors,points,2,0,{reviewedOnly:true,hidden:['C:4']});assert.equal(r.B[0].index,2);assert.equal(r.B.length,1);assert.equal(r.C.length,0);
});
test('Map filtering is independent of glyph pinning and legacy study filters are cleared',()=>{
 const point={id:'1',letter:'A',reviewed:true};assert(visiblePoint(point,0,{letter:'A',group:'all'},[2]));assert(!visiblePoint(point,0,{letter:'B'},[2]));assert(!visiblePoint(point,0,{group:'1'},[2]));assert(!visiblePoint(point,0,{},[2],['A:1']));
 const id=catalog.reviewed.A[0],s=restore({cluster:'2',pins:{A:id}},catalog);assert.equal(s.cluster,'all');assert.equal(s.pins.A,id);
});
test('Browser cosine rankings agree with independent NumPy oracles on real embeddings',()=>{
 const cases=JSON.parse(fs.readFileSync(new URL('./fixtures/style-neighbor-oracle.json',import.meta.url)));
 const bytes=fs.readFileSync(new URL('../public'+map.vectors.url,import.meta.url));const vectors=new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 for(const {anchor,expected}of cases){const actual=rankMatches(vectors,map.points,1152,anchor);for(const c of map.letters){assert.equal(actual[c].length,5);for(let k=0;k<5;k++)assert(Math.abs(actual[c][k].score-expected[c][k].score)<2e-6,`${anchor} ${c} rank ${k}`);}}
});
