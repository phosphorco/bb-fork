import { describe, expect, it, vi } from "vitest";
import {
  collectLogPayloads,
  runCommand,
  setupCommandOutputTestEnvironment,
  stubServerApi,
  type CommandRegistrar,
} from "../helpers/command-output-harness.js";
import { registerThreadCommands } from "../../commands/thread/index.js";

describe("bb thread facets command output", () => {
  setupCommandOutputTestEnvironment();

  const register: CommandRegistrar = (program) =>
    registerThreadCommands(program, () => "http://server");

  it("validates and forwards the canonical bounded facet query", async () => {
    const result = {
      threads: [],
      nextCursor: "next-page",
      facetStates: [
        {
          typeId: "core/participants",
          ownerState: "ready",
        },
      ],
    };
    const query = vi.fn(async () => result);
    stubServerApi({ "v1.threads.facet-query.$post": query });

    const request = {
      scope: { projectId: "proj-1", includeHidden: true },
      filters: [
        {
          typeId: "core/participants",
          operator: "contains",
          member: { perspective: "request-principal" },
        },
      ],
      order: {
        typeId: "plugin/thread-progress/phase",
        direction: "asc",
        absent: "last",
        unknown: "last",
      },
      pageSize: 25,
      cursor: "opaque-cursor",
    };

    await runCommand(
      [
        "thread",
        "facets",
        "query",
        "--query-json",
        JSON.stringify(request),
        "--json",
      ],
      register,
    );

    expect(query).toHaveBeenCalledWith({ json: request });
    expect(
      JSON.parse(collectLogPayloads(vi.mocked(console.log)).join("\n")),
    ).toEqual(result);
  });

  it("applies canonical query defaults before calling the SDK", async () => {
    const query = vi.fn(async () => ({
      threads: [],
      nextCursor: null,
      facetStates: [],
    }));
    stubServerApi({ "v1.threads.facet-query.$post": query });

    await runCommand(["thread", "facets", "query"], register);

    expect(query).toHaveBeenCalledWith({
      json: { scope: {}, filters: [], pageSize: 50 },
    });
    expect(collectLogPayloads(vi.mocked(console.log))).toEqual([
      "No threads found",
    ]);
  });

  it("exposes the bounded execution projection and attention cutoff", async () => {
    const query = vi.fn(async () => ({
      threads: [],
      nextCursor: null,
      facetStates: [],
    }));
    stubServerApi({ "v1.threads.facet-query.$post": query });

    await runCommand(
      [
        "thread",
        "facets",
        "query",
        "--include-execution",
        "--latest-attention-after",
        "1700000000000",
      ],
      register,
    );

    expect(query).toHaveBeenCalledWith({
      json: {
        scope: { experimental_latestAttentionAtOrAfter: 1700000000000 },
        filters: [],
        pageSize: 50,
        experimental_includeExecution: true,
      },
    });
  });

  it("rejects predicates outside the canonical facet algebra", async () => {
    const query = vi.fn(async () => ({
      threads: [],
      nextCursor: null,
      facetStates: [],
    }));
    stubServerApi({ "v1.threads.facet-query.$post": query });

    await expect(
      runCommand(
        [
          "thread",
          "facets",
          "query",
          "--query-json",
          JSON.stringify({
            filters: [
              {
                typeId: "core/participants",
                operator: "matches",
              },
            ],
          }),
        ],
        register,
      ),
    ).rejects.toThrow("process.exit:1");

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Error: Invalid facet query"),
    );
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects malformed query JSON before transport", async () => {
    const query = vi.fn(async () => ({
      threads: [],
      nextCursor: null,
      facetStates: [],
    }));
    stubServerApi({ "v1.threads.facet-query.$post": query });

    await expect(
      runCommand(["thread", "facets", "query", "--query-json", "{"], register),
    ).rejects.toThrow("process.exit:1");

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Error: Invalid facet query JSON"),
    );
    expect(query).not.toHaveBeenCalled();
  });

  it("pages participant profiles through the SDK continuation", async () => {
    const result = {
      totalCount: 5,
      profiles: [],
      nextCursor: "participant-page-2",
    };
    const participants = vi.fn(async () => result);
    stubServerApi({
      "v1.threads.:id.facet-participants.$get": participants,
    });

    await runCommand(
      [
        "thread",
        "facets",
        "participants",
        "thr_23456789ab",
        "--page-size",
        "20",
        "--cursor",
        "opaque-participant-cursor",
        "--json",
      ],
      register,
    );

    expect(participants).toHaveBeenCalledWith({
      param: { id: "thr_23456789ab" },
      query: { pageSize: "20", cursor: "opaque-participant-cursor" },
    });
    expect(
      JSON.parse(collectLogPayloads(vi.mocked(console.log)).join("\n")),
    ).toEqual(result);
  });

  it("rejects an out-of-bounds participant page before transport", async () => {
    const participants = vi.fn(async () => ({
      totalCount: 0,
      profiles: [],
      nextCursor: null,
    }));
    stubServerApi({
      "v1.threads.:id.facet-participants.$get": participants,
    });

    await expect(
      runCommand(
        [
          "thread",
          "facets",
          "participants",
          "thr_23456789ab",
          "--page-size",
          "101",
        ],
        register,
      ),
    ).rejects.toThrow("process.exit:1");

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Error: Invalid participant page"),
    );
    expect(participants).not.toHaveBeenCalled();
  });
});
