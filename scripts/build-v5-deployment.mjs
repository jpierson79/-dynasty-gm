import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEPLOYMENT_MANIFEST_SCHEMA = "v5-deployment-integrity-v1";
const LOCAL_SPECIFIER = /^(?:\.\.?\/)/;
const MUTABLE_LOCAL_SPECIFIER = /^\/(?:v5|js)\//;
const STATIC_IMPORT = /\b(?:import\s+(?:[^'";]+?\s+from\s+)?|export\s+(?:\*|\{[^}]*\})\s+from\s+)["']([^"']+)["']/g;
const NAMED_IMPORT = /\bimport\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;

function slash(value) { return value.split(path.sep).join("/"); }
function assertCommit(commit) {
  if (!/^[0-9a-f]{40}$/i.test(commit || "")) throw new Error("Deployment commit must be a full 40-character Git SHA.");
  return commit.toLowerCase();
}
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function stripQuery(specifier) { return specifier.split(/[?#]/, 1)[0]; }
function localModulePath(fromFile, specifier, versionRoot) {
  const resolved = path.resolve(path.dirname(fromFile), stripQuery(specifier));
  const relative = path.relative(versionRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Local module escapes immutable deployment root: ${specifier} from ${slash(path.relative(versionRoot, fromFile))}`);
  return resolved;
}
function staticSpecifiers(source) { return [...source.matchAll(STATIC_IMPORT)].map(match => match[1]); }
function namedImports(source) {
  return [...source.matchAll(NAMED_IMPORT)].flatMap(match => match[1].split(",").map(part => part.trim()).filter(Boolean).map(part => ({ imported: part.split(/\s+as\s+/)[0].trim(), specifier: match[2] })));
}
function exportedNames(source) {
  const names = new Set();
  for (const match of source.matchAll(/\bexport\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) names.add(match[1]);
  for (const match of source.matchAll(/\bexport\s*\{([^}]*)\}(?:\s+from\s+["'][^"']+["'])?/g)) {
    for (const part of match[1].split(",")) {
      const value = part.trim();
      if (!value) continue;
      const pieces = value.split(/\s+as\s+/);
      names.add((pieces[1] || pieces[0]).trim());
    }
  }
  return names;
}
async function walkFiles(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(target);
      else if (entry.isFile()) files.push(target);
    }
  }
  await walk(root);
  return files.sort((a, b) => slash(path.relative(root, a)).localeCompare(slash(path.relative(root, b))));
}
async function moduleEntry(versionRoot) {
  const htmlFile = path.join(versionRoot, "v5", "index.html");
  const html = await readFile(htmlFile, "utf8");
  const match = html.match(/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["']/i) || html.match(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*\btype=["']module["']/i);
  if (!match || !LOCAL_SPECIFIER.test(match[1])) throw new Error("Versioned V5 index must reference one local module entry.");
  return localModulePath(htmlFile, match[1], versionRoot);
}

export async function validateEmittedModuleGraph({ versionRoot, manifest }) {
  const entry = await moduleEntry(versionRoot);
  const pending = [entry], visited = new Set(), namedContracts = [];
  while (pending.length) {
    const file = pending.pop();
    const relative = slash(path.relative(versionRoot, file));
    if (visited.has(relative)) continue;
    if (!(await stat(file)).isFile()) throw new Error(`Resolved module does not exist: ${relative}`);
    visited.add(relative);
    const source = await readFile(file, "utf8");
    for (const specifier of staticSpecifiers(source)) {
      if (MUTABLE_LOCAL_SPECIFIER.test(stripQuery(specifier))) throw new Error(`Mutable local module URL is prohibited: ${specifier} from ${relative}`);
      if (!LOCAL_SPECIFIER.test(specifier)) continue;
      pending.push(localModulePath(file, specifier, versionRoot));
    }
    for (const contract of namedImports(source)) {
      if (!LOCAL_SPECIFIER.test(contract.specifier)) continue;
      const target = localModulePath(file, contract.specifier, versionRoot);
      if (!exportedNames(await readFile(target, "utf8")).has(contract.imported)) throw new Error(`Named import ${contract.imported} is not exported by ${slash(path.relative(versionRoot, target))}`);
      namedContracts.push({ from: relative, imported: contract.imported, target: slash(path.relative(versionRoot, target)) });
    }
  }
  const manifestByPath = new Map(manifest.files.map(file => [file.path, file.sha256]));
  for (const relative of visited) {
    const expected = manifestByPath.get(relative);
    if (!expected) throw new Error(`Module is absent from integrity manifest: ${relative}`);
    if (sha256(await readFile(path.join(versionRoot, relative))) !== expected) throw new Error(`Manifest hash mismatch: ${relative}`);
  }
  return { entry: slash(path.relative(versionRoot, entry)), modules: [...visited].sort(), namedContracts };
}

function redirectHtml({ commit, target, title }) {
  const escapedTarget = target.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">\n  <meta http-equiv="refresh" content="0;url=${escapedTarget}">\n  <title>${title}</title>\n</head>\n<body>\n  <p>Deployment <code>${commit}</code></p>\n  <p><a href="${escapedTarget}">Open Dynasty Front Office V5</a></p>\n  <script>location.replace(${JSON.stringify(target)});</script>\n</body>\n</html>\n`;
}

export async function packageV5Deployment({ sourceRoot, outputRoot, commit }) {
  const deploymentCommit = assertCommit(commit);
  const resolvedSource = path.resolve(sourceRoot), resolvedOutput = path.resolve(outputRoot);
  const versionRoot = path.join(resolvedOutput, "v5-builds", deploymentCommit);
  await rm(resolvedOutput, { recursive: true, force: true });
  await mkdir(resolvedOutput, { recursive: true });
  for (const name of ["index.html", "css", "js"]) await cp(path.join(resolvedSource, name), path.join(resolvedOutput, name), { recursive: true });
  await mkdir(versionRoot, { recursive: true });
  await cp(path.join(resolvedSource, "v5"), path.join(versionRoot, "v5"), { recursive: true });
  await cp(path.join(resolvedSource, "js"), path.join(versionRoot, "js"), { recursive: true });
  await writeFile(path.join(versionRoot, "index.html"), redirectHtml({ commit: deploymentCommit, target: "./v5/index.html", title: "Dynasty Front Office V5 deployment" }), "utf8");
  await writeFile(path.join(versionRoot, "deployment.json"), `${JSON.stringify({ commit: deploymentCommit, entry: "v5/index.html" }, null, 2)}\n`, "utf8");
  await mkdir(path.join(resolvedOutput, "v5"), { recursive: true });
  await writeFile(path.join(resolvedOutput, "v5", "index.html"), redirectHtml({ commit: deploymentCommit, target: `../v5-builds/${deploymentCommit}/v5/index.html`, title: "Dynasty Front Office V5" }), "utf8");
  await writeFile(path.join(resolvedOutput, "v5", "deployment.json"), `${JSON.stringify({ commit: deploymentCommit, entry: `../v5-builds/${deploymentCommit}/v5/index.html` }, null, 2)}\n`, "utf8");
  const emitted = (await walkFiles(versionRoot)).filter(file => path.basename(file) !== "integrity-manifest.json");
  const files = [];
  for (const file of emitted) files.push({ path: slash(path.relative(versionRoot, file)), sha256: sha256(await readFile(file)) });
  const manifest = { schema: DEPLOYMENT_MANIFEST_SCHEMA, commit: deploymentCommit, entry: "v5/index.html", files };
  await writeFile(path.join(versionRoot, "integrity-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const graph = await validateEmittedModuleGraph({ versionRoot, manifest });
  const manifestPath = path.join(versionRoot, "integrity-manifest.json");
  return { commit: deploymentCommit, outputRoot: resolvedOutput, versionRoot, versionedEntry: `v5-builds/${deploymentCommit}/v5/index.html`, manifestPath, manifestSha256: sha256(await readFile(manifestPath)), graph };
}

function argument(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : ""; }
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sourceRoot = path.resolve(argument("--source") || path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
  const outputRoot = path.resolve(argument("--output") || path.join(sourceRoot, ".pages-dist"));
  const commit = argument("--commit") || process.env.GITHUB_SHA || execFileSync("git", ["rev-parse", "HEAD"], { cwd: sourceRoot, encoding: "utf8" }).trim();
  process.stdout.write(`${JSON.stringify(await packageV5Deployment({ sourceRoot, outputRoot, commit }), null, 2)}\n`);
}
