import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { applyAuthSession } from "../v5/js/services/authService.js";
import { appState } from "../v5/js/state/appState.js";

const callbacks=[];
const refreshed=[];
const user={id:"user-1",email:"manager@example.com"};
const result=applyAuthSession({user},{
  defer:callback=>callbacks.push(callback),
  refresh:async userId=>refreshed.push(userId)
});

assert.equal(result,user);
assert.equal(appState.authUser,user,"session user must be available immediately");
assert.deepEqual(refreshed,[],"cloud queries must not run inside the auth callback");
assert.equal(callbacks.length,1,"signed-in league refresh must be deferred");
await callbacks[0]();
assert.deepEqual(refreshed,[user.id]);

applyAuthSession(null,{defer:callback=>callbacks.push(callback)});
assert.equal(appState.authUser,null);
assert.equal(appState.dataMode,"offline");

const main=await readFile(new URL("../v5/js/main.js",import.meta.url),"utf8");
const html=await readFile(new URL("../v5/index.html",import.meta.url),"utf8");
assert.match(main,/authSignIn:\{pending:true,error:""\}/);
assert.match(main,/Signing in…/);
assert.match(main,/const email=.*password=/,"credentials must be captured before pending state rerenders the form");
assert.match(main,/authService\.js\?v5-4-6b5-auth/);
assert.match(html,/main\.js\?v5-4-7-hkb-update/);

console.log("v5AuthFlow tests passed");
