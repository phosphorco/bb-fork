import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { derivePluginId } from "@bb/domain";
import type { Metafile, Plugin } from "esbuild";
import {
  deterministicJson,
  receiptExistingFiles,
  receiptFile,
  receiptMetafileInputs,
  receiptOutput,
  receiptToolchain,
  receiptVirtualInput,
  sha256,
  type BuildReceiptFile,
} from "./build-receipt.js";
import {
  PLUGIN_THEME_CSS,
  TW_ANIMATE_CSS,
} from "./generated/plugin-theme.generated.js";
import { RUNTIME_EXPORT_MANIFEST } from "./generated/runtime-export-manifest.generated.js";
import { type PluginBuildToolchain } from "./toolchain.js";
import { createPluginArtifactMeta } from "./plugin-artifact-meta.js";
import { isRecord, validatePluginBuildManifest } from "./plugin-manifest.js";
import {
  LEGACY_PLUGIN_SDK_APP_SPECIFIER,
  PLUGIN_SDK_APP_SPECIFIER,
  RUNTIME_SLOT_BY_SPECIFIER,
  SHARED_UI_ICON_SPECIFIER,
} from "./runtime-shims.mjs";
import {
  pluginScopeRoots,
  scopePluginUtilities,
} from "./scope-plugin-utilities.js";

export {
  RUNTIME_SLOT_BY_SPECIFIER,
  SHIMMED_TYPE_PACKAGES,
} from "./runtime-shims.mjs";

const SHARED_UI_ICON_MODULE_SUFFIX = "/shared-ui/src/components/ui/icon";
const SHARED_UI_SOURCE_IMPORTER = /[\\/]shared-ui[\\/]src[\\/]/;
const GENERATED_THEME_SOURCE = fileURLToPath(
  new URL("./generated/plugin-theme.generated.ts", import.meta.url),
);
const GENERATED_RUNTIME_EXPORT_MANIFEST_SOURCE = fileURLToPath(
  new URL("./generated/runtime-export-manifest.generated.ts", import.meta.url),
);
const RUNTIME_SHIMS_SOURCE = fileURLToPath(
  new URL("./runtime-shims.mjs", import.meta.url),
);
const BUILD_SDK_MANIFEST = fileURLToPath(
  new URL("../../plugin-sdk/package.json", import.meta.url),
);

export function isSharedUiIconRelativeImport(
  importPath: string,
  importer: string,
): boolean {
  if (!SHARED_UI_SOURCE_IMPORTER.test(importer)) return false;
  const resolved = resolve(dirname(importer), importPath)
    .replace(/\\/g, "/")
    .replace(/\.(?:tsx?|jsx?)$/, "");
  return resolved.endsWith(SHARED_UI_ICON_MODULE_SUFFIX);
}

let freshFacadeImportSequence = 0;

async function freshModuleExports(moduleUrl: string): Promise<string[]> {
  const freshUrl = new URL(moduleUrl);
  freshUrl.searchParams.set(
    "bb-plugin-build",
    String(++freshFacadeImportSequence),
  );
  const moduleNamespace = await import(freshUrl.href);
  return Object.keys(moduleNamespace).sort();
}

async function shimExportsOf(
  requestedSpecifier: string,
  pluginSdkAppModuleUrl: string | undefined,
): Promise<readonly string[]> {
  const specifier =
    requestedSpecifier === LEGACY_PLUGIN_SDK_APP_SPECIFIER
      ? PLUGIN_SDK_APP_SPECIFIER
      : requestedSpecifier;
  if (specifier === PLUGIN_SDK_APP_SPECIFIER) {
    if (pluginSdkAppModuleUrl !== undefined) {
      return freshModuleExports(pluginSdkAppModuleUrl);
    }
    let resolvedModuleUrl: string;
    try {
      resolvedModuleUrl = import.meta.resolve(PLUGIN_SDK_APP_SPECIFIER);
    } catch {
      const names = RUNTIME_EXPORT_MANIFEST[specifier];
      if (!names) {
        throw new Error(`no runtime export manifest entry for "${specifier}"`);
      }
      return names;
    }
    return freshModuleExports(resolvedModuleUrl);
  }
  const names = RUNTIME_EXPORT_MANIFEST[specifier];
  if (!names) {
    throw new Error(`no runtime export manifest entry for "${specifier}"`);
  }
  return names;
}

async function shimModuleSource(
  specifier: string,
  slot: string,
  pluginSdkAppModuleUrl: string | undefined,
): Promise<string> {
  const names = await shimExportsOf(specifier, pluginSdkAppModuleUrl);
  return [
    `const runtime = globalThis.__bbPluginRuntime;`,
    `if (runtime == null || runtime.${slot} == null) {`,
    `  throw new Error(${JSON.stringify(
      `Cannot load "${specifier}": this bundle must be loaded by the BB app, which provides the shared plugin runtime (globalThis.__bbPluginRuntime).`,
    )});`,
    `}`,
    `const mod = runtime.${slot};`,
    `export default ("default" in mod ? mod.default : mod);`,
    `export const {`,
    ...names.map((name) => `  ${name},`),
    `} = mod;`,
    ``,
  ].join("\n");
}

const SHIM_NAMESPACE = "bb-plugin-runtime-shim";
const SHIM_FILTER = new RegExp(
  `^(${Object.keys(RUNTIME_SLOT_BY_SPECIFIER)
    .map((specifier) => specifier.replace(/[/@.-]/g, "\\$&"))
    .join("|")})$`,
);

export function runtimeShimPlugin(pluginSdkAppModuleUrl?: string): Plugin {
  return {
    name: "bb-plugin-runtime-shims",
    setup(build) {
      build.onResolve({ filter: SHIM_FILTER }, (args) => ({
        path: args.path,
        namespace: SHIM_NAMESPACE,
      }));
      build.onResolve({ filter: /(^|\/)icon(\.[jt]sx?)?$/ }, (args) => {
        if (
          args.namespace !== "file" ||
          !args.path.startsWith(".") ||
          !isSharedUiIconRelativeImport(args.path, args.importer)
        ) {
          return undefined;
        }
        return { path: SHARED_UI_ICON_SPECIFIER, namespace: SHIM_NAMESPACE };
      });
      build.onLoad(
        { filter: /.*/, namespace: SHIM_NAMESPACE },
        async (args) => ({
          contents: await shimModuleSource(
            args.path,
            RUNTIME_SLOT_BY_SPECIFIER[args.path] ?? args.path,
            pluginSdkAppModuleUrl,
          ),
          loader: "js",
        }),
      );
    },
  };
}

interface PluginAppConfig {
  appEntry: string;
  packageName: string;
  pluginVersion: string;
}

type ScannerSource = {
  base: string;
  pattern: string;
  negated: boolean;
};

type DependencyTailwindSource = ScannerSource & {
  packageName: string;
  packageJsonPath: string;
};

function readDependencyNames(pkg: Record<string, unknown>): string[] {
  const names = new Set<string>();
  for (const field of ["dependencies", "devDependencies"] as const) {
    const dependencies = pkg[field];
    if (!isRecord(dependencies)) continue;
    for (const name of Object.keys(dependencies)) {
      names.add(name);
    }
  }
  return [...names].sort();
}

async function readPackageJson(
  filePath: string,
): Promise<Record<string, unknown>> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    throw new Error(`no readable package.json at ${filePath}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`package.json is not valid JSON at ${filePath}`);
  }
  if (!isRecord(json)) {
    throw new Error(`package.json must contain an object at ${filePath}`);
  }
  return json;
}

function readTailwindContentPatterns(
  pkg: Record<string, unknown>,
  packageJsonPath: string,
): string[] {
  const bb = pkg.bb;
  if (!isRecord(bb) || bb.pluginTailwindContent === undefined) {
    return [];
  }
  const patterns = bb.pluginTailwindContent;
  if (
    !Array.isArray(patterns) ||
    !patterns.every((pattern) => typeof pattern === "string")
  ) {
    throw new Error(
      `bb.pluginTailwindContent must be an array of strings in ${packageJsonPath}`,
    );
  }
  return patterns;
}

async function packageJsonPathForDirectDependency(
  rootDir: string,
  packageName: string,
): Promise<string | null> {
  const packageJsonPath = join(
    rootDir,
    "node_modules",
    packageName,
    "package.json",
  );
  try {
    await stat(packageJsonPath);
    return packageJsonPath;
  } catch {
    return null;
  }
}

async function readDependencyTailwindSources(
  rootDir: string,
): Promise<DependencyTailwindSource[]> {
  const rootPackageJsonPath = join(rootDir, "package.json");
  const rootPackageJson = await readPackageJson(rootPackageJsonPath);
  const sources: DependencyTailwindSource[] = [];

  for (const packageName of readDependencyNames(rootPackageJson)) {
    const packageJsonPath = await packageJsonPathForDirectDependency(
      rootDir,
      packageName,
    );
    if (packageJsonPath === null) continue;

    const packageJson = await readPackageJson(packageJsonPath);
    const patterns = readTailwindContentPatterns(packageJson, packageJsonPath);
    if (patterns.length === 0) continue;
    const base = await realpath(dirname(packageJsonPath));
    for (const rawPattern of patterns) {
      const negated = rawPattern.startsWith("!");
      const pattern = negated ? rawPattern.slice(1) : rawPattern;
      sources.push({ base, pattern, negated, packageName, packageJsonPath });
    }
  }

  return sources;
}

async function readPluginAppConfig(rootDir: string): Promise<PluginAppConfig> {
  const packageJsonPath = join(rootDir, "package.json");
  const pkg = await readPackageJson(packageJsonPath);
  const manifest = await validatePluginBuildManifest(
    pkg,
    rootDir,
    packageJsonPath,
  );
  const app = manifest.bb.app;
  if (app === undefined) {
    throw new Error(
      `no frontend entry: ${packageJsonPath} has no "bb": { "app": "./app.tsx" } field (only plugins with an app entry can be built)`,
    );
  }
  if (isAbsolute(app)) {
    throw new Error(`manifest bb.app must be relative, got "${app}"`);
  }
  const appEntry = resolve(rootDir, app);
  if (appEntry !== rootDir && !appEntry.startsWith(rootDir + "/")) {
    throw new Error(`manifest bb.app escapes the plugin directory: "${app}"`);
  }
  try {
    await stat(appEntry);
  } catch {
    throw new Error(`manifest bb.app points at a missing file: ${app}`);
  }
  return {
    appEntry,
    packageName: manifest.name,
    pluginVersion: manifest.version,
  };
}

async function buildTailwindCss(
  rootDir: string,
  outputDir: string,
  pluginId: string,
  toolchain: PluginBuildToolchain,
  dependencySources: DependencyTailwindSource[],
  bundledInputs: ReadonlySet<string>,
): Promise<{
  css: string;
  receipt: {
    ownPatterns: ScannerSource[];
    ownFiles: BuildReceiptFile[];
    dependencySources: Array<{
      packageName: string;
      manifest: BuildReceiptFile;
      base: string;
      pattern: string;
      negated: boolean;
    }>;
    dependencyFiles: BuildReceiptFile[];
    bundledDependencyFiles: BuildReceiptFile[];
    compilerDependencies: BuildReceiptFile[];
    generatedInputs: ReturnType<typeof receiptVirtualInput>[];
  };
}> {
  const [{ compile }, { Scanner }] = await Promise.all([
    import(toolchain.tailwindNode) as Promise<
      typeof import("@tailwindcss/node")
    >,
    import(toolchain.tailwindOxide) as Promise<
      typeof import("@tailwindcss/oxide")
    >,
  ]);
  const input = [
    `@layer theme, utilities;`,
    `@import "tailwindcss/theme.css" layer(theme);`,
    TW_ANIMATE_CSS,
    PLUGIN_THEME_CSS,
    `@layer utilities {`,
    `  @tailwind utilities;`,
    `}`,
    ``,
  ].join("\n");
  const compilerDependencyPaths = new Set<string>();
  const compiler = await compile(input, {
    base: rootDir,
    onDependency: (filePath) => compilerDependencyPaths.add(filePath),
    customCssResolver: async (id) => {
      if (id !== "tailwindcss" && !id.startsWith("tailwindcss/")) {
        return undefined;
      }
      const subpath =
        id === "tailwindcss" ? "index.css" : id.slice("tailwindcss/".length);
      const candidate = join(toolchain.tailwindCssDir, subpath);
      return existsSync(candidate) ? candidate : undefined;
    },
  });
  const ownScanner = new Scanner({
    sources: [
      { base: rootDir, pattern: "**/*", negated: false },
      { base: outputDir, pattern: "**/*", negated: true },
      { base: join(rootDir, "node_modules"), pattern: "**/*", negated: true },
    ],
  });
  const ownFiles = await receiptExistingFiles(rootDir, ownScanner.files);
  const candidates = new Set(ownScanner.scan());
  const dependencyReceiptSources = [] as Array<{
    packageName: string;
    manifest: BuildReceiptFile;
    base: string;
    pattern: string;
    negated: boolean;
  }>;
  let dependencyFiles: BuildReceiptFile[] = [];
  let bundledDependencyFiles: BuildReceiptFile[] = [];

  if (dependencySources.length > 0) {
    const scanner = new Scanner({ sources: dependencySources });
    const scannerFiles = scanner.files;
    const dependencyFileIdentities = await Promise.all(
      scannerFiles.map((file) => realpath(file)),
    );
    const bundledDependencyFilePaths = [
      ...new Set(
        dependencyFileIdentities.filter((file) => bundledInputs.has(file)),
      ),
    ];
    const contents = await Promise.all(
      bundledDependencyFilePaths.map(async (file) => ({
        content: await readFile(file, "utf8"),
        extension: extname(file).slice(1),
      })),
    );
    for (const candidate of new Scanner({ sources: [] }).scanFiles(contents)) {
      candidates.add(candidate);
    }
    dependencyFiles = await receiptExistingFiles(rootDir, scannerFiles);
    bundledDependencyFiles = await receiptExistingFiles(
      rootDir,
      bundledDependencyFilePaths,
    );
    for (const source of dependencySources) {
      dependencyReceiptSources.push({
        packageName: source.packageName,
        manifest: await receiptFile(rootDir, source.packageJsonPath),
        base: source.base,
        pattern: source.pattern,
        negated: source.negated,
      });
    }
  }
  return {
    css: scopePluginUtilities(
      compiler.build([...candidates]),
      pluginScopeRoots(pluginId),
    ),
    receipt: {
      ownPatterns: [
        { base: rootDir, pattern: "**/*", negated: false },
        { base: outputDir, pattern: "**/*", negated: true },
        { base: join(rootDir, "node_modules"), pattern: "**/*", negated: true },
      ],
      ownFiles,
      dependencySources: dependencyReceiptSources.sort(
        (left, right) =>
          left.packageName.localeCompare(right.packageName) ||
          left.pattern.localeCompare(right.pattern),
      ),
      dependencyFiles,
      bundledDependencyFiles,
      compilerDependencies: await receiptExistingFiles(
        rootDir,
        [...compilerDependencyPaths],
      ),
      generatedInputs: [
        receiptVirtualInput("tailwind-input.css", input),
        receiptVirtualInput("generated/plugin-theme", PLUGIN_THEME_CSS),
        receiptVirtualInput("generated/tw-animate", TW_ANIMATE_CSS),
      ],
    },
  };
}

async function bundledInputPaths(
  metafile: Metafile,
  absWorkingDir: string,
): Promise<Set<string>> {
  const paths = new Set<string>();
  await Promise.all(
    Object.keys(metafile.inputs).map(async (input) => {
      if (input.startsWith(`${SHIM_NAMESPACE}:`) || input.startsWith("(")) {
        return;
      }
      paths.add(await realpath(resolve(absWorkingDir, input)));
    }),
  );
  return paths;
}

export interface PluginAppBuildResult {
  jsPath: string;
  cssPath: string;
  metaPath: string;
  receiptPath: string;
}

export interface PluginAppBuildOptions {
  minify?: boolean;
  outputDir?: string;
}

export async function buildPluginApp(
  rootDir: string,
  bbVersion: string,
  toolchain: PluginBuildToolchain,
  options: PluginAppBuildOptions = {},
): Promise<PluginAppBuildResult> {
  const { appEntry, packageName, pluginVersion } =
    await readPluginAppConfig(rootDir);
  const pluginId = derivePluginId(packageName);
  const dependencySources = await readDependencyTailwindSources(rootDir);
  const distDir = options.outputDir ?? join(rootDir, "dist");
  const minify = options.minify ?? true;
  await mkdir(distDir, { recursive: true });
  const jsPath = join(distDir, "app.js");
  const cssPath = join(distDir, "app.css");
  const metaPath = join(distDir, "app.meta.json");
  const receiptPath = join(distDir, "app.receipt.json");

  const stageDir = await mkdtemp(join(distDir, ".stage-"));
  try {
    const stagedJsPath = join(stageDir, "app.js");
    const stagedCssPath = join(stageDir, "app.css");
    const stagedMetaPath = join(stageDir, "app.meta.json");
    const stagedReceiptPath = join(stageDir, "app.receipt.json");

    const esbuild = (await import(
      toolchain.esbuild
    )) as typeof import("esbuild");
    const bundle = await esbuild.build({
      entryPoints: [appEntry],
      outfile: stagedJsPath,
      absWorkingDir: rootDir,
      bundle: true,
      metafile: true,
      format: "esm",
      platform: "browser",
      target: "es2022",
      minify,
      legalComments: "none",
      jsx: "automatic",
      jsxDev: false,
      define: {
        "process.env.NODE_ENV": '"production"',
        __BB_PLUGIN_ID__: JSON.stringify(pluginId),
      },
      logLevel: "error",
      plugins: [runtimeShimPlugin()],
    });

    let authoredCss = "";
    try {
      authoredCss = await readFile(stagedCssPath, "utf8");
    } catch (error) {
      if (!isRecord(error) || error.code !== "ENOENT") throw error;
    }
    if (bundle.metafile === undefined) {
      throw new Error("esbuild did not return the app build metafile");
    }
    const esbuildInputs = await receiptMetafileInputs(rootDir, bundle.metafile);
    const bundledInputs = await bundledInputPaths(bundle.metafile, rootDir);
    const tailwind = await buildTailwindCss(
      rootDir,
      distDir,
      pluginId,
      toolchain,
      dependencySources,
      bundledInputs,
    );
    const tailwindCss = tailwind.css.trimEnd();
    const { optimize } = (await import(
      toolchain.tailwindNode
    )) as typeof import("@tailwindcss/node");
    const css = optimize(`${tailwindCss}\n${authoredCss}`, {
      minify,
    }).code;
    await writeFile(stagedCssPath, css);
    await writeFile(
      stagedMetaPath,
      JSON.stringify(
        createPluginArtifactMeta({ packageName, pluginVersion, bbVersion }),
        null,
        2,
      ) + "\n",
    );
    const outputFiles = await Promise.all([
      receiptOutput(rootDir, jsPath, stagedJsPath),
      receiptOutput(rootDir, cssPath, stagedCssPath),
      receiptOutput(rootDir, metaPath, stagedMetaPath),
    ]);
    await writeFile(
      stagedReceiptPath,
      deterministicJson({
        formatVersion: 1,
        kind: "plugin-app-build",
        configuration: {
          entry: await receiptFile(rootDir, appEntry),
          packageManifest: await receiptFile(rootDir, join(rootDir, "package.json")),
          packageName,
          pluginVersion,
          bbVersion,
          pluginId,
          format: "esm",
          platform: "browser",
          target: "es2022",
          minify,
          jsx: "automatic",
          jsxDev: false,
          define: {
            "process.env.NODE_ENV": "production",
            __BB_PLUGIN_ID__: pluginId,
          },
          runtimeExportManifestSha256: sha256(JSON.stringify(RUNTIME_EXPORT_MANIFEST)),
        },
        inputs: {
          esbuild: esbuildInputs,
          authoredCss: esbuildInputs.filter(
            (input) => input.path.endsWith(".css"),
          ),
          tailwind: tailwind.receipt,
          runtimeShims: [
            receiptVirtualInput(
              "generated/runtime-export-manifest",
              JSON.stringify(RUNTIME_EXPORT_MANIFEST),
            ),
            receiptVirtualInput(
              "runtime-slot-map",
              JSON.stringify(RUNTIME_SLOT_BY_SPECIFIER),
            ),
          ],
          generatedSources: await receiptExistingFiles(rootDir, [
            GENERATED_THEME_SOURCE,
            GENERATED_RUNTIME_EXPORT_MANIFEST_SOURCE,
            RUNTIME_SHIMS_SOURCE,
          ]),
          sdkManifests: await receiptExistingFiles(rootDir, [
            BUILD_SDK_MANIFEST,
            join(rootDir, "node_modules", "@get-bb", "plugin-sdk", "package.json"),
            join(rootDir, "node_modules", "@bb", "plugin-sdk", "package.json"),
          ]),
          externalManifests: await receiptExistingFiles(
            rootDir,
            Object.keys(RUNTIME_SLOT_BY_SPECIFIER).map((specifier) =>
              join(rootDir, "node_modules", specifier.split("/").slice(0, specifier.startsWith("@") ? 2 : 1).join("/"), "package.json"),
            ),
          ),
          toolchain: await receiptToolchain(rootDir, toolchain),
        },
        outputs: outputFiles,
      }),
    );

    await rename(stagedJsPath, jsPath);
    await rename(stagedCssPath, cssPath);
    await rename(stagedMetaPath, metaPath);
    await rename(stagedReceiptPath, receiptPath);
  } finally {
    await rm(stageDir, { recursive: true, force: true });
  }
  return { jsPath, cssPath, metaPath, receiptPath };
}
