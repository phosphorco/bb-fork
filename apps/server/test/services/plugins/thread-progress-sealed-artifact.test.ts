import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { getInstalledPlugin, getPluginSettingsValues } from "@bb/db";
import { startTestServer, type RunningTestServer } from "../../helpers/test-app.js";

const artifactRoot = process.env.BB_THREAD_PROGRESS_ARTIFACT;
let harness: RunningTestServer | undefined;
afterEach(async () => {
  await harness?.pluginService.stop();
  await harness?.close();
});

it.skipIf(!artifactRoot)("installs the actual receipt-backed Thread Progress artifact without source rebuild", { timeout: 90_000 }, async () => {
  if (!artifactRoot) throw new Error("An assembled artifact is required");
  const assembler = await import(new URL("../../../../../../../scripts/proof-thread-progress-artifact.mjs", import.meta.url).href);
  const sealed = JSON.parse(await readFile(join(artifactRoot, "sealed-manifest.json"), "utf8"));
  expect(sealed.buildReceipts.server.receipt.inputs.esbuild.length).toBeGreaterThan(0);
  for (const entry of sealed.files) {
    expect(createHash("sha256").update(await readFile(join(artifactRoot, entry.path))).digest("hex")).toBe(entry.sha256);
  }
  harness = await startTestServer();
  harness.pluginService.bindSdk({ baseUrl: harness.baseUrl });
  const packed = await assembler.packSealedThreadProgressArtifact({ artifactRoot, outputDir: join(harness.config.dataDir, "packed") });
  const registry = await assembler.createLoopbackProofRegistry(packed);
  const oldRegistry = process.env.npm_config_registry;
  const oldCache = process.env.npm_config_cache;
  process.env.npm_config_registry = registry.registry;
  process.env.npm_config_cache = join(harness.config.dataDir, "npm-cache");
  try {
    const loaded = await harness.pluginService.install("npm:@phosphor/bb-plugin-thread-progress@0.1.0", { kind: "root" });
    expect(loaded.status, JSON.stringify(loaded)).toBe("running");
    const row = getInstalledPlugin(harness.db, "thread-progress");
    expect(row?.npmIntegrity).toBe(packed.integrity);
    expect(row?.rootDir).toBe(assembler.managedThreadProgressRoot(harness.config.dataDir));
    if (!row) throw new Error("Installed artifact row missing");
    for (const entry of sealed.files) {
      expect(createHash("sha256").update(await readFile(join(row.rootDir, entry.path))).digest("hex")).toBe(entry.sha256);
    }
    await expect(stat(join(row.rootDir, "server.ts"))).rejects.toThrow();
    await expect(stat(join(row.rootDir, "app.tsx"))).rejects.toThrow();
    const response = await fetch(`${harness.baseUrl}/api/v1/plugins/thread-progress/assets/app.js`);
    expect(response.status).toBe(200);
    expect(createHash("sha256").update(Buffer.from(await response.arrayBuffer())).digest("hex")).toBe(sealed.files.find((entry: { path: string }) => entry.path === "dist/app.js").sha256);
    expect(harness.pluginService.getRpcHandler("thread-progress", "prepareThreadSectionsState").outcome).toBe("found");
  } finally {
    if (oldRegistry === undefined) delete process.env.npm_config_registry;
    else process.env.npm_config_registry = oldRegistry;
    if (oldCache === undefined) delete process.env.npm_config_cache;
    else process.env.npm_config_cache = oldCache;
    await registry.close();
  }
});

it.skipIf(!artifactRoot)("stages the actual receipt-backed Thread Progress artifact without loading its factory", { timeout: 90_000 }, async () => {
  if (!artifactRoot) throw new Error("An assembled artifact is required");
  const assembler = await import(new URL("../../../../../../../scripts/proof-thread-progress-artifact.mjs", import.meta.url).href);
  harness = await startTestServer();
  harness.pluginService.bindSdk({ baseUrl: harness.baseUrl });
  const packed = await assembler.packSealedThreadProgressArtifact({ artifactRoot, outputDir: join(harness.config.dataDir, "packed") });
  const registry = await assembler.createLoopbackProofRegistry(packed);
  try {
    const staged = await harness.pluginService.stageNpmInstall({
      source: "npm:@phosphor/bb-plugin-thread-progress@0.1.0",
      pluginId: "thread-progress",
      npmRegistry: registry.registry,
      expectedNpmVersion: "0.1.0",
      expectedNpmIntegrity: packed.integrity,
      preActivationSettings: {
        descriptors: {
          summariesEnabled: { type: "boolean", label: "Summaries", default: true },
          summariesForChildThreads: { type: "boolean", label: "Child summaries", default: false },
          idleDelaySeconds: { type: "string", label: "Idle delay", default: "3600" },
          summaryMinUserTurns: { type: "string", label: "Minimum turns", default: "1" },
        },
        values: { summariesEnabled: false, summariesForChildThreads: false, idleDelaySeconds: "3600", summaryMinUserTurns: "1" },
      },
    });
    expect(staged.status).toBe("disabled");
    expect(harness.pluginService.isPluginLoaded("thread-progress")).toBe(false);
    const row = getInstalledPlugin(harness.db, "thread-progress");
    expect(row?.enabled).toBe(false);
    expect(row?.npmIntegrity).toBe(packed.integrity);
    expect(row?.rootDir).toBe(assembler.managedThreadProgressRoot(harness.config.dataDir));
    expect(getPluginSettingsValues(harness.db, "thread-progress")).toEqual({
      summariesEnabled: "false",
      summariesForChildThreads: "false",
      idleDelaySeconds: '"3600"',
      summaryMinUserTurns: '"1"',
    });
    await expect(stat(join(harness.config.dataDir, "plugins", "thread-progress", "data.db"))).rejects.toThrow();
  } finally {
    await registry.close();
  }
});
