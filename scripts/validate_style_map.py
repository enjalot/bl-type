"""Check centering, vector identity and exact nearest-neighbor reference cases."""
import os
os.environ.setdefault('OPENBLAS_NUM_THREADS','4')
import json,hashlib
from pathlib import Path
import numpy as np
R=Path(__file__).resolve().parents[1];m=json.loads((R/'public/data/style-map.json').read_text());arrays=np.load(R/'extraction/letter-centered-embeddings.npz');x=arrays['centered'];raw=arrays['raw'];letters=arrays['letters']
assert x.shape==(len(m['points']),1152)
assert np.allclose(np.linalg.norm(x,axis=1),1,atol=1e-6)
assert np.allclose(np.linalg.norm(raw,axis=1),1,atol=1e-6)
for c in m['letters']:
 mask=letters==c;r=raw[mask]-raw[mask].mean(axis=0)
 assert np.linalg.norm(r.mean(axis=0))<1e-5
 assert np.allclose(r/np.linalg.norm(r,axis=1,keepdims=True),x[mask],atol=2e-6)
path=R/'public'/m['vectors']['url'].lstrip('/');payload=path.read_bytes();assert hashlib.sha256(payload).hexdigest()==m['vectors']['sha256'];assert payload==x.astype('<f4').tobytes()
cases=[]
for c in ['A','J','Q']:
 anchor=next(i for i,p in enumerate(m['points']) if p['letter']==c and p['reviewed']);scores=x@x[anchor];expected={}
 for letter in m['letters']:
  idx=np.where(letters==letter)[0];idx=idx[idx!=anchor];top=idx[np.argsort(-scores[idx])[:5]];expected[letter]=[dict(index=int(i),score=float(scores[i])) for i in top]
 cases.append(dict(anchor=anchor,expected=expected))
(R/'tests/fixtures/style-neighbor-oracle.json').write_text(json.dumps(cases))
print('PASS: centroids, residual unit norms, row identity, byte-exact browser vectors, SHA256. Wrote three independent NumPy nearest-neighbor oracles.')
