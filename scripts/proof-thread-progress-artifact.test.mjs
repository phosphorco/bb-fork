import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  assembleThreadProgressArtifact,
  createLoopbackProofRegistry,
  packSealedThreadProgressArtifact,
  verifySealedThreadProgressArtifact,
} from './proof-thread-progress-artifact.mjs';

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'thread-progress-artifact-'));
  const sourceRoot = join(root, 'source');
  await mkdir(sourceRoot);
  await writeFile(join(sourceRoot, 'package.json'), JSON.stringify({
    name: '@phosphor/bb-plugin-thread-progress', version: '0.1.0', type: 'module',
    bb: { name: 'Thread Progress', description: 'fixture', branding: { icon: 'Mountain' }, server: './server.ts', app: './app.tsx' },
  }));
  await writeFile(join(sourceRoot, 'server.ts'), 'export default {}\n');
  await writeFile(join(sourceRoot, 'app.tsx'), 'export default {}\n');
  return { root, sourceRoot, artifactRoot: join(root, 'sealed') };
}

function builder(sdkVersion = '0.4.47') {
  const metadata = JSON.stringify({ artifactFormatVersion: 1, pluginId: 'thread-progress', pluginVersion: '0.1.0',
    sdkMajor: 0, sdkVersion, builtWith: { pluginSdkVersion: sdkVersion } });
  async function write(dist, name, contents) {
    await writeFile(join(dist, name), contents);
  }
  async function receipt(dist, name, outputs) {
    const rows = await Promise.all(outputs.map(async output => ({ path: `../../external-stage/dist/${output}`, sha256: digest(await readFile(join(dist, output)))})));
    const path = join(dist, name);
    await writeFile(path, JSON.stringify({ formatVersion: 1, inputs: { esbuildExternalImports: [] }, outputs: rows }));
    return path;
  }
  return {
    async buildPluginServer(_root, _version, _toolchain, { outputDir }) {
      await mkdir(outputDir, { recursive: true });
      await write(outputDir, 'server.js', 'server');
      await write(outputDir, 'server.js.map', 'map');
      await write(outputDir, 'server.meta.json', metadata);
      return { receiptPath: await receipt(outputDir, 'server.receipt.json', ['server.js', 'server.js.map', 'server.meta.json']) };
    },
    async buildPluginApp(_root, _version, _toolchain, { outputDir }) {
      await mkdir(outputDir, { recursive: true });
      await write(outputDir, 'app.js', 'app');
      await write(outputDir, 'app.css', 'css');
      await write(outputDir, 'app.meta.json', metadata);
      return { receiptPath: await receipt(outputDir, 'app.receipt.json', ['app.js', 'app.css', 'app.meta.json']) };
    },
  };
}

test('assembles an exact sealed root without source files or build sidecars', async () => {
  const value = await fixture();
  try {
    const result = await assembleThreadProgressArtifact({ sourceRoot: value.sourceRoot, artifactRoot: value.artifactRoot, bbVersion: 'test', toolchain: {}, builder: builder(), sourceClosure: () => ({ source: 'fixed', proof: 'fixed' }) });
    assert.equal(result.sourceReceipt, digest(JSON.stringify({ source: 'fixed', proof: 'fixed' })));
    assert.deepEqual((await readdir(value.artifactRoot)).sort(), ['dist', 'package.json', 'sealed-manifest.json']);
    assert.deepEqual((await readdir(join(value.artifactRoot, 'dist'))).sort(), ['app.css', 'app.js', 'app.meta.json', 'server.js', 'server.meta.json']);
    const manifest = JSON.parse(await readFile(join(value.artifactRoot, 'package.json'), 'utf8'));
    assert.equal(manifest.bb.server, './dist/server.js');
    assert.equal(manifest.bb.app, './dist/app.js');
    const sealedManifest = JSON.parse(await readFile(join(value.artifactRoot, 'sealed-manifest.json'), 'utf8'));
    assert.deepEqual(sealedManifest.buildReceipts.server.receipt.outputs.map(output => output.path).sort(), ['../../external-stage/dist/server.js', '../../external-stage/dist/server.js.map', '../../external-stage/dist/server.meta.json']);
    const verified = await verifySealedThreadProgressArtifact(value.artifactRoot);
    assert.equal(verified.contentSha256, result.contentSha256);
    await writeFile(join(value.artifactRoot, 'dist/app.js'), 'changed');
    await assert.rejects(verifySealedThreadProgressArtifact(value.artifactRoot), /receipt mismatch/);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test('rejects a symlinked dist directory even when every output hash matches', async () => {
  const value = await fixture();
  try {
    await assembleThreadProgressArtifact({ sourceRoot: value.sourceRoot, artifactRoot: value.artifactRoot, bbVersion: 'test', toolchain: {}, builder: builder(), sourceClosure: () => ({ source: 'fixed' }) });
    const external = join(value.root, 'external-dist');
    await rename(join(value.artifactRoot, 'dist'), external);
    await symlink(external, join(value.artifactRoot, 'dist'));
    await assert.rejects(verifySealedThreadProgressArtifact(value.artifactRoot), /directory must not be a symlink/);
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test('refuses a correctly hashed build for a different SDK before publication', async () => {
  const value = await fixture();
  try {
    await assert.rejects(assembleThreadProgressArtifact({ sourceRoot: value.sourceRoot, artifactRoot: value.artifactRoot,
      bbVersion: 'test', toolchain: {}, builder: builder('0.4.15'), sourceClosure: () => ({ source: 'fixed' }) }), /selected SDK/);
    await assert.rejects(readFile(join(value.artifactRoot, 'package.json')));
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test('refuses publication when the source closure changes during a held build', async () => {
  const value = await fixture();
  let release;
  let started;
  const held = new Promise(resolve => { release = resolve; });
  const startedBuild = new Promise(resolve => { started = resolve; });
  const base = builder();
  const heldBuilder = {
    ...base,
    async buildPluginServer(...args) { started(); await held; return base.buildPluginServer(...args); },
  };
  let generation = 0;
  try {
    const assembling = assembleThreadProgressArtifact({ sourceRoot: value.sourceRoot, artifactRoot: value.artifactRoot, bbVersion: 'test', toolchain: {}, builder: heldBuilder, sourceClosure: async () => ({ generation, app: await readFile(join(value.sourceRoot, 'app.tsx'), 'utf8') }) });
    await startedBuild;
    generation += 1;
    await writeFile(join(value.sourceRoot, 'app.tsx'), 'changed\n');
    release();
    await assert.rejects(assembling, /Source closure changed/);
    await assert.rejects(readFile(join(value.artifactRoot, 'package.json')));
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test('refuses a stale output hash before publication', async () => {
  const value = await fixture();
  const base = builder();
  const staleBuilder = {
    ...base,
    async buildPluginApp(...args) {
      const result = await base.buildPluginApp(...args);
      await writeFile(join(args[3].outputDir, 'app.js'), 'changed-after-receipt');
      return result;
    },
  };
  try {
    await assert.rejects(
      assembleThreadProgressArtifact({ sourceRoot: value.sourceRoot, artifactRoot: value.artifactRoot, bbVersion: 'test', toolchain: {}, builder: staleBuilder, sourceClosure: () => ({ source: 'fixed', proof: 'fixed' }) }),
      /mismatching app.js/,
    );
    await assert.rejects(readFile(join(value.artifactRoot, 'package.json')));
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test('refuses ignored dist and transitive toolchain mutations during a held build', async () => {
  const value = await fixture();
  const ignoredDist = join(value.sourceRoot, 'dist');
  const toolchainBinary = join(value.root, 'toolchain-native.bin');
  await mkdir(ignoredDist);
  await writeFile(join(ignoredDist, 'identity.js'), 'before');
  await writeFile(toolchainBinary, 'before');
  let release;
  let started;
  const held = new Promise(resolve => { release = resolve; });
  const startedBuild = new Promise(resolve => { started = resolve; });
  const base = builder();
  const heldBuilder = {
    ...base,
    async buildPluginServer(...args) { started(); await held; return base.buildPluginServer(...args); },
  };
  const snapshot = async () => ({
    ignoredDist: digest(await readFile(join(ignoredDist, 'identity.js'))),
    transitiveToolchainBinary: digest(await readFile(toolchainBinary)),
  });
  try {
    const assembling = assembleThreadProgressArtifact({ sourceRoot: value.sourceRoot, artifactRoot: value.artifactRoot, bbVersion: 'test', toolchain: {}, builder: heldBuilder, sourceClosure: () => ({ fixed: true }), inputSnapshot: snapshot });
    await startedBuild;
    await writeFile(join(ignoredDist, 'identity.js'), 'after');
    await writeFile(toolchainBinary, 'after');
    release();
    await assert.rejects(assembling, /Selected build input tree changed/);
    await assert.rejects(readFile(join(value.artifactRoot, 'package.json')));
  } finally { await rm(value.root, { recursive: true, force: true }); }
});

test('packs and serves the assembled tarball with matching uploaded and downloaded hashes', async () => {
  const value = await fixture();
  let registry;
  try {
    const assembled = await assembleThreadProgressArtifact({ sourceRoot: value.sourceRoot, artifactRoot: value.artifactRoot, bbVersion: 'test', toolchain: {}, builder: builder(), sourceClosure: () => ({ fixed: true }), inputSnapshot: () => ({ fixed: true }) });
    assert.equal(assembled.artifactRoot, value.artifactRoot);
    const packed = await packSealedThreadProgressArtifact({ artifactRoot: value.artifactRoot, outputDir: join(value.root, 'pack') });
    registry = await createLoopbackProofRegistry({ tarballPath: packed.tarballPath });
    const packument = await fetch(`${registry.registry}/%40phosphor%2Fbb-plugin-thread-progress`).then(response => response.json());
    const tarball = await fetch(packument.versions['0.1.0'].dist.tarball).then(response => response.arrayBuffer());
    assert.equal(digest(Buffer.from(tarball)), packed.sha256);
    assert.equal(registry.integrity, packed.integrity);
  } finally {
    await registry?.close();
    await rm(value.root, { recursive: true, force: true });
  }
});

test('captures hoisted import-only dependency bytes before the build begins', async () => {
  const value = await fixture();
  const dependency = join(value.root, 'node_modules', 'fixture-dependency');
  await mkdir(join(dependency, 'dist'), { recursive: true });
  await writeFile(join(dependency, 'package.json'), JSON.stringify({ name: 'fixture-dependency', version: '1.0.0', exports: { '.': { import: './dist/index.js' } } }));
  await writeFile(join(dependency, 'dist/index.js'), 'before');
  const manifest = JSON.parse(await readFile(join(value.sourceRoot, 'package.json'), 'utf8'));
  manifest.dependencies = { 'fixture-dependency': '1.0.0' };
  await writeFile(join(value.sourceRoot, 'package.json'), JSON.stringify(manifest));
  const base = builder();
  const mutating = { ...base, async buildPluginServer(...args) {
    await writeFile(join(dependency, 'dist/index.js'), 'after');
    return base.buildPluginServer(...args);
  } };
  try {
    await assert.rejects(assembleThreadProgressArtifact({ sourceRoot: value.sourceRoot, artifactRoot: value.artifactRoot,
      bbVersion: 'test', toolchain: {}, builder: mutating, sourceClosure: () => ({ fixed: true }) }), /Selected build input tree changed/);
    await assert.rejects(readFile(join(value.artifactRoot, 'package.json')));
  } finally { await rm(value.root, { recursive: true, force: true }); }
});
