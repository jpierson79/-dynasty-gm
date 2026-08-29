import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const FULL_SHA = /^[0-9a-f]{40}$/;
const HEX_256 = /^[0-9a-f]{64}$/;
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

export function hostedDeploymentUrls({ baseUrl, versionedEntry, targetSha }) {
  const commit = String(targetSha || "").toLowerCase();
  if (!FULL_SHA.test(commit)) throw new Error("Hosted verification requires a full lowercase target SHA.");
  const expectedEntry = `v5-builds/${commit}/v5/index.html`;
  if (versionedEntry !== expectedEntry) throw new Error(`Versioned entry does not match target SHA: ${versionedEntry}`);
  const root = new URL(String(baseUrl || ""));
  if (root.protocol !== "https:") throw new Error("Hosted verification requires an HTTPS Pages base URL.");
  if (!root.pathname.endsWith("/")) root.pathname += "/";
  const index = new URL(expectedEntry, root);
  const versionRoot = new URL(`v5-builds/${commit}/`, root);
  return {
    index,
    directory: new URL(`v5-builds/${commit}/`, root),
    manifest: new URL("integrity-manifest.json", versionRoot),
    versionRoot
  };
}

async function fetchRequired(url, fetchImpl) {
  const response = await fetchImpl(url, { redirect: "follow", cache: "no-store" });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

export async function verifyHostedV5Deployment({ baseUrl, versionedEntry, targetSha, manifestSha256, fetchImpl = fetch, attempts = 8, delayMs = 5000 }) {
  const expectedManifestHash = String(manifestSha256 || "").toLowerCase();
  if (!HEX_256.test(expectedManifestHash)) throw new Error("Hosted verification requires a SHA-256 manifest digest.");
  const urls = hostedDeploymentUrls({ baseUrl, versionedEntry, targetSha });
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await fetchRequired(urls.index, fetchImpl);
      const manifestBytes = await fetchRequired(urls.manifest, fetchImpl);
      if (sha256(manifestBytes) !== expectedManifestHash) throw new Error("Hosted manifest SHA-256 does not match the trusted build output.");
      const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
      if (manifest.commit !== targetSha || manifest.entry !== "v5/index.html") throw new Error("Hosted manifest identity does not match the requested deployment.");
      const representative = manifest.files.find(file => file.path === "v5/js/main.js") || manifest.files.find(file => file.path.endsWith(".js"));
      if (!representative || !HEX_256.test(representative.sha256)) throw new Error("Hosted manifest lacks a representative hashed module.");
      const moduleUrl = new URL(representative.path, urls.versionRoot);
      const moduleBytes = await fetchRequired(moduleUrl, fetchImpl);
      if (sha256(moduleBytes) !== representative.sha256) throw new Error("Hosted representative module hash does not match the manifest.");
      return { ...urls, module: moduleUrl, manifest, attempt };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(delayMs);
    }
  }
  throw new Error(`Hosted immutable deployment unavailable after ${attempts} attempts: ${lastError?.message || "unknown error"}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await verifyHostedV5Deployment({
    baseUrl: argument("--base-url"),
    versionedEntry: argument("--versioned-entry"),
    targetSha: argument("--target-sha"),
    manifestSha256: argument("--manifest-sha256")
  });
  process.stdout.write(`${JSON.stringify({ index: result.index.href, manifest: result.manifest.commit, module: result.module.href, attempt: result.attempt })}\n`);
}
