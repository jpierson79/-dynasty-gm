export const PROSPECT_LEVELS=Object.freeze({
  MLB:"MLB",AAA:"AAA",AA:"AA",A_PLUS:"A_PLUS",A:"A",ROOKIE:"ROOKIE",
  COMPLEX:"COMPLEX",DSL:"DSL",INACTIVE:"INACTIVE",UNKNOWN:"UNKNOWN"
});
export const LEVEL_AVAILABILITY=Object.freeze({AVAILABLE:"AVAILABLE",UNKNOWN:"UNKNOWN",STALE:"STALE",CONFLICT:"CONFLICT"});
export const PROSPECT_LEVEL_SCHEMA_FIELDS=Object.freeze(["current_level","level_source","level_availability","level_observed_at","level_raw_evidence"]);
export const PROSPECT_LEVEL_SCHEMA_STATES=Object.freeze({PRESENT:"PRESENT",SCHEMA_ABSENT:"SCHEMA_ABSENT",PARTIAL:"PARTIAL"});

const owns=(row,field)=>Object.prototype.hasOwnProperty.call(row||{},field);

export function inspectProspectLevelSchemaRows(rows=[]){
  const source=Array.isArray(rows)?rows:[];
  const presentFields=[],absentFields=[],inconsistentFields=[];
  for(const field of PROSPECT_LEVEL_SCHEMA_FIELDS){
    const count=source.reduce((total,row)=>total+(owns(row,field)?1:0),0);
    if(source.length&&count===source.length)presentFields.push(field);
    else if(count===0)absentFields.push(field);
    else inconsistentFields.push(field);
  }
  const schemaState=inconsistentFields.length||presentFields.length&&absentFields.length?PROSPECT_LEVEL_SCHEMA_STATES.PARTIAL:presentFields.length===PROSPECT_LEVEL_SCHEMA_FIELDS.length?PROSPECT_LEVEL_SCHEMA_STATES.PRESENT:PROSPECT_LEVEL_SCHEMA_STATES.SCHEMA_ABSENT;
  return Object.freeze({schemaState,presentFields:Object.freeze(presentFields),absentFields:Object.freeze(absentFields),inconsistentFields:Object.freeze(inconsistentFields)});
}

export function inspectProspectLevelColumnPresence(presence={}){
  const rows=[Object.fromEntries(PROSPECT_LEVEL_SCHEMA_FIELDS.filter(field=>presence[field]===true).map(field=>[field,null]))];
  return inspectProspectLevelSchemaRows(rows);
}

export function requireHealthyProspectLevelSchemaInspection(inspection){
  if(inspection.schemaState===PROSPECT_LEVEL_SCHEMA_STATES.PARTIAL){
    const error=new Error("Prospect-level evidence schema is partially available.");
    error.code="PROSPECT_LEVEL_SCHEMA_PARTIAL";
    error.schemaInspection=inspection;
    throw error;
  }
  return inspection;
}

export function requireHealthyProspectLevelSchemaRows(rows=[]){
  return requireHealthyProspectLevelSchemaInspection(inspectProspectLevelSchemaRows(rows));
}

export function withProspectLevelSchemaState(rows=[]){
  const inspection=requireHealthyProspectLevelSchemaRows(rows);
  return (rows||[]).map(row=>({...row,prospectLevelSchemaState:inspection.schemaState}));
}

export function isMissingProspectLevelColumnError(error,field=null){
  const candidates=field?[field]:PROSPECT_LEVEL_SCHEMA_FIELDS;
  const details=[error?.message,error?.details,error?.hint,error?.cause?.message,error?.cause?.details].filter(Boolean).join(" ");
  if(!candidates.some(candidate=>details.toLowerCase().includes(String(candidate).toLowerCase())))return false;
  const code=String(error?.code||error?.cause?.code||"").toUpperCase();
  const missingLanguage=/does not exist|could not find[^.]*column|schema cache[^.]*column|undefined column/i.test(details);
  return missingLanguage&&(!code||code==="42703"||code==="PGRST204");
}

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
