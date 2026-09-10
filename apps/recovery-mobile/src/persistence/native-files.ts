import { CryptoDigestAlgorithm, digest } from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";

import type { AttachmentFileStore, AttachmentHasher } from "./attachments";

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const nativeSha256: AttachmentHasher = async (bytes) => {
  const owned = Uint8Array.from(bytes);
  return toHex(
    new Uint8Array(
      await digest(CryptoDigestAlgorithm.SHA256, owned.buffer as ArrayBuffer),
    ),
  );
};

export class ExpoAttachmentFileStore implements AttachmentFileStore {
  ensureDirectory(path: string): Promise<void> {
    new Directory(path).create({ idempotent: true, intermediates: true });
    return Promise.resolve();
  }

  write(path: string, bytes: Uint8Array): Promise<void> {
    const file = new File(path);
    if (!file.exists) file.create({ intermediates: true });
    file.write(bytes);
    return Promise.resolve();
  }

  read(path: string): Promise<Uint8Array> {
    return new File(path).bytes();
  }

  exists(path: string): Promise<boolean> {
    return Promise.resolve(new File(path).exists);
  }

  move(source: string, destination: string): Promise<void> {
    return new File(source).move(new File(destination));
  }

  remove(path: string): Promise<void> {
    const file = new File(path);
    if (file.exists) file.delete();
    return Promise.resolve();
  }

  list(path: string): Promise<string[]> {
    const directory = new Directory(path);
    return Promise.resolve(directory.exists ? directory.list().map((entry) => entry.uri) : []);
  }
}

export function recoveryAttachmentRoot(): string {
  return new Directory(Paths.document, "bb-recovery").uri;
}
