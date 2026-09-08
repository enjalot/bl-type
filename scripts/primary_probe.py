import json,string,urllib.request
from PIL import Image,ImageDraw
from pathlib import Path
out=Image.new('RGB',(1200,26*95),'#eeeade');d=ImageDraw.Draw(out);results={}
for i,c in enumerate(string.ascii_uppercase):
 req=urllib.request.Request('http://127.0.0.1:8804/api/bl/search',data=json.dumps({'query':'letter '+c.lower(),'backend':'faiss'}).encode(),headers={'Content-Type':'application/json'})
 hits=json.load(urllib.request.urlopen(req))['results'];results[c]=hits
 for j,h in enumerate(hits[:12]):
  im=Image.open('/data/images/british-library-book-images/thumbs/'+h['thumbUrl'].split('/bl/')[1]);im.thumbnail((78,65));x=j*100;y=i*95;out.paste(im,(x,y));d.text((x,y+66),c+' '+str(h['row']),fill='black')
 print(c,flush=True)
Path('bl-type/extraction/primary-probe.json').write_text(json.dumps(results));out.save('/tmp/bl-primary.jpg')
