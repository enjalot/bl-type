import {rankMatches} from './style-math.js';
let vectors,points,dimensions,ready;
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){
   points=data.points;dimensions=data.vectors.dimensions;
   ready=(async()=>{const r=await fetch(data.vectors.url);if(!r.ok)throw Error('Could not load style embeddings');const buffer=await r.arrayBuffer();if(buffer.byteLength!==data.vectors.bytes||buffer.byteLength!==points.length*dimensions*4)throw Error('Style embedding dimensions do not match');vectors=new Float32Array(buffer);self.postMessage({type:'ready'});})();await ready;
  }else if(data.type==='matches'){
   await ready;if(!vectors)throw Error('Style embeddings are still loading');
   const matches=rankMatches(vectors,points,dimensions,data.anchor,data.options);
   self.postMessage({type:'matches',request:data.request,anchor:data.anchor,matches});
  }
 }catch(error){self.postMessage({type:'error',request:data.request,message:error.message});}
};
