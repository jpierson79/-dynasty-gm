import assert from "node:assert/strict";
import { getPlayers } from "../js/services/cloudStore.js";

function player(id){
  return { id, league_id:"league-1", name:`Player ${id}` };
}

function mockSupabase({pages,failures={}}){
  const calls=[];
  return {
    calls,
    from(table){
      const state={table};
      const query={
        select(columns){state.columns=columns;return query},
        eq(column,value){state.eq={column,value};return query},
        order(column,options){state.order={column,options};return query},
        range(from,to){
          calls.push({...state,from,to});
          const failure=failures[`${from}-${to}`];
          if(failure)return Promise.resolve({data:null,error:{message:failure}});
          return Promise.resolve({data:pages.shift()||[],error:null});
        }
      };
      return query;
    }
  };
}

const firstPage=Array.from({length:1000},(_,index)=>player(`p${index+1}`));
const secondPage=Array.from({length:1000},(_,index)=>player(`p${index+1001}`));
const finalPage=Array.from({length:5},(_,index)=>player(`p${index+2001}`));
const supabase=mockSupabase({pages:[firstPage,secondPage,finalPage]});
const rows=await getPlayers("league-1",{supabaseClient:supabase});

assert.equal(rows.length,2005);
assert.deepEqual(
  supabase.calls.map(call=>({table:call.table,from:call.from,to:call.to,order:call.order,eq:call.eq})),
  [
    {table:"players",from:0,to:999,order:{column:"id",options:{ascending:true}},eq:{column:"league_id",value:"league-1"}},
    {table:"players",from:1000,to:1999,order:{column:"id",options:{ascending:true}},eq:{column:"league_id",value:"league-1"}},
    {table:"players",from:2000,to:2999,order:{column:"id",options:{ascending:true}},eq:{column:"league_id",value:"league-1"}}
  ]
);

const failingSupabase=mockSupabase({
  pages:[firstPage],
  failures:{"1000-1999":"database range exploded"}
});
await assert.rejects(
  () => getPlayers("league-1",{supabaseClient:failingSupabase}),
  /Player preload failed at range 1000-1999: database range exploded/
);

console.log("cloudStorePagination tests passed");
