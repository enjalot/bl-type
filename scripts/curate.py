#!/usr/bin/env python3
"""Apply the recorded visual review and make traceable punctuation cuts.
Run after extract.py. All cuts retain source row, source URL and operation notes.
"""
import json,string
from pathlib import Path
import numpy as np
from PIL import Image,ImageOps
import pyarrow.parquet as pq
from imaging import process_image
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'public';file=OUT/'data/catalog.json';cat=json.loads(file.read_text())
points=pq.read_table('/data/latent-scope-3d/points/bl/points.parquet',columns=['fname','thumb_path','date','image_url','subset']).to_pydict()
probe=json.loads((ROOT/'extraction/primary-probe.json').read_text())
# Zero-based result positions rejected during the 12-per-letter contact-sheet review.
rejected={'D':[5,6,11],'F':[4,6],'G':[3],'I':[5],'K':[6],'O':[3],'P':[],'Q':[10],'X':[9],'Y':[9]}
for c in string.ascii_uppercase:
 good=[str(h['row']) for i,h in enumerate(probe[c][:12]) if i not in rejected.get(c,[]) and str(h['row']) in cat['glyphs']]
 cat.setdefault('reviewed',{})[c]=good
 hits={h['id']:h for h in cat['sets'][c]}
 cat['sets'][c]=[hits.pop(id) for id in good if id in hits]+list(hits.values())

def source(row):return Image.open('/data/images/british-library-book-images/thumbs/'+points['thumb_path'][row]).convert('RGB')
def crop(row,box):
 im=source(row);w,h=im.size;return im.crop(tuple(round(v*(w if i%2==0 else h)) for i,v in enumerate(box)))
def paper(im):return tuple(np.percentile(np.array(im).reshape(-1,3),90,axis=0).astype(int))
def paste_parts(parts,size,bg):
 im=Image.new('RGB',size,bg)
 for p,xy in parts:im.paste(p,xy)
 return im

def add(c,row,im,note):
 id=str(2000000+ord(c)); path=OUT/'glyphs'/f'{id}.webp';im.save(path,lossless=True)
 _,im,clean,d,features,t=process_image(path);clean.save(OUT/'glyphs'/f'{id}.png');w,h=im.size
 (OUT/'glyphs'/f'{id}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"><path fill="#191919" fill-rule="evenodd" d="{d}"/></svg>')
 old=cat['glyphs'].get(str(row),{});cat['glyphs'][id]=dict(id=id,width=w,height=h,subset=points['subset'][row],fname=points['fname'][row],date=points['date'][row],source=points['image_url'][row],sourceRow=row,derivation=note,threshold=t,cluster=old.get('cluster',3),clusterInherited=True,x=old.get('x',.5),y=old.get('y',.5))
 cat['sets'][c]=[dict(id=id,score=0,query='Manually reviewed source fragment',rank=0)]+[h for h in cat['sets'][c] if h['id']!=id]
 cat.setdefault('reviewed',{})[c]=[id]

# Digits taken from price marks, decorative numerals and figure/page numbers.
for c,row,box in [('1',644900,(.02,.03,.47,.94)),('2',453501,(.19,.49,.75,.88)),('3',452188,(0,0,1,1)),('4',380694,(.02,.03,.34,.96)),('5',597313,(0,0,1,1)),('6',476063,(.26,.31,.35,.75)),('7',465792,(.02,.03,.32,.96)),('8',380171,(.65,.02,.83,.97)),('9',380210,(.79,.08,.99,.97))]:
 add(c,row,crop(row,box),'Rectangular crop of a printed numeral; no redrawing.')
cat['reviewed']['0']=[id for id in ['501140','505330','417221','456728'] if id in cat['glyphs']]
# A question-mark dot and comma provide the raw pieces for common punctuation.
dot=crop(391136,(.28,.67,.73,.92));comma=crop(297844,(.24,.44,.39,.65))
add('.',391136,dot,'Bottom dot cropped from a printed question mark.')
add(',',297844,comma,'One comma cropped from a circular punctuation illustration.')
for c in [':',';']:
 second=dot if c==':' else comma.resize((dot.width,round(dot.height*1.45)))
 im=paste_parts([(dot,(0,0)),(second,(0,dot.height*2))],(dot.width,dot.height*2+second.height),paper(dot))
 add(c,391136,im,'Two source fragments stacked: question-mark dots'+(' and comma from row 297844.' if c==';' else '.'))
mark=crop(489729,(.79,.08,.93,.94)); markdot=dot.resize((mark.width,mark.width)); bang=paste_parts([(mark,(0,0)),(markdot,(0,mark.height+8))],(mark.width,mark.height+8+mark.width),paper(mark));add('!',489729,bang,'Vertical mark cropped from an illustration, with a question-mark dot from row 391136 below.')
add('?',391136,source(391136),'Whole source tile, reviewed as a question mark.')
for c in ["'",'"']:
 im=ImageOps.flip(comma)
 if c=='"':im=paste_parts([(im,(0,0)),(im,(im.width+4,0))],(im.width*2+4,im.height),paper(im))
 add(c,297844,im,'Comma fragment flipped vertically'+(' and repeated.' if c=='"' else '.'))
# Brackets are assembled from a found architectural corner; braces from a printed ornament.
corner=crop(358630,(.08,.08,.94,.88));w,h=corner.size
bracket=paste_parts([(corner,(0,0)),(ImageOps.flip(corner),(0,h))],(w,h*2),paper(corner))
for c in ['[',']']:add(c,358630,bracket if c=='[' else ImageOps.mirror(bracket),'Architectural corner cropped, reflected vertically and joined'+('; then mirrored.' if c==']' else '.'))
brace=crop(577748,(.01,.02,.34,.96))
for c in ['{','}']:add(c,577748,brace if c=='{' else ImageOps.mirror(brace),'Left curly ornament cropped from a printed symbol sheet'+('; mirrored.' if c=='}' else '.'))
arc=crop(695356,(.015,.01,.48,.99))
for c in ['(',')']:add(c,695356,arc if c=='(' else ImageOps.mirror(arc),'Arc cropped from a drawn circle'+('; mirrored.' if c==')' else '.'))
add('&',531689,crop(531689,(.06,.07,.68,.97)),'Ampersand cropped to remove the trailing c and period.')
# A simple ink stroke from the source price mark is reused for code operators.
stroke=crop(644900,(.66,.46,.92,.59));stroke=stroke.resize((120,12));bg=paper(stroke)
for c in ['-','_']:add(c,644900,stroke,'Horizontal ink stroke cropped from a printed price mark.')
equals=paste_parts([(stroke,(0,0)),(stroke,(0,36))],(120,48),bg);add('=',644900,equals,'Two copies of the price-mark stroke stacked.')
slash=crop(644900,(.45,.07,.65,.9));add('/',644900,slash,'Slash cropped from a printed price mark.')
# Chevron assembled from the same historical ink stroke, with the construction recorded.
for c in ['<','>']:
 im=Image.new('RGB',(110,140),bg);arr=np.array(im)
 # Rotate strips on paper; this is a collage of source ink, not a font fallback.
 strip=stroke.rotate(35,expand=True,fillcolor=bg);strip.thumbnail((100,75));im.paste(strip,(4,4));im.paste(ImageOps.flip(strip),(4,62))
 if c=='>':im=ImageOps.mirror(im)
 add(c,644900,im,'Two rotated copies of a found ink stroke form a chevron'+('; mirrored.' if c=='>' else '.'))
for c,ids in {'+':['392204','459386','398606','610086'],'*':['525486','581645','608063','520037'],'#':['601825'],'@':['488742']}.items():cat['reviewed'][c]=[id for id in ids if id in cat['glyphs']]
cat['glyphs'][str(2000000+ord(';'))]['sourceRows']=[391136,297844]
cat['glyphs'][str(2000000+ord('!'))]['sourceRows']=[489729,391136]
cat['curation']='The first 12 exact letter-query results were visually reviewed, with obvious mismatches excluded from default shuffling. This is a small seed alphabet, not a full review. Digits and punctuation include labelled crops and collages with retained source identities.'
cat['clustering'] = cat['clustering'].split(' Derived cuts')[0] + ' Derived cuts inherit their source cluster when available (otherwise Study 04); they are not reclustered.'
cat['derivedCount']=sum('derivation' in g for g in cat['glyphs'].values())
file.write_text(json.dumps(cat,separators=(',',':')))
print('Curated defaults:',{c:len(ids) for c,ids in cat['reviewed'].items()});print('Derived fragments:',cat['derivedCount'])
