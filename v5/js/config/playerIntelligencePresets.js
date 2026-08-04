export const PLAYER_STAGE_OPTIONS=[
  "PROSPECT",
  "MLB_ESTABLISHED","MLB_EMERGING","MLB_ROLE_PLAYER","PROSPECT_NEAR_MLB","PROSPECT_DEVELOPMENTAL","RELIEVER","UNKNOWN"
];

export const SCORE_SORTS=[
  {value:"dynasty_asset_score",label:"Dynasty Asset Score"},
  {value:"overall_score",label:"Overall Score"},
  {value:"championship_impact",label:"Championship Impact"},
  {value:"ceiling_score",label:"Ceiling"},
  {value:"floor_score",label:"Floor"},
  {value:"risk_score",label:"Risk"},
  {value:"trade_liquidity",label:"Trade Liquidity"},
  {value:"market_appreciation",label:"Market Appreciation"},
  {value:"breakout_probability",label:"Breakout Probability"},
  {value:"buy_low_score",label:"Buy Low"},
  {value:"sell_high_score",label:"Sell High"},
  {value:"scarcity",label:"Scarcity"},
  {value:"league_fit",label:"League Fit"},
  {value:"portfolio_fit",label:"Portfolio Fit"},
  {value:"acquisition_opportunity",label:"Acquisition Opportunity"},
  {value:"confidence_score",label:"Confidence"}
];

export const PLAYER_INTELLIGENCE_PRESETS={
  topDynasty:{label:"Top Dynasty Assets",query:{sort:"dynasty_asset_score",ascending:false,minDynastyAssetScore:65}},
  winNow:{label:"Win-Now Impact",query:{sort:"championship_impact",ascending:false,minChampionshipImpact:60}},
  upside:{label:"High-Upside Prospects",query:{sort:"ceiling_score",ascending:false,playerStage:"PROSPECT",minCeiling:60}},
  buyLow:{label:"Buy-Low Candidates",query:{sort:"buy_low_score",ascending:false,minBuyLowScore:55,minConfidence:50}},
  sellHigh:{label:"Sell-High Candidates",query:{sort:"sell_high_score",ascending:false,minConfidence:50}},
  freeAgents:{label:"Best Free Agents",query:{sort:"dynasty_asset_score",ascending:false,ownerTeamId:"FREE_AGENT",minAcquisitionOpportunity:55}},
  riskReward:{label:"High Risk / High Reward",query:{sort:"ceiling_score",ascending:false,maxRisk:75,minCeiling:60}},
  lowConfidence:{label:"Strong Values With Low Confidence",query:{sort:"dynasty_asset_score",ascending:false,minDynastyAssetScore:55,dataAvailability:"lowConfidence"}},
  missingIdentity:{label:"Missing Identity Data",query:{sort:"name",ascending:true,dataAvailability:"missingMlbam"}}
};

export function presetQuery(key){
  const preset=PLAYER_INTELLIGENCE_PRESETS[key];
  return preset?{preset:key,...preset.query,page:1}:null;
}
