import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { assertNormalUnchanged, assertAllowedPlugins, assertPortsAvailable, assertStartupMatches, assertThreadProgressDrained, proofEnvironment, proofData, proofRoot, runThreadProgressStageTransaction, validateFixtureProfile } from './proof-runtime.mjs';
import { managedThreadProgressRoot, packSealedThreadProgressArtifact, verifySealedThreadProgressArtifact } from './proof-thread-progress-artifact.mjs';

const sourceImport = path => import(pathToFileURL(join(proofRoot, path)).href);
const actualArtifact = process.env.BB_THREAD_PROGRESS_ARTIFACT;

async function makeStageFixture() {
  const dataDir = await mkdtemp(join(tmpdir(), 'bb-proof-stage-'));
  const profilePath = join(dataDir, 'fixture-profile.json');
  const verified = await verifySealedThreadProgressArtifact(actualArtifact);
  const packed = await packSealedThreadProgressArtifact({ artifactRoot: actualArtifact, outputDir: join(dataDir, 'profile-tarball') });
  const settings = Object.fromEntries(Object.entries(verified.manifest.settings).map(([key, setting]) => [key, setting.value]));
  const profile = {
    version: 2,
    plugins: [{
      id: 'thread-progress', root: managedThreadProgressRoot(dataDir), files: Object.fromEntries(verified.files.map(file => [file.path, file.sha256])),
      contentSha256: verified.contentSha256, sealedManifestSha256: verified.sealedManifestSha256,
      source: { sourceReceipt: verified.sourceReceipt }, tarballSha256: packed.sha256, npmIntegrity: packed.integrity,
      preActivationSettings: settings,
    }],
  };
  const profileBytes = Buffer.from(`${JSON.stringify(profile, null, 2)}\n`);
  await writeFile(profilePath, '{"version":1}\n');
  const [{ createConnection }, { migrate }] = await Promise.all([
    sourceImport('packages/db/src/connection.ts'), sourceImport('packages/db/src/migrate.ts'),
  ]);
  const db = createConnection(join(dataDir, 'bb.db'));
  try { migrate(db); } finally { db.$client.close(); }
  return { dataDir, profilePath, profile, profileBytes };
}

async function readStagedRow(dataDir) {
  const [{ createConnection }, rows, { getPluginSettingsValues }] = await Promise.all([
    sourceImport('packages/db/src/connection.ts'), sourceImport('packages/db/src/data/plugins.ts'), sourceImport('packages/db/src/data/plugin-storage.ts'),
  ]);
  const db = createConnection(join(dataDir, 'bb.db'));
  try { return { row: rows.getInstalledPlugin(db, 'thread-progress'), settings: getPluginSettingsValues(db, 'thread-progress') }; }
  finally { db.$client.close(); }
}

async function stageFixture(fixture, afterStage = async () => {}) {
  return runThreadProgressStageTransaction({
    artifactRoot: actualArtifact, profile: fixture.profile, profileBytes: fixture.profileBytes, profilePath: fixture.profilePath,
    dataDir: fixture.dataDir, appVersion: '0.42.0', beforeStage: async () => ({ normal: 'isolated-normal' }), afterStage,
  });
}

test('cold fixture check rejects activation, environment work and each producer queue', () => {
  const clean = { unitState: 'inactive', enabled: false, environmentThreads: 0,
    queues: { notification_outbox: 0, summary_jobs: 0, sticker_jobs: 0 } };
  assertThreadProgressDrained(clean);
  assert.throws(() => assertThreadProgressDrained({ ...clean, unitState: 'active' }), /Stop the proof/);
  assert.throws(() => assertThreadProgressDrained({ ...clean, enabled: true }), /disabled/);
  assert.throws(() => assertThreadProgressDrained({ ...clean, environmentThreads: 1 }), /environment/);
  for (const name of Object.keys(clean.queues)) {
    assert.throws(() => assertThreadProgressDrained({ ...clean, queues: { ...clean.queues, [name]: 1 } }), /not drained/);
  }
});

test('fixture profile admits only explicit offline source artifacts and loopback ingress', () => {
  const root = '/fixture/source';
  const profile = {
    version: 2,
    publicKeyPath: `${proofData}/p6r-fixture-keys/p6r-proof-public.pem`,
    publicKeySha256: 'c'.repeat(64),
    boundary: {
      configuration: { pluginId: 'p6r-proof-signed-idp' },
      trustedIngresses: [{ kind: 'local', remoteAddresses: ['127.0.0.1'] }],
    },
    plugins: ['p6r-proof-signed-idp', 'p6r-proof-identity-probe'].map(id => ({
      id, root: `${root}/${id}`, files: { 'package.json': 'a'.repeat(64), 'server.js': 'b'.repeat(64) },
    })).concat([{
      id: 'thread-progress', kind: 'sealed-app-artifact', root: `${proofData}/plugins/cache/npm/@phosphor/bb-plugin-thread-progress/0.1.0/node_modules/@phosphor/bb-plugin-thread-progress`,
      files: Object.fromEntries(['package.json', 'dist/server.js', 'dist/server.meta.json', 'dist/app.js', 'dist/app.css', 'dist/app.meta.json'].map((path, index) => [path, 'abcdef'.charAt(index).repeat(64)])),
      contentSha256: 'd'.repeat(64), sealedManifestSha256: 'f'.repeat(64), source: { sourceReceipt: 'e'.repeat(64), baseSdkVersion: '0.4.47', forkSdkVersion: '0.4.47' },
      tarballSha256: 'a'.repeat(64), npmIntegrity: `sha512-${'A'.repeat(86)}==`,
      preActivationSettings: { summariesEnabled: false, summariesForChildThreads: false, idleDelaySeconds: '3600', summaryMinUserTurns: '1' },
    }]),
  };
  assert.equal(validateFixtureProfile(profile, root), profile);
  const legacyProfile = { ...profile, version: 1, plugins: profile.plugins.slice(0, 2) };
  assert.equal(validateFixtureProfile(legacyProfile, root), legacyProfile);
  assert.throws(() => validateFixtureProfile({ ...profile, version: 1 }, root), /Invalid proof fixture/);
  assert.throws(() => validateFixtureProfile({ ...legacyProfile, plugins: [profile.plugins[0], profile.plugins[2]] }, root), /plugin\/source/);
  const invalidKey = structuredClone(profile); invalidKey.publicKeyPath = '/normal/key.pem';
  assert.throws(() => validateFixtureProfile(invalidKey, root), /confined path/);
  const invalidRoot = structuredClone(profile); invalidRoot.plugins[0].root = '/normal/plugin';
  assert.throws(() => validateFixtureProfile(invalidRoot, root), /plugin\/source/);
  const invalidFile = structuredClone(profile); invalidFile.plugins[0].files['../secret'] = 'a'.repeat(64);
  assert.throws(() => validateFixtureProfile(invalidFile, root), /artifact digest/);
  const invalidIngress = structuredClone(profile); invalidIngress.boundary.trustedIngresses[0].remoteAddresses = ['10.0.0.1'];
  assert.throws(() => validateFixtureProfile(invalidIngress, root), /loopback/);
  const enabledProducer = structuredClone(profile); enabledProducer.plugins[2].preActivationSettings.summariesEnabled = true;
  assert.throws(() => validateFixtureProfile(enabledProducer, root), /plugin\/source/);
  const missingReceipt = structuredClone(profile); delete missingReceipt.plugins[2].sealedManifestSha256;
  assert.throws(() => validateFixtureProfile(missingReceipt, root), /plugin\/source/);
  const differentSdk = structuredClone(profile); differentSdk.plugins[2].source.baseSdkVersion = '0.4.15';
  assert.throws(() => validateFixtureProfile(differentSdk, root), /plugin\/source/);
  assert.throws(() => assertAllowedPlugins([{ id: 'provider-codex', enabled: true }], profile), /Unexpected/);
  assert.throws(() => assertAllowedPlugins([{ id: profile.plugins[0].id, enabled: true, rootDir: '/normal/plugin' }], profile), /Unexpected/);
  assert.throws(() => assertAllowedPlugins([], profile, true), /not running/);
  assertAllowedPlugins(profile.plugins.map(plugin => ({ id: plugin.id, rootDir: plugin.root, enabled: true, status: 'running' })), profile, true);
  assertAllowedPlugins([{ id: 'provider-codex', enabled: false }], null);
});

test('source evidence belongs to the same boot and unchanged authored files', () => {
  const fingerprint = { head: 'baseline', diffSha256: 'tracked-before', untrackedSha256: { 'new.ts': 'before' } };
  const startup = { launchId: 'boot-one', fingerprint };
  assertStartupMatches(startup, structuredClone(fingerprint), 'boot-one');
  assert.throws(() => assertStartupMatches(startup, fingerprint, 'boot-two'), /server launch/);
  assert.throws(() => assertStartupMatches(startup, { ...fingerprint, diffSha256: 'tracked-after' }, 'boot-one'), /source changed/);
  assert.throws(() => assertStartupMatches(startup, { ...fingerprint, untrackedSha256: { 'new.ts': 'after' } }, 'boot-one'), /source changed/);
});

test('proof environment excludes agent routing, credentials and startup hooks while preserving the real home', () => {
  const env = proofEnvironment({
    HOME: '/home/ubuntu', PATH: '/unsafe', BB_DATA_DIR: '/home/ubuntu/.bb',
    BB_SERVER_URL: 'https://production', BB_THREAD_ID: 'thread', BB_CLI: '/normal/bb',
    CODEX_HOME: '/credential/path', OPENAI_API_KEY: 'test-secret', NODE_OPTIONS: '--import malicious',
    BB_P6R_IDENTITY_BOUNDARY: '{"normal":true}',
    BB_P6R_PROOF_PUBLIC_KEY_PATH: '/normal/key.pem',
  }, '/proof/node/bin/node');
  assert.equal(env.HOME, '/home/ubuntu');
  assert.equal(env.BB_DATA_DIR, proofData);
  assert.equal(env.BB_SERVER_URL, 'http://127.0.0.1:39886');
  assert.equal(env.PATH, '/proof/node/bin:/usr/bin:/bin');
  for (const key of ['BB_THREAD_ID', 'BB_CLI', 'CODEX_HOME', 'OPENAI_API_KEY', 'NODE_OPTIONS', 'BB_P6R_IDENTITY_BOUNDARY', 'BB_P6R_PROOF_PUBLIC_KEY_PATH']) assert.equal(env[key], undefined);
});

test('port preflight refuses collisions and releases earlier reservations on failure', async () => {
  const occupied = createServer();
  await new Promise(done => occupied.listen(0, '127.0.0.1', done));
  const first = createServer();
  await new Promise(done => first.listen(0, '127.0.0.1', done));
  const freePort = first.address().port;
  const usedPort = occupied.address().port;
  await new Promise(done => first.close(done));
  try {
    await assert.rejects(assertPortsAvailable([freePort, usedPort]), { code: 'EADDRINUSE' });
    await assertPortsAvailable([freePort]);
  } finally { await new Promise(done => occupied.close(done)); }
});

test('normal service identity is fenced to this proof launch without rewriting preparation history', () => {
  assertNormalUnchanged('active normal pid-2', 'active normal pid-2');
  assert.throws(() => assertNormalUnchanged('active normal pid-2', 'active normal pid-3'), /Normal service identity changed/);
  assert.throws(() => assertNormalUnchanged(undefined, 'active normal pid-2'), /Normal service identity changed/);
});

test('offline stage uses the real sealed artifact without loading its factory and restores npm environment', { skip: actualArtifact ? false : 'set BB_THREAD_PROGRESS_ARTIFACT to a sealed Thread Progress artifact' }, async () => {
  const fixture = await makeStageFixture();
  const previousRegistry = process.env.npm_config_registry;
  const previousCache = process.env.npm_config_cache;
  process.env.npm_config_registry = 'https://registry.example.test';
  process.env.npm_config_cache = '/tmp/existing-npm-cache';
  try {
    const receipt = await stageFixture(fixture);
    const { row, settings } = await readStagedRow(fixture.dataDir);
    assert.equal(row?.enabled, false);
    assert.equal(row?.rootDir, fixture.profile.plugins[0].root);
    assert.equal(row?.npmIntegrity, receipt.npmIntegrity);
    assert.deepEqual(settings, Object.fromEntries(Object.entries(fixture.profile.plugins[0].preActivationSettings).map(([key, value]) => [key, JSON.stringify(value)])));
    assert.equal(existsSync(join(fixture.dataDir, 'plugins', 'thread-progress', 'data.db')), false);
    assert.deepEqual(JSON.parse(await readFile(fixture.profilePath, 'utf8')), fixture.profile);
    assert.equal(JSON.parse(await readFile(join(fixture.dataDir, 'thread-progress-stage-receipt.json'), 'utf8')).state, 'profile-replaced');
    assert.equal(process.env.npm_config_registry, 'https://registry.example.test');
    assert.equal(process.env.npm_config_cache, '/tmp/existing-npm-cache');
  } finally {
    if (previousRegistry === undefined) delete process.env.npm_config_registry; else process.env.npm_config_registry = previousRegistry;
    if (previousCache === undefined) delete process.env.npm_config_cache; else process.env.npm_config_cache = previousCache;
    await rm(fixture.dataDir, { recursive: true, force: true });
  }
});

test('offline stage refuses retained disabled and enabled registrations before package work', { skip: actualArtifact ? false : 'set BB_THREAD_PROGRESS_ARTIFACT to a sealed Thread Progress artifact' }, async () => {
  const fixture = await makeStageFixture();
  try {
    await stageFixture(fixture);
    await assert.rejects(stageFixture(fixture), /Remove an existing fixture registration explicitly/);
    const [{ createConnection }, { setInstalledPluginEnabled }] = await Promise.all([
      sourceImport('packages/db/src/connection.ts'), sourceImport('packages/db/src/data/plugins.ts'),
    ]);
    const db = createConnection(join(fixture.dataDir, 'bb.db'));
    try { setInstalledPluginEnabled(db, 'thread-progress', true); } finally { db.$client.close(); }
    await assert.rejects(stageFixture(fixture), /Remove an existing fixture registration explicitly/);
    assert.equal((await readStagedRow(fixture.dataDir)).row?.enabled, true);
    assert.equal(existsSync(join(fixture.dataDir, 'plugins', 'thread-progress', 'data.db')), false);
  } finally {
    await rm(fixture.dataDir, { recursive: true, force: true });
  }
});

test('post-stage failure persists an explicit retained-disabled recovery receipt', { skip: actualArtifact ? false : 'set BB_THREAD_PROGRESS_ARTIFACT to a sealed Thread Progress artifact' }, async () => {
  const fixture = await makeStageFixture();
  const originalProfile = await readFile(fixture.profilePath, 'utf8');
  try {
    await assert.rejects(stageFixture(fixture, async () => { throw new Error('deliberate post-stage fence'); }), /remains disabled.*Remove the disabled registration explicitly/u);
    const { row, settings } = await readStagedRow(fixture.dataDir);
    assert.equal(row?.enabled, false);
    assert.equal(row?.rootDir, fixture.profile.plugins[0].root);
    assert.deepEqual(settings, Object.fromEntries(Object.entries(fixture.profile.plugins[0].preActivationSettings).map(([key, value]) => [key, JSON.stringify(value)])));
    assert.equal(await readFile(fixture.profilePath, 'utf8'), originalProfile);
    const partial = JSON.parse(await readFile(join(fixture.dataDir, 'thread-progress-stage-partial-receipt.json'), 'utf8'));
    assert.equal(partial.state, 'retained-disabled-after-failure');
    assert.equal(partial.profileReplaced, false);
    assert.match(partial.recovery, /Remove its registration explicitly/u);
  } finally {
    await rm(fixture.dataDir, { recursive: true, force: true });
  }
});
