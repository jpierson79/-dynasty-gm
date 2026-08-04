export function $(selector,root=document){return root.querySelector(selector)}
export function $all(selector,root=document){return [...root.querySelectorAll(selector)]}
export function escapeHtml(value){
  return String(value??"").replace(/[&<>"]/g,match=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[match]));
}
export function setHtml(el,html){if(el)el.innerHTML=html}
export function optionHtml(value,label,selectedValue=""){
  const selected=String(value)===String(selectedValue)?" selected":"";
  return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
}
export function debounce(fn,ms=200){
  let timer;
  return (...args)=>{clearTimeout(timer);timer=setTimeout(()=>fn(...args),ms)};
}
