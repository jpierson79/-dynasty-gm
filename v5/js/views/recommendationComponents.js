import { escapeHtml } from "../utils/dom.js";

export function reasonText(code){return String(code||"").replaceAll("_"," ")}
export function recommendationCard(item,{showPlayer=true}={}){
  const player=item.player||{};
  const scores=player.scores||item.score?.explanation?.scores||{};
  const primary=(item.reasonCodes||[]).slice(0,3).map(reasonText).join(", ")||"No primary reason";
  const caution=(item.cautions||[])[0]||"No major caution";
  return `<article class="recommendation-card" data-recommendation-player="${escapeHtml(item.playerId)}">
    <div class="recommendation-head">${showPlayer?`<button class="link-button" data-player-detail="${escapeHtml(item.playerId)}">${escapeHtml(player.name||item.playerId)}</button>`:""}<b>${escapeHtml(item.recommendation)}</b></div>
    <p class="note">Priority ${escapeHtml(item.priority)} · Confidence ${escapeHtml(item.confidence)} · Rule ${escapeHtml(item.decisionRuleVersion)}</p>
    <p>${escapeHtml(primary)}</p>
    <p class="note">${escapeHtml(caution)}</p>
    <p class="note">Dynasty ${escapeHtml(player.score?.dynasty_asset_score??"Unavailable")} · Impact ${escapeHtml(player.score?.championship_impact??"Unavailable")} · Ceiling ${escapeHtml(scores.ceiling_score??"Unavailable")} · Risk ${escapeHtml(player.score?.risk_score??"Unavailable")}</p>
    <details><summary>Decision diagnostics</summary><pre>${escapeHtml(JSON.stringify(item,null,2))}</pre></details>
  </article>`;
}
export function groupedRecommendations(items=[]){
  const groups=new Map();
  items.forEach(item=>{
    if(!groups.has(item.group))groups.set(item.group,[]);
    groups.get(item.group).push(item);
  });
  return [...groups.entries()].map(([group,rows])=>`<section><h3>${escapeHtml(group)}</h3><div class="recommendation-grid">${rows.map(item=>recommendationCard(item)).join("")}</div></section>`).join("");
}
