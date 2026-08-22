import type { P6rClaimedIdentity } from "@bb/domain";

const socketActors = new WeakMap<object, P6rClaimedIdentity>();
const baseSocketActors = new WeakMap<object, P6rClaimedIdentity>();
const claimedIdentitySockets = new WeakSet<object>();

interface P6rRegisterSocketActorOptions {
  p6rAllowClaimedIdentity?: boolean;
}

export function p6rRegisterSocketActor(
  socket: object,
  actor: P6rClaimedIdentity | null,
  options: P6rRegisterSocketActorOptions = {},
): void {
  if (actor === null) {
    socketActors.delete(socket);
    baseSocketActors.delete(socket);
  } else {
    socketActors.set(socket, actor);
    baseSocketActors.set(socket, actor);
  }
  if (options.p6rAllowClaimedIdentity === true) {
    claimedIdentitySockets.add(socket);
  } else {
    claimedIdentitySockets.delete(socket);
  }
}

export function p6rCanSetSocketActor(socket: object): boolean {
  return claimedIdentitySockets.has(socket);
}

export function p6rSetSocketActor(
  socket: object,
  actor: P6rClaimedIdentity,
): void {
  if (p6rCanSetSocketActor(socket)) {
    socketActors.set(socket, actor);
  }
}

export function p6rRestoreSocketActor(socket: object): void {
  const actor = baseSocketActors.get(socket);
  if (actor !== undefined && p6rCanSetSocketActor(socket)) {
    socketActors.set(socket, actor);
  } else if (p6rCanSetSocketActor(socket)) {
    socketActors.delete(socket);
  }
}

export function p6rReleaseSocketActor(socket: object): void {
  socketActors.delete(socket);
  baseSocketActors.delete(socket);
  claimedIdentitySockets.delete(socket);
}

export function p6rGetSocketActor(socket: object): P6rClaimedIdentity | null {
  return socketActors.get(socket) ?? null;
}
