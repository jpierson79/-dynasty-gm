(function(){
  const V4_PHASE="Phase 1 - local compatibility layer";
  const STORAGE_PROVIDER="Browser Local Storage";
  const requiredFields={
    Player:["id","name","normalizedName","positions","rosterStatus","createdAt","updatedAt"],
    PlayerMetrics:["playerId","source","season","metricType","metrics","importedAt"],
    Manager:["id","teamName","competitiveWindow","hkbReliance","updatedAt"],
    ManagerPreference:["managerId","preferenceType","strength"],
    Team:["id","name","updatedAt"],
    Trade:["id","transactionDate","tradeType","importedAt"],
    TradeAsset:["tradeId"],
    PlayerSnapshot:["playerId","snapshotDate"],
    CalculatedPlayerScore:["playerId","scoreVersion","calculatedAt"],
    ImportJob:["id","importType","status","startedAt"]
  };
  const entities={
    Player:{
      id:"Stable app player id. Phase 1 derives this from player_id/mlbam/statcastId/name when needed.",
      mlbamId:"MLBAM or Statcast player id when available.",
      name:"Display name.",
      normalizedName:"Canonical lowercase name used for matching.",
      age:"Numeric player age.",
      positions:"Array of eligible positions.",
      mlbTeam:"MLB organization/team.",
      ownerTeamId:"Future Team id. Phase 1 maps from owner/status text.",
      rosterStatus:"ROSTERED, FREE AGENT, IL, MINORS, or source status.",
      hkbValue:"Raw HarryKnowsBall value.",
      overallRank:"Raw/imported or derived overall HKB rank.",
      positionRank:"Raw/imported or derived position rank.",
      createdAt:"ISO timestamp.",
      updatedAt:"ISO timestamp."
    },
    PlayerMetrics:{
      playerId:"References Player.id.",
      source:"Metric source, for example Statcast or HarryKnowsBall.",
      season:"Metric season.",
      metricType:"hitter, pitcher, hkb, or other import category.",
      metrics:"Mapped raw metric key/value object only.",
      importedAt:"ISO timestamp."
    },
    Manager:{
      id:"Stable manager id.",
      teamName:"Fantasy team name.",
      managerName:"Manager display name.",
      competitiveWindow:"Contender, Retooling, Rebuilder, etc.",
      tradeStyle:"Observed trade style.",
      hkbReliance:"Low, Medium, High.",
      communicationStyle:"Observed communication style.",
      notes:"General manager notes.",
      updatedAt:"ISO timestamp."
    },
    ManagerPreference:{
      managerId:"References Manager.id.",
      playerId:"Optional Player.id.",
      playerName:"Optional unmatched player name.",
      preferenceType:"favorite, avoids, values, target type, etc.",
      strength:"Numeric or descriptive strength.",
      notes:"Preference details."
    },
    Team:{
      id:"Stable team id.",
      name:"Team name.",
      managerId:"References Manager.id.",
      competitiveWindow:"Team window.",
      updatedAt:"ISO timestamp."
    },
    Trade:{
      id:"Stable trade id.",
      transactionDate:"Trade date.",
      teamAId:"First team id.",
      teamBId:"Second team id.",
      tradeType:"Trade, waiver, add/drop, etc.",
      notes:"Trade notes.",
      importedAt:"ISO timestamp."
    },
    TradeAsset:{
      tradeId:"References Trade.id.",
      playerId:"References Player.id.",
      fromTeamId:"Original Team.id.",
      toTeamId:"Destination Team.id."
    },
    PlayerSnapshot:{
      playerId:"References Player.id.",
      snapshotDate:"Snapshot date/time.",
      ownerTeamId:"Team ownership at snapshot.",
      hkbValue:"HKB value at snapshot.",
      overallRank:"Overall rank at snapshot.",
      calculatedScores:"Small score summary at snapshot."
    },
    CalculatedPlayerScore:{
      playerId:"References Player.id.",
      scoreVersion:"Scoring/settings version.",
      championshipImpact:"Calculated score.",
      scarcity:"Calculated score.",
      liquidity:"Calculated score.",
      appreciation:"Calculated score.",
      breakout:"Calculated score.",
      risk:"Calculated score.",
      dynastyAssetScore:"Calculated score.",
      calculatedAt:"ISO timestamp."
    },
    ImportJob:{
      id:"Stable import job id.",
      importType:"HKB, Fantrax, Statcast, Trade History, etc.",
      fileName:"Imported file name when available.",
      status:"pending, running, completed, failed.",
      rowsProcessed:"Rows parsed.",
      rowsMatched:"Rows matched to app records.",
      rowsUnmatched:"Rows not matched.",
      errorMessage:"Failure summary.",
      startedAt:"ISO timestamp.",
      completedAt:"ISO timestamp."
    }
  };
  window.DynastyV4Schema={version:"4.0-phase-1",phase:V4_PHASE,storageProvider:STORAGE_PROVIDER,entities,requiredFields};
})();
