import type { AttachmentPayload } from "./contracts";
import type { RecoveryRepository } from "./repository";

export interface AttachmentFileStore {
  ensureDirectory(path: string): Promise<void>;
  write(path: string, bytes: Uint8Array): Promise<void>;
  read(path: string): Promise<Uint8Array>;
  exists(path: string): Promise<boolean>;
  move(source: string, destination: string): Promise<void>;
  remove(path: string): Promise<void>;
  list(path: string): Promise<string[]>;
}

export type AttachmentHasher = (bytes: Uint8Array) => Promise<string>;

export interface AttachmentStageHooks {
  afterWrite?: () => Promise<void>;
  afterHash?: () => Promise<void>;
  afterMove?: () => Promise<void>;
  afterCommit?: () => Promise<void>;
}

export interface StageAttachmentInput {
  namespaceId: string;
  outboxId: string;
  attachmentId: string;
  bytes: Uint8Array;
  rootPath: string;
  uniqueSuffix: string;
}

function childPath(parent: string, name: string): string {
  return `${parent.replace(/\/+$/u, "")}/${encodeURIComponent(name)}`;
}

async function verifyPayload(
  fileStore: AttachmentFileStore,
  hasher: AttachmentHasher,
  path: string,
  expectedHash: string,
  expectedBytes: number,
): Promise<boolean> {
  if (!(await fileStore.exists(path))) return false;
  const bytes = await fileStore.read(path);
  return (
    bytes.byteLength === expectedBytes && (await hasher(bytes)) === expectedHash
  );
}

/** Stage, read back, hash, rename, then commit the SQLite reference. */
export async function stageAttachmentPayload(
  repository: RecoveryRepository,
  fileStore: AttachmentFileStore,
  hasher: AttachmentHasher,
  input: StageAttachmentInput,
  hooks: AttachmentStageHooks = {},
): Promise<AttachmentPayload> {
  const stagingDirectory = childPath(input.rootPath, "staging");
  const payloadDirectory = childPath(input.rootPath, "payloads");
  await fileStore.ensureDirectory(stagingDirectory);
  await fileStore.ensureDirectory(payloadDirectory);

  const stagingPath = childPath(
    stagingDirectory,
    `${input.attachmentId}-${input.uniqueSuffix}.stage`,
  );
  const expectedSha256 = await hasher(input.bytes);
  await fileStore.write(stagingPath, input.bytes);
  await hooks.afterWrite?.();

  const persistedBytes = await fileStore.read(stagingPath);
  const persistedSha256 = await hasher(persistedBytes);
  if (persistedBytes.byteLength !== input.bytes.byteLength) {
    throw new Error("Attachment staging byte count mismatch");
  }
  if (persistedSha256 !== expectedSha256) {
    throw new Error("Attachment staging hash mismatch");
  }
  await hooks.afterHash?.();

  const finalPath = childPath(payloadDirectory, expectedSha256);
  if (await fileStore.exists(finalPath)) {
    if (
      !(await verifyPayload(
        fileStore,
        hasher,
        finalPath,
        expectedSha256,
        persistedBytes.byteLength,
      ))
    ) {
      throw new Error("Existing content-addressed attachment is corrupt");
    }
    await fileStore.remove(stagingPath);
  } else {
    await fileStore.move(stagingPath, finalPath);
  }
  await hooks.afterMove?.();

  const payload: AttachmentPayload = {
    namespaceId: input.namespaceId,
    attachmentId: input.attachmentId,
    outboxId: input.outboxId,
    state: "complete",
    stagingPath: null,
    finalPath,
    sha256: expectedSha256,
    byteCount: persistedBytes.byteLength,
  };
  await repository.putAttachmentPayload(payload);
  await hooks.afterCommit?.();
  return payload;
}

export interface AttachmentReconciliationResult {
  removedStaging: number;
  removedUnreferenced: number;
  markedUnavailable: number;
}

export async function reconcileAttachmentPayloads(
  repository: RecoveryRepository,
  fileStore: AttachmentFileStore,
  hasher: AttachmentHasher,
  rootPath: string,
): Promise<AttachmentReconciliationResult> {
  const stagingDirectory = childPath(rootPath, "staging");
  const payloadDirectory = childPath(rootPath, "payloads");
  await fileStore.ensureDirectory(stagingDirectory);
  await fileStore.ensureDirectory(payloadDirectory);

  const rows = await repository.listAttachmentPayloads();
  const referencedStaging = new Set(
    rows.flatMap((row) => (row.stagingPath ? [row.stagingPath] : [])),
  );
  let removedStaging = 0;
  for (const path of await fileStore.list(stagingDirectory)) {
    if (referencedStaging.has(path)) continue;
    await fileStore.remove(path);
    removedStaging += 1;
  }

  const referenced = new Set(
    rows.flatMap((row) => (row.finalPath ? [row.finalPath] : [])),
  );
  let markedUnavailable = 0;
  for (const row of rows) {
    if (row.state === "staging") {
      if (!row.stagingPath || !(await fileStore.exists(row.stagingPath))) {
        await repository.markAttachmentUnavailable(
          row.namespaceId,
          row.attachmentId,
        );
        markedUnavailable += 1;
      }
      continue;
    }
    if (
      row.state !== "complete" ||
      !row.finalPath ||
      !row.sha256 ||
      !(await verifyPayload(
        fileStore,
        hasher,
        row.finalPath,
        row.sha256,
        row.byteCount,
      ))
    ) {
      if (row.state === "complete") {
        await repository.markAttachmentUnavailable(
          row.namespaceId,
          row.attachmentId,
        );
        markedUnavailable += 1;
      }
    }
  }

  let removedUnreferenced = 0;
  for (const path of await fileStore.list(payloadDirectory)) {
    if (referenced.has(path)) continue;
    await fileStore.remove(path);
    removedUnreferenced += 1;
  }
  return { markedUnavailable, removedStaging, removedUnreferenced };
}
