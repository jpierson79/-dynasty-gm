export async function runWithDataHealthTimeout(operation,timeoutMs=60000){
  if(typeof operation!=="function")throw new TypeError("Data Health operation must be a function.");
  let timeoutId;
  const timeout=new Promise((_,reject)=>{
    timeoutId=setTimeout(()=>reject(new Error(`Data Health timed out after ${Math.ceil(timeoutMs/1000)} seconds. No data was changed; try again or inspect the cloud connection.`)),timeoutMs);
  });
  try{
    return await Promise.race([Promise.resolve().then(operation),timeout]);
  }finally{
    clearTimeout(timeoutId);
  }
}
