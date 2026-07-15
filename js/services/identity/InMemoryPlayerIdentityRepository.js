import {
  candidateIdentitySummary,
  cleanExternalId,
  cleanMlbamId,
  fallbackIdentityKey,
  playerId,
  playerNormalizedName
} from "./playerIdentityUtils.js";

function add(map,key,player){
  if(!key)return;
  const rows=map.get(key)||[];
  rows.push(player);
  map.set(key,rows);
}

function cloneRows(rows){
  return [...(rows||[])];
}

function invalidReason(player){
  if(!player||typeof player!=="object")return "record_not_object";
  if(!playerId(player))return "missing_internal_player_id";
  return "";
}

export class InMemoryPlayerIdentityRepository{
  #byFantrax=new Map();
  #byMlbam=new Map();
  #byName=new Map();
  #invalidRecords=[];

  constructor(existingPlayers=[]){
    const rows=Array.isArray(existingPlayers)?existingPlayers:[];
    rows.forEach((player,index)=>{
      const reason=invalidReason(player);
      if(reason){
        this.#invalidRecords.push(Object.freeze({
          index,
          reason,
          summary:candidateIdentitySummary(player)
        }));
        return;
      }
      add(this.#byFantrax,cleanExternalId(player.fantrax_id),player);
      add(this.#byMlbam,cleanMlbamId(player.mlbam_id),player);
      add(this.#byName,playerNormalizedName(player),player);
    });
  }

  findByFantraxId(id){
    return cloneRows(this.#byFantrax.get(cleanExternalId(id)));
  }

  findByMlbamId(id){
    return cloneRows(this.#byMlbam.get(cleanMlbamId(id)));
  }

  findByNormalizedName(name){
    return cloneRows(this.#byName.get(playerNormalizedName({normalized_name:name})));
  }

  getDiagnostics(){
    return Object.freeze({
      invalidRecords:this.#invalidRecords.map(record=>Object.freeze({
        ...record,
        summary:{...record.summary,positions:[...record.summary.positions]}
      }))
    });
  }

  findInvalidMatches(importedPlayer){
    const incomingFantrax=cleanExternalId(importedPlayer?.fantrax_id);
    const incomingMlbam=cleanMlbamId(importedPlayer?.mlbam_id);
    const incomingFallback=!incomingFantrax&&!incomingMlbam?fallbackIdentityKey(importedPlayer):"";
    return this.#invalidRecords.filter(record=>{
      const summary=record.summary;
      return Boolean(
        incomingFantrax&&summary.fantraxId===incomingFantrax||
        incomingMlbam&&summary.mlbamId===incomingMlbam||
        incomingFallback&&`${summary.normalizedName}|${summary.team}|${summary.positions.join("/")}`===incomingFallback
      );
    }).map(record=>Object.freeze({
      ...record,
      summary:{...record.summary,positions:[...record.summary.positions]}
    }));
  }
}
