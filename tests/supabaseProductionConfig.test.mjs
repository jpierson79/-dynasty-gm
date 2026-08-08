import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const config=await readFile(new URL("../js/config/supabase.js",import.meta.url),"utf8");
const gitignore=await readFile(new URL("../.gitignore",import.meta.url),"utf8");
const url=config.match(/SUPABASE_URL\s*=\s*["']([^"']+)["']/)?.[1]||"";
const key=config.match(/SUPABASE_ANON_KEY\s*=\s*["']([^"']+)["']/)?.[1]||"";

assert.match(url,/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/,"production config must use a Supabase HTTPS project URL");
assert.match(key,/^sb_publishable_[A-Za-z0-9_-]+$/,"production config must use a browser-safe Supabase publishable key");
assert.doesNotMatch(config,/service[_-]?role|sb_secret_/i,"production config must not contain privileged Supabase credentials");
assert.doesNotMatch(gitignore,/^js\/config\/supabase\.js\s*$/m,"production config must be included in the GitHub Pages deployment");

console.log("supabaseProductionConfig tests passed");
