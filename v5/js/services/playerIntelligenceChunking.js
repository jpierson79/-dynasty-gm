export const INSPECTION_EVALUATION_CHUNK_SIZE=100;
export const yieldToEventLoop=()=>new Promise(resolve=>setTimeout(resolve,0));

export async function evaluateInChunks(items,evaluate,{chunkSize=INSPECTION_EVALUATION_CHUNK_SIZE,yieldFn=yieldToEventLoop,onProgress,phase="evaluation",progressOffset=0,progressTotal=items.length}={}){
  const output=[],started=performance.now();let yieldCount=0,maxChunkMs=0;
  for(let start=0;start<items.length;start+=chunkSize){
    const chunkStarted=performance.now(),end=Math.min(items.length,start+chunkSize);
    for(let index=start;index<end;index++)output.push(evaluate(items[index],index));
    maxChunkMs=Math.max(maxChunkMs,performance.now()-chunkStarted);
    onProgress?.({phase,evaluatedPlayers:end,totalPlayers:items.length,completedWork:progressOffset+end,totalWork:progressTotal,progressPercent:progressTotal?Math.round(100*(progressOffset+end)/progressTotal):100,elapsedMs:Math.round(performance.now()-started)});
    if(end<items.length){yieldCount++;await yieldFn();}
  }
  return {output,metrics:{durationMs:Math.round(performance.now()-started),yieldCount,maxChunkMs:Math.round(maxChunkMs*100)/100}};
}
