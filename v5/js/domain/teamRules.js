const INVALID_TEAM_EXACT=new Set([
  "FREE AGENT",
  "FREE AGENTS",
  "FA",
  "W",
  "WAIVER",
  "WAIVERS",
  "ACTIVE",
  "RESERVE",
  "IL",
  "IR",
  "MINORS",
  "MINOR LEAGUE",
  "MILB",
  "ROSTERED",
  "UNKNOWN"
]);

const INVALID_TEAM_PATTERNS=[
  {reason:"contains HTML markup",test:value=>/<\/?[a-z][\s\S]*>/i.test(value)},
  {reason:"free-agent bucket",test:value=>/\bFREE\s*AGENT(S)?\b|\bFA\b/i.test(value)},
  {reason:"waiver label",test:value=>/\bWAIVER(S)?\b|\bCLAIM(S|ED|ING)?\b|\bWAIVER\s*DATE\b/i.test(value)},
  {reason:"status token",test:value=>/\b(ACTIVE|RESERVE|ROSTERED|MINORS|MINOR\s*LEAGUE|MILB|IL|IR|UNKNOWN)\b/i.test(value)},
  {reason:"waiver date",test:value=>/\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/.test(value)}
];

export function normalizedTeamToken(value){
  return String(value||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().toUpperCase();
}

export function invalidFantasyTeamReason(team,{playerCount=null}={}){
  const name=String(team?.name||"").trim();
  const abbreviation=String(team?.abbreviation||"").trim();
  const combined=[name,abbreviation].filter(Boolean).join(" ");
  const token=normalizedTeamToken(name);
  const abbrToken=normalizedTeamToken(abbreviation);
  if(!name)return"missing team name";
  if(INVALID_TEAM_EXACT.has(token)||INVALID_TEAM_EXACT.has(abbrToken))return"status/free-agent token";
  const pattern=INVALID_TEAM_PATTERNS.find(item=>item.test(combined));
  if(pattern)return pattern.reason;
  if(playerCount===0)return"no owned players in active league";
  return"";
}

export function isValidFantasyTeam(team,context={}){
  return !invalidFantasyTeamReason(team,context);
}

export function playerCountByTeam(playerRows=[]){
  const counts=new Map();
  playerRows.forEach(player=>{
    if(player.owner_team_id)counts.set(player.owner_team_id,(counts.get(player.owner_team_id)||0)+1);
  });
  return counts;
}

export function validFantasyTeamsForPlayers(teamRows=[],playerRows=[]){
  const counts=playerCountByTeam(playerRows);
  return teamRows.filter(team=>isValidFantasyTeam(team,{playerCount:counts.get(team.id)||0}));
}
