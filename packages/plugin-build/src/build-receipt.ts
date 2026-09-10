import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { relative, resolve } from "node:path";
import type { Metafile } from "esbuild";
import {
  PLUGIN_TOOLCHAIN_PINS,
  type PluginBuildToolchain,
} from "./toolchain.js";

export interface BuildReceiptFile {
  path: string;
  sha256: string;
}

export interface BuildReceiptVirtualInput extends BuildReceiptFile {
  path: `virtual:${string}`;
}

export function sha256(contents: string | Uint8Array): string {
  return createHash("sha256").update(contents).digest("hex");
}

function receiptPath(rootDir: string, filePath: string): string {
  return relative(rootDir, filePath).replaceAll("\\", "/");
}

export async function receiptFile(
  rootDir: string,
  filePath: string,
): Promise<BuildReceiptFile> {
  const [canonicalRoot, canonicalPath] = await Promise.all([
    realpath(rootDir),
    realpath(filePath),
  ]);
  return {
    path: receiptPath(canonicalRoot, canonicalPath),
    sha256: sha256(await readFile(canonicalPath)),
  };
}

export async function receiptOutput(
  rootDir: string,
  logicalPath: string,
  contentsPath: string,
): Promise<BuildReceiptFile> {
  return {
    path: receiptPath(rootDir, logicalPath),
    sha256: sha256(await readFile(contentsPath)),
  };
}

export function receiptVirtualInput(
  name: string,
  contents: string,
): BuildReceiptVirtualInput {
  return { path: `virtual:${name}`, sha256: sha256(contents) };
}

function sortedFiles(files: readonly BuildReceiptFile[]): BuildReceiptFile[] {
  return [...files].sort(
    (left, right) =>
      left.path.localeCompare(right.path) || left.sha256.localeCompare(right.sha256),
  );
}

export async function receiptMetafileInputs(
  rootDir: string,
  metafile: Metafile,
): Promise<BuildReceiptFile[]> {
  return sortedFiles(
    await Promise.all(
      Object.keys(metafile.inputs)
        .filter((input) => !input.startsWith("(") && !input.startsWith("bb-plugin-runtime-shim:"))
        .map((input) => receiptFile(rootDir, resolve(rootDir, input))),
    ),
  );
}

export function receiptMetafileExternalImports(metafile: Metafile): string[] {
  return [
    ...new Set(
      Object.values(metafile.outputs).flatMap((output) =>
        output.imports
          .filter((entry) => entry.external === true)
          .map((entry) => entry.path),
      ),
    ),
  ].sort();
}

async function manifestForModule(
  rootDir: string,
  modulePath: string,
): Promise<BuildReceiptFile | null> {
  let candidate = modulePath;
  while (true) {
    const manifestPath = resolve(candidate, "package.json");
    try {
      return await receiptFile(rootDir, manifestPath);
    } catch {
      const parent = resolve(candidate, "..");
      if (parent === candidate) return null;
      candidate = parent;
    }
  }
}

export async function receiptToolchain(
  rootDir: string,
  toolchain: PluginBuildToolchain,
): Promise<{
  nodeVersion: string;
  pins: typeof PLUGIN_TOOLCHAIN_PINS;
  manifests: BuildReceiptFile[];
}> {
  const modulePaths = [
    new URL(toolchain.esbuild).pathname,
    new URL(toolchain.tailwindNode).pathname,
    new URL(toolchain.tailwindOxide).pathname,
    toolchain.tailwindCssDir,
  ];
  const manifests = (
    await Promise.all(modulePaths.map((path) => manifestForModule(rootDir, path)))
  ).filter((manifest): manifest is BuildReceiptFile => manifest !== null);
  return {
    nodeVersion: process.version,
    pins: PLUGIN_TOOLCHAIN_PINS,
    manifests: sortedFiles(manifests),
  };
}

export async function receiptExistingFiles(
  rootDir: string,
  filePaths: readonly string[],
): Promise<BuildReceiptFile[]> {
  const files = await Promise.all(
    [...new Set(filePaths)].map(async (filePath) => {
      try {
        return await receiptFile(rootDir, filePath);
      } catch {
        return null;
      }
    }),
  );
  return sortedFiles(
    files.filter((file): file is BuildReceiptFile => file !== null),
  );
}

export function deterministicJson(value: object): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
