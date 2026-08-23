import { describe, expect, it } from "vitest";
import type { P6rClaimedIdentity } from "@bb/domain";
import {
  p6rGetSocketActor,
  p6rRegisterSocketActor,
  p6rReleaseSocketActor,
} from "../../src/ws/socket-actors.js";

const actor: P6rClaimedIdentity = {
  p6rHandle: "sawyer",
  p6rDisplayName: "Sawyer",
  p6rImageUrl: null,
  p6rClientId: "browser-1",
};

describe("socket actors", () => {
  it("registers and releases a socket actor", () => {
    const socket = {};

    expect(p6rGetSocketActor(socket)).toBeNull();
    p6rRegisterSocketActor(socket, actor);
    expect(p6rGetSocketActor(socket)).toBe(actor);
    p6rReleaseSocketActor(socket);
    expect(p6rGetSocketActor(socket)).toBeNull();
  });
});
