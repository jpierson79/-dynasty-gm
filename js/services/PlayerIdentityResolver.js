import { InMemoryPlayerIdentityRepository } from "./identity/InMemoryPlayerIdentityRepository.js";
import {
  RESOLVER_VERSION,
  candidateIdentitySummary,
  cleanExternalId,
  cleanMlbamId,
  cloneSummary,
  createResolutionKey,
  incomingIdentitySummary,
  normalizeName,
  playerNormalizedName,
  positionsOverlap,
  sortCandidateSummaries
} from "./identity/playerIdentityUtils.js";

const ACTIONS=Object.freeze({
  INSERT:"insert",
  UPDATE:"update",
  CONFLICT:"conflict",
  UNMATCHED:"unmatched"
});

const CONFIDENCE=Object.freeze({
  HIGH:"high",
  MEDIUM:"medium",
  LOW:"low"
});

const MATCH_SOURCE=Object.freeze({
  FANTRAX:"fantrax_id",
  MLBAM:"mlbam_id",
  FALLBACK:"fallback"
});

const REASONS=Object.freeze({
  FANTRAX_MATCH:"fantrax_id_match",
  MLBAM_MATCH:"mlbam_id_match",
  FALLBACK_MATCH:"safe_fallback_match",
  INSERT_STABLE:"no_existing_stable_identifier_match",
  DUPLICATE_FANTRAX:"duplicate_existing_fantrax_id",
  DUPLICATE_MLBAM:"duplicate_existing_mlbam_id",
  SPLIT_STABLE_IDS:"fantrax_id_and_mlbam_id_match_different_players",
  STABLE_FALLBACK_CONFLICT:"stable_identifier_conflicts_with_fallback_candidate",
  AMBIGUOUS_FALLBACK:"ambiguous_fallback_match",
  MISSING_IDENTITY:"missing_stable_identifier_and_no_safe_fallback",
  INVALID_EXISTING_PLAYER:"invalid_existing_player_identity"
});

const PLAYER_IDENTITY_DIAGNOSTIC_FANTRAX_ID="*05rat*";

const CONFIDENCE_SCORES=Object.freeze({
  FANTRAX_UPDATE:1.00,
  MLBAM_UPDATE:0.98,
  FALLBACK_UPDATE:0.85,
  FANTRAX_INSERT:0.95,
  MLBAM_INSERT:0.93,
  CONFLICT:0.00,
  UNMATCHED:0.00
});

function hasMethod(value,name){
  return typeof value?.[name]==="function";
}

function asArray(value){
  return Array.isArray(value)?[...value]:[];
}

function safeRepositoryCall(repository,method,arg){
  return asArray(repository[method](arg));
}

function stableId(player){
  return cleanExternalId(player?.id);
}

function candidateSummaries(players){
  return sortCandidateSummaries(players.map(candidateIdentitySummary));
}

function logDiagnosticFantraxDecision(incoming,result){
  if(cleanExternalId(incoming?.fantrax_id)!==PLAYER_IDENTITY_DIAGNOSTIC_FANTRAX_ID)return;
  const repositoryLookup=result?.diagnostics?.repository?.diagnosticFantraxLookup||{};
  const repositoryMatch=Array.isArray(repositoryLookup.matches)?repositoryLookup.matches[0]:null;
  console.info("[PlayerIdentityResolver diagnostic]",{
    incomingFantraxId:PLAYER_IDENTITY_DIAGNOSTIC_FANTRAX_ID,
    repositoryContainsFantraxId:Boolean(repositoryLookup.repositoryContainsFantraxId),
    matchedPlayerId:result?.matchedPlayerId||null,
    repositoryPlayerName:result?.playerSummary?.name||repositoryMatch?.name||null,
    resolverDecision:result?.action||null,
    resolverBranch:Array.isArray(result?.trace)?result.trace[result.trace.length-1]||null:null
  });
}

function repositoryDiagnostics(repository,importedPlayer){
  const diagnostics=hasMethod(repository,"getDiagnostics")?repository.getDiagnostics():{};
  const invalidRecords=Array.isArray(diagnostics?.invalidRecords)?diagnostics.invalidRecords:[];
  const relevantInvalidRecords=hasMethod(repository,"findInvalidMatches")
    ?asArray(repository.findInvalidMatches(importedPlayer))
    :[];
  return {
    counts:diagnostics?.counts||{},
    diagnosticFantraxLookup:diagnostics?.diagnosticFantraxLookup||{},
    invalidRecords:invalidRecords.map(record=>({
      ...record,
      summary:record.summary?cloneSummary(record.summary):record.summary
    })),
    relevantInvalidRecords:relevantInvalidRecords.map(record=>({
      ...record,
      summary:record.summary?cloneSummary(record.summary):record.summary
    }))
  };
}

function fallbackMatches(incoming,repository){
  const nameKey=playerNormalizedName(incoming);
  if(!nameKey)return [];
  return safeRepositoryCall(repository,"findByNormalizedName",nameKey)
    .filter(candidate=>{
      const incomingSummary=incomingIdentitySummary(incoming);
      const candidateSummary=candidateIdentitySummary(candidate);
      return Boolean(
        incomingSummary.team&&
        candidateSummary.team&&
        incomingSummary.team===candidateSummary.team&&
        positionsOverlap(incomingSummary.positions,candidateSummary.positions)
      );
    })
    .sort((a,b)=>stableId(a).localeCompare(stableId(b))||candidateIdentitySummary(a).name.localeCompare(candidateIdentitySummary(b).name));
}

function baseResult(incoming,diagnosticContext,trace,payload){
  const relevantKeys=new Set((diagnosticContext.repositoryDiagnostics.relevantInvalidRecords||[]).map(record=>`${record.index}:${record.reason}`));
  const repositoryWarnings=(diagnosticContext.repositoryDiagnostics.invalidRecords||[])
    .filter(record=>!relevantKeys.has(`${record.index}:${record.reason}`));
  const result=Object.freeze({
    resolverVersion:RESOLVER_VERSION,
    resolvedAt:new Date().toISOString(),
    resolutionKey:createResolutionKey(incoming),
    trace:Object.freeze([...trace]),
    diagnostics:Object.freeze({
      incoming:cloneSummary(incomingIdentitySummary(incoming)),
      candidateCounts:Object.freeze({
        fantrax:diagnosticContext.fantraxMatches.length,
        mlbam:diagnosticContext.mlbamMatches.length,
        fallback:diagnosticContext.fallback.length
      }),
      repository:Object.freeze({
        counts:Object.freeze({...(diagnosticContext.repositoryDiagnostics.counts||{})}),
        diagnosticFantraxLookup:Object.freeze({
          ...(diagnosticContext.repositoryDiagnostics.diagnosticFantraxLookup||{}),
          matches:Object.freeze([...(diagnosticContext.repositoryDiagnostics.diagnosticFantraxLookup?.matches||[])])
        })
      }),
      warnings:Object.freeze(repositoryWarnings.map(record=>`ignored_invalid_existing_player:${record.reason}`))
    }),
    matchedPlayerId:null,
    confidence:CONFIDENCE.LOW,
    confidenceScore:CONFIDENCE_SCORES.UNMATCHED,
    matchSource:null,
    ...payload
  });
  logDiagnosticFantraxDecision(incoming,result);
  return result;
}

function conflictResult(reason,incoming,diagnosticContext,players,trace){
  const candidates=candidateSummaries(players);
  return baseResult(incoming,diagnosticContext,[...trace,"resolved_conflict"],{
    action:ACTIONS.CONFLICT,
    confidence:CONFIDENCE.LOW,
    confidenceScore:CONFIDENCE_SCORES.CONFLICT,
    reason,
    conflict:Object.freeze({
      reason,
      incoming:cloneSummary(incomingIdentitySummary(incoming)),
      candidates:Object.freeze(candidates),
      conflictingPlayerIds:candidates.map(candidate=>candidate.id).filter(Boolean),
      conflictingPlayerNames:candidates.map(candidate=>candidate.name).filter(Boolean),
      compatibility:Object.freeze({
        conflictingPlayerIds:Object.freeze(candidates.map(candidate=>candidate.id).filter(Boolean)),
        conflictingPlayerNames:Object.freeze(candidates.map(candidate=>candidate.name).filter(Boolean))
      })
    })
  });
}

function updateResult(player,incoming,diagnosticContext,trace,{reason,matchSource,confidenceScore}){
  const summary=candidateIdentitySummary(player);
  return baseResult(incoming,diagnosticContext,trace,{
    action:ACTIONS.UPDATE,
    matchedPlayerId:summary.id,
    confidence:matchSource===MATCH_SOURCE.FALLBACK?CONFIDENCE.MEDIUM:CONFIDENCE.HIGH,
    confidenceScore,
    matchSource,
    reason,
    playerSummary:summary
  });
}

function insertResult(incoming,diagnosticContext,trace,matchSource){
  return baseResult(incoming,diagnosticContext,trace,{
    action:ACTIONS.INSERT,
    confidence:CONFIDENCE.HIGH,
    confidenceScore:matchSource===MATCH_SOURCE.FANTRAX?CONFIDENCE_SCORES.FANTRAX_INSERT:CONFIDENCE_SCORES.MLBAM_INSERT,
    matchSource,
    reason:REASONS.INSERT_STABLE
  });
}

function unmatchedResult(reason,incoming,diagnosticContext,trace,extra={}){
  return baseResult(incoming,diagnosticContext,trace,{
    action:ACTIONS.UNMATCHED,
    confidence:CONFIDENCE.LOW,
    confidenceScore:CONFIDENCE_SCORES.UNMATCHED,
    reason,
    ...extra
  });
}

/**
 * Resolves one normalized imported player against a player identity repository.
 * The resolver is side-effect free, database-agnostic, and intentionally has no
 * CSV parsing or importer-specific behavior.
 */
export class PlayerIdentityResolver{
  #repository;

  constructor({existingPlayers,repository}={}){
    if(repository){
      ["findByFantraxId","findByMlbamId","findByNormalizedName"].forEach(method=>{
        if(!hasMethod(repository,method))throw new Error(`PlayerIdentityResolver repository is missing ${method}().`);
      });
      this.#repository=repository;
    }else{
      this.#repository=new InMemoryPlayerIdentityRepository(existingPlayers||[]);
    }
  }

  resolve(importedPlayer){
    const incoming=importedPlayer||{};
    const fantraxId=cleanExternalId(incoming.fantrax_id);
    const mlbamId=cleanMlbamId(incoming.mlbam_id);
    const trace=[];

    if(fantraxId)trace.push("fantrax_id_present");
    else trace.push("fantrax_id_missing");

    const fantraxMatches=fantraxId?safeRepositoryCall(this.#repository,"findByFantraxId",fantraxId):[];
    if(fantraxId)trace.push(fantraxMatches.length>1?"multiple_fantrax_matches_found":fantraxMatches.length?"fantrax_match_found":"fantrax_match_not_found");

    if(mlbamId)trace.push("mlbam_id_present");
    else trace.push("mlbam_id_missing");

    const mlbamMatches=mlbamId?safeRepositoryCall(this.#repository,"findByMlbamId",mlbamId):[];
    if(mlbamId)trace.push(mlbamMatches.length>1?"multiple_mlbam_matches_found":mlbamMatches.length?"mlbam_match_found":"mlbam_match_not_found");
    trace.push("mlbam_validation_complete");

    const previewSession=globalThis.__PLAYER_IDENTITY_PREVIEW_SESSION__;
    if(previewSession&&!previewSession.policyLogged){
      console.info("[Resolver Policy]",{
        fallbackAllowed:!fantraxId&&!mlbamId,
        fantraxPresent:!!fantraxId,
        mlbamPresent:!!mlbamId
      });
      previewSession.policyLogged=true;
    }
    const fallback=(!fantraxId&&!mlbamId)?fallbackMatches(incoming,this.#repository):[];
    if(fantraxId||mlbamId)trace.push("fallback_skipped_stable_id_present");
    else trace.push(fallback.length>1?"multiple_safe_fallback_matches_found":fallback.length?"safe_fallback_found":"safe_fallback_not_found");
    trace.push("fallback_validation_complete");

    const repositoryDiagnostic=repositoryDiagnostics(this.#repository,incoming);
    const diagnosticContext={fantraxMatches,mlbamMatches,fallback,repositoryDiagnostics:repositoryDiagnostic};
    const relevantInvalidCandidates=repositoryDiagnostic.relevantInvalidRecords.map(record=>record.summary).filter(Boolean);
    if(relevantInvalidCandidates.length){
      trace.push("relevant_invalid_existing_player_found");
      return conflictResult(REASONS.INVALID_EXISTING_PLAYER,incoming,diagnosticContext,relevantInvalidCandidates,trace);
    }

    if(fantraxMatches.length>1)return conflictResult(REASONS.DUPLICATE_FANTRAX,incoming,diagnosticContext,fantraxMatches,trace);
    if(mlbamMatches.length>1)return conflictResult(REASONS.DUPLICATE_MLBAM,incoming,diagnosticContext,mlbamMatches,trace);

    const fantraxMatch=fantraxMatches[0]||null;
    const mlbamMatch=mlbamMatches[0]||null;
    if(fantraxMatch&&mlbamMatch&&stableId(fantraxMatch)!==stableId(mlbamMatch)){
      return conflictResult(REASONS.SPLIT_STABLE_IDS,incoming,diagnosticContext,[fantraxMatch,mlbamMatch],trace);
    }

    const stableMatch=fantraxMatch||mlbamMatch;
    const conflictingFallback=stableMatch?fallback.filter(player=>stableId(player)!==stableId(stableMatch)):[];
    if(conflictingFallback.length){
      return conflictResult(REASONS.STABLE_FALLBACK_CONFLICT,incoming,diagnosticContext,[stableMatch,...conflictingFallback],trace);
    }

    if(fantraxMatch){
      return updateResult(fantraxMatch,incoming,diagnosticContext,[...trace,"resolved_update_by_fantrax_id"],{
        reason:REASONS.FANTRAX_MATCH,
        matchSource:MATCH_SOURCE.FANTRAX,
        confidenceScore:CONFIDENCE_SCORES.FANTRAX_UPDATE
      });
    }

    if(mlbamMatch){
      return updateResult(mlbamMatch,incoming,diagnosticContext,[...trace,"resolved_update_by_mlbam_id"],{
        reason:REASONS.MLBAM_MATCH,
        matchSource:MATCH_SOURCE.MLBAM,
        confidenceScore:CONFIDENCE_SCORES.MLBAM_UPDATE
      });
    }

    if(fallback.length===1){
      return updateResult(fallback[0],incoming,diagnosticContext,[...trace,"resolved_update_by_fallback"],{
        reason:REASONS.FALLBACK_MATCH,
        matchSource:MATCH_SOURCE.FALLBACK,
        confidenceScore:CONFIDENCE_SCORES.FALLBACK_UPDATE
      });
    }

    if(fallback.length>1){
      return unmatchedResult(REASONS.AMBIGUOUS_FALLBACK,incoming,diagnosticContext,[...trace,"resolved_unmatched_ambiguous_fallback"],{
        matchSource:MATCH_SOURCE.FALLBACK,
        candidates:Object.freeze(candidateSummaries(fallback))
      });
    }

    if(fantraxId){
      return insertResult(incoming,diagnosticContext,[...trace,"resolved_insert_by_fantrax_id"],MATCH_SOURCE.FANTRAX);
    }

    if(mlbamId){
      return insertResult(incoming,diagnosticContext,[...trace,"resolved_insert_by_mlbam_id"],MATCH_SOURCE.MLBAM);
    }

    return unmatchedResult(REASONS.MISSING_IDENTITY,incoming,diagnosticContext,[...trace,"resolved_unmatched_missing_identity"]);
  }
}

export const PlayerIdentityResolution=Object.freeze({
  ACTIONS,
  CONFIDENCE,
  MATCH_SOURCE,
  REASONS,
  CONFIDENCE_SCORES,
  RESOLVER_VERSION,
  normalizeName
});
