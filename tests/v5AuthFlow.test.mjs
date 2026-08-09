import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { applyAuthSession } from "../v5/js/services/authService.js";
import { appState } from "../v5/js/state/appState.js?v5-4-6e-gate4c1-auth-state";

const callbacks=[];
const refreshed=[];
const user={id:"user-1",email:"manager@example.com"};
const result=applyAuthSession({user},{
  defer:callback=>callbacks.push(callback),
  refresh:async userId=>refreshed.push(userId)
});

assert.equal(result,user);
assert.equal(appState.authUser,user,"successful auth must update user state immediately");
assert.deepEqual(refreshed,[],"authenticated repository work must not run inside the Supabase auth callback");
assert.equal(callbacks.length,1,"signed-in league refresh must be deferred");
await callbacks[0]();
assert.deepEqual(refreshed,[user.id],"deferred refresh must receive the authenticated user");

applyAuthSession(null,{defer:callback=>callbacks.push(callback)});
assert.equal(appState.authUser,null,"session restoration must preserve the signed-out state");
assert.equal(appState.dataMode,"offline");

const main=await readFile(new URL("../v5/js/main.js",import.meta.url),"utf8");
const html=await readFile(new URL("../v5/index.html",import.meta.url),"utf8");
const auth=await readFile(new URL("../v5/js/services/authService.js",import.meta.url),"utf8");
const cloudData=await readFile(new URL("../v5/js/services/cloudDataService.js",import.meta.url),"utf8");

assert.match(main,/addEventListener\("submit",async event=>/,"the delegated Sign In submit handler must remain bound");
assert.match(main,/if\(event\.target\.id!=="signInForm"\)return;/);
assert.match(main,/const \{error\}=await signIn\(email,password\)/,"Sign In must invoke the expected auth method");
assert.match(main,/authSignIn:\{pending:true,error:""\}/,"Sign In must expose in-flight state");
assert.match(main,/authSignIn:\{pending:false,error:message\}/,"auth rejection must become visible app state");
assert.match(main,/Signing in…/);
assert.match(main,/const email=.*password=/,"credentials must be captured before pending state rerenders the form");
assert.match(auth,/onAuthStateChange\(\(_event,session\)=>applyAuthSession\(session\)\)/,"auth callback must not await repository work");
assert.doesNotMatch(auth,/onAuthStateChange\(async/,"stale deadlocking auth callback must not return");
const sharedStateToken="appState.js?v5-4-6e-gate4c1-auth-state";
assert.ok(main.includes(sharedStateToken),"main must render the shared state singleton");
assert.ok(auth.includes(sharedStateToken),"auth must update the same state singleton rendered by main");
assert.ok(cloudData.includes(sharedStateToken),"deferred league loading must update the same state singleton");
assert.match(main,/authService\.js\?v5-4-6e-gate4c1-auth-state/,"exact module graph must select the repaired auth implementation");
assert.match(main,/cloudDataService\.js\?v5-4-6e-gate4c1-auth-state/,"exact module graph must select shared-state league loading");
assert.match(html,/main\.js\?v5-4-6e-gate4c1-auth-state/,"cache-busted entry point must load the repaired event binding");

console.log("v5AuthFlow tests passed");
