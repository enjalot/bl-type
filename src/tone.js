// Estimate paper and ink separately so pale scans get the same usable tonal range.
export function toneLevels(rgba) {
 const histogram=new Uint32Array(256);
 let count=0,total=0;
 for(let i=0;i<rgba.length;i+=4){
  if(rgba[i+3]<128)continue;
  const gray=Math.round(.2126*rgba[i]+.7152*rgba[i+1]+.0722*rgba[i+2]);
  histogram[gray]++;count++;total+=gray;
 }
 if(!count)return {black:0,white:255};
 let left=0,sum=0,best=-1,threshold=0;
 for(let t=0;t<255;t++){
  left+=histogram[t];sum+=t*histogram[t];
  if(!left||left===count)continue;
  const delta=sum/left-(total-sum)/(count-left),score=left*(count-left)*delta*delta;
  if(score>best){best=score;threshold=t;}
 }
 const percentile=(fraction,end=255)=>{
  let n=0;for(let i=0;i<=end;i++)n+=histogram[i];
  let cumulative=0;for(let i=0;i<=end;i++){cumulative+=histogram[i];if(cumulative>=Math.max(1,n*fraction))return i;}
  return end;
 };
 const black=percentile(.2,threshold),white=percentile(.95);
 return best<0||white-black<8?{black:0,white:255}:{black,white};
}

export function normalizePixels(rgba,levels=toneLevels(rgba),transparent=false){
 const result=new Uint8ClampedArray(rgba.length),{black,white}=levels;
 for(let i=0;i<rgba.length;i+=4){
  const gray=Math.round(.2126*rgba[i]+.7152*rgba[i+1]+.0722*rgba[i+2]);
  const value=Math.max(0,Math.min(255,(gray-black)*255/(white-black)));
  result[i]=result[i+1]=result[i+2]=transparent?0:value;
  result[i+3]=transparent?(255-value)*rgba[i+3]/255:rgba[i+3];
 }
 return result;
}
