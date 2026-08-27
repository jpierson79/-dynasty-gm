import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hostedDeploymentUrls, verifyHostedV5Deployment } from "../scripts/verify-hosted-v5-deployment.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflow = await readFile(path.join(root, ".github", "workflows", "deploy-pages.yml"), "utf8");
const sha = "a".repeat(40), manifest = { commit: sha, entry: "v5/index.html", files: [] };
const moduleBytes = new TextEncoder().encode("export const ready=true;\n");
manifest.files.push({ path: "v5/js/main.js", sha256: createHash("sha256").update(moduleBytes).digest("hex") });
const manifestBytes = new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`);
const manifestHash = createHash("sha256").update(manifestBytes).digest("hex");

assert.match(workflow, /actions\/configure-pages@v5/);
assert.match(workflow, /data\.build_type !== "workflow"/);
assert.match(workflow, /actions\/upload-pages-artifact@v4/);
assert.match(workflow, /actions\/deploy-pages@v4/);
assert.match(workflow, /verify-hosted-v5-deployment\.mjs/);
assert.match(workflow, /steps\.deployment\.outputs\.page_url/);
assert.match(workflow, /pages: write[\s\S]*id-token: write/);
assert.doesNotMatch(workflow, /contents: write/);

const modeScript = workflow.match(/- name: Require Actions-based Pages publication[\s\S]*?script: \|\n((?: {12}.*\n)+)/)?.[1]
  ?.split("\n").map(line => line.slice(12)).join("\n");
assert.ok(modeScript, "the exact Pages publication-mode guard must be testable");
const runModeGuard = async buildType => {
  const failures = [];
  const github = { rest: { repos: { getPages: async () => ({ data: { build_type: buildType } }) } } };
  const context = { repo: { owner: "owner", repo: "project" } };
  const core = { setFailed: message => failures.push(message) };
  await new (Object.getPrototypeOf(async function(){}).constructor)("github", "context", "core", modeScript)(github, context, core);
  return failures;
};
assert.deepEqual(await runModeGuard("workflow"), [], "Actions publication mode passes the exact workflow guard");
assert.match((await runModeGuard("legacy"))[0], /must be GitHub Actions.*observed legacy/, "legacy branch publication fails closed with actionable guidance");

const urls = hostedDeploymentUrls({ baseUrl: "https://example.github.io/project/", versionedEntry: `v5-builds/${sha}/v5/index.html`, targetSha: sha });
assert.equal(urls.index.href, `https://example.github.io/project/v5-builds/${sha}/v5/index.html`);
assert.equal(urls.manifest.href, `https://example.github.io/project/v5-builds/${sha}/integrity-manifest.json`);
assert.throws(() => hostedDeploymentUrls({ baseUrl: "https://example.github.io/project/", versionedEntry: "v5/index.html", targetSha: sha }), /does not match/);

let calls = 0;
const fetchImpl = async url => {
  calls += 1;
  const pathname = new URL(url).pathname;
  if (pathname.endsWith("/v5/index.html")) return new Response("<html></html>");
  if (pathname.endsWith("/integrity-manifest.json")) return new Response(manifestBytes);
  if (pathname.endsWith("/v5/js/main.js")) return new Response(moduleBytes);
  return new Response("missing", { status: 404 });
};
const verified = await verifyHostedV5Deployment({ baseUrl: "https://example.github.io/project/", versionedEntry: `v5-builds/${sha}/v5/index.html`, targetSha: sha, manifestSha256: manifestHash, fetchImpl, attempts: 1, delayMs: 0 });
assert.equal(verified.manifest.commit, sha);
assert.equal(calls, 3);
await assert.rejects(() => verifyHostedV5Deployment({ baseUrl: "https://example.github.io/project/", versionedEntry: `v5-builds/${sha}/v5/index.html`, targetSha: sha, manifestSha256: "b".repeat(64), fetchImpl, attempts: 1, delayMs: 0 }), /manifest SHA-256/);
const wrongTargetManifest = { ...manifest, commit: "b".repeat(40) };
const wrongTargetBytes = new TextEncoder().encode(`${JSON.stringify(wrongTargetManifest, null, 2)}\n`);
const wrongTargetHash = createHash("sha256").update(wrongTargetBytes).digest("hex");
const wrongTargetFetch = async url => new URL(url).pathname.endsWith("integrity-manifest.json") ? new Response(wrongTargetBytes) : fetchImpl(url);
await assert.rejects(() => verifyHostedV5Deployment({ baseUrl: "https://example.github.io/project/", versionedEntry: `v5-builds/${sha}/v5/index.html`, targetSha: sha, manifestSha256: wrongTargetHash, fetchImpl: wrongTargetFetch, attempts: 1, delayMs: 0 }), /manifest identity/);

console.log("V5 Pages delivery contract tests passed.");
