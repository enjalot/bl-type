import {normalizePixels,toneLevels} from './tone.js';
import {assetUrl} from './assets.js';

const cache=new Map();
export function normalizedTile(id){
 if(cache.has(id)){const pending=cache.get(id);cache.delete(id);cache.set(id,pending);return pending;}
 const pending=renderTile(id).catch(error=>{cache.delete(id);throw error;});
 cache.set(id,pending);
 if(cache.size>256)cache.delete(cache.keys().next().value);
 return pending;
}
async function renderTile(id){
 const image=new Image();image.crossOrigin='anonymous';image.src=assetUrl('glyphs/'+id+'.webp');await image.decode();
 const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),levels=toneLevels(pixels.data),result={};
 for(const mode of ['original','clean']){
  ctx.putImageData(new ImageData(normalizePixels(pixels.data,levels,mode==='clean'),canvas.width,canvas.height),0,0);
  result[mode]=canvas.toDataURL('image/png');
 }
 return result;
}
