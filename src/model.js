export const DEFAULT_TEXT = 'The quick brown fox\njumps over the lazy dog.';
export const CODE_TEXT = 'const type = {\n  name: "found",\n  letters: [1, 2, 3]\n};';
export function hash(s) { let h=2166136261; for(const c of String(s)) {h^=c.charCodeAt(0);h=Math.imul(h,16777619);} return h>>>0; }
export function candidates(catalog,char,state) {
 const hits=catalog.sets[char.toUpperCase()]||[];
 return hits.filter(h=>!state.hidden.includes(char.toUpperCase()+':'+h.id)&& (state.cluster==='all'||catalog.glyphs[h.id].cluster===Number(state.cluster)));
}
export function choose(catalog,char,index,state) {
 const key=char.toUpperCase(), pinned=state.pins[key];
 if(pinned&&catalog.glyphs[pinned]&&catalog.sets[key]?.some(h=>h.id===pinned))return catalog.glyphs[pinned];
 let pool=candidates(catalog,key,state);
 if(!pool.length)pool=(catalog.sets[key]||[]).filter(h=>!state.hidden.includes(key+':'+h.id));
 if(!pool.length)return null;
 // Start from the strongest retrievals; the complete set remains available to curate.
 let reviewed=pool.filter(h=>catalog.reviewed?.[key]?.includes(h.id));
 if(!reviewed.length)reviewed=(catalog.sets[key]||[]).filter(h=>catalog.reviewed?.[key]?.includes(h.id)&&!state.hidden.includes(key+':'+h.id));
 if(reviewed.length)pool=reviewed;
 pool=pool.slice(0,state.depth||24);
 const offset=state.assignment==='alphabet'?key:key+':'+index;
 const hit=pool[hash(state.seed+':'+offset)%pool.length];
 return catalog.glyphs[hit.id];
}
export function initialState(){return {text:DEFAULT_TEXT,mode:'original',assignment:'ransom',seed:41,pins:{},hidden:[],cluster:'all',size:86,spacing:4,paper:'#f8f5ed',ink:'#24211d',threshold:145,depth:24,selected:'A',tab:'styles',normalize:false,fade:0};}
export function restore(value,catalog){
 const s=initialState(); if(!value||typeof value!=='object')return s;
 if(typeof value.text==='string')s.text=value.text.slice(0,2000);
 for(const key of ['mode','assignment','tab'])if(({mode:['original','clean','vector'],assignment:['ransom','alphabet'],tab:['letters','styles']}[key]).includes(value[key]))s[key]=value[key];
 for(const [key,min,max] of [['size',30,160],['spacing',-12,30],['fade',0,85],['threshold',30,230],['depth',1,180],['seed',0,1e9]])if(Number.isFinite(value[key]))s[key]=Math.max(min,Math.min(max,value[key]));
 for(const key of ['ink','paper'])if(/^#[\da-f]{6}$/i.test(value[key]))s[key]=value[key];
 if(typeof value.normalize==='boolean')s.normalize=value.normalize;
 // Legacy style-group filtering is retired: exploration no longer changes casting.
 s.cluster='all';
 if(catalog.sets[value.selected])s.selected=value.selected;
 if(value.pins&&typeof value.pins==='object')for(const [c,id] of Object.entries(value.pins))if(catalog.sets[c]?.some(h=>h.id===id))s.pins[c]=id;
 if(Array.isArray(value.hidden))s.hidden=value.hidden.filter(x=>typeof x==='string'&&x.length<40);
 return s;
}

export function glyphScale(c){if(/[.,]/.test(c))return c==='.'?.14:.24;if(/["\']/.test(c))return .24;if(c===':')return .55;if(c===';')return .65;if(c==='-'||c==='_')return .13;if(c==='=')return .36;if(/[+*]/.test(c))return .5;if(/[<>]/.test(c))return .65;return 1;}
