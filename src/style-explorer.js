import {assetUrl} from './assets.js';
import {visiblePoint} from './style-math.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let dataPromise;
async function loadData(){if(!dataPromise)dataPromise=fetch(assetUrl('data/style-map.json')).then(r=>{if(!r.ok)throw Error('The style map is unavailable.');return r.json();}).catch(e=>{dataPromise=null;throw e;});return dataPromise;}
export class StyleExplorer{
 constructor(host,catalog,actions){
  this.host=host;this.catalog=catalog;this.actions=actions;this.filter={letter:'all',group:'all',reviewedOnly:false};this.projection='centered';this.color='group';this.anchor=null;this.hover=null;this.matches=null;this.request=0;this.zoom={k:1,x:0,y:0};this.disposed=false;
  this.host.innerHTML='<p class="map-loading" role="status">Opening the style map…</p>';
  this.ready=this.init().catch(e=>{if(!this.disposed)this.host.innerHTML=`<p role="alert">${esc(e.message)}</p><button id="retry-style">Try again</button>`;this.el('#retry-style')?.addEventListener('click',()=>{this.ready=this.init();});});
 }
 el(s){return this.host.querySelector(s);}
 async init(){
  this.data=await loadData();if(this.disposed)return;
  this.layer=this.data.defaultLayer;this.hiddenSnapshot=JSON.stringify(this.actions.state().hidden);
  this.host.innerHTML=`<div class="explorer-intro"><div><h2>Find a matching alphabet.</h2><p>Hover to peek. Click a tile to find its closest match in every other letter.</p></div><span class="map-badge">${this.data.points.length.toLocaleString()} LETTER TILES</span></div>
  <div class="map-toolbar"><label>Map<select id="projection"><option value="centered">Style · letter average removed</option><option value="raw">Original embeddings · compare</option></select></label><label>Color by<select id="color-by"><option value="group">Style group</option><option value="letter">Letter</option></select></label><label class="map-check"><input type="checkbox" id="reviewed-only">Reviewed seeds only</label><div class="zoom-controls"><button id="zoom-out" aria-label="Zoom out">−</button><button id="zoom-in" aria-label="Zoom in">+</button><button id="reset-map">Reset view</button></div></div>
  <div class="letter-filters" aria-label="Filter map by letter"><button data-letter-filter="all" class="active">All letters</button>${this.data.letters.map(c=>`<button data-letter-filter="${c}">${c}</button>`).join('')}</div>
  <div class="map-layout"><div class="map-stage"><canvas id="style-map" tabindex="0" aria-label="Letter style map. Arrow keys browse visible tiles; Enter selects. Drag to pan; scroll to zoom." aria-describedby="map-status"></canvas><div id="map-tooltip" class="map-tooltip" hidden></div><div class="map-hint">DRAG TO PAN · SCROLL TO ZOOM</div></div><aside id="reference-panel" class="reference-panel"></aside></div>
  <div class="map-status-row"><span id="map-status" role="status"></span><span id="map-legend"></span></div>
  <section id="nearest-strip" class="nearest-strip" aria-label="Nearest alphabet preview"></section>
  <details class="group-details"><summary>Explore automatic style groups <span>EVoC · optional</span></summary><div class="group-controls"><label>Detail level<select id="group-layer">${this.data.layers.map((l,i)=>`<option value="${i}" ${i===this.layer?'selected':''}>${l.groups.length} groups · ${l.noise} ungrouped</option>`).join('')}</select></label><label>Show<select id="group-filter"></select></label><button id="clear-group">Show all groups</button></div><div id="group-gallery"></div><p>Groups are discovered from the centered embeddings, independently of the 2D layout. Ungrouped tiles are kept. These are suggestions, not identified historical typefaces.</p></details>
  <section id="matches-panel" class="matches-panel"></section>
  <details class="map-method"><summary>What does this map measure?</summary><p>Each SigLIP image vector is unit-normalized, its letter’s mean vector is subtracted, and the residual is unit-normalized again. UMAP maps those 1,152-dimensional residuals to two dimensions (cosine distance, 30 neighbors, min_dist 0.12, seed 17). Switch to Original embeddings to compare an uncentered UMAP.</p><code>style(image) = normalize(normalize(image) − mean(normalized images of that letter))</code><p>Matches use exact cosine similarity in the full centered vector space, even while viewing the original UMAP. Two-dimensional distances can be misleading. Letter averages use the retained candidate sets, not just reviewed seeds; filtering does not refit the projection.</p><p>${esc(this.data.method.limitations)} Repeated source IDs receive one letter label: reviewed labels win, then the strongest letter-query score. ${this.data.method.assignmentCount-this.data.points.length} repeated assignments were resolved this way.</p><p><a href="https://evoc.readthedocs.io/en/latest/" target="_blank" rel="noreferrer">EVoC documentation ↗</a> · ${esc(this.data.method.clustering.version)} · density-based clustering of the full residual vectors; no fixed cluster count.</p></details>`;
  this.canvas=this.el('#style-map');this.worker=new Worker(new URL('./style-worker.js',import.meta.url),{type:'module'});
  this.worker.onmessage=({data})=>{if(this.disposed)return;if(data.type==='ready'){this.workerReady=true;this.renderReference();}if(data.type==='error'){if(data.request===undefined||data.request===this.request){this.error=data.message;this.pending=false;this.renderReference();this.renderMatches();}}if(data.type==='matches'&&data.request===this.request&&data.anchor===this.anchor){this.matches=data.matches;this.pending=false;this.error=null;this.renderReference();this.renderMatches();this.draw();}};
  this.worker.onerror=()=>{this.error='Style matching could not start. Reload to try again.';this.pending=false;this.renderReference();};
  this.worker.postMessage({type:'init',points:this.data.points,vectors:{...this.data.vectors,url:new URL(assetUrl(this.data.vectors.url),document.baseURI).href}});
  this.el('#projection').onchange=e=>{this.projection=e.target.value;this.zoom={k:1,x:0,y:0};this.draw();};
  this.el('#color-by').onchange=e=>{this.color=e.target.value;this.host.querySelectorAll('[data-letter-filter]').forEach(b=>{const c=b.dataset.letterFilter;b.style.borderBottomColor=this.color==='letter'&&c!=='all'?`hsl(${(c.charCodeAt(0)-65)*137.508%360},42%,43%)`:'';b.style.borderBottomWidth=this.color==='letter'&&c!=='all'?'3px':'';});this.draw();};
  this.host.querySelectorAll('[data-letter-filter]').forEach(b=>b.onclick=()=>{this.filter.letter=b.dataset.letterFilter;this.host.querySelectorAll('[data-letter-filter]').forEach(x=>x.classList.toggle('active',x===b));this.hover=null;this.tooltip(null);this.draw();});
  this.el('#reviewed-only').onchange=e=>{this.filter.reviewedOnly=e.target.checked;this.draw();if(this.anchor!==null)this.findMatches();};
  this.el('#group-layer').onchange=e=>{this.layer=Number(e.target.value);this.filter.group='all';this.renderGroups();this.draw();this.renderReference();};
  this.el('#group-filter').onchange=e=>{this.filter.group=e.target.value;this.draw();};this.el('#clear-group').onclick=()=>{this.filter.group='all';this.el('#group-filter').value='all';this.draw();};
  this.el('#reset-map').onclick=()=>{this.zoom={k:1,x:0,y:0};this.draw();};this.el('#zoom-in').onclick=()=>this.scale(1.4);this.el('#zoom-out').onclick=()=>this.scale(1/1.4);
  this.bindCanvas();this.renderGroups();this.renderReference();this.renderMatches();this.resize=new ResizeObserver(()=>this.draw());this.resize.observe(this.canvas);this.draw();
 }
 update(){if(!this.data||!this.canvas)return;const hidden=JSON.stringify(this.actions.state().hidden);if(hidden!==this.hiddenSnapshot){this.hiddenSnapshot=hidden;if(this.anchor!==null)this.findMatches();}this.renderReference();this.renderMatches();this.draw();}
 layerData(){return this.data.layers[this.layer];}
 visible(i){return visiblePoint(this.data.points[i],i,this.filter,this.layerData().labels,this.actions.state().hidden);}
 matchIndices(){if(!this.matches)return [];return Object.values(this.matches).flatMap(hits=>hits.length?[hits[0].index]:[]).filter(i=>this.data.points[i].letter!==this.data.points[this.anchor]?.letter);}
 coords(){const xy=this.data.coords[this.projection],w=this.canvas.clientWidth,h=this.canvas.clientHeight;let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const [x,y]of xy){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}const scale=Math.min((w-60)/(maxX-minX),(h-60)/(maxY-minY));return xy.map(([x,y])=>[((x-(maxX+minX)/2)*scale+w/2)*this.zoom.k+this.zoom.x,((y-(maxY+minY)/2)*scale+h/2)*this.zoom.k+this.zoom.y]);}
 draw(){if(!this.canvas||!this.host.isConnected)return;const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;const dpr=devicePixelRatio||1;if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==Math.round(h*dpr)){this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);}const ctx=this.canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);this.positions=this.coords();const matches=new Set(this.matchIndices());let shown=0;this.visibleIndices=[];
  for(let i=0;i<this.data.points.length;i++){
   const visible=this.visible(i);if(visible){shown++;this.visibleIndices.push(i);}if(!visible&&!matches.has(i)&&i!==this.anchor&&i!==this.hover)continue;
   const [x,y]=this.positions[i],p=this.data.points[i],label=this.layerData().labels[i];if(x<0||y<0||x>w||y>h)continue;
   ctx.globalAlpha=visible?(this.anchor===null?.75:.4):.85;ctx.fillStyle=this.color==='letter'?`hsl(${(p.letter.charCodeAt(0)-65)*137.508%360},42%,43%)`:label<0?'#b6b1a7':`hsl(${(label*137.508+20)%360},34%,47%)`;ctx.beginPath();ctx.arc(x,y,Math.min(4,2.7*Math.sqrt(this.zoom.k)),0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;
  for(const i of matches){const [x,y]=this.positions[i];ctx.strokeStyle=i===this.hover?'#007caa':'#d84c2c';ctx.lineWidth=i===this.hover?3:2;ctx.fillStyle=i===this.hover?'#d9f2ff':'#fff8e9';ctx.beginPath();ctx.arc(x,y,7,0,7);ctx.fill();ctx.stroke();ctx.font='bold 11px Arial';ctx.fillStyle=i===this.hover?'#007caa':'#9c381f';ctx.fillText(this.data.points[i].letter,x+10,y+4);}
  if(this.anchor!==null){const [x,y]=this.positions[this.anchor];ctx.strokeStyle='#242a23';ctx.fillStyle='#f4b649';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(x,y,9,0,7);ctx.fill();ctx.stroke();}
  if(this.hover!==null&&this.positions[this.hover]){const [x,y]=this.positions[this.hover];ctx.strokeStyle='#007caa';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,12,0,7);ctx.stroke();ctx.fillStyle='#007caa';ctx.font='bold 12px Arial';ctx.fillText(this.data.points[this.hover].letter,x+16,y-10);}
  this.canvas.dataset.hoverIndex=this.hover===null?'':String(this.hover);this.host.querySelectorAll('[data-neighbor-index]').forEach(el=>el.classList.toggle('hovered',Number(el.dataset.neighborIndex)===this.hover));
  this.el('#map-status').textContent=`${shown.toLocaleString()} visible${this.filter.letter==='all'?'':' · letter '+this.filter.letter}${matches.size?' · gold: reference · orange: nearest · blue: hover':''}`;
  this.el('#map-legend').textContent=this.projection==='centered'?'UMAP · letter average removed':'UMAP · original embeddings';
 }
 hit(x,y){
  // The annotated rings take precedence over unannotated dots beneath them.
  let best=null,d=100;for(const i of [...this.matchIndices(),...(this.anchor===null?[]:[this.anchor])]){const [px,py]=this.positions[i],dd=(px-x)**2+(py-y)**2;if(dd<d){best=i;d=dd;}}if(best!==null)return best;
  d=144;for(let i=0;i<this.positions.length;i++){if(!this.visible(i))continue;const [px,py]=this.positions[i],dd=(px-x)**2+(py-y)**2;if(dd<d){d=dd;best=i;}}return best;
 }
 bindCanvas(){const c=this.canvas;
  const local=e=>{const r=c.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
  c.onpointerdown=e=>{if(e.button!==0)return;const [x,y]=local(e);this.drag={x,y,ox:this.zoom.x,oy:this.zoom.y,moved:false};c.setPointerCapture(e.pointerId);};
  c.onpointermove=e=>{const [x,y]=local(e);if(this.drag){const dx=x-this.drag.x,dy=y-this.drag.y;if(Math.hypot(dx,dy)>4)this.drag.moved=true;if(this.drag.moved){this.zoom.x=this.drag.ox+dx;this.zoom.y=this.drag.oy+dy;this.tooltip(null);this.draw();return;}}const hit=this.hit(x,y);if(hit!==this.hover){this.hover=hit;this.draw();}this.tooltip(hit,x,y);};
  c.onpointerup=e=>{if(!this.drag)return;const moved=this.drag.moved;this.drag=null;if(c.hasPointerCapture(e.pointerId))c.releasePointerCapture(e.pointerId);if(!moved){const [x,y]=local(e),hit=this.hit(x,y);if(hit!==null)this.select(hit);}};
  c.onpointercancel=()=>{this.drag=null;};c.onpointerleave=()=>{if(!this.drag){this.hover=null;this.tooltip(null);this.draw();}};
  c.addEventListener('wheel',e=>{e.preventDefault();const [x,y]=local(e);this.scale(Math.exp(-e.deltaY*.0015),x,y);this.tooltip(null);},{passive:false});
  c.onkeydown=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const list=this.visibleIndices;if(!list.length)return;const delta=['ArrowLeft','ArrowUp'].includes(e.key)?-1:1;let pos=list.indexOf(this.hover??this.anchor);pos=(pos+delta+list.length)%list.length;this.hover=list[pos];this.draw();this.tooltip(this.hover,...this.positions[this.hover]);}if(e.key==='Enter'&&this.hover!==null){e.preventDefault();this.select(this.hover);}if(e.key==='Escape'){this.hover=null;this.tooltip(null);this.draw();}};
 }
 scale(factor,x=this.canvas.clientWidth/2,y=this.canvas.clientHeight/2){const k=Math.max(.65,Math.min(15,this.zoom.k*factor)),r=k/this.zoom.k;this.zoom.x=x-(x-this.zoom.x)*r;this.zoom.y=y-(y-this.zoom.y)*r;this.zoom.k=k;this.hover=null;this.tooltip(null);this.draw();}
 tooltip(index,x=0,y=0){const tip=this.el('#map-tooltip');if(!tip)return;tip.hidden=index===null;if(index===null)return;const p=this.data.points[index],group=this.layerData().labels[index];tip.innerHTML=`<img crossorigin="anonymous" src="${assetUrl('glyphs/')}${p.id}.webp" alt="${p.letter} source ${p.id}"><div><b>${p.letter}</b><span>#${p.id} · ${group<0?'Ungrouped':'Group '+(group+1)}<br>${p.reviewed?'Reviewed seed':'Unreviewed candidate'}</span></div>`;tip.style.left=Math.max(6,Math.min(x+18,this.canvas.clientWidth-178))+'px';tip.style.top=Math.max(6,Math.min(y+16,this.canvas.clientHeight-195))+'px';}
 select(index){this.anchor=index;this.hover=null;this.tooltip(null);this.matches=null;this.actions.inspect(this.data.points[index].letter,this.data.points[index].id);this.findMatches();this.renderReference();this.renderMatches();this.draw();}
 selectGlyph(char,id){const i=this.data.points.findIndex(p=>p.id===id&&p.letter===char);if(i>=0){this.select(i);return true;}return false;}
 findMatches(){if(this.anchor===null)return;this.pending=true;this.error=null;this.matches=null;this.worker.postMessage({type:'matches',request:++this.request,anchor:this.anchor,options:{reviewedOnly:this.filter.reviewedOnly,hidden:this.actions.state().hidden,limit:5}});this.renderReference();this.renderMatches();}
 renderReference(){const panel=this.el('#reference-panel');if(!panel)return;if(this.anchor===null){panel.innerHTML='<span class="eyebrow">1 / PICK A REFERENCE</span><h3>Start with a letter you like.</h3><p>Hover over any dot to see the scan. Click it to find matching letters.</p><p class="quiet">Clicking explores. Your text changes only when you press Use.</p>';return;}
  const p=this.data.points[this.anchor],g=this.catalog.glyphs[p.id],pin=this.actions.state().pins[p.letter],group=this.layerData().labels[this.anchor];
  panel.innerHTML=`<div class="reference-heading"><span class="eyebrow">REFERENCE / ${p.letter}</span><button id="clear-reference">Clear ×</button></div><img class="reference-image" src="${assetUrl('glyphs/')}${p.id}.webp" alt="Reference ${p.letter}"><b>${p.letter} <span>#${p.id}</span></b><p>${group<0?'Ungrouped':'Group '+(group+1)} · ${p.reviewed?'reviewed seed':'unreviewed candidate'}<br>${esc(g.date||'Undated')} · ${esc(g.subset)}</p><button class="primary" id="use-reference" ${pin===p.id?'disabled':''}>${pin===p.id?'Using this '+p.letter:'Use this '+p.letter}</button><button class="primary" id="use-nearest-reference" title="Assign the reference and nearest match per letter, replacing current A–Z choices in one undoable step" ${this.pending||!this.matches?'disabled':''}>Use nearest alphabet</button><p class="quiet">${this.error?esc(this.error):this.pending?'Finding closest letters…':'The outlined dots are the closest matches in the other letters.'}</p>${g.source?`<a href="${esc(g.source)}" target="_blank" rel="noreferrer">Original scan ↗</a>`:''}`;
  this.el('#use-nearest-reference').onclick=()=>this.assignNearest(false);
  this.el('#use-reference').onclick=()=>{this.actions.use(p.letter,p.id);this.update();};this.el('#clear-reference').onclick=()=>{this.anchor=null;this.matches=null;this.request++;this.pending=false;this.renderReference();this.renderMatches();this.draw();};
 }
 renderGroups(){const l=this.layerData();this.el('#group-filter').innerHTML=`<option value="all">All groups</option><option value="-1">Ungrouped · ${l.noise}</option>${l.groups.map(g=>`<option value="${g.id}">Group ${g.id+1} · ${g.count} tiles · ${g.letterCount} letters</option>`).join('')}`;this.el('#group-filter').value=this.filter.group;
  this.el('#group-gallery').innerHTML=[...l.groups].sort((a,b)=>b.count-a.count).slice(0,12).map(g=>`<button class="group-card" data-group="${g.id}"><div>${g.examples.slice(0,4).map(i=>`<img crossorigin="anonymous" loading="lazy" src="${assetUrl('glyphs/')}${this.data.points[i].id}.webp" alt="Group ${g.id+1} example">`).join('')}</div><b>Group ${g.id+1}</b><span>${g.count} tiles · ${g.letterCount} letters</span></button>`).join('');this.host.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{this.filter.group=b.dataset.group;this.el('#group-filter').value=this.filter.group;this.draw();});
 }
 nearestChoices(onlyUnpinned=false){
  const choices={};if(this.anchor===null||this.pending||!this.matches)return choices;
  const state=this.actions.state(),anchor=this.data.points[this.anchor];
  if(!state.hidden.includes(anchor.letter+':'+anchor.id)&&(!onlyUnpinned||!state.pins[anchor.letter]))choices[anchor.letter]=anchor.id;
  for(const [c,hits]of Object.entries(this.matches))if(c!==anchor.letter&&hits.length&&(!onlyUnpinned||!state.pins[c])){const p=this.data.points[hits[0].index];if(!state.hidden.includes(c+':'+p.id))choices[c]=p.id;}
  return choices;
 }
 assignNearest(onlyUnpinned){
  const choices=this.nearestChoices(onlyUnpinned);if(!Object.keys(choices).length)return;
  this.actions.useMany(choices,(onlyUnpinned?'Fill unpinned letters from ':'Assign nearest alphabet from ')+this.data.points[this.anchor].letter);this.update();
 }
 bindNeighborHover(root){
  for(const el of root.querySelectorAll('[data-neighbor-index]')){
   const enter=()=>{this.hover=Number(el.dataset.neighborIndex);this.tooltip(null);this.draw();};
   const leave=()=>{if(this.hover===Number(el.dataset.neighborIndex)){this.hover=null;this.draw();}};
   el.onpointerenter=enter;el.onpointerleave=leave;el.onfocusin=enter;el.onfocusout=event=>{if(!el.contains(event.relatedTarget))leave();};
  }
 }
 renderNearest(){
  const panel=this.el('#nearest-strip');if(!panel)return;
  if(this.anchor===null){panel.innerHTML='<p class="nearest-empty">Select a dot to preview its nearest alphabet here.</p>';return;}
  if(this.pending||!this.matches){panel.innerHTML=`<p role="status">${this.error?esc(this.error):'Finding the nearest alphabet…'}</p>`;return;}
  const anchor=this.data.points[this.anchor],state=this.actions.state(),count=Object.keys(this.nearestChoices()).length;
  panel.innerHTML=`<div class="nearest-heading"><div><span class="eyebrow">NEAREST ALPHABET / FROM ${anchor.letter}</span><p>Your reference plus the closest image for each other letter.</p></div><div class="nearest-actions"><button id="assign-nearest" class="primary">Assign all ${count} letters</button><button id="fill-nearest">Fill unpinned only</button></div></div><div class="nearest-mini-grid">${this.data.letters.map(c=>{
   const isAnchor=c===anchor.letter,hit=isAnchor?{index:this.anchor,score:1}:this.matches[c]?.[0];
   if(!hit)return `<div class="nearest-mini unavailable"><b>${c}</b><span>No match</span></div>`;
   const p=this.data.points[hit.index],used=state.pins[c]===p.id;
   return `<div class="nearest-mini ${isAnchor?'is-reference':''} ${used?'in-use':''}" data-neighbor-index="${hit.index}"><button class="mini-preview" data-mini-inspect="${hit.index}" aria-label="Inspect nearest ${c}" title="${c} · ${isAnchor?'reference':'cosine '+hit.score.toFixed(3)} · #${p.id}"><b>${c}<span>${isAnchor?'REF':used?'●':''}</span></b><img crossorigin="anonymous" src="${assetUrl('glyphs/')}${p.id}.webp" alt="Nearest ${c}" loading="lazy"></button><button class="mini-use" data-mini-use="${hit.index}" ${used?'disabled':''}>${used?'In use':'Use '+c}</button></div>`;
  }).join('')}</div><p class="nearest-help">Assign all replaces your A–Z choices with this alphabet; one Undo restores them. Hover a miniature to find its blue highlight on the map.</p>`;
  this.el('#assign-nearest').onclick=()=>this.assignNearest(false);this.el('#fill-nearest').onclick=()=>this.assignNearest(true);
  panel.querySelectorAll('[data-mini-use]').forEach(button=>button.onclick=()=>{const p=this.data.points[Number(button.dataset.miniUse)];this.actions.use(p.letter,p.id);});
  panel.querySelectorAll('[data-mini-inspect]').forEach(button=>button.onclick=()=>{const p=this.data.points[Number(button.dataset.miniInspect)];this.actions.inspect(p.letter,p.id);this.actions.revealInspector();});
  this.bindNeighborHover(panel);
 }
 renderMatches(){this.renderNearest();const panel=this.el('#matches-panel');if(!panel)return;if(this.anchor===null){panel.innerHTML='';return;}if(this.pending||!this.matches){panel.innerHTML=`<p role="status">${this.error?esc(this.error):'Finding nearest matches in the full centered embedding space…'}</p>`;return;}
  const anchor=this.data.points[this.anchor];const state=this.actions.state(),expanded=this.el('.match-details')?.open||false;
  panel.innerHTML=`<details class="match-details" ${expanded?'open':''}><summary>More matches and alternatives</summary></details>`;const detail=this.el('.match-details');
  detail.insertAdjacentHTML('beforeend',`<div class="matches-heading"><div><span class="eyebrow">2 / REVIEW THE MATCHES</span><h3>An alphabet that follows your ${anchor.letter}.</h3><p>Closest by centered cosine similarity. Click a match to inspect it; Use applies it to your text.</p></div><button class="primary" id="use-matches">Fill unpinned letters</button></div><div class="neighbor-grid">${this.data.letters.filter(c=>c!==anchor.letter).map(c=>{const hits=this.matches[c];if(!hits.length)return `<div class="neighbor-card"><b>${c}</b><p>No eligible candidate</p></div>`;const h=hits[0],p=this.data.points[h.index];return `<div data-neighbor-index="${h.index}" class="neighbor-card ${state.pins[c]===p.id?'in-use':''}"><button class="neighbor-preview" data-match="${h.index}" aria-label="Inspect closest ${c}"><b>${c}</b><img crossorigin="anonymous" src="${assetUrl('glyphs/')}${p.id}.webp" alt="Closest ${c}" loading="lazy"><span>cos ${h.score.toFixed(3)} · ${p.reviewed?'reviewed':'candidate'}</span></button><button class="use-match" data-use-match="${h.index}" ${state.pins[c]===p.id?'disabled':''}>${state.pins[c]===p.id?'In use':'Use '+c}</button>${hits.length>1?`<details><summary>${hits.length-1} alternatives</summary><div class="alternatives">${hits.slice(1).map(h=>`<button data-match="${h.index}" title="Inspect ${c} · cosine ${h.score.toFixed(3)}"><img crossorigin="anonymous" loading="lazy" src="${assetUrl('glyphs/')}${this.data.points[h.index].id}.webp" alt="Alternative ${c}"></button>`).join('')}</div></details>`:''}</div>`;}).join('')}</div><p class="quiet">Letter and group filters affect the map only. Matches search all letters; Reviewed seeds only and hidden exclusions also constrain matching. Existing pinned letters are preserved when filling an alphabet.</p>`);
  this.host.querySelectorAll('[data-match]').forEach(b=>b.onclick=()=>{const p=this.data.points[Number(b.dataset.match)];this.actions.inspect(p.letter,p.id);this.actions.revealInspector();});
  this.host.querySelectorAll('[data-use-match]').forEach(b=>b.onclick=()=>{const p=this.data.points[Number(b.dataset.useMatch)];this.actions.use(p.letter,p.id);this.update();});
  this.el('#use-matches').onclick=()=>this.assignNearest(true);
  this.bindNeighborHover(panel);
 }
 dispose(){this.disposed=true;this.request++;this.worker?.terminate();this.resize?.disconnect();}
}
