export const PROSPECT_LEVELS=Object.freeze({
  MLB:"MLB",AAA:"AAA",AA:"AA",A_PLUS:"A_PLUS",A:"A",ROOKIE:"ROOKIE",
  COMPLEX:"COMPLEX",DSL:"DSL",INACTIVE:"INACTIVE",UNKNOWN:"UNKNOWN"
});
export const LEVEL_AVAILABILITY=Object.freeze({AVAILABLE:"AVAILABLE",UNKNOWN:"UNKNOWN",STALE:"STALE",CONFLICT:"CONFLICT"});

const SPORT_LEVELS=new Map([[1,"MLB"],[11,"AAA"],[12,"AA"],[13,"A_PLUS"],[14,"A"],[16,"ROOKIE"]]);
const TEXT_LEVELS=new Map([
  ["MLB","MLB"],["MAJOR LEAGUE BASEBALL","MLB"],
  ["AAA","AAA"],["TRIPLE-A","AAA"],["TRIPLE A","AAA"],
  ["AA","AA"],["DOUBLE-A","AA"],["DOUBLE A","AA"],
  ["A+","A_PLUS"],["HIGH-A","A_PLUS"],["HIGH A","A_PLUS"],["CLASS A ADVANCED","A_PLUS"],
  ["A","A"],["SINGLE-A","A"],["SINGLE A","A"],["CLASS A","A"],
  ["ROOKIE","ROOKIE"],["ROK","ROOKIE"],
  ["COMPLEX","COMPLEX"],["FLORIDA COMPLEX LEAGUE","COMPLEX"],["FCL","COMPLEX"],["ARIZONA COMPLEX LEAGUE","COMPLEX"],["ACL","COMPLEX"],
  ["DOMINICAN SUMMER LEAGUE","DSL"],["DSL","DSL"]
]);
const clean=value=>String(value??"").trim();

export function normalizeProspectLevel({sportId=null,level=null,active=true,source="UNKNOWN",observedAt=null,rawEvidence=null}={}){
  const normalizedSource=clean(source)||"UNKNOWN",rawLevel=clean(level),numericSport=Number(sportId);
  if(active===false)return {currentLevel:PROSPECT_LEVELS.INACTIVE,levelSource:normalizedSource,levelAvailability:LEVEL_AVAILABILITY.AVAILABLE,levelObservedAt:observedAt||null,rawEvidence:rawEvidence??{sportId:sportId??null,level:rawLevel||null,active:false}};
  const currentLevel=SPORT_LEVELS.get(numericSport)||TEXT_LEVELS.get(rawLevel.toUpperCase())||PROSPECT_LEVELS.UNKNOWN;
  return {currentLevel,levelSource:normalizedSource,levelAvailability:currentLevel===PROSPECT_LEVELS.UNKNOWN?LEVEL_AVAILABILITY.UNKNOWN:LEVEL_AVAILABILITY.AVAILABLE,levelObservedAt:observedAt||null,rawEvidence:rawEvidence??{sportId:Number.isFinite(numericSport)?numericSport:null,level:rawLevel||null,active:active!==false}};
}

export function mergeProspectLevelEvidence(entries=[]){
  const evidence=entries.filter(Boolean),known=[...new Set(evidence.filter(row=>row.levelAvailability===LEVEL_AVAILABILITY.AVAILABLE&&row.currentLevel!==PROSPECT_LEVELS.UNKNOWN).map(row=>row.currentLevel))];
  if(known.length>1)return {currentLevel:null,levelSource:[...new Set(evidence.map(row=>row.levelSource).filter(Boolean))].join("+")||"UNKNOWN",levelAvailability:LEVEL_AVAILABILITY.CONFLICT,levelObservedAt:null,rawEvidence:evidence.map(row=>row.rawEvidence)};
  return evidence.find(row=>row.currentLevel===known[0])||evidence[0]||normalizeProspectLevel();
}
