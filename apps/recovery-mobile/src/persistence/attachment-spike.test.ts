import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  type AttachmentFileStore,
  reconcileAttachmentPayloads,
  stageAttachmentPayload,
} from "./attachments";
import { NodeRecoverySqlDatabase } from "./node-sqlite";
import { RecoveryRepository } from "./repository";

class NodeAttachmentFileStore implements AttachmentFileStore {
  async ensureDirectory(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }

  async write(path: string, bytes: Uint8Array): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async read(path: string): Promise<Uint8Array> {
    return readFile(path);
  }

  async exists(path: string): Promise<boolean> {
    return stat(path).then(
      () => true,
      () => false,
    );
  }

  move(source: string, destination: string): Promise<void> {
    return rename(source, destination);
  }

  remove(path: string): Promise<void> {
    return rm(path, { force: true });
  }

  async list(path: string): Promise<string[]> {
    return readdir(path).then((entries) =>
      entries.map((entry) => join(path, entry)),
    );
  }
}

class CorruptingAttachmentFileStore extends NodeAttachmentFileStore {
  override write(path: string, bytes: Uint8Array): Promise<void> {
    const corrupted = Uint8Array.from(bytes);
    if (corrupted.length > 0) corrupted[0] = corrupted[0]! ^ 0xff;
    return super.write(path, corrupted);
  }
}

const sha256 = async (bytes: Uint8Array): Promise<string> =>
  createHash("sha256").update(bytes).digest("hex");

const temporaryDirectories: string[] = [];

async function createHarness(): Promise<{
  fileStore: NodeAttachmentFileStore;
  repository: RecoveryRepository;
  rootPath: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "bb-recovery-attachments-"));
  temporaryDirectories.push(root);
  const repository = new RecoveryRepository(
    NodeRecoverySqlDatabase.open(join(root, "recovery.db")),
  );
  await repository.initialize();
  await repository.ensureNamespace({
    namespaceId: "namespace-a",
    serverProfileKey: "profile-a",
    ownerKey: "provider:subject",
    ownerState: "resolved",
  });
  await repository.putOutboxItem({
    namespaceId: "namespace-a",
    outboxId: "outbox-a",
    threadId: "thread-a",
    body: "Message with an attachment",
    state: "awaiting-context",
    createdAt: 1,
    updatedAt: 1,
  });
  return {
    fileStore: new NodeAttachmentFileStore(),
    repository,
    rootPath: join(root, "payload-store"),
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("Recovery attachment crash protocol", () => {
  it("commits only a read-back verified content-addressed final", async () => {
    const harness = await createHarness();
    const payload = await stageAttachmentPayload(
      harness.repository,
      harness.fileStore,
      sha256,
      {
        namespaceId: "namespace-a",
        outboxId: "outbox-a",
        attachmentId: "attachment-a",
        bytes: new TextEncoder().encode("durable bytes"),
        rootPath: harness.rootPath,
        uniqueSuffix: "attempt-one",
      },
    );
    expect(payload).toMatchObject({
      state: "complete",
      byteCount: 13,
      sha256: await sha256(new TextEncoder().encode("durable bytes")),
    });
    await expect(harness.fileStore.exists(payload.finalPath!)).resolves.toBe(
      true,
    );
    await expect(harness.repository.listAttachmentPayloads()).resolves.toEqual([
      payload,
    ]);
    await harness.repository.close();
  });

  it("rejects same-length corruption during the staging write", async () => {
    const harness = await createHarness();
    await expect(
      stageAttachmentPayload(
        harness.repository,
        new CorruptingAttachmentFileStore(),
        sha256,
        {
          namespaceId: "namespace-a",
          outboxId: "outbox-a",
          attachmentId: "attachment-a",
          bytes: new TextEncoder().encode("durable bytes"),
          rootPath: harness.rootPath,
          uniqueSuffix: "attempt-one",
        },
      ),
    ).rejects.toThrow("hash mismatch");
    await expect(harness.repository.listAttachmentPayloads()).resolves.toEqual(
      [],
    );
    await harness.repository.close();
  });

  it("preserves a staging file referenced by durable intent", async () => {
    const harness = await createHarness();
    const stagingPath = join(harness.rootPath, "staging", "referenced.stage");
    await harness.fileStore.ensureDirectory(dirname(stagingPath));
    await harness.fileStore.write(
      stagingPath,
      new TextEncoder().encode("pending bytes"),
    );
    await harness.repository.putAttachmentPayload({
      namespaceId: "namespace-a",
      attachmentId: "attachment-a",
      outboxId: "outbox-a",
      state: "staging",
      stagingPath,
      finalPath: null,
      sha256: null,
      byteCount: 13,
    });
    await expect(
      reconcileAttachmentPayloads(
        harness.repository,
        harness.fileStore,
        sha256,
        harness.rootPath,
      ),
    ).resolves.toMatchObject({ removedStaging: 0, markedUnavailable: 0 });
    await expect(harness.fileStore.exists(stagingPath)).resolves.toBe(true);
    await harness.repository.close();
  });

  it("removes an orphan final after a crash before the database commit", async () => {
    const harness = await createHarness();
    await expect(
      stageAttachmentPayload(
        harness.repository,
        harness.fileStore,
        sha256,
        {
          namespaceId: "namespace-a",
          outboxId: "outbox-a",
          attachmentId: "attachment-a",
          bytes: new TextEncoder().encode("orphaned final"),
          rootPath: harness.rootPath,
          uniqueSuffix: "attempt-one",
        },
        {
          afterMove: async () =>
            Promise.reject(new Error("injected after move")),
        },
      ),
    ).rejects.toThrow("injected after move");

    await expect(
      reconcileAttachmentPayloads(
        harness.repository,
        harness.fileStore,
        sha256,
        harness.rootPath,
      ),
    ).resolves.toEqual({
      markedUnavailable: 0,
      removedStaging: 0,
      removedUnreferenced: 1,
    });
    await expect(harness.repository.listAttachmentPayloads()).resolves.toEqual(
      [],
    );
    await harness.repository.close();
  });

  it("marks missing committed bytes unavailable without deleting outbox intent", async () => {
    const harness = await createHarness();
    const payload = await stageAttachmentPayload(
      harness.repository,
      harness.fileStore,
      sha256,
      {
        namespaceId: "namespace-a",
        outboxId: "outbox-a",
        attachmentId: "attachment-a",
        bytes: new TextEncoder().encode("later missing"),
        rootPath: harness.rootPath,
        uniqueSuffix: "attempt-one",
      },
    );
    await harness.fileStore.remove(payload.finalPath!);
    await expect(
      reconcileAttachmentPayloads(
        harness.repository,
        harness.fileStore,
        sha256,
        harness.rootPath,
      ),
    ).resolves.toMatchObject({ markedUnavailable: 1 });
    await expect(
      harness.repository.listAttachmentPayloads(),
    ).resolves.toMatchObject([
      { attachmentId: "attachment-a", state: "unavailable" },
    ]);
    await expect(
      harness.repository.getOutboxItem("namespace-a", "outbox-a"),
    ).resolves.toMatchObject({ body: "Message with an attachment" });
    await harness.repository.close();
  });
});
