import { clampScore } from "./math.js";

const POSITION_BASE={C:88,SS:80,"2B":72,"3B":66,OF:52,"1B":45,SP:70,RP:38,P:58,DH:34};

export function scarcity({player}={}){
  const positions=Array.isArray(player?.positions)?player.positions:String(player?.positions||"").split(/[\/,\s]+/);
  const best=positions.map(pos=>POSITION_BASE[String(pos||"").toUpperCase()]||50).sort((a,b)=>b-a)[0]||50;
  return clampScore(best);
}

export default scarcity;
