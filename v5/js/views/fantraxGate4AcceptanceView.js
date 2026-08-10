import { escapeHtml } from "../utils/dom.js";

function row(label,value){
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value??"—")}</td></tr>`;
}

export function renderFantraxGate4Acceptance(state){
  const acceptance=state.gate4Acceptance||{};
  const artifact=acceptance.artifact;
  if(!artifact)return `<section class="view-panel"><h2>Gate 4 Deterministic Acceptance</h2><p class="warning-note">No reviewed acceptance artifact is loaded. Persistence is disabled.</p></section>`;
  const checkpoints=Object.entries(artifact.checkpoints||{});
  const candidates=artifact.candidates||[];
  const protectedHashes=artifact.protectedBaseline?.hashes||artifact.protectedBaseline||{};
  return `<section class="view-panel">
    <h2>Gate 4 Deterministic Acceptance</h2>
    <p class="warning-note">Human review pause. Persistence is ${acceptance.persistenceEnabled?"armed by a separately authorized execution task":"disabled for this implementation checkpoint"}.</p>
    <h3>Checkpoint chain</h3>
    <table><thead><tr><th>Checkpoint</th><th>Status</th><th>Digest</th></tr></thead><tbody>${checkpoints.map(([name,item])=>`<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(item.status)}</td><td><code>${escapeHtml(item.digest||"—")}</code></td></tr>`).join("")}</tbody></table>
    <h3>Reviewed candidates (${candidates.length})</h3>
    <table><thead><tr><th>#</th><th>Player</th><th>UUID</th><th>Fantrax ID</th><th>Team</th><th>Current</th><th>Target</th></tr></thead><tbody>${candidates.map((item,index)=>`<tr><td>${index+1}</td><td>${escapeHtml(item.name)}</td><td><code>${escapeHtml(item.id)}</code></td><td>${escapeHtml(item.fantraxApiPlayerId)}</td><td>${escapeHtml(item.fantraxTeamId)}</td><td>${escapeHtml(item.currentRosterStatus)}</td><td>${escapeHtml(item.roster_status)}</td></tr>`).join("")}</tbody></table>
    <h3>Manifest and protected evidence</h3>
    <table><tbody>${row("Manifest version",artifact.manifest?.manifestVersion)}${row("Manifest digest",artifact.manifestDigest)}${row("Human confirmation digest",artifact.humanConfirmationDigest)}${Object.entries(protectedHashes).map(([name,value])=>row(`Protected: ${name}`,value)).join("")}</tbody></table>
  </section>`;
}
