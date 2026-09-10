import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, createHash, createPublicKey } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const script = fileURLToPath(import.meta.url);
const forkRoot = resolve(dirname(script), '..');
export const proofRoot = join(forkRoot, 'build/proof-bb');
export const proofData = '/home/ubuntu/.local/share/bb-fork-proof';
export const ports = [39886, 39887, 39888];
const unit = 'bb-fork-proof.service';
const pin = '960255b98ce3dccdcb5754eb67a7f989236602a1';
const marker = join(proofData, 'proof-owner.json');
const loader = join(proofRoot, 'node_modules/tsx/dist/loader.mjs');
const fixtureProfilePath = join(proofData, 'fixture-profile.json');
const fixtureSource = resolve(forkRoot, '../plugins/packages/bb-identity/examples/local-proof');
const fixtureIds = ['p6r-proof-signed-idp', 'p6r-proof-identity-probe'];
const fixtureKeyRoot = join(proofData, 'p6r-fixture-keys');
const sealedThreadProgressId = 'thread-progress';
const sealedThreadProgressRoot = join(proofData, 'plugins', 'cache', 'npm', '@phosphor', 'bb-plugin-thread-progress', '0.1.0', 'node_modules', '@phosphor', 'bb-plugin-thread-progress');
const sealedThreadProgressFiles = ['package.json', 'dist/server.js', 'dist/server.meta.json', 'dist/app.js', 'dist/app.css', 'dist/app.meta.json'];
const sealedThreadProgressSettings = {
  summariesEnabled: false,
  summariesForChildThreads: false,
  idleDelaySeconds: '3600',
  summaryMinUserTurns: '1',
};

export function validateFixtureProfile(value, root = fixtureSource) {
  if (![1, 2].includes(value?.version) || !Array.isArray(value.plugins) || value.plugins.length !== (value.version === 1 ? 2 : 3) ||
      value.boundary?.configuration?.pluginId !== fixtureIds[0]) throw new Error('Invalid proof fixture profile');
  if (typeof value.publicKeyPath !== 'string' || !value.publicKeyPath.startsWith(`${fixtureKeyRoot}/`) ||
      resolve(value.publicKeyPath) !== value.publicKeyPath ||
      typeof value.publicKeySha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.publicKeySha256)) {
    throw new Error('Proof public key requires a confined path and digest');
  }
  if (!Array.isArray(value.boundary.trustedIngresses) || !value.boundary.trustedIngresses.length ||
      value.boundary.trustedIngresses.some(ingress => ingress.kind !== 'local' ||
        !Array.isArray(ingress.remoteAddresses) || !ingress.remoteAddresses.length ||
        ingress.remoteAddresses.some(address => !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)))) {
    throw new Error('Proof fixture ingress must be local loopback');
  }
  const seen = new Set();
  for (const plugin of value.plugins) {
    const sealed = value.version === 2 && plugin.id === sealedThreadProgressId;
    if ((!fixtureIds.includes(plugin.id) && !sealed) || seen.has(plugin.id) || typeof plugin.root !== 'string' ||
        (!sealed && !plugin.root.startsWith(`${root}/`)) || (sealed && plugin.root !== sealedThreadProgressRoot) || resolve(plugin.root) !== plugin.root ||
        !plugin.files || typeof plugin.files !== 'object' || Array.isArray(plugin.files) ||
        !Object.hasOwn(plugin.files, 'package.json') || (sealed && (plugin.kind !== 'sealed-app-artifact' ||
          Object.keys(plugin.files).sort().join('\0') !== [...sealedThreadProgressFiles].sort().join('\0') ||
          typeof plugin.contentSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(plugin.contentSha256) ||
          typeof plugin.sealedManifestSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(plugin.sealedManifestSha256) ||
          typeof plugin.tarballSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(plugin.tarballSha256) ||
          typeof plugin.npmIntegrity !== 'string' || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(plugin.npmIntegrity) ||
          typeof plugin.source?.sourceReceipt !== 'string' || !/^[a-f0-9]{64}$/.test(plugin.source.sourceReceipt) ||
          plugin.source.baseSdkVersion !== '0.4.47' || plugin.source.forkSdkVersion !== '0.4.47' ||
          JSON.stringify(plugin.preActivationSettings) !== JSON.stringify(sealedThreadProgressSettings))) ||
        (!sealed && Object.keys(plugin.files).length < 2)) {
      throw new Error('Unexpected proof fixture plugin/source');
    }
    seen.add(plugin.id);
    for (const [path, hash] of Object.entries(plugin.files)) {
      if (path.startsWith('/') || path.split('/').some(part => part === '..' || part === '.' || !part) ||
          typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid fixture artifact digest');
    }
  }
  return value;
}

function fixtureProfile() {
  if (!existsSync(fixtureProfilePath)) return null;
  verifyStateOwner(true);
  const value = validateFixtureProfile(JSON.parse(readFileSync(fixtureProfilePath, 'utf8')));
  if (realpathSync(value.publicKeyPath) !== value.publicKeyPath || !statSync(value.publicKeyPath).isFile()) {
    throw new Error('Proof public key must be a regular non-symlink file');
  }
  const publicKey = readFileSync(value.publicKeyPath);
  if (createHash('sha256').update(publicKey).digest('hex') !== value.publicKeySha256 ||
      !publicKey.toString('utf8').startsWith('-----BEGIN PUBLIC KEY-----') ||
      createPublicKey(publicKey).asymmetricKeyType !== 'rsa') {
    throw new Error('Proof RSA public key does not match its receipt');
  }
  for (const plugin of value.plugins) {
    if (realpathSync(plugin.root) !== plugin.root) throw new Error('Fixture root must be visible source');
    for (const [path, hash] of Object.entries(plugin.files)) {
      const file = join(plugin.root, path);
      if (realpathSync(file) !== file || createHash('sha256').update(readFileSync(file)).digest('hex') !== hash) {
        throw new Error(`Fixture artifact changed: ${plugin.id}/${path}`);
      }
    }
    const manifest = JSON.parse(readFileSync(join(plugin.root, 'package.json'), 'utf8'));
    if (plugin.id === sealedThreadProgressId) {
      const sealedPath = join(plugin.root, 'sealed-manifest.json');
      if (realpathSync(sealedPath) !== sealedPath) throw new Error('Sealed manifest must not be a symlink');
      const sealedBytes = readFileSync(sealedPath);
      if (createHash('sha256').update(sealedBytes).digest('hex') !== plugin.sealedManifestSha256) throw new Error('Sealed build receipt changed');
      const sealedManifest = JSON.parse(sealedBytes.toString('utf8'));
      if (createHash('sha256').update(JSON.stringify(sealedManifest.sourceClosure)).digest('hex') !== plugin.source.sourceReceipt) throw new Error('Sealed source receipt mismatch');
      const contentSha256 = createHash('sha256').update(sealedThreadProgressFiles.map(path => `${path}\0${plugin.files[path]}\n`).join('')).digest('hex');
      if (manifest.bb?.server !== './dist/server.js' || manifest.bb?.app !== './dist/app.js' || manifest.bb?.host ||
          sealedManifest.pluginId !== sealedThreadProgressId || sealedManifest.pluginVersion !== '0.1.0' ||
          contentSha256 !== plugin.contentSha256 || sealedManifest.contentSha256 !== plugin.contentSha256 || JSON.stringify(sealedManifest.settings && Object.fromEntries(Object.entries(sealedManifest.settings).map(([key, setting]) => [key, setting.value]))) !== JSON.stringify(sealedThreadProgressSettings)) {
        throw new Error('Sealed Thread Progress manifest has a source fallback or mismatched receipt');
      }
      continue;
    }
    const server = manifest.bb?.server;
    if (typeof server !== 'string' || !Object.hasOwn(plugin.files, server.replace(/^\.\//, '')) ||
        manifest.bb?.app || manifest.bb?.host) {
      throw new Error(`Fixture must declare a receipted server-only entry: ${plugin.id}`);
    }
  }
  return value;
}

export function assertAllowedPlugins(installed, profile, requireRunning = false) {
  const allowed = new Map((profile?.plugins ?? []).map(plugin => [plugin.id, plugin]));
  for (const plugin of installed) {
    if (!plugin.enabled && plugin.status !== 'running') continue;
    const fixture = allowed.get(plugin.id);
    if (!fixture || (plugin.rootDir !== undefined && plugin.rootDir !== fixture.root)) {
      throw new Error(`Unexpected active proof plugin: ${plugin.id}`);
    }
  }
  if (requireRunning && profile) {
    for (const id of allowed.keys()) {
      if (!installed.some(plugin => plugin.id === id && plugin.enabled && plugin.status === 'running')) {
        throw new Error(`Proof fixture is not running: ${id}`);
      }
    }
  }
}

export function assertThreadProgressDrained({ unitState, enabled, environmentThreads, queues }) {
  if (unitState !== 'inactive') throw new Error('Stop the proof unit before fixture staging or drain checks');
  if (enabled) throw new Error('Thread Progress must be disabled before staging');
  if (environmentThreads !== 0) throw new Error('Proof has visible environment-backed threads');
  for (const name of ['notification_outbox', 'summary_jobs', 'sticker_jobs']) {
    if (!Number.isSafeInteger(queues[name]) || queues[name] !== 0) throw new Error(`Thread Progress queue is not drained: ${name}`);
  }
}

async function threadProgressDrainCheck() {
  verifySource();
  verifyStateOwner(true);
  const unitState = command('systemctl', ['--user', 'show', unit, '--value', '-p', 'ActiveState']);
  if (unitState !== 'inactive') throw new Error('Stop the proof unit before fixture staging or drain checks');
  await assertPortsAvailable();
  const normal = normalService();
  if (!normal.includes('ActiveState=active') || !normal.includes(`WorkingDirectory=${join(forkRoot, 'build/bb')}`)) {
    throw new Error('Normal service is not active at its expected source');
  }
  const { DatabaseSync } = await import('node:sqlite');
  const databasePath = join(proofData, 'bb.db');
  if (realpathSync(databasePath) !== databasePath) throw new Error('Proof database must not be a symlink');
  const db = new DatabaseSync(databasePath, { readOnly: true });
  let feature;
  try {
    const row = db.prepare('SELECT enabled FROM plugins WHERE id = ?').get(sealedThreadProgressId);
    // Stricter than the minimum primary-host exclusion: no visible environment
    // can cause an observed-plan subprocess during this first fixture slice.
    const environmentThreads = db.prepare("SELECT count(*) AS n FROM threads WHERE visibility = 'visible' AND environment_id IS NOT NULL AND deleted_at IS NULL").get().n;
    const featurePath = join(proofData, 'plugins', sealedThreadProgressId, 'data.db');
    if (existsSync(featurePath)) {
      if (realpathSync(featurePath) !== featurePath) throw new Error('Feature database must not be a symlink');
      feature = new DatabaseSync(featurePath, { readOnly: true });
    }
    const queues = {};
    for (const name of ['notification_outbox', 'summary_jobs', 'sticker_jobs']) {
      const present = feature?.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
      queues[name] = present ? feature.prepare(`SELECT count(*) AS n FROM ${name}`).get().n : 0;
    }
    assertThreadProgressDrained({ unitState, enabled: Boolean(row?.enabled), environmentThreads, queues });
    assertNormalUnchanged(normal, normalService());
    return { source: proofRoot, data: proofData, unitState, enabled: false, environmentThreads, queues, normal };
  } finally {
    feature?.close();
    db.close();
  }
}

function stageRecoveryMessage(error, profileReplaced) {
  const detail = error instanceof Error ? error.message : String(error);
  return `fixture stage failed after disabled registration; Thread Progress remains disabled and was never loaded. ${profileReplaced ? 'The profile replacement may already be visible; inspect the profile and partial stage receipt before recovery.' : 'The existing profile was not replaced.'} Remove the disabled registration explicitly before restaging: ${detail}`;
}

function writeStageReceipt(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  renameSync(temporary, path);
}

/** Internal seam for the isolated offline transaction test. The CLI admits all fixed proof inputs first. */
export async function runThreadProgressStageTransaction({ artifactRoot, profile, profileBytes, profilePath, dataDir, appVersion, beforeStage, afterStage }) {
  const selected = profile.plugins.find(plugin => plugin.id === sealedThreadProgressId);
  if (profile.version !== 2 || !selected) throw new Error('Stage requires an admitted v2 Thread Progress profile');
  const assembler = await import('./proof-thread-progress-artifact.mjs');
  const verified = await assembler.verifySealedThreadProgressArtifact(artifactRoot);
  if (selected.contentSha256 !== verified.contentSha256 || selected.sealedManifestSha256 !== verified.sealedManifestSha256 ||
      selected.source.sourceReceipt !== verified.sourceReceipt || Object.entries(selected.files).some(([path, hash]) => !verified.files.some(file => file.path === path && file.sha256 === hash))) {
    throw new Error('Prospective profile does not match the sealed artifact');
  }
  const before = await beforeStage();
  const fingerprint = sourceFingerprint();
  const partialReceiptPath = join(dataDir, 'thread-progress-stage-partial-receipt.json');
  const receiptPath = join(dataDir, 'thread-progress-stage-receipt.json');
  const previousRegistry = process.env.npm_config_registry;
  const previousCache = process.env.npm_config_cache;
  let db, service, registry, partial;
  let profileReplaced = false;
  try {
    const [{ createPluginService }, { createAiServiceRegistry }, { createNoopTelemetryService }, { createLogger }] = await Promise.all([
      sourceImport('apps/server/src/services/plugins/plugin-service.ts'), sourceImport('apps/server/src/services/ai/ai-service-registry.ts'),
      sourceImport('apps/server/src/services/system/telemetry.ts'), sourceImport('packages/logger/src/index.ts'),
    ]);
    const database = await pluginDatabase({ dataDir });
    db = database.db;
    if (database.rows.getInstalledPlugin(db, sealedThreadProgressId)) throw new Error('Remove an existing fixture registration explicitly before staging');
    const packed = await assembler.packSealedThreadProgressArtifact({ artifactRoot, outputDir: join(dataDir, 'staged-tarballs') });
    if (selected.tarballSha256 !== packed.sha256 || selected.npmIntegrity !== packed.integrity) throw new Error('Prospective tarball receipt mismatch');
    registry = await assembler.createLoopbackProofRegistry(packed);
    process.env.npm_config_registry = registry.registry;
    process.env.npm_config_cache = join(dataDir, 'stage-npm-cache');
    service = createPluginService({ db, aiServices: createAiServiceRegistry(), telemetry: createNoopTelemetryService(),
      logger: createLogger({ component: 'proof-stage', dataDir, transportMode: 'stream' }),
      hub: { getDaemonSessionIdForHost: () => null, notifyPluginSignal: () => 0, notifySystem: () => {} }, dataDir, appVersion, bundledPlugins: [],
    });
    const descriptors = Object.fromEntries(Object.entries(verified.manifest.settings).map(([key, setting]) => [key, { type: setting.type, label: key }]));
    await service.stageNpmInstall({ source: 'npm:@phosphor/bb-plugin-thread-progress@0.1.0', pluginId: sealedThreadProgressId,
      expectedNpmVersion: '0.1.0', expectedNpmIntegrity: packed.integrity, preActivationSettings: { descriptors, values: selected.preActivationSettings },
    });
    // Record successful disabled registration before any installed-byte or
    // settings verification can fail. These are expectations, not verified facts.
    partial = { state: 'disabled-stage-unverified', profileSha256: createHash('sha256').update(profileBytes).digest('hex'), profilePath,
      expectedRoot: selected.root, expectedContentSha256: verified.contentSha256, npmIntegrity: packed.integrity,
      recovery: 'Thread Progress is disabled and was never loaded. Remove its registration explicitly before restaging.' };
    writeStageReceipt(partialReceiptPath, partial);
    const row = database.rows.getInstalledPlugin(db, sealedThreadProgressId);
    if (!row || row.enabled || row.rootDir !== selected.root || row.npmIntegrity !== packed.integrity || service.isPluginLoaded(sealedThreadProgressId)) throw new Error('Staged registration mismatch');
    const installed = await assembler.verifySealedThreadProgressArtifact(row.rootDir);
    if (installed.sealedManifestSha256 !== verified.sealedManifestSha256 || installed.contentSha256 !== verified.contentSha256) throw new Error('Installed artifact mismatch');
    const { getPluginSettingsValues } = await sourceImport('packages/db/src/data/plugin-storage.ts');
    const storedSettings = getPluginSettingsValues(db, sealedThreadProgressId);
    if (Object.entries(selected.preActivationSettings).some(([key, value]) => storedSettings[key] !== JSON.stringify(value))) throw new Error('Staged settings mismatch');
    const receipt = { ...before, fingerprint, artifact: installed.contentSha256, sealedManifestSha256: installed.sealedManifestSha256,
      tarballSha256: packed.sha256, npmIntegrity: packed.integrity, root: row.rootDir, descriptors, settings: selected.preActivationSettings };
    // The profile and receipt are separate files. This partial receipt is written
    // before profile replacement and deliberately makes no atomicity claim.
    partial = { state: 'disabled-stage-retained', profileSha256: createHash('sha256').update(profileBytes).digest('hex'), profilePath,
      recovery: 'Thread Progress is disabled and was never loaded. Remove its registration explicitly before restaging.', ...receipt };
    writeStageReceipt(partialReceiptPath, partial);
    await afterStage({ before, fingerprint, receipt });
    const temporaryProfile = `${profilePath}.${randomUUID()}.tmp`;
    writeFileSync(temporaryProfile, profileBytes, { flag: 'wx', mode: 0o600 });
    renameSync(temporaryProfile, profilePath);
    profileReplaced = true;
    writeStageReceipt(receiptPath, { state: 'profile-replaced', partialReceipt: partialReceiptPath, ...receipt });
    return receipt;
  } catch (error) {
    if (partial) {
      try { writeStageReceipt(partialReceiptPath, { ...partial, state: 'retained-disabled-after-failure', profileReplaced,
        failure: error instanceof Error ? error.message : String(error), recovery: 'Thread Progress remains disabled and was never loaded. Remove its registration explicitly before restaging.',
      }); } catch {}
      throw new Error(stageRecoveryMessage(error, profileReplaced));
    }
    throw error;
  } finally {
    try { await service?.stop(); } finally {
      db?.$client.close();
      if (previousRegistry === undefined) delete process.env.npm_config_registry; else process.env.npm_config_registry = previousRegistry;
      if (previousCache === undefined) delete process.env.npm_config_cache; else process.env.npm_config_cache = previousCache;
      await registry?.close();
    }
  }
}

async function stageThreadProgress(artifactArgument, profileArgument) {
  const drain = await threadProgressDrainCheck();
  if (!artifactArgument || !profileArgument) throw new Error('Stage requires artifact and prospective profile paths');
  const artifactRoot = resolve(artifactArgument);
  const proposedPath = resolve(profileArgument);
  for (const path of [artifactRoot, proposedPath]) {
    if (!path.startsWith(`${proofData}/`) || realpathSync(path) !== path) throw new Error('Stage inputs must be confined non-symlink proof paths');
  }
  const profileBytes = readFileSync(proposedPath);
  const profile = validateFixtureProfile(JSON.parse(profileBytes));
  if (profile.version !== 2) throw new Error('Staging requires an explicit v2 profile');
  const currentProfile = fixtureProfile();
  if (!currentProfile || JSON.stringify(profile.boundary) !== JSON.stringify(currentProfile.boundary) ||
      profile.publicKeyPath !== currentProfile.publicKeyPath || profile.publicKeySha256 !== currentProfile.publicKeySha256 ||
      JSON.stringify(profile.plugins.filter(plugin => fixtureIds.includes(plugin.id))) !==
        JSON.stringify(currentProfile.plugins.filter(plugin => fixtureIds.includes(plugin.id)))) {
    throw new Error('Staging must preserve the checked P/F sources, boundary and key');
  }
  const { loadServerConfig } = await sourceImport('packages/config/src/server.ts');
  return runThreadProgressStageTransaction({
    artifactRoot, profile, profileBytes, profilePath: fixtureProfilePath, dataDir: proofData,
    appVersion: loadServerConfig({ env: launchEnvironment(), repoRoot: proofRoot }).BB_APP_VERSION,
    beforeStage: async () => drain,
    afterStage: async ({ fingerprint }) => {
      await threadProgressDrainCheck();
      assertStartupMatches({ launchId: 'stage', fingerprint }, sourceFingerprint(), 'stage');
      assertNormalUnchanged(drain.normal, normalService());
    },
  });
}

function launchEnvironment() {
  const env = proofEnvironment(process.env);
  const profile = fixtureProfile();
  if (profile) {
    env.BB_P6R_IDENTITY_BOUNDARY = JSON.stringify(profile.boundary);
    env.BB_P6R_PROOF_PUBLIC_KEY_PATH = profile.publicKeyPath;
  }
  return env;
}

export function proofEnvironment(base, node = process.execPath) {
  const env = {};
  for (const key of ['HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL']) {
    if (base[key] !== undefined) env[key] = base[key];
  }
  return {
    ...env,
    XDG_RUNTIME_DIR: `/run/user/${process.getuid()}`,
    PATH: `${dirname(node)}:/usr/bin:/bin`,
    NODE_ENV: 'development',
    BB_DATA_DIR: proofData,
    BB_SERVER_PORT: String(ports[0]),
    BB_SERVER_BIND_HOST: '127.0.0.1',
    BB_SERVER_URL: `http://127.0.0.1:${ports[0]}`,
    BB_HOST_DAEMON_PORT: String(ports[1]),
    BB_DEV_APP_PORT: String(ports[2]),
    BB_DEV_APP_HOST: '127.0.0.1',
    BB_APP_URL: `http://127.0.0.1:${ports[2]}`,
    BB_EXTERNAL_URL: `http://127.0.0.1:${ports[2]}`,
    BB_HOST_DAEMON_AUTO_UPDATE: 'false',
    BB_TELEMETRY: 'false',
    BB_INHERITED_SKILLS_ROOTS: '',
    BB_MARKETPLACE_URL: `http://127.0.0.1:${ports[0]}/proof-disabled-marketplace`,
    BB_INFERENCE: 'proof-fixture/test',
    BB_INFERENCE_FALLBACK: 'proof-fixture/test',
    BB_TRANSCRIPTION: 'proof-fixture/test',
  };
}

function command(file, args) {
  return execFileSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function verifySource() {
  if (realpathSync(proofRoot) !== proofRoot) throw new Error('Proof source must be the visible worktree');
  const common = command('git', ['-C', proofRoot, 'rev-parse', '--git-common-dir']);
  if (realpathSync(resolve(proofRoot, common)) !== realpathSync(join(forkRoot, '.git/modules/upstream'))) {
    throw new Error('Wrong proof source Git store');
  }
  if (command('git', ['-C', proofRoot, 'branch', '--show-current']) !== 'proof/identity-first') {
    throw new Error('Unexpected proof source branch');
  }
  command('git', ['-C', proofRoot, 'merge-base', '--is-ancestor', pin, 'HEAD']);
  if (!existsSync(loader)) throw new Error('Install proof dependencies with pnpm install --frozen-lockfile first');
  return command('git', ['-C', proofRoot, 'rev-parse', 'HEAD']);
}

export function sourceFingerprint(root = proofRoot) {
  const head = command('git', ['-C', root, 'rev-parse', 'HEAD']);
  const diff = command('git', ['-C', root, 'diff', '--binary', 'HEAD']);
  const paths = command('git', ['-C', root, 'ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean).sort();
  const untrackedSha256 = Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(join(root, path))).digest('hex')]));
  return { head, diffSha256: createHash('sha256').update(diff).digest('hex'), untrackedSha256 };
}

export function assertNormalUnchanged(startupNormal, currentNormal) {
  if (typeof startupNormal !== 'string' || startupNormal !== currentNormal) throw new Error('Normal service identity changed since this proof launch');
}

export function assertStartupMatches(startup, current, launchId) {
  if (typeof launchId !== 'string' || startup.launchId !== launchId) throw new Error('Proof startup receipt does not identify this server launch');
  if (JSON.stringify(startup.fingerprint) !== JSON.stringify(current)) throw new Error('Proof source changed after startup; restart the proof before verifying current source');
}

export async function assertPortsAvailable(selected = ports) {
  const reservations = [];
  try {
    for (const port of selected) {
      const socket = createServer();
      reservations.push(socket);
      await new Promise((done, fail) => {
        socket.once('error', fail);
        socket.listen({ host: '127.0.0.1', port, exclusive: true }, done);
      });
    }
  } finally {
    await Promise.all(reservations.map(socket => new Promise(done => socket.close(done))));
  }
}

function verifyStateOwner(required) {
  if (!existsSync(proofData)) {
    if (required) throw new Error('Run prepare before start');
    return;
  }
  if (realpathSync(proofData) !== proofData) throw new Error('Proof data must not be a symlink');
  if (!existsSync(marker)) throw new Error('Existing data directory lacks proof ownership marker');
  const owner = JSON.parse(readFileSync(marker, 'utf8'));
  if (owner.source !== proofRoot || owner.pin !== pin || owner.data !== proofData) throw new Error('Proof ownership marker mismatch');
}

async function sourceImport(path) {
  return import(pathToFileURL(join(proofRoot, path)).href);
}

async function effectiveConfig() {
  const env = launchEnvironment();
  const [{ loadServerConfig }, { loadHostDaemonConfig }, { loadViteDevConfig }] = await Promise.all([
    sourceImport('packages/config/src/server.ts'),
    sourceImport('packages/config/src/host-daemon.ts'),
    sourceImport('packages/config/src/vite-dev.ts'),
  ]);
  const input = { env, repoRoot: proofRoot };
  const server = loadServerConfig(input);
  const daemon = loadHostDaemonConfig(input);
  const app = loadViteDevConfig(input);
  if (server.BB_DATA_DIR !== proofData || daemon.BB_DATA_DIR !== proofData ||
      server.BB_SERVER_PORT !== ports[0] || daemon.BB_HOST_DAEMON_PORT !== ports[1] ||
      app.appPort !== ports[2] || app.serverPort !== ports[0] || app.appHost !== '127.0.0.1') {
    throw new Error('Native configuration differs from proof selection');
  }
  return { data: proofData, serverPort: server.BB_SERVER_PORT, daemonPort: daemon.BB_HOST_DAEMON_PORT,
    appPort: app.appPort, serverUrl: app.serverHttpOrigin, source: proofRoot, providerPolicy: fixtureProfile() ? 'explicit offline fixture allowlist; builtin plugins disabled' : 'bootstrap requires all builtin plugins disabled; no inherited provider environment' };
}

function normalService() {
  return command('systemctl', ['--user', 'show', 'bb.service', '-p', 'ActiveState', '-p', 'MainPID', '-p', 'WorkingDirectory']);
}

async function preflight() {
  const source = verifySource();
  verifyStateOwner(false);
  await assertPortsAvailable();
  const config = await effectiveConfig();
  const normal = normalService();
  if (!normal.includes('ActiveState=active') || !normal.includes(`WorkingDirectory=${join(forkRoot, 'build/bb')}`)) {
    throw new Error('Normal service is not active at its expected source');
  }
  return { source, config, normal };
}

async function pluginDatabase({ dataDir = proofData } = {}) {
  const [{ createConnection }, { migrate }, rows, { listBundledPluginRegistrations }] = await Promise.all([
    sourceImport('packages/db/src/connection.ts'), sourceImport('packages/db/src/migrate.ts'),
    sourceImport('packages/db/src/data/plugins.ts'), sourceImport('apps/server/src/services/plugins/builtin-registry.ts'),
  ]);
  const db = createConnection(join(dataDir, 'bb.db'));
  return { db, migrate, rows, bundled: listBundledPluginRegistrations() };
}

async function prepare() {
  const receipt = await preflight();
  if (existsSync(marker)) throw new Error('Proof already prepared; use check then start (never reset automatically)');
  mkdirSync(proofData, { recursive: true, mode: 0o700 });
  writeFileSync(marker, JSON.stringify({ source: proofRoot, data: proofData, pin }, null, 2), { flag: 'wx', mode: 0o600 });
  const { db, migrate, rows, bundled } = await pluginDatabase();
  try {
    migrate(db);
    db.transaction(() => {
      for (const plugin of bundled) {
        const manifest = JSON.parse(readFileSync(join(plugin.rootDir, 'package.json'), 'utf8'));
        rows.upsertInstalledPlugin(db, {
          id: plugin.pluginId, source: `builtin:${plugin.name}`, provenance: { kind: 'builtin' },
          sourceIntent: { kind: 'builtin', name: plugin.name }, exactResolution: { kind: 'builtin' },
          updateState: { lastCheckAt: null, availableCompatibleVersion: null, newestIncompatibleVersion: null, statusDetail: null },
          activeArtifactId: null, rootDir: plugin.rootDir, version: manifest.version, enabled: false,
        });
      }
    });
  } finally { db.$client.close(); }
  writeFileSync(join(proofData, 'prepare-receipt.json'), JSON.stringify(receipt, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ ...receipt, builtinPluginsDisabled: bundled.length }, null, 2));
}

async function assertFixtureOnly() {
  verifyStateOwner(true);
  const { db, rows, bundled } = await pluginDatabase();
  try {
    const installed = rows.listInstalledPlugins(db);
    assertAllowedPlugins(installed, fixtureProfile());
    for (const plugin of bundled) {
      if (!installed.some(row => row.id === plugin.pluginId && !row.enabled)) throw new Error(`Missing disabled builtin ${plugin.pluginId}; refuse auto-install`);
    }
    return installed.length;
  } finally { db.$client.close(); }
}

async function serve() {
  const receipt = await preflight();
  await assertFixtureOnly();
  const env = { ...launchEnvironment(), BB_SERVER_LAUNCH_ID: randomUUID() };
  const fingerprint = sourceFingerprint();
  writeFileSync(join(proofData, 'startup-receipt.json'), JSON.stringify({
    time: new Date().toISOString(), launchId: env.BB_SERVER_LAUNCH_ID, fingerprint, fixtures: fixtureProfile(), normal: normalService(),
  }, null, 2), { mode: 0o600 });
  const children = [];
  let stopping = false;
  function stop(code) {
    if (stopping) return;
    stopping = true;
    process.exitCode = code;
    for (const child of children) child.kill('SIGTERM');
    const force = setTimeout(() => { for (const child of children) child.kill('SIGKILL'); }, 8000);
    force.unref();
  }
  process.on('SIGTERM', () => stop(0));
  process.on('SIGINT', () => stop(0));
  const commands = [
    { label: 'server', cwd: proofRoot, args: ['apps/server/src/index.ts'] },
    { label: 'app', cwd: join(proofRoot, 'apps/app'), args: ['node_modules/vite/bin/vite.js', '--config', 'vite.dev.config.ts', '--configLoader', 'runner', '--host', '127.0.0.1', '--port', String(ports[2]), '--strictPort'] },
  ];
  function startChild(item, childEnv = env) {
    const child = spawn(process.execPath, ['--conditions=source', '--import', loader, ...item.args], { cwd: item.cwd, env: childEnv, stdio: 'inherit' });
    children.push(child);
    child.once('error', error => { console.error(error.message); stop(1); });
    child.once('exit', (code, signal) => {
      console.log(JSON.stringify({ child: item.label, exitCode: code, signal }));
      if (!stopping) stop(code || 1);
    });
  }
  for (const item of commands) startChild(item);
  try {
    let healthy = false;
    const deadline = performance.now() + 45000;
    while (performance.now() < deadline && !stopping) {
      try {
        const response = await fetch(`${env.BB_SERVER_URL}/health`, { signal: AbortSignal.timeout(1000) });
        const health = await response.json();
        if (response.ok && health.launchId === env.BB_SERVER_LAUNCH_ID) { healthy = true; break; }
      } catch {}
      await new Promise(done => setTimeout(done, 250));
    }
    if (!healthy) throw new Error('Proof server did not report its exact launch ID');
    let daemonEnv = env;
    if (!existsSync(join(proofData, 'auth.json'))) {
      const response = await fetch(`${env.BB_SERVER_URL}/internal/hosts/enroll-key`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(5000),
      });
      const enrollment = await response.json();
      if (response.status !== 201 || typeof enrollment.enrollKey !== 'string' || typeof enrollment.hostId !== 'string') {
        throw new Error('Proof-local daemon enrollment failed');
      }
      daemonEnv = { ...env, BB_HOST_ENROLL_KEY: enrollment.enrollKey, BB_HOST_ID: enrollment.hostId };
    }
    if (stopping) return;
    startChild({ label: 'daemon', cwd: proofRoot, args: ['apps/host-daemon/src/index.ts'] }, daemonEnv);
  } catch (error) { stop(1); throw error; }
  console.log(JSON.stringify({ ...receipt, childPids: children.map(child => child.pid) }, null, 2));
}

async function verifyRunning() {
  verifySource();
  verifyStateOwner(true);
  const deadline = performance.now() + 45000;
  let lastError;
  while (performance.now() < deadline) {
    try {
      const healthResponse = await fetch(`http://127.0.0.1:${ports[0]}/health`, { signal: AbortSignal.timeout(1500) });
      const uiResponse = await fetch(`http://127.0.0.1:${ports[2]}/`, { signal: AbortSignal.timeout(1500) });
      const daemonResponse = await fetch(`http://127.0.0.1:${ports[1]}/health`, { signal: AbortSignal.timeout(1500) });
      if (!healthResponse.ok || !uiResponse.ok || !daemonResponse.ok) throw new Error('Proof health endpoints not all ready');
      const health = await healthResponse.json();
      const fingerprint = sourceFingerprint();
      const startup = JSON.parse(readFileSync(join(proofData, 'startup-receipt.json'), 'utf8'));
      assertStartupMatches(startup, fingerprint, health.launchId);
      const profile = fixtureProfile();
      if (JSON.stringify(startup.fixtures ?? null) !== JSON.stringify(profile)) throw new Error('Proof fixture profile changed after startup');
      const pluginsResponse = await fetch(`http://127.0.0.1:${ports[0]}/api/v1/plugins`, { signal: AbortSignal.timeout(1500) });
      const plugins = await pluginsResponse.json();
      if (!Array.isArray(plugins.plugins)) throw new Error('Invalid proof plugin response');
      assertAllowedPlugins(plugins.plugins, profile, true);
      const cgroup = command('systemctl', ['--user', 'show', unit, '--value', '-p', 'ControlGroup']);
      if (!cgroup.endsWith(`/${unit}`)) throw new Error('Proof unit is not live');
      const pids = readFileSync(`/sys/fs/cgroup${cgroup}/cgroup.procs`, 'utf8').trim().split('\n');
      const witnessed = [];
      for (const pid of pids) {
        let raw;
        try { raw = readFileSync(`/proc/${pid}/environ`, 'utf8'); } catch (error) { if (error.code === 'ENOENT' || error.code === 'ESRCH') continue; throw error; }
        const env = Object.fromEntries(raw.split('\0').filter(Boolean).map(value => {
          const at = value.indexOf('='); return [value.slice(0, at), value.slice(at + 1)];
        }));
        if (env.BB_DATA_DIR !== proofData || env.BB_SERVER_URL !== `http://127.0.0.1:${ports[0]}` ||
            env.BB_HOST_DAEMON_PORT !== String(ports[1]) || env.BB_THREAD_ID || env.BB_CLI || env.OPENAI_API_KEY) {
          throw new Error(`Proof child ${pid} has unexpected routing/environment`);
        }
        if ((env.BB_P6R_IDENTITY_BOUNDARY ?? null) !== (profile ? JSON.stringify(profile.boundary) : null)) {
          throw new Error(`Proof child ${pid} has unexpected identity boundary configuration`);
        }
        if ((env.BB_P6R_PROOF_PUBLIC_KEY_PATH ?? null) !== (profile?.publicKeyPath ?? null)) {
          throw new Error(`Proof child ${pid} has unexpected fixture key configuration`);
        }
        witnessed.push(Number(pid));
      }
      if (witnessed.length < 4) throw new Error('Expected supervisor and three runtime children');
      const normal = normalService();
      assertNormalUnchanged(startup.normal, normal);
      const diff = command('git', ['-C', proofRoot, 'diff', '--binary', 'HEAD']);
      const receipt = {
        time: new Date().toISOString(), source: verifySource(), config: await effectiveConfig(),
        health, disabledPlugins: plugins.plugins.filter(plugin => !plugin.enabled).length, startup,
        pids: witnessed, normal, ...fingerprint,
      };
      writeFileSync(join(proofData, 'verified-source.diff'), diff, { mode: 0o600 });
      writeFileSync(join(proofData, 'verified-receipt.json'), JSON.stringify(receipt, null, 2), { mode: 0o600 });
      console.log(JSON.stringify(receipt, null, 2));
      return;
    } catch (error) { lastError = error; }
    await new Promise(done => setTimeout(done, 500));
  }
  throw lastError ?? new Error('Proof health timed out');
}

async function main(action) {
  if (action === 'fixture-stage') {
    if (process.argv[3] !== sealedThreadProgressId) throw new Error('Only the Thread Progress fixture is supported');
    console.log(JSON.stringify(await stageThreadProgress(process.argv[4], process.argv[5]), null, 2));
    return;
  }
  if (action === 'fixture-drain-check') {
    if (process.argv[3] !== sealedThreadProgressId) throw new Error('Only the Thread Progress fixture is supported');
    console.log(JSON.stringify(await threadProgressDrainCheck(), null, 2));
    return;
  }
  if (action === 'check') { console.log(JSON.stringify(await preflight(), null, 2)); return; }
  if (action === 'prepare') return prepare();
  if (action === 'verify') return verifyRunning();
  if (action === 'serve') {
    if (!readFileSync('/proc/self/cgroup', 'utf8').split('\n').some(line => line.endsWith(`/${unit}`))) {
      throw new Error('Use start: systemd cgroup ownership is required');
    }
    return serve();
  }
  if (action === 'start') {
    await preflight();
    await assertFixtureOnly();
    const env = launchEnvironment();
    const assignments = Object.entries(env).map(([key, value]) => `${key}=${value}`);
    command('systemd-run', ['--user', '--collect', '--unit', unit,
      '--property=KillMode=control-group', '--property=TimeoutStopSec=15', '--property=Restart=no',
      `--property=WorkingDirectory=${proofRoot}`, '/usr/bin/env', '-i', ...assignments,
      process.execPath, '--conditions=source', '--import', loader, script, 'serve']);
    console.log('Proof unit started; run verify to check readiness and isolation.');
    return;
  }
  if (action === 'stop') {
    const state = command('systemctl', ['--user', 'show', unit, '--value', '-p', 'ActiveState']);
    if (state !== 'inactive') command('systemctl', ['--user', 'stop', unit]);
    await assertPortsAvailable();
    console.log(normalService());
    return;
  }
  if (action === 'status') {
    console.log(command('systemctl', ['--user', 'show', unit, '-p', 'ActiveState', '-p', 'MainPID', '-p', 'ControlGroup', '-p', 'WorkingDirectory']));
    console.log(normalService());
    return;
  }
  throw new Error('Usage: scripts/proof-runtime check|prepare|start|verify|status|stop | fixture-drain-check thread-progress | fixture-stage thread-progress ARTIFACT_ROOT PROFILE_PATH');
}

if (process.argv[1] && resolve(process.argv[1]) === script) {
  main(process.argv[2]).catch(error => { console.error(error.stack); process.exitCode = 1; });
}
