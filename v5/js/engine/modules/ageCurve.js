import { clampScore, numberValue } from "./math.js";

export function ageCurveScore({player}={}){
  const age=numberValue(player?.age,0);
  if(!age)return 50;
  if(age<=23)return 88;
  if(age<=26)return 96;
  if(age<=29)return 86;
  if(age<=32)return 68;
  if(age<=35)return 42;
  return 24;
}

export default ageCurveScore;
