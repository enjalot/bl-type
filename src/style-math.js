// Both the map and neighbour lists refer to stable indices in style-map.json.
export function rankMatches(vectors, points, dimensions, anchor, {reviewedOnly=false, hidden=[], limit=5}={}) {
 if(!Number.isInteger(anchor)||anchor<0||anchor>=points.length)throw Error('Invalid reference tile');
 const excluded=new Set(hidden), result=Object.fromEntries('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c=>[c,[]]));
 const offset=anchor*dimensions;
 for(let i=0;i<points.length;i++){
  const p=points[i];if(i===anchor||p.id===points[anchor].id||excluded.has(p.letter+':'+p.id)||(reviewedOnly&&!p.reviewed))continue;
  let score=0;const start=i*dimensions;for(let d=0;d<dimensions;d++)score+=vectors[offset+d]*vectors[start+d];
  const list=result[p.letter];if(!list)continue;
  const hit={index:i,score:Math.max(-1,Math.min(1,score))};
  const pos=list.findIndex(v=>hit.score>v.score||(hit.score===v.score&&i<v.index));
  if(pos<0){if(list.length<limit)list.push(hit);}else{list.splice(pos,0,hit);if(list.length>limit)list.pop();}
 }
 return result;
}
export function visiblePoint(point,index,{letter='all',group='all',reviewedOnly=false},labels,hidden=[]){
 return (letter==='all'||point.letter===letter)&&(group==='all'||labels[index]===Number(group))&&(!reviewedOnly||point.reviewed)&&!hidden.includes(point.letter+':'+point.id);
}
