import { openNativeRecoveryDatabase } from "./native-sqlite";
import { RecoveryRepository } from "./repository";

let repositoryPromise: Promise<RecoveryRepository> | null = null;

export function getNativeRecoveryRepository(): Promise<RecoveryRepository> {
  if (repositoryPromise) return repositoryPromise;
  const initialization = openNativeRecoveryDatabase().then(async (database) => {
    const repository = new RecoveryRepository(database);
    try {
      await repository.initialize();
      return repository;
    } catch (error) {
      await database.close().catch(() => undefined);
      throw error;
    }
  });
  const retryable = initialization.catch((error: unknown) => {
    if (repositoryPromise === retryable) repositoryPromise = null;
    throw error;
  });
  repositoryPromise = retryable;
  return repositoryPromise;
}
