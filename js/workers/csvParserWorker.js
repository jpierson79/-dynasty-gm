self.onmessage=e=>{
  try{
    const text=e.data?.text||"";
    const rows=[];
    let cur=[],val="",q=false;
    for(let i=0;i<text.length;i++){
      const c=text[i],n=text[i+1];
      if(c==='"'&&q&&n==='"'){val+='"';i++}
      else if(c==='"')q=!q;
      else if(c===","&&!q){cur.push(val);val=""}
      else if((c==="\n"||c==="\r")&&!q){
        if(val||cur.length){cur.push(val);rows.push(cur);cur=[];val=""}
        if(c==="\r"&&n==="\n")i++;
      }else val+=c;
    }
    if(val||cur.length){cur.push(val);rows.push(cur)}
    postMessage({ok:true,rows:rows.filter(r=>r.some(x=>String(x).trim()))});
  }catch(error){
    postMessage({ok:false,error:error?.message||"CSV parse failed"});
  }
};
