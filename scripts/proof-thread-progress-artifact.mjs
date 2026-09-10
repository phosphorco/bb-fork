import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { lstat, mkdtemp, readFile, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire, isBuiltin } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const script = fileURLToPath(import.meta.url);
const forkRoot = resolve(dirname(script), '..');
export const proofRoot = join(forkRoot, 'build/proof-bb');
export const threadProgressId = 'thread-progress';
export const threadProgressVersion = '0.1.0';
export const sealedArtifactFiles = [
  'package.json',
  'dist/server.js',
  'dist/server.meta.json',
  'dist/app.js',
  'dist/app.css',
  'dist/app.meta.json',
];
export const threadProgressSettings = {
  summariesEnabled: { type: 'boolean', value: false },
  summariesForChildThreads: { type: 'boolean', value: false },
  idleDelaySeconds: { type: 'string', value: '3600' },
  summaryMinUserTurns: { type: 'string', value: '1' },
};

export function managedThreadProgressRoot(dataDir) {
  return join(dataDir, 'plugins', 'cache', 'npm', '@phosphor', 'bb-plugin-thread-progress', threadProgressVersion, 'node_modules', '@phosphor', 'bb-plugin-thread-progress');
}

function command(file, args) {
  return execFileSync(file, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function repositoryFingerprint(root) {
  const repository = command('git', ['-C', root, 'rev-parse', '--show-toplevel']);
  const head = command('git', ['-C', repository, 'rev-parse', 'HEAD']);
  const diff = command('git', ['-C', repository, 'diff', '--binary', 'HEAD']);
  const untracked = command('git', ['-C', repository, 'ls-files', '--others', '--exclude-standard', '-z'])
    .split('\0').filter(Boolean).sort();
  return {
    repository,
    head,
    diffSha256: sha256(diff),
    untrackedSha256: Object.fromEntries(untracked.map(path => [path, sha256(readFileSync(join(repository, path)))])),
  };
}

async function toolchainClosure(toolchain) {
  const entries = [];
  for (const [name, value] of Object.entries(toolchain).sort(([left], [right]) => left.localeCompare(right))) {
    if (typeof value !== 'string') throw new Error(`Invalid toolchain input ${name}`);
    const path = value.startsWith('file:') ? fileURLToPath(value) : value;
    const info = await stat(path);
    const receiptPath = info.isDirectory() ? join(path, 'package.json') : path;
    entries.push({ name, path: receiptPath, sha256: sha256(await readFile(receiptPath)) });
  }
  return entries;
}

async function packageRoot(path) {
  let current = path;
  while (true) {
    try {
      if ((await stat(current)).isFile()) current = dirname(current);
      await stat(join(current, 'package.json'));
      return current;
    } catch {
      const parent = dirname(current);
      if (parent === current) throw new Error(`No package manifest for toolchain input ${path}`);
      current = parent;
    }
  }
}

async function snapshotTree(root, files, visited) {
  const canonical = await realpath(root);
  if (visited.has(canonical)) return;
  visited.add(canonical);
  const info = await lstat(canonical);
  if (info.isSymbolicLink()) return snapshotTree(await realpath(canonical), files, visited);
  if (info.isFile()) {
    files.set(canonical, sha256(await readFile(canonical)));
    return;
  }
  if (!info.isDirectory()) return;
  for (const entry of await readdir(canonical, { withFileTypes: true })) {
    await snapshotTree(join(canonical, entry.name), files, visited);
  }
}

async function installedPackageManifest(fromRoot, name) {
  const require = createRequire(join(fromRoot, 'package.json'));
  for (const modules of require.resolve.paths(`${name}/package.json`) ?? []) {
    const candidate = join(modules, name, 'package.json');
    try { if ((await stat(candidate)).isFile()) return await realpath(candidate); }
    catch (error) { if (error?.code !== 'ENOENT') throw error; }
  }
  throw new Error(`Missing installed dependency ${name} from ${fromRoot}`);
}

async function snapshotPackageClosure(root, files, visited, packages) {
  const canonical = await realpath(root);
  if (packages.has(canonical)) return;
  packages.add(canonical);
  await snapshotTree(canonical, files, visited);
  const manifest = JSON.parse(await readFile(join(canonical, 'package.json'), 'utf8'));
  for (const name of Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies }).sort()) {
    let entry;
    try {
      entry = await installedPackageManifest(canonical, name);
    } catch {
      if (manifest.optionalDependencies?.[name] !== undefined || manifest.peerDependencies?.[name] !== undefined) continue;
      throw new Error(`Missing build dependency ${name} from ${canonical}`);
    }
    await snapshotPackageClosure(await packageRoot(await realpath(entry)), files, visited, packages);
  }
}

async function explicitInputSnapshot(args) {
  const toolchainRoots = await Promise.all(
    Object.values(args.toolchain).map(async value => {
      if (typeof value !== 'string') throw new Error('Invalid toolchain input');
      return packageRoot(value.startsWith('file:') ? fileURLToPath(value) : value);
    }),
  );
  const roots = [
    args.sourceRoot,
    join(proofRoot, 'packages', 'plugin-build'),
    join(proofRoot, 'packages', 'plugin-sdk'),
    join(proofRoot, 'packages', 'domain'),
    join(proofRoot, 'packages', 'process-utils'),
    ...toolchainRoots,
  ];
  const files = new Map();
  const visited = new Set();
  const packages = new Set();
  for (const root of roots) await snapshotPackageClosure(root, files, visited, packages);
  return Object.fromEntries([...files.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function collectReceiptInputs(value, files = []) {
  if (Array.isArray(value)) {
    for (const entry of value) collectReceiptInputs(entry, files);
    return files;
  }
  if (value === null || typeof value !== 'object') return files;
  if (typeof value.path === 'string' && typeof value.sha256 === 'string') {
    files.push(value);
    return files;
  }
  for (const entry of Object.values(value)) collectReceiptInputs(entry, files);
  return files;
}

async function assertReceiptInputsSnapshotted(sourceRoot, receipts, snapshot) {
  for (const receipt of receipts) {
    for (const input of collectReceiptInputs(receipt.receipt.inputs)) {
      if (input.path.startsWith('virtual:')) continue;
      const canonical = await realpath(resolve(sourceRoot, input.path));
      if (snapshot[canonical] !== input.sha256) {
        throw new Error(`Build consumed changed or undiscovered input ${input.path}`);
      }
    }
  }
}

async function fileReceipt(root, path) {
  return { path: relative(root, path).replaceAll('\\', '/'), sha256: sha256(await readFile(path)) };
}

async function contentReceipt(root) {
  const files = await Promise.all(sealedArtifactFiles.map(path => fileReceipt(root, join(root, path))));
  return { files, contentSha256: sha256(files.map(file => `${file.path}\0${file.sha256}\n`).join('')) };
}

export async function verifySealedThreadProgressArtifact(root) {
  await assertNoSymlinks(root);
  const manifestPath = join(root, 'sealed-manifest.json');
  if ((await lstat(manifestPath)).isSymbolicLink()) throw new Error('Sealed manifest must not be a symlink');
  const bytes = await readFile(manifestPath);
  const manifest = JSON.parse(bytes);
  const content = await contentReceipt(root);
  if (manifest.formatVersion !== 1 || manifest.pluginId !== threadProgressId || manifest.pluginVersion !== threadProgressVersion ||
      JSON.stringify(manifest.files) !== JSON.stringify(content.files) || manifest.contentSha256 !== content.contentSha256 ||
      JSON.stringify(manifest.settings) !== JSON.stringify(threadProgressSettings)) throw new Error('Sealed artifact receipt mismatch');
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  if (pkg.bb?.server !== './dist/server.js' || pkg.bb?.app !== './dist/app.js' || pkg.bb?.host) throw new Error('Sealed artifact has a source fallback');
  for (const kind of ['server', 'app']) {
    const meta = JSON.parse(await readFile(join(root, `dist/${kind}.meta.json`), 'utf8'));
    if (meta.artifactFormatVersion !== 1 || meta.pluginId !== threadProgressId || meta.pluginVersion !== threadProgressVersion ||
        meta.sdkMajor !== 0 || meta.sdkVersion !== '0.4.47' || meta.builtWith?.pluginSdkVersion !== '0.4.47') {
      throw new Error('Sealed artifact metadata does not match the selected SDK');
    }
    const build = manifest.buildReceipts?.[kind];
    if (!build?.receipt || !Array.isArray(build.receipt.outputs)) throw new Error('Missing sealed build receipt');
    for (const file of content.files.filter(file => file.path.startsWith(`dist/${kind}.`))) {
      // Builder output identities are relative to the authored source root,
      // including an external custom outputDir. Never dereference these paths.
      const matches = build.receipt.outputs.filter(output => typeof output.path === 'string' && basename(output.path) === basename(file.path));
      if (matches.length !== 1 || matches[0].sha256 !== file.sha256) throw new Error('Missing or ambiguous sealed output in build receipt');
    }
    for (const output of build.receipt.outputs) {
      const file = typeof output.path === 'string' ? content.files.find(file => basename(file.path) === basename(output.path)) : undefined;
      if (file && file.sha256 !== output.sha256) throw new Error('Sealed build output does not match its receipt');
    }
  }
  return { manifest, ...content, sealedManifestSha256: sha256(bytes), sourceReceipt: sha256(JSON.stringify(manifest.sourceClosure)) };
}

function sealedPackage(source, dependencies) {
  return {
    name: source.name,
    version: source.version,
    type: 'module',
    engines: source.engines,
    ...(Object.keys(dependencies).length === 0 ? {} : { dependencies }),
    bb: {
      name: source.bb.name,
      description: source.bb.description,
      branding: source.bb.branding,
      server: './dist/server.js',
      app: './dist/app.js',
    },
  };
}

async function runtimeExternals(sourceRoot, externals) {
  if (!Array.isArray(externals) || !externals.every(specifier => typeof specifier === 'string')) {
    throw new Error('Server build receipt has no external import inventory');
  }
  const dependencies = {};
  for (const specifier of externals) {
    if (isBuiltin(specifier) || specifier === '@get-bb/plugin-sdk' || specifier === '@bb/plugin-sdk') continue;
    const packageName = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
    const manifest = JSON.parse(await readFile(await installedPackageManifest(sourceRoot, packageName), 'utf8'));
    if (typeof manifest.version !== 'string') throw new Error(`Runtime external ${packageName} has no version`);
    dependencies[packageName] = manifest.version;
  }
  return { externals, dependencies };
}

async function assertBuildReceipt(path, expectedOutputs) {
  const receipt = JSON.parse(await readFile(path, 'utf8'));
  if (receipt.formatVersion !== 1 || !Array.isArray(receipt.outputs)) throw new Error(`Invalid build receipt ${path}`);
  for (const output of expectedOutputs) {
    const entry = receipt.outputs.find(candidate => candidate.path.endsWith(output));
    if (!entry || typeof entry.sha256 !== 'string' || entry.sha256 !== sha256(await readFile(join(dirname(path), basename(output))))) {
      throw new Error(`Build receipt missing or mismatching ${output}`);
    }
  }
  return { sha256: sha256(await readFile(path)), receipt };
}

async function assertNoSymlinks(root) {
  for (const directory of [root, join(root, 'dist')]) {
    const info = await lstat(directory);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('Sealed artifact directory must not be a symlink');
  }
  for (const path of sealedArtifactFiles) {
    const file = join(root, path);
    if ((await lstat(file)).isSymbolicLink()) throw new Error(`Sealed artifact symlink ${path}`);
    if (!(await stat(file)).isFile()) throw new Error(`Sealed artifact missing ${path}`);
  }
  const entries = await readdir(root, { withFileTypes: true });
  if (entries.some(entry => entry.name !== 'package.json' && entry.name !== 'dist' && entry.name !== 'sealed-manifest.json')) {
    throw new Error('Sealed artifact contains an unexpected root entry');
  }
  const distEntries = await readdir(join(root, 'dist'));
  if (distEntries.sort().join('\0') !== sealedArtifactFiles.filter(path => path.startsWith('dist/')).map(path => path.slice(5)).sort().join('\0')) {
    throw new Error('Sealed artifact contains an unexpected dist entry');
  }
}

async function loadBuilder() {
  return import(pathToFileURL(join(proofRoot, 'packages/plugin-build/src/index.ts')).href);
}

export async function assembleThreadProgressArtifact(args) {
  const sourceRoot = resolve(args.sourceRoot);
  const artifactRoot = resolve(args.artifactRoot);
  if (artifactRoot === sourceRoot || artifactRoot.startsWith(`${sourceRoot}/`)) throw new Error('Artifact root must be outside the canonical source root');
  const sourcePackage = JSON.parse(await readFile(join(sourceRoot, 'package.json'), 'utf8'));
  if (sourcePackage.name !== '@phosphor/bb-plugin-thread-progress' || sourcePackage.version !== threadProgressVersion || sourcePackage.bb?.server === undefined || sourcePackage.bb?.app === undefined) {
    throw new Error('Unexpected Thread Progress source manifest');
  }
  const sourceClosure = args.sourceClosure ?? (async () => ({
    assembler: { path: relative(forkRoot, script), sha256: sha256(await readFile(script)) },
    plugin: repositoryFingerprint(sourceRoot),
    proof: repositoryFingerprint(proofRoot),
    toolchain: await toolchainClosure(args.toolchain),
  }));
  const inputSnapshot = args.inputSnapshot ?? (() => explicitInputSnapshot({ sourceRoot, toolchain: args.toolchain }));
  const before = await sourceClosure();
  const snapshotBefore = await inputSnapshot();
  const stageRoot = await mkdtemp(join(dirname(artifactRoot), '.thread-progress-stage-'));
  try {
    const distDir = join(stageRoot, 'dist');
    const builder = args.builder ?? await loadBuilder();
    const [server, app] = await Promise.all([
      builder.buildPluginServer(sourceRoot, args.bbVersion, args.toolchain, { outputDir: distDir }),
      builder.buildPluginApp(sourceRoot, args.bbVersion, args.toolchain, { outputDir: distDir }),
    ]);
    const [serverReceipt, appReceipt] = await Promise.all([
      assertBuildReceipt(server.receiptPath, ['server.js', 'server.js.map', 'server.meta.json']),
      assertBuildReceipt(app.receiptPath, ['app.js', 'app.css', 'app.meta.json']),
    ]);
    await assertReceiptInputsSnapshotted(sourceRoot, [serverReceipt, appReceipt], snapshotBefore);
    await rm(join(distDir, 'server.js.map'));
    await rm(server.receiptPath);
    await rm(app.receiptPath);
    const external = await runtimeExternals(
      sourceRoot,
      serverReceipt.receipt.inputs?.esbuildExternalImports,
    );
    await writeFile(join(stageRoot, 'package.json'), `${JSON.stringify(sealedPackage(sourcePackage, external.dependencies), null, 2)}\n`);
    await assertNoSymlinks(stageRoot);
    const artifact = await contentReceipt(stageRoot);
    const after = await sourceClosure();
    const snapshotAfter = await inputSnapshot();
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Source closure changed while compiling; sealed artifact was not published');
    if (JSON.stringify(snapshotBefore) !== JSON.stringify(snapshotAfter)) throw new Error('Selected build input tree changed while compiling; sealed artifact was not published');
    await writeFile(join(stageRoot, 'sealed-manifest.json'), `${JSON.stringify({
      formatVersion: 1,
      pluginId: threadProgressId,
      pluginVersion: threadProgressVersion,
      sourceClosure: before,
      inputSnapshot: snapshotBefore,
      buildReceipts: { server: serverReceipt, app: appReceipt },
      runtimeExternals: external.externals,
      settings: threadProgressSettings,
      ...artifact,
    }, null, 2)}\n`);
    await verifySealedThreadProgressArtifact(stageRoot);
    await rename(stageRoot, artifactRoot);
    return {
      artifactRoot,
      sourceReceipt: sha256(JSON.stringify(before)),
      buildReceipts: { server: serverReceipt.sha256, app: appReceipt.sha256 },
      ...artifact,
    };
  } catch (error) {
    await rm(stageRoot, { recursive: true, force: true });
    throw error;
  }
}

export async function packSealedThreadProgressArtifact(args) {
  const artifactRoot = resolve(args.artifactRoot);
  const outputDir = resolve(args.outputDir);
  const before = await verifySealedThreadProgressArtifact(artifactRoot);
  const manifest = JSON.parse(await readFile(join(artifactRoot, 'package.json'), 'utf8'));
  if (manifest.name !== '@phosphor/bb-plugin-thread-progress' || manifest.version !== threadProgressVersion) {
    throw new Error('Unexpected sealed package identity');
  }
  await mkdir(outputDir, { recursive: true });
  const packed = JSON.parse(command('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', outputDir, artifactRoot]));
  if (!Array.isArray(packed) || packed.length !== 1 || typeof packed[0]?.filename !== 'string') throw new Error('npm pack did not return one tarball');
  const tarballPath = join(outputDir, packed[0].filename);
  const after = await verifySealedThreadProgressArtifact(artifactRoot);
  if (before.sealedManifestSha256 !== after.sealedManifestSha256 || before.contentSha256 !== after.contentSha256) {
    throw new Error('Sealed artifact changed while packing');
  }
  const bytes = await readFile(tarballPath);
  return {
    tarballPath,
    sha256: sha256(bytes),
    integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
  };
}

export async function createLoopbackProofRegistry(args) {
  const tarball = await readFile(args.tarballPath);
  const integrity = `sha512-${createHash('sha512').update(tarball).digest('base64')}`;
  const shasum = createHash('sha1').update(tarball).digest('hex');
  const packageName = '@phosphor/bb-plugin-thread-progress';
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    const origin = `http://127.0.0.1:${server.address().port}`;
    if (path === `/${packageName}`) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ name: packageName, 'dist-tags': { latest: threadProgressVersion }, versions: {
        [threadProgressVersion]: { name: packageName, version: threadProgressVersion, dist: { tarball: `${origin}/${packageName}/-/${packageName.slice(1).replace('/', '-')}-${threadProgressVersion}.tgz`, integrity, shasum } },
      } }));
      return;
    }
    if (path.endsWith('.tgz')) {
      response.writeHead(200, { 'content-type': 'application/octet-stream' });
      response.end(tarball);
      return;
    }
    response.writeHead(404); response.end();
  });
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  return {
    registry: `http://127.0.0.1:${server.address().port}`,
    integrity,
    sha256: sha256(tarball),
    close: () => new Promise(resolvePromise => server.close(resolvePromise)),
  };
}
