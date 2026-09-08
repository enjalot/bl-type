import {assetUrl} from './assets.js';
import './style.css';
import {DEFAULT_TEXT,CODE_TEXT,choose,candidates,initialState,restore,glyphScale} from './model.js';
import {normalizedTile} from './tone-renderer.js';
import opentype from 'opentype.js';
import {StyleExplorer} from './style-explorer.js';
import {SelectionHistory,selectionSnapshot} from './selection-history.js';
const $=s=>document.querySelector(s), app=$('#app');
let toneGeneration=0;
let catalog, paths={}, state, displayCount=60, imageCache=new Map(), explorer=null, inspected={}, history;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n.toLocaleString();
const icon={shuffle:'↝',arrow:'↗',lock:'●'};
try {
 const r=await fetch(assetUrl('data/catalog.json'));if(!r.ok)throw Error('The letter catalogue has not been extracted yet. Run the extraction command in README.md.');catalog=await r.json();
 let saved;try{saved=JSON.parse(localStorage.getItem('bl-type-v1'));}catch{}
 state=restore(saved,catalog);history=new SelectionHistory(saved?.selectionHistory,state,value=>restore(value,catalog));init();
}catch(e){app.innerHTML=`<div class="fatal"><h1>The type case is closed.</h1><p>${esc(e.message)}</p><button onclick="location.reload()">Try again</button></div>`;}
function persist(){try{localStorage.setItem('bl-type-v1',JSON.stringify({...state,selectionHistory:history.serialize()}));}catch{toast('Browser storage is full. Save your alphabet as JSON.');}}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),4000);}
function init(){
 explorer?.dispose();explorer=null;
 app.innerHTML=`<header><a class="brand" href="./" aria-label="BL Type home"><span class="brand-mark">B<span>L</span></span><b>BL TYPE</b><span class="brand-sub">AN EXPERIMENTAL TYPE FOUNDRY</span></a><nav><button id="open-map">Explore styles ↗</button><button id="about">How it works</button><button id="save">Save alphabet ↓</button><button id="import">Open</button><input id="file" type="file" accept="application/json,.json" hidden></nav></header>
 <main>
 <div class="workspace"><section class="composer"><div class="panel-bar"><span class="eyebrow">01 / COMPOSE YOUR TEXT</span><div class="segments" id="modes">${[['original','Original'],['clean','Paper off'],['vector','Vector']].map(([v,l])=>`<button data-mode="${v}">${l}</button>`).join('')}</div></div>
 <div class="specimen" id="specimen"><div class="specimen-top"><span id="specimen-label"></span><span>CLICK A LETTER TO RECAST IT ↘</span></div><div id="render" aria-label="Composed image lettering"></div><div class="specimen-bottom"><span id="render-note"></span><span id="seed-label"></span></div></div>
 <div class="input-area"><div class="input-heading"><label for="sentence">Your words</label><div><button data-preset="pangram">Pangram</button><button data-preset="code">Code specimen</button></div></div><textarea id="sentence" maxlength="2000" spellcheck="false" aria-label="Your words"></textarea></div>
 <div class="controls"><label>LETTER HEIGHT <span><input id="size" type="range" min="30" max="160"><output id="size-value"></output></span></label><label>TRACKING <span><input id="spacing" type="range" min="-12" max="30"><output id="spacing-value"></output></span></label><label class="color-control">INK<input id="ink" type="color"></label><label class="color-control">PAPER<input id="paper" type="color"></label></div>
 <div class="tone-controls"><label class="normalize-control"><input id="normalize" type="checkbox"> Normalize contrast</label><label class="fade-control" for="fade">Fade <input id="fade" type="range" min="0" max="85" step="1"><output id="fade-value"></output></label><p id="tone-note"></p></div>
 <div class="compose-actions"><span class="history-controls"><button data-history="undo" aria-keyshortcuts="Control+Z Meta+Z" aria-label="Undo assignments">↶</button><button data-history="redo" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y" aria-label="Redo assignments">↷</button></span><label class="assignment"><select id="assignment"><option value="ransom">Mix each occurrence</option><option value="alphabet">One image per letter</option></select></label><button id="shuffle" class="primary">↝ &nbsp; Shuffle the type</button><div class="export"><select id="export-format" aria-label="Export format"><option value="png">PNG image</option><option value="svg">SVG specimen</option><option value="otf">OTF font</option></select><button id="export">Export ↓</button></div></div></section>
 <aside class="inspector"><div class="panel-bar"><span class="eyebrow">02 / CHOOSE A LETTER</span><button id="unlock" title="Unpin this letter">Unpin</button></div><div class="inspector-heading"><span id="selected-char"></span><div><b id="candidate-count"></b><p>Click a tile to inspect it. Use applies it to your text.</p></div></div><div class="filter-row"><label>Letter <select id="letter-picker" aria-label="Choose letter">${Object.keys(catalog.sets).map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label><span id="pin-status"></span></div><div id="source-detail"></div><div id="candidates" class="candidate-grid"></div><button id="more" class="more">Show more candidates +</button><p class="candidate-disclaimer">Search finds possibilities. Seed tiles were visually checked. The wider pool includes wrong letters. Select a tile to inspect it; hide it below if it doesn’t belong.</p></aside></div>
 <section class="case"><div class="case-heading"><div class="tabs"><button data-tab="letters">Your alphabet</button><button data-tab="styles">Explore styles</button></div><div><span id="lock-count"></span><span class="history-controls"><button id="undo-use" data-history="undo" aria-keyshortcuts="Control+Z Meta+Z" aria-label="Undo assignments">↶ Undo</button><button id="redo-use" data-history="redo" aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y" aria-label="Redo assignments">↷ Redo</button></span><button id="unlock-all">Unpin all</button></div></div><div id="case-content"></div></section>
 <footer><span>BL TYPE <span class="footer-dot">·</span> OLD INK, NEW SENTENCES. <a class="source-link" href="https://github.com/enjalot/bl-type" target="_blank" rel="noreferrer">Source on GitHub ↗</a></span><span>British Library book images / CC0 source collection / Independent experiment</span></footer></main>
 <dialog id="notes"><button class="close" id="close-notes" aria-label="Close field notes">×</button><div class="eyebrow">NOTES FROM THE TYPE CASE</div><h2>Letters, with a past.</h2><p>These images come from the British Library’s digitised books, via Daniel van Strien’s <a href="${catalog.sourceDataset}" target="_blank" rel="noreferrer">British Library Book Images dataset</a>. This is an independent experiment.</p><h3>What’s in the drawer?</h3><p>${catalog.retrieval.queries} text searches over all ${fmt(catalog.corpusSize)} images returned ${fmt(catalog.retrieval.uniqueCandidates)} unique candidates. Up to 180 distinct source tiles per character are included here. This is a broad retrieval pass, not an exhaustive or OCR-verified alphabet. Lowercase input uses the same uppercase image sets. Punctuation and digits include reviewed source cuts and collages. Each cut records its source and transformation.</p><p>${esc(catalog.curation||'')}</p><h3>Three ways to print</h3><p><b>Original</b> preserves the locally processed 256 px source thumbnail, or the labelled cut when a derived tile is selected. <b>Paper off</b> normalizes the paper and uses luminance as transparency. <b>Vector</b> traces the dark shapes with per-image Otsu thresholding, preserving ornament and holes. No detail is invented beyond the thumbnail resolution.</p><p><b>Normalize contrast</b> estimates the ink and paper tones of each tile and stretches them to black and white. It preserves texture while balancing faded scans; original mode becomes grayscale. <b>Fade</b> softens tiles against the chosen paper. Vector ink is already uniform. These controls affect the specimen and SVG/PNG exports; source previews remain unchanged.</p><h3>Style is an experiment</h3><p>The new style map uses UMAP on letter-centered SigLIP vectors. Nearest matches use the full 1,152-dimensional residuals, and EVoC groups those same vectors. Map filters only affect exploration. Use buttons explicitly pin a tile; pinned letters always win.</p><h3>Take it with you</h3><p>SVG and PNG export the current composition. OTF builds an installable outline font from one representative per character, using your pinned choices first. OTF contains outlines only, so contrast, fade, and colors do not apply. Repeated randomized letters cannot be represented in a conventional single-glyph font. Save alphabet stores your settings, choices, and exclusions as JSON.</p></dialog><div id="toast" role="status"></div>`;
 $('#sentence').value=state.text;$('#sentence').rows=Math.max(2,Math.min(8,state.text.split('\n').length));
 $('#sentence').addEventListener('input',e=>{state.text=e.target.value;updatePreview();persist();});
 for(const key of ['size','spacing','fade','ink','paper']){$('#'+key).value=state[key];$('#'+key).addEventListener('input',e=>{state[key]=['ink','paper'].includes(key)?e.target.value:Number(e.target.value);updatePreview();persist();});}
 $('#normalize').checked=state.normalize;$('#normalize').onchange=e=>{state.normalize=e.target.checked;updatePreview();persist();};
 $('#assignment').value=state.assignment;$('#assignment').onchange=e=>changeSelection('Change casting mode',()=>{state.assignment=e.target.value;});
 $('#modes').onclick=e=>{if(e.target.dataset.mode){state.mode=e.target.dataset.mode;refresh();}};
 document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{state.text=b.dataset.preset==='code'?CODE_TEXT:DEFAULT_TEXT;state.size=b.dataset.preset==='code'?52:86;$('#size').value=state.size;$('#sentence').value=state.text;$('#sentence').rows=Math.max(2,state.text.split('\n').length);refresh();});
 $('#shuffle').onclick=()=>changeSelection('Shuffle alphabet',()=>{state.seed=(state.seed+1)%1000000000;});
 $('#letter-picker').onchange=e=>{state.selected=e.target.value;displayCount=60;refresh();};
 $('#open-map').onclick=openMap;
 document.querySelectorAll('[data-history]').forEach(button=>button.onclick=()=>travelHistory(button.dataset.history));
 $('#unlock').onclick=()=>changeSelection('Unpin '+state.selected,()=>{delete state.pins[state.selected];});
 $('#unlock-all').onclick=()=>changeSelection('Unpin all letters',()=>{state.pins={};});
 $('#more').onclick=()=>{displayCount+=60;renderCandidates();};
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;refresh();});
 $('#about').onclick=()=>$('#notes').showModal();$('#close-notes').onclick=()=>$('#notes').close();
 $('#save').onclick=()=>download(new Blob([JSON.stringify({format:'bl-type-v1',...state},null,2)],{type:'application/json'}),'bl-type-alphabet.json');
 $('#import').onclick=()=>$('#file').click();$('#file').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>1000000)throw Error('File is too large');const data=JSON.parse(await f.text());if(data.format!=='bl-type-v1')throw Error('Choose a BL Type alphabet JSON file');const before=selectionSnapshot(state);state=restore(data,catalog);history.record(before,state,'Open alphabet');inspected={};init();toast('Alphabet restored.');}catch(e){toast(e.message);}};
 $('#export').onclick=exportWork;refresh();
}
function refresh(){updatePreview();renderCandidates();renderCase();updateHistoryControls();persist();}
function updateHistoryControls(){for(const button of document.querySelectorAll('[data-history]')){const undo=button.dataset.history==='undo',label=undo?history.undoLabel:history.redoLabel;button.disabled=!label;button.title=label?(undo?'Undo: ':'Redo: ')+label:(undo?'Nothing to undo':'Nothing to redo');}}
function changeSelection(label,mutate){const before=selectionSnapshot(state);mutate();const changed=history.record(before,state,label);refresh();return changed;}
function travelHistory(direction){const label=direction==='undo'?history.undoLabel:history.redoLabel,snapshot=history[direction]();if(!snapshot)return;Object.assign(state,snapshot);$('#assignment').value=state.assignment;refresh();toast((direction==='undo'?'Undid: ':'Redid: ')+label);}

function inspect(char,id){state.selected=char;inspected[char]=id;renderCandidates();persist();}
function use(char,id){if(changeSelection('Use '+char,()=>{state.pins[char]=id;}))toast('Using this '+char+'.');}
function openMap(){state.tab='styles';renderCase();persist();$('.case').scrollIntoView({behavior:'smooth'});}

function glyphMarkup(g){const ext=state.mode==='original'?'webp':state.mode==='clean'?'png':'svg';return `<img crossorigin="anonymous" src="${assetUrl('glyphs/')}${g.id}.${ext}" alt="" draggable="false" loading="lazy">`;}
function updatePreview(){
 $('#modes').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.mode===state.mode));
 const render=$('#render'),renderSize=state.size*(innerWidth<580?.6:1);render.style.setProperty('--glyph-size',renderSize+'px');render.style.setProperty('--tracking',state.spacing+'px');$('#specimen').style.background=state.paper;$('#specimen').style.color=state.ink;
 for(const key of ['size','spacing','fade'])$('#'+key+'-value').textContent=(key==='size'?Math.round(renderSize):state[key])+(key==='fade'?'%':'');
 let index=0,missing=new Set(),fallBack=new Set();
 render.innerHTML=state.text.split('\n').map(line=>`<div class="line">${line.split(/(\s+)/).map(word=>/^\s+$/.test(word)?`<span class="space" style="width:${word.length*renderSize*.34}px"></span>`:`<span class="word">${Array.from(word).map(c=>{const i=index++,g=choose(catalog,c,i,state);if(!g){missing.add(c);return `<span class="fallback" style="opacity:${1-state.fade/100}" title="No image set: ${esc(c)}">${esc(c)}</span>`;}if(state.cluster!=='all'&&!state.pins[c.toUpperCase()]&&g.cluster!==Number(state.cluster))fallBack.add(c.toUpperCase());const scale=glyphScale(c);const ratio=Math.max(.18,Math.min(2.8,g.width/g.height))*scale;return `<button class="letter ${state.mode}" data-id="${g.id}" data-letter="${esc(c.toUpperCase())}" title="Choose ${esc(c.toUpperCase())} · source ${g.id}" aria-label="Choose image for ${esc(c.toUpperCase())}" style="width:${renderSize*ratio}px;height:${renderSize*scale}px;align-self:${/[\"\']/.test(c)?'flex-start':/[=+*<>:-]/.test(c)?'center':'flex-end'};opacity:${1-state.fade/100};--ink:${state.ink};--tile:url('${assetUrl('glyphs/')}${g.id}.${state.mode==='clean'?'png':'svg'}')">${glyphMarkup(g)}</button>`;}).join('')}</span>`).join('')}</div>`).join('');
 render.querySelectorAll('[data-letter]').forEach(b=>b.onclick=()=>{state.selected=b.dataset.letter;inspected[state.selected]=b.dataset.id;displayCount=60;renderCandidates();renderCase();persist();if(innerWidth<850)$('.inspector').scrollIntoView({behavior:'smooth'});});
 applyPreviewTone(render);
 $('#tone-note').textContent=state.mode==='vector'?'Vector ink is already uniform. Fade adjusts its opacity.':state.normalize?'Each tile’s paper and ink are stretched to white and black; texture is preserved.':'Enable to balance pale and dark scans. Fade softens the whole tile.';
 $('#specimen-label').textContent={original:'SPECIMEN / FOUND PAPER',clean:'SPECIMEN / PAPER REMOVED',vector:'SPECIMEN / TRACED INK'}[state.mode];
 $('#seed-label').textContent='EDITION '+String(state.seed).padStart(3,'0');
 $('#render-note').textContent=missing.size?`System-font fallback: ${[...missing].join(' ')}`:fallBack.size?`Outside this style: ${[...fallBack].join(' ')}`:state.mode==='original'?'Found tiles & labelled punctuation cuts · uppercase sets':state.mode==='clean'?'Paper-normalized ink · original texture':'True SVG contours · ornament included';
}
function applyPreviewTone(render){
 const generation=++toneGeneration,mode=state.mode;
 render.dataset.tone='ready';
 if(!state.normalize||mode==='vector')return;
 render.dataset.tone='loading';
 const jobs=[...render.querySelectorAll('.letter')].map(async el=>{
  const tile=await normalizedTile(el.dataset.id);
  if(generation!==toneGeneration||!el.isConnected)return;
  el.querySelector('img').src=tile[mode];
  if(mode==='clean')el.style.setProperty('--tile',`url("${tile.clean}")`);
 });
 Promise.all(jobs).then(()=>{if(generation===toneGeneration)render.dataset.tone='ready';}).catch(()=>{if(generation===toneGeneration){render.dataset.tone='error';toast('A tile could not be normalized. Try toggling contrast again.');}});
}
function renderCandidates(){
 const c=state.selected,pool=candidates(catalog,c,state),pin=state.pins[c],representative=choose(catalog,c,0,state),scroll=$('#candidates').scrollTop;
 if(inspected[c]&&state.hidden.includes(c+':'+inspected[c]))delete inspected[c];
 const g=catalog.glyphs[inspected[c]]||(pin?catalog.glyphs[pin]:representative);
 $('#selected-char').textContent=c;$('#candidate-count').textContent=pool.length+' candidates';$('#letter-picker').value=c;$('#pin-status').textContent=pin?'● PINNED':'RANDOMIZED';$('#unlock').disabled=!pin;
 $('#candidates').innerHTML=pool.length?pool.slice(0,displayCount).map(h=>`<button class="candidate ${h.id===pin?'picked':''} ${h.id===g?.id?'inspected':''}" data-id="${h.id}" aria-label="Inspect image ${h.id} for ${esc(c)}" title="${esc(h.query)} · ${h.score.toFixed(3)}"><img crossorigin="anonymous" src="${assetUrl('glyphs/')}${h.id}.webp" alt="Candidate ${esc(c)}" loading="lazy"><span>${catalog.glyphs[h.id].derivation?'SOURCE CUT':catalog.reviewed?.[c]?.includes(h.id)?'REVIEWED':'CANDIDATE'}${h.id===pin?' ●':''}</span></button>`).join(''):'<p class="empty">All candidates hidden. Restore them in Your alphabet.</p>';
 $('#candidates').querySelectorAll('button').forEach(b=>b.onclick=()=>{inspected[c]=b.dataset.id;renderCandidates();});$('#candidates').scrollTop=scroll;$('#more').hidden=pool.length<=displayCount;
 $('#source-detail').innerHTML=g?`<div class="source-title"><span>INSPECTING ${esc(c)}</span><b>#${g.id}</b></div><div class="source-body"><img crossorigin="anonymous" src="${assetUrl('glyphs/')}${g.id}.webp" alt="Inspected ${esc(c)}"><div><b>${esc(g.subset)} · ${esc(g.date||'undated')}</b><p title="${esc(g.fname)}">${esc(g.fname.replace(/_/g,' '))}</p>${g.derivation?`<p class="derivation">Cut / ${esc(g.derivation)}</p>`:''}${g.source?`<a href="${esc(g.source)}" target="_blank" rel="noreferrer">Original scan ↗</a>`:''}<button id="hide-tile">Hide from ${esc(c)} ×</button></div></div><div class="inspection-actions"><button class="primary" id="use-tile" ${pin===g.id?'disabled':''}>${pin===g.id?'In use':'Use this '+esc(c)}</button>${/^[A-Z]$/.test(c)?'<button id="find-style">Find style matches ↗</button>':''}</div>`:'';
 if(g){$('#use-tile').onclick=()=>use(c,g.id);$('#hide-tile').onclick=()=>{changeSelection('Hide '+c+' candidate',()=>{state.hidden.push(c+':'+g.id);if(state.pins[c]===g.id)delete state.pins[c];delete inspected[c];});toast('Candidate hidden. Restore it in Your alphabet.');};$('#find-style')?.addEventListener('click',async()=>{openMap();await explorer.ready;if(!explorer.selectGlyph(c,g.id))toast('This ambiguous tile is assigned to another letter in the map. Try another candidate.');});}
}
function renderCase(){
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));$('#lock-count').textContent=Object.keys(state.pins).length+' pinned';
 const target=$('#case-content');
 if(state.tab==='letters'){
 explorer?.dispose();explorer=null;
 target.innerHTML=`<div class="alphabet">${Object.keys(catalog.sets).sort((a,b)=>{const order='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';const ia=order.indexOf(a),ib=order.indexOf(b);return (ia<0?100+a.charCodeAt(0):ia)-(ib<0?100+b.charCodeAt(0):ib);}).map(c=>{const g=choose(catalog,c,0,state);return `<button class="alphabet-tile ${c===state.selected?'selected':''}" data-char="${esc(c)}"><span class="tile-char">${esc(c)}</span>${g?`<img crossorigin="anonymous" src="${assetUrl('glyphs/')}${g.id}.webp" alt="${esc(c)}" loading="lazy">`:'<span>—</span>'}<span class="tile-count">${candidates(catalog,c,state).length}${state.pins[c]?' ●':''}</span></button>`;}).join('')}</div><div class="case-foot"><span>Lowercase shares the capital sets. Digits & punctuation are experimental finds.</span><button id="restore-hidden">Restore ${state.hidden.length} hidden candidates</button></div>`;
 target.querySelectorAll('[data-char]').forEach(b=>b.onclick=()=>{state.selected=b.dataset.char;displayCount=60;refresh();});$('#restore-hidden').onclick=()=>changeSelection('Restore hidden candidates',()=>{state.hidden=[];});
 }else{
 if(!explorer||!explorer.host.isConnected){target.innerHTML='<div id="style-browser"></div>';explorer=new StyleExplorer($('#style-browser'),catalog,{state:()=>state,inspect,use,useMany:(choices,label='Fill unpinned letters')=>{if(changeSelection(label,()=>{Object.assign(state.pins,choices);}))toast('Assigned '+Object.keys(choices).length+' letters.');},revealInspector:()=>$('.inspector').scrollIntoView({behavior:'smooth'})});}else explorer.update();
 }
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
async function loadPaths(ids){await Promise.all([...new Set(ids)].filter(id=>!paths[id]).map(async id=>{const r=await fetch(assetUrl('glyphs/'+id+'.svg'));if(!r.ok)throw Error('Could not load vector '+id);const doc=new DOMParser().parseFromString(await r.text(),'image/svg+xml');const path=doc.querySelector('path')?.getAttribute('d');if(!path)throw Error('Invalid vector '+id);paths[id]=path;}));return paths;}
async function imageData(id,ext){const key=id+'.'+ext;if(!imageCache.has(key)){const r=await fetch(assetUrl('glyphs/'+key));if(!r.ok)throw Error('Could not load tile '+id);const blob=await r.blob();imageCache.set(key,await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);}));}return imageCache.get(key);}
async function exportWork(){const b=$('#export');b.disabled=true;b.textContent='Preparing…';try{const format=$('#export-format').value;if(format==='otf')await exportFont();else{const svg=await exportSVG();if(format==='svg')download(new Blob([svg],{type:'image/svg+xml'}),'bl-type-specimen.svg');else{const img=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));try{await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(Error('Could not render exported SVG'));img.src=url;});const c=document.createElement('canvas');const scale=Math.min(2,8000/Math.max(img.width,img.height));c.width=img.width*scale;c.height=img.height*scale;c.getContext('2d').drawImage(img,0,0,c.width,c.height);const blob=await new Promise(r=>c.toBlob(r,'image/png'));if(!blob)throw Error('Image exceeds browser export limits');download(blob,'bl-type-specimen.png');}finally{URL.revokeObjectURL(url);}}}toast('Your type is ready.');}catch(e){toast(e.message);}finally{b.disabled=false;b.textContent='Export ↓';}}
async function exportSVG(){
 const settings={...state},box=$('#render').getBoundingClientRect(),padding=32,opacity=1-settings.fade/100;
 const letters=[...$('#render').querySelectorAll('.letter,.fallback')].map(el=>({
  id:el.dataset.id,text:el.textContent,rect:el.getBoundingClientRect(),w:el.offsetWidth,h:el.offsetHeight,fontSize:parseFloat(getComputedStyle(el).fontSize)
 }));
 if(settings.mode==='vector')await loadPaths(letters.map(el=>el.id).filter(Boolean));
 let body=`<rect width="100%" height="100%" fill="${settings.paper}"/>`;
 if(settings.mode==='clean')body+=`<defs><filter id="ink"><feFlood flood-color="${settings.ink}"/><feComposite in2="SourceGraphic" operator="in"/></filter></defs>`;
 for(const {id,text,rect,w,h,fontSize} of letters){
  const x=rect.left-box.left+padding,y=rect.top-box.top+padding;
  if(!id){body+=`<text x="${x}" y="${rect.bottom-box.top+padding-10}" font-size="${fontSize}" fill="${settings.ink}" opacity="${opacity}">${esc(text)}</text>`;continue;}
  const g=catalog.glyphs[id];
  body+=`<g opacity="${opacity}" transform="translate(${x} ${y})">`;
  if(settings.mode==='vector')body+=`<svg width="${w}" height="${h}" viewBox="0 0 ${g.width} ${g.height}"><path fill="${settings.ink}" fill-rule="evenodd" d="${paths[id]}"/></svg>`;
  else {
   const data=settings.normalize?(await normalizedTile(id))[settings.mode]:await imageData(id,settings.mode==='clean'?'png':'webp');
   body+=`<image width="${w}" height="${h}" href="${data}"${settings.mode==='clean'?' filter="url(#ink)"':''}/>`;
  }
  body+='</g>';
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(box.width+padding*2)}" height="${Math.ceil(box.height+padding*2)}" viewBox="0 0 ${Math.ceil(box.width+padding*2)} ${Math.ceil(box.height+padding*2)}"><title>BL Type specimen</title>${body}</svg>`;
}
async function exportFont(){await loadPaths(Object.keys(catalog.sets).map(c=>choose(catalog,c,0,state)?.id).filter(Boolean));const glyphs=[new opentype.Glyph({name:'.notdef',advanceWidth:600,path:new opentype.Path()}),new opentype.Glyph({name:'space',unicode:32,advanceWidth:340,path:new opentype.Path()})];
 for(const c of Object.keys(catalog.sets)){
 const g=choose(catalog,c,0,state);if(!g)continue;const factor=glyphScale(c),scale=800*factor/g.height,top=/[\"\']/.test(c)?800:/[=+*<>:-]/.test(c)?400+400*factor:800*factor,path=new opentype.Path();
 for(const match of paths[g.id].matchAll(/([MLZ])(?:([\d.]+),([\d.]+))?/g)){const [,cmd,x,y]=match;if(cmd==='Z')path.close();else path[cmd==='M'?'moveTo':'lineTo'](40+Number(x)*scale,top-Number(y)*scale);}
 for(const char of /[A-Z]/.test(c)?[c,c.toLowerCase()]:[c])glyphs.push(new opentype.Glyph({name:'uni'+char.charCodeAt(0).toString(16).padStart(4,'0'),unicode:char.charCodeAt(0),advanceWidth:Math.max(120,Math.round(g.width*scale+80)),path}));
 }
 const font=new opentype.Font({familyName:'BL Type '+state.seed,styleName:'Found',unitsPerEm:1000,ascender:850,descender:-150,glyphs});download(new Blob([font.toArrayBuffer()],{type:'font/otf'}),'bl-type-'+state.seed+'.otf');}

window.addEventListener('resize',()=>{if(catalog&&state&&$('#render')){updatePreview();if(state.tab==='styles')explorer?.draw();}});

window.addEventListener('keydown',event=>{
 if(!(event.ctrlKey||event.metaKey)||event.altKey||!history)return;
 if(event.target.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable=""]'))return;
 const key=event.key.toLowerCase(),direction=key==='z'?(event.shiftKey?'redo':'undo'):key==='y'?'redo':null;
 if(direction){event.preventDefault();travelHistory(direction);}
});
