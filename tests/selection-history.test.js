import test from 'node:test';
import assert from 'node:assert/strict';
import {SelectionHistory,selectionSnapshot} from '../src/selection-history.js';
const state=(pins={},extra={})=>({pins,hidden:[],seed:41,assignment:'ransom',...extra});
test('Undo/redo traverses individual and atomic multi-letter assignments',()=>{
 const h=new SelectionHistory(),a=state(),b=state({A:'1'}),c=state({A:'2',B:'3',C:'4'});
 h.record(a,b,'Use A');h.record(b,c,'Nearest alphabet');
 assert.equal(h.undoLabel,'Nearest alphabet');assert.deepEqual(h.undo(),b);assert.deepEqual(h.undo(),a);assert.equal(h.undo(),null);
 assert.deepEqual(h.redo(),b);assert.deepEqual(h.redo(),c);assert.equal(h.redo(),null);
});
test('A new assignment clears redo; a no-op preserves redo',()=>{
 const h=new SelectionHistory(),a=state(),b=state({A:'1'});h.record(a,b,'Use A');h.undo();
 assert.equal(h.record(a,a,'Nothing'),false);assert.equal(h.redoLabel,'Use A');
 h.record(a,state({B:'2'}),'Use B');assert.equal(h.redo(),null);
});
test('History restores hidden exclusions, random seed and casting mode without aliasing',()=>{
 const h=new SelectionHistory(),before=state({A:'1'}),after=state({}, {hidden:['A:1'],seed:42,assignment:'alphabet'});h.record(before,after,'Hide and shuffle');before.pins.A='changed';
 const undone=h.undo();assert.equal(undone.pins.A,'1');undone.pins.A='changed again';assert.deepEqual(h.redo(),after);assert.equal(h.undo().pins.A,'1');
});
test('Reload validates continuity and retains both stack directions with a bounded history',()=>{
 const h=new SelectionHistory(undefined,undefined,undefined,2);let current=state();
 for(let i=0;i<4;i++){const next=state({A:String(i)});h.record(current,next,'Choice '+i);current=next;}
 assert.equal(h.past.length,2);current=h.undo();const restored=new SelectionHistory(h.serialize(),current);assert.equal(restored.undoLabel,'Choice 2');assert.equal(restored.redoLabel,'Choice 3');assert.deepEqual(restored.redo(),state({A:'3'}));
 const invalid=new SelectionHistory(h.serialize(),state({A:'unrelated'}));assert.equal(invalid.undo(),null);assert.equal(invalid.redo(),null);
});
test('Equivalent maps and exclusion sets do not create spurious steps',()=>{
 const h=new SelectionHistory();assert.equal(h.record(state({A:'1',B:'2'},{hidden:['A:3','B:4']}),state({B:'2',A:'1'},{hidden:['B:4','A:3','A:3']}),'No-op'),false);
 assert.deepEqual(selectionSnapshot(state({B:'2',A:'1'})).pins,{A:'1',B:'2'});
});
