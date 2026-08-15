import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packageV5Deployment } from "../scripts/build-v5-deployment.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),sha="c".repeat(40);
const workflow=await readFile(path.join(root,".github/workflows/deploy-pages.yml"),"utf8");
assert.match(workflow,/on:\s*\n\s*workflow_dispatch:/);
assert.doesNotMatch(workflow,/\bpush\s*:/);
assert.match(workflow,/path: trusted/); assert.match(workflow,/path: target/);
assert.match(workflow,/node trusted\/scripts\/build-v5-deployment\.mjs/);
assert.doesNotMatch(workflow,/node target\//);
assert.match(workflow,/build:\s*[\s\S]*permissions:\s*\n\s*contents: read/);
assert.match(workflow,/deploy:\s*[\s\S]*pages: write[\s\S]*id-token: write/);
assert.match(workflow,/uses: actions\/upload-pages-artifact@v3[\s\S]*deploy:\s*[\s\S]*needs: build/);

const temp=await mkdtemp(path.join(os.tmpdir(),"trusted-pages-"));
try{
  const target=path.join(temp,"target");
  await cp(root,target,{recursive:true,filter:source=>!source.includes(`${path.sep}.git${path.sep}`)&&!source.endsWith(`${path.sep}.git`)});
  const output=path.join(temp,"output");
  const result=await packageV5Deployment({targetRoot:target,targetSha:sha,outputRoot:output});
  const manifest=JSON.parse(await readFile(result.manifestPath,"utf8"));
  assert.equal(manifest.commit,sha); assert.equal(result.graph.modules.length,102);
  for(const denied of [".git",".github","tests","docs","scripts","node_modules"]) assert.equal(manifest.files.some(file=>file.path===denied||file.path.startsWith(`${denied}/`)),false);
  await writeFile(path.join(target,"v5","integrity-manifest.json"),'{"commit":"malicious"}\n');
  const replaced=await packageV5Deployment({targetRoot:target,targetSha:sha,outputRoot:path.join(temp,"replaced")});
  assert.equal(JSON.parse(await readFile(replaced.manifestPath,"utf8")).commit,sha);
  assert.equal(JSON.parse(await readFile(replaced.manifestPath,"utf8")).files.some(file=>file.path.endsWith("integrity-manifest.json")),false);
  await rm(path.join(target,"v5","integrity-manifest.json"));
  const outside=path.join(temp,"outside.js"); await writeFile(outside,"throw new Error('must not execute');\n");
  let linkCreated=true; try{await symlink(outside,path.join(target,"v5","escape-test.js"));}catch{linkCreated=false;}
  if(linkCreated){await assert.rejects(packageV5Deployment({targetRoot:target,targetSha:sha,outputRoot:path.join(temp,"linked")}),/Symbolic links and junctions are prohibited/);await rm(path.join(target,"v5","escape-test.js"));}
  await writeFile(path.join(target,"v5","unapproved.exe"),"not hosted\n");
  await assert.rejects(packageV5Deployment({targetRoot:target,targetSha:sha,outputRoot:path.join(temp,"unsupported")}),/Unsupported static file type/);
  await rm(path.join(target,"v5","unapproved.exe"));
  await assert.rejects(packageV5Deployment({targetRoot:target,targetSha:"short",outputRoot:path.join(temp,"bad")}),/full 40-character/);
  await assert.rejects(packageV5Deployment({targetRoot:target,targetSha:sha,outputRoot:path.join(target,"nested-output")}),/separate from untrusted target/);
  assert.equal(await readFile(outside,"utf8"),"throw new Error('must not execute');\n");
  console.log(`Trusted deployment workflow tests passed (${manifest.files.length} files; symlink test ${linkCreated?"executed":"unavailable"}).`);
}finally{await rm(temp,{recursive:true,force:true});}
