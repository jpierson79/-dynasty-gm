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

const PLAYER_IDENTITY_DIAGNOSTIC_FANTRAX_ID="*05rat*";

export class InMemoryPlayerIdentityRepository{
  #byFantrax=new Map();
  #byMlbam=new Map();
  #byName=new Map();
  #invalidRecords=[];

  constructor(existingPlayers=[]){
    const rows=Array.isArray(existingPlayers)?existingPlayers:[];
    const internalIds=new Set();
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
      internalIds.add(playerId(player));
      add(this.#byFantrax,cleanExternalId(player.fantrax_id),player);
      add(this.#byMlbam,cleanMlbamId(player.mlbam_id),player);
      add(this.#byName,playerNormalizedName(player),player);
    });
    const targetRows=this.#byFantrax.get(PLAYER_IDENTITY_DIAGNOSTIC_FANTRAX_ID)||[];
    console.info("[PlayerIdentityRepository diagnostic]",{
      sourceRows:rows.length,
      indexedByInternalUuid:internalIds.size,
      indexedByFantraxId:this.#byFantrax.size,
      indexedByMlbamId:this.#byMlbam.size,
      indexedByNormalizedName:this.#byName.size,
      invalidRecords:this.#invalidRecords.length,
      targetFantraxId:PLAYER_IDENTITY_DIAGNOSTIC_FANTRAX_ID,
      repositoryContainsFantraxId:targetRows.length>0,
      targetMatches:targetRows.map(player=>({
        playerId:playerId(player),
        name:playerName(player)
      }))
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
    const targetRows=this.#byFantrax.get(PLAYER_IDENTITY_DIAGNOSTIC_FANTRAX_ID)||[];
    return Object.freeze({
      counts:Object.freeze({
        indexedByFantraxId:this.#byFantrax.size,
        indexedByMlbamId:this.#byMlbam.size,
        indexedByNormalizedName:this.#byName.size,
        invalidRecords:this.#invalidRecords.length
      }),
      diagnosticFantraxLookup:Object.freeze({
        fantraxId:PLAYER_IDENTITY_DIAGNOSTIC_FANTRAX_ID,
        repositoryContainsFantraxId:targetRows.length>0,
        matches:Object.freeze(targetRows.map(player=>Object.freeze({
          playerId:playerId(player),
          name:playerName(player)
        })))
      }),
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
