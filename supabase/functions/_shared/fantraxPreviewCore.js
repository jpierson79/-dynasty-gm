export const FANTRAX_PREVIEW_SCHEMA_VERSION="fantrax-public-preview-v1";
export const FANTRAX_OPERATIONS={
  "league-info":"getLeagueInfo",
  "team-rosters":"getTeamRosters",
  "matchup-scores":"getMatchupScores",
  standings:"getStandings",
  "draft-picks":"getDraftPicks",
  "draft-results":"getDraftResults"
};

const STATUS_MAP={ACTIVE:"ACTIVE",RESERVE:"RESERVE",INJURED_RESERVE:"IL",MINORS:"MINORS"};
const list=value=>Array.isArray(value)?value:[];
const object=value=>value&&typeof value==="object"&&!Array.isArray(value)?value:{};
const numberOrNull=value=>value===null||value===undefined||value===""||!Number.isFinite(Number(value))?null:Number(value);
const text=value=>value===null||value===undefined?"":String(value);

export function normalizeFantraxRosterStatus(value){return STATUS_MAP[text(value).trim().toUpperCase()]||"UNCLASSIFIED"}
export function validExternalLeagueId(value){return /^[a-z0-9]{16}$/i.test(text(value).trim())}

function teamEntries(value){return Object.entries(object(value))}
function playerEntries(value){return Object.entries(object(value))}
function normalizeLeagueInfo(raw,fetchedAt){
  const data=object(raw);
  return {
    externalLeagueId:"[REDACTED]",
    leagueName:text(data.leagueName),
    seasonYear:text(data.seasonYear),
    leagueHistoryId:text(data.leagueHistoryId),
    teams:teamEntries(data.teamInfo).map(([key,row])=>({fantraxTeamId:text(row?.id||key),teamName:text(row?.name)})),
    players:playerEntries(data.playerInfo).map(([id,row])=>({fantraxApiPlayerId:text(id),eligiblePositions:list(row?.eligiblePos).map(text),status:text(row?.status)})),
    scoringPeriods:list(data.scoringPeriods).map(row=>({periodNumber:numberOrNull(row?.number),startDate:text(row?.startDate),endDate:text(row?.endDate)})),
    matchupPeriods:list(data.matchups).map(row=>({periodNumber:numberOrNull(row?.period),matchupCount:list(row?.matchupList).length})),
    fetchedAt,sourceSchemaVersion:FANTRAX_PREVIEW_SCHEMA_VERSION
  };
}
function normalizeRosters(raw,fetchedAt){
  const data=object(raw),periodNumber=numberOrNull(data.period);
  const rosterItems=teamEntries(data.rosters).flatMap(([teamId,team])=>list(team?.rosterItems).map(row=>({
    periodNumber,fantraxApiPlayerId:text(row?.id),fantraxTeamId:text(teamId),fantraxTeamName:text(team?.teamName),sourcePosition:text(row?.position),sourceStatus:text(row?.status),normalizedRosterStatus:normalizeFantraxRosterStatus(row?.status)
  })));
  return {periodNumber,rosterItems,fetchedAt,sourceSchemaVersion:FANTRAX_PREVIEW_SCHEMA_VERSION};
}
function normalizeMatchups(raw,fetchedAt){
  const data=object(raw),periodNumber=numberOrNull(data.period);
  return {periodNumber,matchups:list(data.matchups).map(row=>({periodNumber,awayFantraxTeamId:text(row?.away?.teamId),awayTeamName:text(row?.away?.teamName),awayScore:numberOrNull(row?.away?.score),homeFantraxTeamId:text(row?.home?.teamId),homeTeamName:text(row?.home?.teamName),homeScore:numberOrNull(row?.home?.score)})),fetchedAt,sourceSchemaVersion:FANTRAX_PREVIEW_SCHEMA_VERSION};
}
function normalizeStandings(raw,fetchedAt){
  return {snapshotScope:"CURRENT_ONLY",standings:list(raw).map(row=>({fantraxTeamId:text(row?.teamId),teamName:text(row?.teamName),rank:numberOrNull(row?.rank),wins:numberOrNull(row?.wins??row?.win),losses:numberOrNull(row?.losses??row?.loss),ties:numberOrNull(row?.ties??row?.tie),pointsFor:numberOrNull(row?.pointsFor??row?.totalPointsFor),pointsAgainst:numberOrNull(row?.pointsAgainst??row?.totalPointsAgainst),gamesBack:numberOrNull(row?.gamesBack),points:numberOrNull(row?.points),snapshotScope:"CURRENT_ONLY"})),fetchedAt,sourceSchemaVersion:FANTRAX_PREVIEW_SCHEMA_VERSION};
}
function normalizeDraftPicks(raw,fetchedAt){const data=object(raw);return {currentDraftPicks:list(data.currentDraftPicks),futureDraftPicks:list(data.futureDraftPicks),fetchedAt,sourceSchemaVersion:FANTRAX_PREVIEW_SCHEMA_VERSION}}
function normalizeDraftResults(raw,fetchedAt){const data=object(raw);return {draftDate:text(data.draftDate),draftState:text(data.draftState),draftType:text(data.draftType),draftOrder:list(data.draftOrder),draftResults:list(data.draftPicks),fetchedAt,sourceSchemaVersion:FANTRAX_PREVIEW_SCHEMA_VERSION}}

export function normalizeFantraxResponse(operation,raw,{fetchedAt=new Date().toISOString()}={}){
  if(raw?.error)throw new Error(`Fantrax returned ${text(raw.error.code||raw.error)}`);
  if(operation==="league-info"&&(!raw||typeof raw.playerInfo!=="object"||typeof raw.teamInfo!=="object"||!Array.isArray(raw.scoringPeriods)))throw new Error("Fantrax league-info response failed schema validation.");
  if(operation==="team-rosters"&&(!raw||typeof raw.rosters!=="object"||numberOrNull(raw.period)===null))throw new Error("Fantrax team-rosters response failed schema validation.");
  if(operation==="matchup-scores"&&(!raw||!Array.isArray(raw.matchups)||numberOrNull(raw.period)===null))throw new Error("Fantrax matchup-scores response failed schema validation.");
  if(operation==="standings"&&!Array.isArray(raw))throw new Error("Fantrax standings response failed schema validation.");
  if(operation==="draft-picks"&&(!raw||!Array.isArray(raw.currentDraftPicks)||!Array.isArray(raw.futureDraftPicks)))throw new Error("Fantrax draft-picks response failed schema validation.");
  if(operation==="draft-results"&&(!raw||!Array.isArray(raw.draftPicks)||!Array.isArray(raw.draftOrder)))throw new Error("Fantrax draft-results response failed schema validation.");
  if(operation==="league-info")return normalizeLeagueInfo(raw,fetchedAt);
  if(operation==="team-rosters")return normalizeRosters(raw,fetchedAt);
  if(operation==="matchup-scores")return normalizeMatchups(raw,fetchedAt);
  if(operation==="standings")return normalizeStandings(raw,fetchedAt);
  if(operation==="draft-picks")return normalizeDraftPicks(raw,fetchedAt);
  if(operation==="draft-results")return normalizeDraftResults(raw,fetchedAt);
  throw new Error("Operation is not allowlisted.");
}
