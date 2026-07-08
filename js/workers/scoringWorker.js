self.onmessage=e=>{
  const {view,players=[],myOwner=""}=e.data||{};
  const clean=s=>String(s||"").trim().toLowerCase();
  const mine=players.filter(p=>clean(p.owner)===clean(myOwner));
  const freeAgents=players.filter(p=>clean(p.owner)==="free agent");
  const by=(key)=>players.slice().sort((a,b)=>(+b[key]||0)-(+a[key]||0)).slice(0,25).map(p=>({name:p.name,owner:p.owner,pos:p.pos,value:+p[key]||0}));
  const summary={
    view,
    generatedAt:Date.now(),
    counts:{players:players.length,mine:mine.length,freeAgents:freeAgents.length,other:Math.max(0,players.length-mine.length-freeAgents.length)},
    top:{assets:by("dynastyAssetScore"),risk:by("dynastyRiskScore"),breakout:by("breakoutScore"),appreciation:by("marketAppreciationScore")}
  };
  self.postMessage(summary);
};
