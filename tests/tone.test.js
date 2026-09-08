import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePixels,toneLevels} from '../src/tone.js';
import {restore} from '../src/model.js';
const pixels=values=>new Uint8ClampedArray(values.flatMap(v=>[v,v,v,255]));
test('Faded and dark versions of a scan normalize to the same tones',()=>{
 const dark=pixels([20,20,70,120,...Array(16).fill(220)]);
 const faded=pixels([150,150,170,190,...Array(16).fill(230)]);
 assert.deepEqual(normalizePixels(dark),normalizePixels(faded));
 const clean=normalizePixels(faded,toneLevels(faded),true);
 assert.equal(clean[3],255);assert.equal(clean.at(-1),0);assert(clean[11]>0&&clean[11]<255);
});
test('Uniform and nearly uniform tiles are not amplified',()=>{
 for(const values of [[200,200,200],[198,200,201]])assert.deepEqual(normalizePixels(pixels(values)),pixels(values));
 assert.deepEqual(toneLevels(new Uint8ClampedArray(8)),{black:0,white:255});
});
test('Tone settings survive restore, are bounded, and legacy wobble is discarded',()=>{
 const catalog={sets:{},glyphs:{}};
 const state=restore({normalize:true,fade:45,jitter:12},catalog);
 assert.equal(state.normalize,true);assert.equal(state.fade,45);assert(!('jitter' in state));
 assert.equal(restore({normalize:'true',fade:900},catalog).normalize,false);
 assert.equal(restore({fade:900},catalog).fade,85);
});
