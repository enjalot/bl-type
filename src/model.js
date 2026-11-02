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
 for(const key of ['mode','assignment','tab'])if(({mode:['original','clean','vector'],assignment:['ransom','alphabet'],tab:['letters','styles','sources']}[key]).includes(value[key]))s[key]=value[key];
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

// fname is <BL system number>_<volume>_[<page>_<image on page>_]<title>_<year>.jpg; covers omit the page fields.
export function provenance(g){
 if(!g)return null;
 const m=/^(\d{9})_(\d+)_(?:(\d{6})_(\d+)_)?(.*)_([^_]*)\.jpg$/.exec(g.fname||''),flickrId=/\/(\d+)_[\da-f]+_o\.jpg$/.exec(g.source||'')?.[1]||null;
 return {id:g.id,systemNumber:m?.[1]||null,volume:m?Number(m[2]):null,page:m?.[3]?Number(m[3]):null,imageIndex:m?.[4]?Number(m[4]):null,
  title:(m?m[5]:String(g.fname||'').replace(/\.jpg$/,'')).replace(/\s+/g,' ').trim()||'Untitled',year:g.date||m?.[6]||null,
  flickrId,flickrPage:flickrId?'https://www.flickr.com/photos/britishlibrary/'+flickrId:null,image:g.source?g.source.replace(/^http:/,'https:'):null,
  derivation:g.derivation||null,sourceRows:g.sourceRows||(g.sourceRow!=null?[g.sourceRow]:[])};
}
export function shortTitle(p,max=60){return p.title.length>max?p.title.slice(0,max-1).trimEnd()+'…':p.title;}
export function citation(p){return [p.year||'undated',p.page?'p. '+p.page:null,p.imageIndex?'image '+p.imageIndex:null].filter(Boolean).join(' · ');}
// Mirrors the specimen: occurrence indices count every non-whitespace character.
export function composition(catalog,text,state){const out=[];let index=0;for(const char of Array.from(text)){if(/\s/.test(char))continue;const i=index++;out.push({char,index:i,glyph:choose(catalog,char,i,state)});}return out;}
// Unique tiles in order of first use, grouped by the book they came from.
export function sourceGroups(catalog,text,state){
 const tiles=new Map(),books=new Map();
 for(const {char,glyph} of composition(catalog,text,state)){if(!glyph)continue;let t=tiles.get(glyph.id);if(!t){t={glyph,prov:provenance(glyph),chars:[],count:0};tiles.set(glyph.id,t);const key=t.prov.systemNumber||glyph.fname;if(!books.has(key))books.set(key,{key,prov:t.prov,tiles:[]});books.get(key).tiles.push(t);}t.count++;if(!t.chars.includes(char))t.chars.push(char);}
 return {books:[...books.values()],tiles:[...tiles.values()]};
}
export function creditsText(catalog,groups){
 const lines=['BL Type specimen: image sources','British Library book images (CC0), via '+catalog.sourceDataset,''];
 for(const book of groups.books){lines.push(`${book.prov.title} (${book.prov.year||'undated'})${book.prov.systemNumber?' · BL system no. '+book.prov.systemNumber:''}`);for(const t of book.tiles)lines.push(`  ${t.chars.join(' ')}: ${citation(t.prov)}${t.prov.derivation?' · cut: '+t.prov.derivation:''}${t.prov.flickrPage?' · '+t.prov.flickrPage:''}`);lines.push('');}
 return lines.join('\n').trimEnd()+'\n';
}
