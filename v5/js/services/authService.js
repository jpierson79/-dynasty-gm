import { initializeSupabaseClient } from "../config/supabaseClient.js";
import * as legacyAuth from "../../../js/services/authService.js";
import * as leagues from "../repositories/leagueRepository.js";
import { appState, getActiveLeagueId, setActiveLeagueId, setState } from "../state/appState.js";

export async function initializeAuth(onStatus){
  const client=await initializeSupabaseClient({onStatus});
  if(!client){
    setState({dataMode:"offline"});
    return null;
  }
  const user=await leagues.currentUser();
  setState({authUser:user});
  if(user)await refreshAccessibleLeagues(user.id);
  client.auth.onAuthStateChange((_event,session)=>applyAuthSession(session));
  return client;
}

export function applyAuthSession(session,{defer=callback=>setTimeout(callback,0),refresh=refreshAccessibleLeagues}={}){
  const nextUser=session?.user||null;
  setState({authUser:nextUser});
  if(!nextUser){
    setActiveLeagueId("");
    setState({activeLeague:null,dataMode:"offline",players:[],teams:[],managers:[]});
    return null;
  }
  defer(()=>Promise.resolve(refresh(nextUser.id)).catch(error=>setState({dataMode:"offline",errors:[String(error?.message||error||"Cloud league refresh failed.")]})));
  return nextUser;
}

export async function signIn(email,password){return legacyAuth.signIn(email,password)}
export async function signOut(){return legacyAuth.signOut()}

export async function refreshAccessibleLeagues(userId=appState.authUser?.id){
  const accessible=await leagues.accessibleLeagues(userId);
  const saved=getActiveLeagueId();
  let active=null;
  if(accessible.length===1)active=accessible[0];
  else if(saved)active=accessible.find(league=>league.id===saved)||null;
  if(active)setActiveLeagueId(active.id);
  setState({accessibleLeagues:accessible,activeLeague:active,dataMode:active?"cloud":"offline"});
  return {accessible,active};
}

export async function selectLeague(leagueId){
  const league=(appState.accessibleLeagues||[]).find(item=>item.id===leagueId)||null;
  setActiveLeagueId(league?.id||"");
  setState({activeLeague:league,dataMode:league?"cloud":"offline"});
  return league;
}
