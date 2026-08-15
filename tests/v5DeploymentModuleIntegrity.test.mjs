import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packageV5Deployment, validateEmittedModuleGraph } from "../scripts/build-v5-deployment.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const commitA = "a".repeat(40), commitB = "b".repeat(40);
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
async function exists(file) { return stat(file).then(value => value.isFile(), () => false); }

const temp = await mkdtemp(path.join(os.tmpdir(), "v5-deployment-integrity-"));
try {
  const outputA = path.join(temp, "a");
  const resultA = await packageV5Deployment({ sourceRoot: root, outputRoot: outputA, commit: commitA });
  const versionA = path.join(outputA, "v5-builds", commitA);
  const manifestA = JSON.parse(await readFile(resultA.manifestPath, "utf8"));
  assert.equal(resultA.versionedEntry, `v5-builds/${commitA}/v5/index.html`);
  assert.equal(manifestA.commit, commitA);
  assert.equal(manifestA.entry, "v5/index.html");
  assert.equal(await exists(path.join(versionA, "v5", "index.html")), true);
  assert.equal(await exists(path.join(versionA, "v5", "js", "main.js")), true);
  assert.equal(await exists(path.join(versionA, "v5", "js", "services", "statcastProviderService.js")), true);
  assert.equal(await exists(path.join(versionA, "v5", "js", "repositories", "importJobRepository.js")), true);
  assert.equal(await exists(path.join(versionA, "js", "services", "authService.js")), true, "shared root JS must be immutable too");
  for (const file of manifestA.files) assert.equal(hash(await readFile(path.join(versionA, file.path))), file.sha256, `hash mismatch for ${file.path}`);
  assert.equal(hash(await readFile(resultA.manifestPath)), resultA.manifestSha256);

  const graphA = await validateEmittedModuleGraph({ versionRoot: versionA, manifest: manifestA });
  for (const required of ["v5/js/main.js", "v5/js/services/statcastProviderService.js", "v5/js/repositories/importJobRepository.js", "v5/js/services/playerIntelligenceInspectionService.js"]) assert.ok(graphA.modules.includes(required));
  assert.ok(graphA.modules.some(file => file.startsWith("js/services/")), "shared dependencies must stay in the same immutable root");
  assert.ok(graphA.namedContracts.some(contract => contract.from === "v5/js/services/statcastProviderService.js" && contract.imported === "finishAutomatedStatcastJob" && contract.target === "v5/js/repositories/importJobRepository.js"));
  assert.equal(graphA.modules.some(file => file.includes("../") || file.startsWith("/v5/")), false);

  assert.deepEqual(await readFile(path.join(versionA, "v5", "js", "main.js")), await readFile(path.join(root, "v5", "js", "main.js")), "application JS must be copied byte-for-byte");
  assert.match(await readFile(path.join(outputA, "v5", "index.html"), "utf8"), new RegExp(`v5-builds/${commitA}/v5/index\\.html`));

  for (const file of manifestA.files.filter(file => file.path.endsWith(".js"))) {
    assert.deepEqual(await readFile(path.join(versionA, file.path)), await readFile(path.join(root, file.path)), `copied JS bytes changed for ${file.path}`);
  }

  const repeatOutput = path.join(temp, "a-repeat");
  const repeatA = await packageV5Deployment({ sourceRoot: root, outputRoot: repeatOutput, commit: commitA });
  assert.deepEqual(await readFile(repeatA.manifestPath), await readFile(resultA.manifestPath), "same commit and source must emit a deterministic manifest");
  assert.equal(repeatA.manifestSha256, resultA.manifestSha256);

  const outputB = path.join(temp, "b");
  const resultB = await packageV5Deployment({ sourceRoot: root, outputRoot: outputB, commit: commitB });
  assert.notEqual(resultA.versionedEntry, resultB.versionedEntry);
  assert.equal(await exists(path.join(outputB, "v5-builds", commitB, "v5", "js", "main.js")), true);

  const unsafeRoot = path.join(temp, "unsafe");
  await mkdir(path.join(unsafeRoot, "v5", "js"), { recursive: true });
  await writeFile(path.join(unsafeRoot, "v5", "index.html"), '<script type="module" src="./js/main.js"></script>\n');
  await writeFile(path.join(unsafeRoot, "v5", "js", "main.js"), 'import "/v5/js/mutable.js";\n');
  const unsafeManifest = { files: [{ path: "v5/js/main.js", sha256: hash(await readFile(path.join(unsafeRoot, "v5", "js", "main.js"))) }] };
  await assert.rejects(validateEmittedModuleGraph({ versionRoot: unsafeRoot, manifest: unsafeManifest }), /Mutable local module URL is prohibited/);

  const workflow = await readFile(path.join(root, ".github", "workflows", "deploy-pages.yml"), "utf8");
  assert.match(workflow, /git rev-parse HEAD/);
  assert.match(workflow, /build-v5-deployment\.mjs --commit/);
  assert.match(workflow, /actions\/upload-pages-artifact@v3/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.doesNotMatch(workflow, /[0-9a-f]{40}/i, "workflow must not hard-code a deployment SHA");
  console.log(`V5 deployment integrity tests passed (${graphA.modules.length} modules, ${manifestA.files.length} hashed files).`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
