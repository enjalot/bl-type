// History concerns glyph assignments, exclusions and random casting, not text editing.
export function selectionSnapshot(state){
 return {pins:Object.fromEntries(Object.entries(state.pins).sort(([a],[b])=>a.localeCompare(b))),hidden:[...new Set(state.hidden)].sort(),seed:state.seed,assignment:state.assignment};
}
const copy=value=>structuredClone(value);
const equal=(a,b)=>JSON.stringify(selectionSnapshot(a))===JSON.stringify(selectionSnapshot(b));
export class SelectionHistory{
 constructor(saved,current,sanitize=x=>x,limit=100){
  this.past=[];this.future=[];this.limit=limit;
  try{
   if(saved?.version!==1)return;
   const parse=entries=>entries.slice(-limit).map(e=>{if(!e||typeof e.label!=='string'||!e.before||!e.after)throw Error('Invalid history');return {label:e.label.slice(0,100),before:selectionSnapshot(sanitize(e.before)),after:selectionSnapshot(sanitize(e.after))};});
   const past=parse(saved.past),future=parse(saved.future);
   let cursor=selectionSnapshot(current);
   for(const e of [...past].reverse()){if(!equal(e.after,cursor))throw Error('History no longer matches');cursor=e.before;}
   cursor=selectionSnapshot(current);
   for(const e of [...future].reverse()){if(!equal(e.before,cursor))throw Error('Redo no longer matches');cursor=e.after;}
   this.past=past;this.future=future;
  }catch{this.past=[];this.future=[];}
 }
 record(before,after,label){
  if(equal(before,after))return false;
  this.past.push({before:selectionSnapshot(before),after:selectionSnapshot(after),label});
  if(this.past.length>this.limit)this.past.shift();this.future=[];return true;
 }
 undo(){const entry=this.past.pop();if(!entry)return null;this.future.push(entry);return copy(entry.before);}
 redo(){const entry=this.future.pop();if(!entry)return null;this.past.push(entry);return copy(entry.after);}
 get undoLabel(){return this.past.at(-1)?.label;}
 get redoLabel(){return this.future.at(-1)?.label;}
 serialize(){return {version:1,past:copy(this.past),future:copy(this.future)};}
}
