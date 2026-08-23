import { describe, expect, it } from "vitest";
import {
  headersForLoopbackRequest,
  P6R_TUNNEL_ORIGIN_HEADER,
} from "../src/headers.js";

describe("headersForLoopbackRequest", () => {
  it("strips a client-supplied tunnel marker and stamps the trusted marker", () => {
    const headers = headersForLoopbackRequest(
      [
        ["X-P6R-Via-Tunnel", "client-controlled"],
        ["x-p6r-via-tunnel", "0"],
        ["content-type", "application/json"],
      ],
      {
        publicOrigin: "https://owner.getbb.app",
        loopbackOrigin: "http://127.0.0.1:38886",
        p6rMarkTunnelOrigin: true,
      },
    );

    expect(headers).toEqual({
      "content-type": "application/json",
      [P6R_TUNNEL_ORIGIN_HEADER]: "1",
    });
  });

  it("stamps both ordinary HTTP requests and websocket upgrade headers", () => {
    expect(
      headersForLoopbackRequest([], {
        publicOrigin: "https://owner.getbb.app",
        loopbackOrigin: "http://127.0.0.1:38886",
        p6rMarkTunnelOrigin: true,
      }),
    ).toEqual({ [P6R_TUNNEL_ORIGIN_HEADER]: "1" });
  });
});
