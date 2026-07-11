const state={
  service:null,
  session:null,
  profile:null,
  status:"connecting",
  message:"Connecting",
  loading:false,
  localOnly:false,
  clientReady:false,
  signupHandlerRegistered:false
};

function $(id){return document.getElementById(id)}
function clean(value){return String(value||"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[m]))}
function isFileProtocol(){return window.location.protocol==="file:"}
function configLooksMissing(config){
  return !config?.SUPABASE_URL||
    !config?.SUPABASE_ANON_KEY||
    String(config.SUPABASE_URL).includes("YOUR_")||
    String(config.SUPABASE_ANON_KEY).includes("YOUR_");
}

function statusLabel(){
  const labels={
    connecting:"Connecting",
    "account-created":"Account created",
    confirmation:"Check your email",
    "config-missing":"Configuration missing",
    "network-error":"Network error",
    "signup-failed":"Signup failed",
    unavailable:"Supabase unavailable",
    "signed-in":"Signed in",
    "signed-out":"Signed out"
  };
  if(labels[state.status])return labels[state.status];
  if(state.localOnly)return"Local-only mode";
  return"Signed out";
}

function statusClass(){
  if(["signed-in","account-created"].includes(state.status))return"good";
  if(["connecting","confirmation","signed-out"].includes(state.status)||state.localOnly)return"warn";
  return"bad";
}

function displayName(){
  return state.profile?.display_name||
    state.profile?.displayName||
    state.session?.user?.user_metadata?.display_name||
    "";
}

function email(){
  return state.session?.user?.email||"";
}

function setStatus(status,message,isError=false){
  state.status=status;
  state.message=message||statusLabel();
  setMessage(state.message,isError);
  renderAuthView();
}

function setMessage(text,isError=false){
  state.message=text||"";
  const el=$("authMessage");
  if(el){
    el.textContent=state.message;
    el.className=`note mt-10 ${isError?"auth-error":"auth-success"}`;
  }
}

function authButtonsDisabled(){
  return state.loading||!state.clientReady||state.status==="config-missing"||state.status==="network-error"||state.status==="unavailable";
}

function renderCloudStatus(){
  const label=statusLabel();
  const cls=statusClass();
  const header=$("cloudStatusIndicator");
  if(header){
    header.className=`cloud-status pill ${cls}`;
    header.textContent=state.localOnly&&state.status==="signed-out"?"Local-only mode":label;
    header.title="Cloud sync remains disabled during Phase 2D.";
  }
  const authStatus=$("authCloudStatus");
  if(authStatus){
    authStatus.innerHTML=`<div class="debug-grid"><div><span>Cloud account</span><b>${clean(label)}</b></div><div><span>Signed-in user</span><b>${clean(displayName()||email()||"None")}</b></div><div><span>Supabase client</span><b>${state.clientReady?"Ready":"Not ready"}</b></div><div><span>Cloud synchronization</span><b>Disabled until next phase</b></div><div><span>Browser data</span><b>Kept locally</b></div></div>`;
  }
}

function renderAuthView(){
  renderCloudStatus();
  const signedIn=Boolean(state.session);
  $("authSignedInPanel")?.classList.toggle("hidden",!signedIn);
  $("authForms")?.classList.toggle("hidden",signedIn);
  const who=$("authSignedInUser");
  if(who)who.innerHTML=signedIn?`Signed in as <b>${clean(displayName()||email())}</b>${displayName()&&email()?` <span class="note">(${clean(email())})</span>`:""}`:"";
  const disabled=authButtonsDisabled();
  const signInButton=$("authSignInButton");
  const signUpButton=$("authSignUpButton");
  const signOutButton=$("authSignOutButton");
  if(signInButton)signInButton.disabled=disabled;
  if(signUpButton){
    signUpButton.disabled=disabled;
    signUpButton.textContent=state.loading&&state.status==="connecting"?"Connecting...":state.loading?"Working...":"Create Account";
  }
  if(signOutButton)signOutButton.disabled=state.loading||!state.clientReady;
  const localOnly=$("authLocalOnlyNote");
  if(localOnly){
    localOnly.textContent=state.status==="config-missing"?"Supabase configuration is missing. The app is running from this browser only.":
      state.status==="network-error"?"Supabase could not be reached. The app is running from this browser only.":
      state.localOnly?"Local-only mode is active for this browser session.":
      "Local data remains available either way.";
  }
  const message=$("authMessage");
  if(message&&state.loading)message.textContent=state.message||"Connecting";
  else if(message&&!message.textContent)message.textContent=state.message;
}

function classifyError(error){
  const text=String(error?.message||error||"");
  if(/fetch|network|load failed|err_network|failed to fetch|cdn|import/i.test(text))return{status:"network-error",message:"Network error. Supabase could not be reached.",isError:true};
  return{status:"signup-failed",message:text||"Signup failed.",isError:true};
}

async function refreshSession(message){
  if(!state.service||!state.clientReady)return;
  try{
    state.session=await state.service.getCurrentSession();
    state.profile=null;
    if(state.session){
      try{
        state.profile=await state.service.getCurrentProfile();
      }catch(profileError){
        console.warn("[Auth] profile lookup failed",profileError?.message||"Unknown profile error");
        state.profile={display_name:state.session.user?.user_metadata?.display_name||"",email:state.session.user?.email||""};
      }
    }
    state.status=state.session?"signed-in":"signed-out";
    if(message)setMessage(message,false);
  }catch(e){
    const classified=classifyError(e);
    state.localOnly=true;
    state.clientReady=false;
    setStatus(classified.status,classified.message,true);
    return;
  }
  renderAuthView();
}

async function withLoading(message,task){
  state.loading=true;
  state.message=message||"Connecting";
  setMessage(state.message,false);
  renderAuthView();
  try{
    await task();
  }finally{
    state.loading=false;
    renderAuthView();
  }
}

async function handleSignIn(event){
  event.preventDefault();
  await withLoading("Connecting",async()=>{
    const emailValue=$("authSignInEmail")?.value.trim();
    const passwordValue=$("authSignInPassword")?.value||"";
    if(!emailValue||!passwordValue){setStatus("signup-failed","Enter an email and password to sign in.",true);return}
    try{
      const { error } = await state.service.signIn(emailValue,passwordValue);
      if(error){setStatus("signup-failed",error.message||"Sign in failed.",true);return}
      state.localOnly=false;
      await refreshSession("Signed in. Cloud sync is still disabled until the next migration phase.");
    }catch(e){
      const classified=classifyError(e);
      setStatus(classified.status,classified.message,true);
    }
  });
}

async function handleSignUp(event){
  event.preventDefault();
  await withLoading("Connecting",async()=>{
    console.info("[Auth] signup begins");
    if(!state.service||typeof state.service.signUp!=="function"){
      setStatus("signup-failed","Signup failed. Auth service is not ready.",true);
      return;
    }
    const emailValue=$("authSignUpEmail")?.value.trim();
    const passwordValue=$("authSignUpPassword")?.value||"";
    const displayNameValue=$("authDisplayName")?.value.trim()||"";
    if(!emailValue||!passwordValue){setStatus("signup-failed","Signup failed. Enter an email and password.",true);return}
    try{
      const { data, error } = await state.service.signUp(emailValue,passwordValue,displayNameValue);
      if(error){
        const classified=classifyError(error);
        setStatus(classified.status,classified.message,true);
        return;
      }
      if(data?.session){
        state.localOnly=false;
        state.status="account-created";
        await refreshSession("Account created. Cloud sync is still disabled until the next migration phase.");
      }else{
        state.status="confirmation";
        state.session=null;
        state.profile=null;
        setMessage("Check your email",false);
        renderAuthView();
      }
    }catch(e){
      const classified=classifyError(e);
      setStatus(classified.status,classified.message,true);
    }
  });
}

async function handleSignOut(){
  await withLoading("Connecting",async()=>{
    try{
      const { error } = await state.service.signOut();
      if(error){setStatus("signup-failed",error.message||"Sign out failed.",true);return}
      state.session=null;
      state.profile=null;
      state.status="signed-out";
      setMessage("Signed out. Local browser data was not changed.",false);
    }catch(e){
      const classified=classifyError(e);
      setStatus(classified.status,classified.message,true);
    }
  });
}

function bindAuthEvents(){
  $("authSignInForm")?.addEventListener("submit",handleSignIn);
  const signupForm=$("authSignUpForm");
  if(signupForm){
    signupForm.addEventListener("submit",handleSignUp);
    state.signupHandlerRegistered=true;
    console.info("[Auth] signup submit handler registered");
  }
  $("authSignOutButton")?.addEventListener("click",handleSignOut);
  $("authLocalOnlyButton")?.addEventListener("click",()=>{
    state.localOnly=true;
    setMessage("Local-only mode selected. Your current browser data remains available.",false);
    renderAuthView();
    window.goView?.("dashboard");
  });
}

async function initAuth(){
  bindAuthEvents();
  renderAuthView();
  if(isFileProtocol()){
    state.localOnly=true;
    state.clientReady=false;
    setStatus("config-missing","Cloud authentication requires Live Server. Open the app through http://127.0.0.1.",true);
    return;
  }
  try{
    setStatus("connecting","Connecting",false);
    const config=await import("../config/supabase.js");
    if(configLooksMissing(config)){
      state.localOnly=true;
      state.clientReady=false;
      setStatus("config-missing","Configuration missing",true);
      return;
    }
    state.service=await import("./authService.js");
    if(!state.service.supabaseStatus?.available||!state.service.supabaseStatus?.initialized){
      state.localOnly=true;
      state.clientReady=false;
      setStatus("config-missing",state.service.supabaseStatus?.message||"Configuration missing",true);
      return;
    }
    state.clientReady=true;
    await refreshSession();
    state.service.subscribeToAuthChanges(async()=>{await refreshSession()});
    setMessage(state.session?"Session restored. Cloud sync is still disabled until the next migration phase.":"Signed out. You can sign in or continue using local browser data.",false);
    renderAuthView();
  }catch(e){
    const classified=classifyError(e);
    state.localOnly=true;
    state.clientReady=false;
    setStatus(classified.status,classified.message,true);
  }
}

window.DynastyAuthUI={refreshSession,renderAuthView,state};
initAuth();
