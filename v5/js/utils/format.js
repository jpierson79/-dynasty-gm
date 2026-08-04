export function number(value){
  const n=Number(value||0);
  return Number.isFinite(n)?n.toLocaleString():"0";
}
export function percent(part,total){
  const p=Number(part||0),t=Number(total||0);
  if(!t)return"0%";
  return `${Math.round((p/t)*100)}%`;
}
export function text(value,fallback=""){return value===undefined||value===null||value===""?fallback:String(value)}
export function todayIso(){return new Date().toISOString()}
