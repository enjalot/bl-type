import json,urllib.request
from PIL import Image,ImageDraw
from pathlib import Path
queries={'0':'number 0','1':'number 1','2':'number 2','3':'number 3','4':'number 4','5':'number 5','6':'number 6','7':'number 7','8':'number 8','9':'number 9','.':'a small round dot',',':'a comma punctuation mark',':':'colon punctuation mark',';':'semicolon punctuation mark','!':'exclamation mark','?':'question mark','(':'left parenthesis',')':'right parenthesis','[':'left square bracket',']':'right square bracket','{':'left curly brace','}':'right curly brace','+':'a plus sign','-':'a horizontal decorative rule','=':'equals sign','/':'a diagonal slash','*':'asterisk symbol','"':'double quotation marks',"'":'a single quotation mark','<':'less than sign','>':'greater than sign','#':'a hash symbol','&':'ampersand symbol','@':'at sign symbol'}
out=Image.new('RGB',(1200,len(queries)*95),'#eeeade');d=ImageDraw.Draw(out);results={}
for i,(c,q) in enumerate(queries.items()):
 req=urllib.request.Request('http://127.0.0.1:8804/api/bl/search',data=json.dumps({'query':q,'backend':'faiss'}).encode(),headers={'Content-Type':'application/json'})
 hits=json.load(urllib.request.urlopen(req))['results'];results[c]=hits
 for j,h in enumerate(hits[:12]):
  im=Image.open('/data/images/british-library-book-images/thumbs/'+h['thumbUrl'].split('/bl/')[1]);im.thumbnail((78,65));x=j*100;y=i*95;out.paste(im,(x,y));d.text((x,y+66),c+' '+str(h['row']),fill='black')
Path('bl-type/extraction/punctuation-probe.json').write_text(json.dumps(results));out.save('/tmp/bl-punctuation.jpg')
