import { Command } from "commander";
import {
  threadFacetParticipantPageRequestSchema,
  threadFacetQueryRequestSchema,
  type ThreadFacetParticipantPageRequest,
  type ThreadFacetQueryRequest,
} from "@bb/domain";
import { action } from "../../action.js";
import { createCliBbSdk } from "../../client.js";
import { getErrorMessage, outputJson } from "../helpers.js";

interface FacetQueryOptions {
  includeExecution?: boolean;
  json?: boolean;
  latestAttentionAfter?: string;
  queryJson?: string;
}

interface FacetParticipantsOptions {
  cursor?: string;
  json?: boolean;
  pageSize?: string;
}

export function registerFacetCommands(
  parent: Command,
  getUrl: () => string,
): void {
  const facets = parent
    .command("facets")
    .description("Query extensible thread facets");

  facets
    .command("query")
    .description("Run a bounded facet query")
    .option(
      "--query-json <json>",
      "Canonical facet query envelope (defaults to {})",
    )
    .option(
      "--include-execution",
      "Include effective provider, model, reasoning, provenance, and witness",
    )
    .option(
      "--latest-attention-after <epoch-ms>",
      "Only scan threads with attention at or after this epoch millisecond",
    )
    .option("--json", "Print machine-readable JSON output")
    .action(
      action(async (opts: FacetQueryOptions) => {
        const request = parseFacetQuery(opts);
        const result =
          await createCliBbSdk(getUrl()).threads.queryFacets(request);
        if (outputJson(opts, result)) return;
        if (result.threads.length === 0) {
          console.log("No threads found");
        } else {
          for (const thread of result.threads) {
            const execution = thread.experimental_execution;
            console.log(
              [
                thread.id,
                thread.title ?? thread.titleFallback ?? "-",
                ...(execution
                  ? [
                      execution.providerId,
                      execution.effectiveModel ?? "unresolved",
                      execution.effectiveReasoningLevel ?? "unresolved",
                      `${execution.modelSource}/${execution.reasoningSource}`,
                    ]
                  : []),
              ].join("\t"),
            );
          }
        }
        for (const state of result.facetStates) {
          console.log(`Facet ${state.typeId}: ${state.ownerState}`);
        }
        if (result.nextCursor !== null) {
          console.log(`Next cursor: ${result.nextCursor}`);
        }
      }),
    );

  facets
    .command("participants <threadId>")
    .description("Page a thread's facet-backed participant profiles")
    .option("--page-size <count>", "Profiles per page (1-100)")
    .option("--cursor <cursor>", "Opaque continuation cursor")
    .option("--json", "Print machine-readable JSON output")
    .action(
      action(async (threadId: string, opts: FacetParticipantsOptions) => {
        const request = parseFacetParticipantPage(threadId, opts);
        const result =
          await createCliBbSdk(getUrl()).threads.facetParticipants(request);
        if (outputJson(opts, result)) return;
        console.log(
          `Participants: ${result.profiles.length}/${result.totalCount}`,
        );
        for (const profile of result.profiles) {
          console.log(`${profile.p6rPrincipalKey}\t${profile.p6rDisplayName}`);
        }
        if (result.nextCursor !== null) {
          console.log(`Next cursor: ${result.nextCursor}`);
        }
      }),
    );
}

function parseFacetQuery(opts: FacetQueryOptions): ThreadFacetQueryRequest {
  let value: unknown;
  try {
    value = JSON.parse(opts.queryJson ?? "{}");
  } catch (error: unknown) {
    throw new Error(`Invalid facet query JSON: ${getErrorMessage(error)}`);
  }

  const base = threadFacetQueryRequestSchema.safeParse(value);
  if (!base.success) {
    throw new Error(`Invalid facet query: ${base.error.message}`);
  }
  const latestAttentionAtOrAfter =
    opts.latestAttentionAfter === undefined
      ? undefined
      : Number(opts.latestAttentionAfter);
  const result = threadFacetQueryRequestSchema.safeParse({
    ...base.data,
    scope: {
      ...base.data.scope,
      ...(latestAttentionAtOrAfter === undefined
        ? {}
        : { experimental_latestAttentionAtOrAfter: latestAttentionAtOrAfter }),
    },
    ...(opts.includeExecution ? { experimental_includeExecution: true } : {}),
  });
  if (!result.success) {
    throw new Error(`Invalid facet query: ${result.error.message}`);
  }
  return result.data;
}

function parseFacetParticipantPage(
  threadId: string,
  opts: FacetParticipantsOptions,
): ThreadFacetParticipantPageRequest {
  const result = threadFacetParticipantPageRequestSchema.safeParse({
    threadId,
    ...(opts.pageSize === undefined ? {} : { pageSize: Number(opts.pageSize) }),
    ...(opts.cursor === undefined ? {} : { cursor: opts.cursor }),
  });
  if (!result.success) {
    throw new Error(`Invalid participant page: ${result.error.message}`);
  }
  return result.data;
}
