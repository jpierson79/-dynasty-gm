export function clampScore(value){
  const n=Number(value);
  if(!Number.isFinite(n))return 0;
  return Math.max(0,Math.min(100,Math.round(n)));
}

export function clampNumber(value,min=0,max=100){
  const n=Number(value);
  if(!Number.isFinite(n))return min;
  return Math.max(min,Math.min(max,n));
}

export function numberValue(value,fallback=0){
  const n=Number(value);
  return Number.isFinite(n)?n:fallback;
}

export function metricNumber(metrics,key,fallback=0){
  const n=Number(metrics?.[key]);
  return Number.isFinite(n)?n:fallback;
}

export function hasMetric(metrics,key){
  return Number.isFinite(Number(metrics?.[key]));
}

export function hkbScore(value){
  const hkb=Math.max(0,numberValue(value,0));
  if(!hkb)return 45;
  return clampScore(28+68*(1-Math.exp(-hkb/2600)));
}

export function weightedScore(entries){
  let total=0,weight=0;
  entries.forEach(([value,w])=>{
    const n=Number(value);
    const wt=Number(w);
    if(Number.isFinite(n)&&Number.isFinite(wt)&&wt>0){
      total+=n*wt;
      weight+=wt;
    }
  });
  return weight?total/weight:50;
}

export function confidenceAdjust(raw,confidence,{neutral=50,maxSwing=48}={}){
  const c=clampNumber(confidence,0,1);
  const adjusted=neutral+(raw-neutral)*(0.45+c*0.55);
  return clampScore(clampNumber(adjusted,neutral-maxSwing,neutral+maxSwing));
}

export function average(values){
  const nums=values.map(Number).filter(Number.isFinite);
  return nums.length?nums.reduce((sum,value)=>sum+value,0)/nums.length:null;
}

export function standardDeviation(values){
  const avg=average(values);
  if(avg===null)return null;
  const nums=values.map(Number).filter(Number.isFinite);
  const variance=nums.reduce((sum,value)=>sum+(value-avg)**2,0)/nums.length;
  return Math.sqrt(variance);
}
