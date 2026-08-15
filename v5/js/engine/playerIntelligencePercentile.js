const numeric=value=>typeof value==="number"&&Number.isFinite(value);
const round=value=>Math.round(Number(value)*100)/100;

export function buildExactPercentileContext(values=[]){
  const sorted=values.filter(numeric).sort((a,b)=>a-b),percentileByValue=new Map();
  for(let start=0;start<sorted.length;){
    let end=start+1;while(end<sorted.length&&sorted[end]===sorted[start])end++;
    const percentile=sorted.length===1?100:round(100*(start+Math.max(0,end-start-1)/2)/(sorted.length-1));
    percentileByValue.set(sorted[start],percentile);start=end;
  }
  return {sorted,percentileByValue,min:sorted[0]??null,max:sorted.at(-1)??null,range:sorted.length?Math.max(1,sorted.at(-1)-sorted[0]):1};
}

export function exactPercentile(value,context,{invert=false}={}){
  if(!numeric(value)||!context?.sorted?.length)return null;
  const percentile=context.percentileByValue.get(value);
  return percentile===undefined?null:round(invert?100-percentile:percentile);
}
