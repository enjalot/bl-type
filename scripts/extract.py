#!/usr/bin/env python3
"""Search the complete local BL index; preserve provenance and trace candidate tiles.
No source data is modified. Retrieval candidates are not verified character labels.
"""
import os
os.environ.setdefault('OMP_NUM_THREADS','4')
os.environ.setdefault('OPENBLAS_NUM_THREADS','4')
os.environ.setdefault('TOKENIZERS_PARALLELISM','false')
import argparse, json, string, shutil, time
from pathlib import Path
import numpy as np
from PIL import Image
import cv2
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(); parser.add_argument('--top-k',type=int,default=512); parser.add_argument('--keep',type=int,default=180); parser.add_argument('--refresh',action='store_true'); args=parser.parse_args()
OUT=ROOT/'public'; CACHE=ROOT/'extraction'; CACHE.mkdir(exist_ok=True)
EXP=Path('/data/latent-craft/experiments/bl-search-20260907b')
THUMBS=Path('/data/images/british-library-book-images/thumbs')
queries={c:[f'letter {c.lower()}'] for c in string.ascii_uppercase}
queries.update({c:[f'number {c}',f'the printed digit {c}'] for c in string.digits})
punct={'.':['a small round dot','a circular ornament'], ',':['a comma punctuation mark'], ':':['colon punctuation mark'], ';':['semicolon punctuation mark'], '!':['exclamation mark'], '?':['question mark'], '(':['left parenthesis','a curved ornamental bracket'], ')':['right parenthesis','a curved ornamental bracket'], '[':['left square bracket'], ']':['right square bracket'], '{':['left curly brace','a decorative curly bracket'], '}':['right curly brace','a decorative curly bracket'], '+':['a plus sign','a small cross ornament'], '-':['a horizontal decorative rule'], '=':['equals sign'], '/':['a diagonal slash'], '*':['a small star ornament','asterisk symbol'], '"':['double quotation marks'], "'":['a single quotation mark'], '<':['less than sign'], '>':['greater than sign'], '_':['a horizontal line ornament'], '#':['a hash symbol'], '&':['ampersand symbol'], '@':['at sign symbol']}
queries.update(punct)
cache=CACHE/'search.json'
if not cache.exists() or args.refresh:
 import torch,faiss
 from transformers import AutoTokenizer,Siglip2TextModel
 torch.set_num_threads(4); faiss.omp_set_num_threads(4)
 print('Loading local text encoder and full-corpus SQ8 index',flush=True)
 model=Siglip2TextModel.from_pretrained(EXP/'text-model',local_files_only=True).eval()
 tokenizer=AutoTokenizer.from_pretrained(EXP/'text-model',local_files_only=True)
 index=faiss.read_index(str(EXP/'faiss-sq8.index'),faiss.IO_FLAG_MMAP|faiss.IO_FLAG_READ_ONLY); index.nprobe=256
 results={}
 for char,phrases in queries.items():
  found={}
  with torch.inference_mode():
   emb=model(**tokenizer(phrases,padding='max_length',truncation=True,max_length=64,return_tensors='pt')).pooler_output
   emb=torch.nn.functional.normalize(emb,dim=-1).numpy()
  scores,ids=index.search(emb,args.top_k)
  for qi,phrase in enumerate(phrases):
   for rank,(row,score) in enumerate(zip(ids[qi],scores[qi])):
    if row<0: continue
    r=found.setdefault(int(row),dict(row=int(row),score=float(score),rank=rank,query=phrase,rrf=0))
    r['rrf']+=1/(30+rank)
    if rank<r['rank']:r.update(rank=rank,score=float(score),query=phrase)
  results[char]=sorted(found.values(),key=lambda r:-r['rrf'])
  print(f'{char}: {len(found)} candidates',flush=True)
 cache.write_text(json.dumps(dict(topK=args.top_k,queries=queries,results=results)))
 del model,index
receipt=json.loads(cache.read_text()); results=receipt['results']
import pyarrow.parquet as pq
points=pq.read_table('/data/latent-scope-3d/points/bl/points.parquet',columns=['fname','thumb_path','date','image_url','subset']).to_pydict()
vectors=np.load('/data/latent-basemap/substrates/bl-siglip2-1m/substrate.f16.npy',mmap_mode='r')
glyphs={}; sets={}; features=[]; embed=[]; ids=[]; seen_hash={}; duplicate_count=0

from imaging import process_image

for char,hits in results.items():
 chosen=[]; hashes=set()
 for hit in hits:
  row=hit['row']; src=THUMBS/points['thumb_path'][row]
  if not src.is_file():continue
  # Exact pixel duplicates are hidden within each letter, but remain in search.json.
  import hashlib
  digest=hashlib.sha256(Image.open(src).convert('RGB').tobytes()).hexdigest()
  if digest in hashes:duplicate_count+=1;continue
  hashes.add(digest)
  key=str(row)
  if key not in glyphs:
   src,im,clean,path,f,t=process_image(src)
   shutil.copyfile(src,OUT/'glyphs'/f'{row}.webp');clean.save(OUT/'glyphs'/f'{row}.png')
   w,h=im.size
   (OUT/'glyphs'/f'{row}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"><path fill="#191919" fill-rule="evenodd" d="{path}"/></svg>')
   glyphs[key]=dict(id=key,width=w,height=h,path=path,subset=points['subset'][row],fname=points['fname'][row],date=points['date'][row],source=points['image_url'][row],threshold=t)
   features.append(f);embed.append(np.array(vectors[row],dtype='float32'));ids.append(key)
  chosen.append(dict(id=key,score=round(hit['score'],5),query=hit['query'],rank=hit['rank']))
  if len(chosen)>=args.keep:break
 sets[char]=chosen
 print(f'Prepared {char}: {len(chosen)}',flush=True)
# Residualize semantic embeddings by their first character group to reduce letter identity.
x=np.array(embed); x/=np.linalg.norm(x,axis=1,keepdims=True)
lookup={key:i for i,key in enumerate(ids)}; groups={}
for c,hits in sets.items():
 for hit in hits:groups.setdefault(hit['id'],c)
for c in sets:
 idx=[lookup[k] for k,g in groups.items() if g==c]
 if idx:x[idx]-=x[idx].mean(axis=0)
z=PCA(n_components=20,random_state=17).fit_transform(x)
f=StandardScaler().fit_transform(np.array(features)); combined=np.column_stack([np.clip(f,-3,3),StandardScaler().fit_transform(z)*.35])
kmeans=KMeans(n_clusters=8,random_state=17,n_init=10).fit(combined)
xy=PCA(n_components=2,random_state=17).fit_transform(combined); xy=(xy-xy.min(axis=0))/(np.ptp(xy,axis=0)+1e-8)
clusters=[]
for ci in range(8):
 members=np.where(kmeans.labels_==ci)[0]; order=members[np.argsort(np.linalg.norm(combined[members]-kmeans.cluster_centers_[ci],axis=1))]
 clusters.append(dict(id=ci,name=f'Study {ci+1:02}',count=len(members),examples=[ids[i] for i in order[:8]]))
for i,key in enumerate(ids):glyphs[key].update(cluster=int(kmeans.labels_[i]),x=round(float(xy[i,0]),4),y=round(float(xy[i,1]),4))
# Keep SVG paths in a separate file so the initial catalogue stays small.
paths={key:g.pop('path') for key,g in glyphs.items()}; (CACHE/'paths.json').write_text(json.dumps(paths,separators=(',',':')))
manifest=dict(title='BL Type Foundry',created=time.strftime('%Y-%m-%d'),corpusSize=1080814,model='google/siglip2-so400m-patch16-256',sourceDataset='https://huggingface.co/datasets/biglam/british-library-book-images',retrieval=dict(topK=receipt['topK'],queries=sum(len(q) for q in receipt['queries'].values()),candidates=sum(len(h) for h in results.values()),uniqueCandidates=len({r['row'] for h in results.values() for r in h}),exactDuplicatesSkipped=duplicate_count,exhaustive=False),clustering='K-means (k=8, seed=17): standardized tile morphology/tone plus 20 PCA components of character-centered SigLIP embeddings at weight 0.35. Exploratory visual families, not verified typefaces.',glyphs=glyphs,sets=sets,clusters=clusters,punctuation=list(punct))
(OUT/'data/catalog.json').write_text(json.dumps(manifest,separators=(',',':')))
print(f'Done: {len(glyphs)} unique tiles; {sum(map(len,sets.values()))} assignments.',flush=True)
