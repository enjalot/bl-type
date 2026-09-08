#!/usr/bin/env python3
"""UMAP and EVoC on letter-centered SigLIP embeddings, independent of legacy PCA.
Writes versioned assets; preserves source data and the original catalogue.
"""
import os
for key in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','NUMBA_NUM_THREADS']:os.environ.setdefault(key,'4')
import json,string,time,hashlib
from pathlib import Path
from importlib.metadata import version
import numpy as np
from sklearn.neighbors import NearestNeighbors
import umap
from evoc import EVoC
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'public/data';CACHE=ROOT/'extraction';START=time.time()
cat=json.loads((OUT/'catalog.json').read_text());source=Path('/data/latent-basemap/substrates/bl-siglip2-1m/substrate.f16.npy');all_vectors=np.load(source,mmap_mode='r')
# Each original image has exactly one label. Resolve the few repeated assignments
# by reviewed status, then best exact-letter-query similarity, then alphabetically.
assignments={}
for c in string.ascii_uppercase:
 for hit in cat['sets'][c]:
  if cat['glyphs'][hit['id']].get('derivation'):continue
  reviewed=hit['id'] in cat['reviewed'].get(c,[])
  priority=(int(reviewed),hit['score'],-ord(c))
  if hit['id'] not in assignments or priority>assignments[hit['id']]['priority']:
   assignments[hit['id']]=dict(id=hit['id'],letter=c,reviewed=reviewed,priority=priority)
points=sorted(assignments.values(),key=lambda p:(p['letter'],int(p['id'])))
rows=np.array([int(p['id']) for p in points]);raw=np.array(all_vectors[rows],dtype=np.float32);raw/=np.linalg.norm(raw,axis=1,keepdims=True)
labels=np.array([p['letter'] for p in points]);centered=raw.copy();centroids={};counts={}
for c in string.ascii_uppercase:
 mask=labels==c;centroid=raw[mask].mean(axis=0);centroids[c]=centroid;counts[c]=int(mask.sum());centered[mask]-=centroid
assert all(np.linalg.norm(centered[labels==c].mean(axis=0))<1e-5 for c in string.ascii_uppercase)
norms=np.linalg.norm(centered,axis=1,keepdims=True);assert np.all(norms>1e-6)
centered/=norms
assert np.isfinite(centered).all()
np.savez(CACHE/'letter-centered-embeddings.npz',raw=raw,centered=centered,rows=rows,letters=labels,centroids=np.stack(list(centroids.values())))
params=dict(n_neighbors=30,min_dist=.12,n_components=2,metric='cosine',n_epochs=350,random_state=17,n_jobs=1)
coords={}
for name,x in [('raw',raw),('centered',centered)]:
 print(f'UMAP {name}: {x.shape}',flush=True);t=time.time()
 cache_key=hashlib.sha256(x.tobytes()+json.dumps(params,sort_keys=True).encode()).hexdigest()[:12]
 cache=CACHE/f'style-umap-{name}-{cache_key}.npy'
 if cache.exists():xy=np.load(cache)
 else:
  xy=umap.UMAP(**params).fit_transform(x);np.save(cache,xy)
 coords[name]=np.round(xy,6).tolist();print(f'  {time.time()-t:.1f}s',flush=True)
print('EVoC on the full 1,152-dimensional centered unit vectors',flush=True)
eparams=dict(noise_level=.5,base_min_cluster_size=20,n_neighbors=30,n_epochs=100,random_state=17)
model=EVoC(**eparams).fit(centered)
layers=[]
for li,(lab,strength) in enumerate(zip(model.cluster_layers_,model.membership_strength_layers_)):
 groups=[]
 for group in sorted(set(lab)-{-1}):
  idx=np.where(lab==group)[0];mean=centered[idx].mean(axis=0);order=idx[np.argsort(-(centered[idx]@mean))]
  # Prefer diverse letters in the small group preview.
  examples=[];seen=set()
  for j in order:
   if labels[j] not in seen:examples.append(int(j));seen.add(labels[j])
   if len(examples)==6:break
  groups.append(dict(id=int(group),count=len(idx),letterCount=len(set(labels[idx])),examples=examples))
 layers.append(dict(id=li,labels=np.asarray(lab,dtype=int).tolist(),strengths=np.round(strength,4).tolist(),groups=groups,noise=int(np.sum(lab==-1))))
 print(f'  layer {li}: {len(groups)} groups, {layers[-1]["noise"]} ungrouped',flush=True)
# The count is discovered by EVoC. Select a manageable existing layer, not k-means.
default=min(range(len(layers)),key=lambda i:abs(len(layers[i]['groups'])-24))
metrics={}
for name,x in [('raw',raw),('centered',centered)]:
 # Exact cosine neighbours; this is an identity-leakage diagnostic, not style truth.
 nn=NearestNeighbors(n_neighbors=11,metric='cosine',algorithm='brute',n_jobs=4).fit(x).kneighbors(return_distance=False)[:,:10]
 metrics[name]=dict(sameLetterFractionAt10=float(np.mean(labels[nn]==labels[:,None])))
for p in points:p.pop('priority')
release=hashlib.sha256(centered.tobytes()+json.dumps(params,sort_keys=True).encode()).hexdigest()[:12]
vector_name=f'style-{release}.f32.bin';centered.astype('<f4').tofile(OUT/vector_name)
result=dict(version=2,release=release,points=points,coords=coords,layers=layers,defaultLayer=default,letters=list(string.ascii_uppercase),counts=counts,vectors=dict(url='/data/'+vector_name,dtype='float32-le',dimensions=1152,rows=len(points),bytes=centered.nbytes,sha256=hashlib.sha256(centered.astype('<f4').tobytes()).hexdigest()),method=dict(formula='z_i = normalize(normalize(e_i) - mean(normalize(e_j) for j with letter(j) = letter(i)))',centroids='Arithmetic mean of all retained, uniquely assigned candidates for each A–Z letter. Reviewed labels win overlaps; otherwise the strongest exact-letter query wins.',assignmentCount=sum(len(cat['sets'][c]) for c in string.ascii_uppercase),uniqueImages=len(points),umap=params,clustering=dict(algorithm='EVoC',version=version('evoc'),parameters=eparams),neighbors='Exact cosine similarity of the 1,152-dimensional centered, renormalized embeddings. Not distance on the 2D map.',limitations='Letter labels are retrieval-derived, with a small reviewed seed set. Centering suppresses each letter average, but does not guarantee pure style. Digits and derived punctuation have no matching crop embeddings and are excluded.'),metrics=metrics,versions={name:version(name) for name in ['numpy','umap-learn','evoc','scikit-learn']},elapsedSeconds=round(time.time()-START,2))
tmp=OUT/'style-map.json.tmp';tmp.write_text(json.dumps(result,separators=(',',':'),allow_nan=False));tmp.replace(OUT/'style-map.json')
(CACHE/'style-map-receipt.json').write_text(json.dumps({k:v for k,v in result.items() if k not in ['points','coords','layers']},indent=2))
print('DONE',release,metrics,'seconds',result['elapsedSeconds'],flush=True)
