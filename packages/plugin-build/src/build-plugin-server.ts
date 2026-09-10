import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  deterministicJson,
  receiptExistingFiles,
  receiptMetafileExternalImports,
  receiptFile,
  receiptMetafileInputs,
  receiptOutput,
  receiptToolchain,
  sha256,
} from "./build-receipt.js";
import { createPluginArtifactMeta } from "./plugin-artifact-meta.js";
import { isRecord, validatePluginBuildManifest } from "./plugin-manifest.js";
import {
  installedPluginSdkDirectory,
  installedPluginSdkExportTarget,
  pathExists,
  PLUGIN_SDK_PACKAGE_NAME,
} from "./plugin-sdk-install.js";
import {
  NODE_ESM_REQUIRE_BANNER,
  type PluginBuildToolchain,
} from "./toolchain.js";

const PLUGIN_SDK_SPECIFIER = "@get-bb/plugin-sdk";

const BUILD_SDK_MANIFEST = fileURLToPath(
  new URL("../../plugin-sdk/package.json", import.meta.url),
);

const LEGACY_PLUGIN_SDK_SPECIFIER = "@bb/plugin-sdk";

export const PLUGIN_SERVER_EXTERNALS: readonly string[] = [
  PLUGIN_SDK_SPECIFIER,
  LEGACY_PLUGIN_SDK_SPECIFIER,
  "better-sqlite3",
];

const PLUGIN_SDK_ROOT_FILTER = /^@get-bb\/plugin-sdk$|^@bb\/plugin-sdk$/;
const PLUGIN_SDK_SUBPATH_FILTER = /^@get-bb\/plugin-sdk\//;
const PLUGIN_SDK_SUBPATH_RESOLVE_MARK = "bb-server-sdk-subpath";

async function unresolvedSdkSubpathError(args: {
  specifier: string;
  resolveDir: string;
  esbuildErrors: readonly { text: string }[];
}): Promise<string> {
  const need = `a server entry's "${args.specifier}" import is bundled from the plugin's own SDK install (bb serves only the bare "${PLUGIN_SDK_SPECIFIER}" at load time), so the plugin needs`;
  const packageDir = await installedPluginSdkDirectory(args.resolveDir);
  if (packageDir === null) {
    return `"${args.specifier}" is not installed for this plugin (no node_modules/${PLUGIN_SDK_PACKAGE_NAME}); ${need} the SDK as a dependency`;
  }
  const subpath = `.${args.specifier.slice(PLUGIN_SDK_PACKAGE_NAME.length)}`;
  const target = await installedPluginSdkExportTarget(packageDir, subpath);
  if (target === null) {
    return `"${args.specifier}" is not exported by the ${PLUGIN_SDK_PACKAGE_NAME} installed at ${packageDir}; ${need} an SDK version that ships it`;
  }
  const targetPath = resolve(packageDir, target);
  if (!(await pathExists(targetPath))) {
    return `"${args.specifier}" is installed for this plugin but its dist is not built: run the SDK build (${targetPath} is missing); ${need} the built SDK`;
  }
  return `"${args.specifier}" could not be resolved from ${packageDir}: ${args.esbuildErrors.map((error) => error.text).join("; ")}`;
}

interface PluginServerConfig {
  serverEntry: string;
  packageName: string;
  pluginVersion: string;
}

async function readPluginServerConfig(
  rootDir: string,
): Promise<PluginServerConfig> {
  const packageJsonPath = join(rootDir, "package.json");
  let raw: string;
  try {
    raw = await readFile(packageJsonPath, "utf8");
  } catch {
    throw new Error(`no readable package.json at ${packageJsonPath}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`package.json is not valid JSON at ${packageJsonPath}`);
  }
  if (!isRecord(json) || !isRecord(json.bb) || json.bb.server === undefined) {
    throw new Error(
      `no server entry: ${packageJsonPath} has no "bb": { "server": "./server.ts" } field`,
    );
  }
  const manifest = await validatePluginBuildManifest(
    json,
    rootDir,
    packageJsonPath,
  );
  const server = manifest.bb.server;
  if (isAbsolute(server)) {
    throw new Error(`manifest bb.server must be relative, got "${server}"`);
  }
  const serverEntry = resolve(rootDir, server);
  if (serverEntry !== rootDir && !serverEntry.startsWith(rootDir + "/")) {
    throw new Error(
      `manifest bb.server escapes the plugin directory: "${server}"`,
    );
  }
  try {
    await stat(serverEntry);
  } catch {
    throw new Error(`manifest bb.server points at a missing file: ${server}`);
  }
  return {
    serverEntry,
    packageName: manifest.name,
    pluginVersion: manifest.version,
  };
}

export interface PluginServerBuildResult {
  jsPath: string;
  mapPath: string;
  metaPath: string;
  receiptPath: string;
}

export interface PluginServerBuildOptions {
  outputDir?: string;
}

export async function buildPluginServer(
  rootDir: string,
  bbVersion: string,
  toolchain: PluginBuildToolchain,
  options: PluginServerBuildOptions = {},
): Promise<PluginServerBuildResult> {
  const { serverEntry, packageName, pluginVersion } =
    await readPluginServerConfig(rootDir);
  const distDir = options.outputDir ?? join(rootDir, "dist");
  await mkdir(distDir, { recursive: true });
  const jsPath = join(distDir, "server.js");
  const mapPath = join(distDir, "server.js.map");
  const metaPath = join(distDir, "server.meta.json");
  const receiptPath = join(distDir, "server.receipt.json");

  const stageDir = await mkdtemp(join(distDir, ".stage-"));
  try {
    const stagedJsPath = join(stageDir, "server.js");
    const stagedMetaPath = join(stageDir, "server.meta.json");
    const stagedReceiptPath = join(stageDir, "server.receipt.json");

    const esbuild = (await import(
      toolchain.esbuild
    )) as typeof import("esbuild");
    const bundle = await esbuild.build({
      entryPoints: [serverEntry],
      outfile: stagedJsPath,
      absWorkingDir: rootDir,
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node22",
      sourcemap: true,
      metafile: true,
      banner: { js: NODE_ESM_REQUIRE_BANNER },
      external: PLUGIN_SERVER_EXTERNALS.filter(
        (specifier) => !PLUGIN_SDK_ROOT_FILTER.test(specifier),
      ),
      plugins: [
        {
          name: "bb-plugin-sdk-resolution",
          setup(build) {
            build.onResolve({ filter: PLUGIN_SDK_ROOT_FILTER }, (args) => ({
              path: args.path,
              external: true,
            }));
            build.onResolve(
              { filter: PLUGIN_SDK_SUBPATH_FILTER },
              async (args) => {
                if (args.pluginData === PLUGIN_SDK_SUBPATH_RESOLVE_MARK) {
                  return undefined;
                }
                const installed = await build.resolve(args.path, {
                  resolveDir: args.resolveDir,
                  kind: args.kind,
                  importer: args.importer,
                  pluginData: PLUGIN_SDK_SUBPATH_RESOLVE_MARK,
                });
                if (installed.errors.length === 0 && installed.path !== "") {
                  return { path: installed.path };
                }
                return {
                  errors: [
                    {
                      text: await unresolvedSdkSubpathError({
                        specifier: args.path,
                        resolveDir: args.resolveDir,
                        esbuildErrors: installed.errors,
                      }),
                    },
                  ],
                };
              },
            );
          },
        },
      ],
      logLevel: "error",
    });
    await writeFile(
      stagedMetaPath,
      JSON.stringify(
        createPluginArtifactMeta({ packageName, pluginVersion, bbVersion }),
        null,
        2,
      ) + "\n",
    );

    if (bundle.metafile === undefined) {
      throw new Error("esbuild did not return the server build metafile");
    }
    const outputFiles = await Promise.all([
      receiptOutput(rootDir, jsPath, stagedJsPath),
      receiptOutput(rootDir, mapPath, join(stageDir, "server.js.map")),
      receiptOutput(rootDir, metaPath, stagedMetaPath),
    ]);
    const externalManifests = await receiptExistingFiles(
      rootDir,
      PLUGIN_SERVER_EXTERNALS.map((specifier) =>
        join(rootDir, "node_modules", specifier, "package.json"),
      ),
    );
    await writeFile(
      stagedReceiptPath,
      deterministicJson({
        formatVersion: 1,
        kind: "plugin-server-build",
        configuration: {
          entry: await receiptFile(rootDir, serverEntry),
          packageManifest: await receiptFile(rootDir, join(rootDir, "package.json")),
          packageName,
          pluginVersion,
          bbVersion,
          format: "esm",
          platform: "node",
          target: "node22",
          sourcemap: true,
          banner: NODE_ESM_REQUIRE_BANNER,
          bannerSha256: sha256(NODE_ESM_REQUIRE_BANNER),
          externals: [...PLUGIN_SERVER_EXTERNALS],
        },
        inputs: {
          esbuild: await receiptMetafileInputs(rootDir, bundle.metafile),
          esbuildExternalImports: receiptMetafileExternalImports(
            bundle.metafile,
          ),
          sdkManifests: await receiptExistingFiles(rootDir, [
            BUILD_SDK_MANIFEST,
            join(rootDir, "node_modules", "@get-bb", "plugin-sdk", "package.json"),
            join(rootDir, "node_modules", "@bb", "plugin-sdk", "package.json"),
          ]),
          externalManifests,
          toolchain: await receiptToolchain(rootDir, toolchain),
        },
        outputs: outputFiles,
      }),
    );

    await rename(stagedJsPath, jsPath);
    await rename(join(stageDir, "server.js.map"), mapPath);
    await rename(stagedMetaPath, metaPath);
    await rename(stagedReceiptPath, receiptPath);
  } finally {
    await rm(stageDir, { recursive: true, force: true });
  }
  return { jsPath, mapPath, metaPath, receiptPath };
}
