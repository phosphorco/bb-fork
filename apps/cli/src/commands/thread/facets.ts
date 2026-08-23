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
  json?: boolean;
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
    .option("--json", "Print machine-readable JSON output")
    .action(
      action(async (opts: FacetQueryOptions) => {
        const request = parseFacetQuery(opts.queryJson);
        const result =
          await createCliBbSdk(getUrl()).threads.queryFacets(request);
        if (outputJson(opts, result)) return;
        if (result.threads.length === 0) {
          console.log("No threads found");
        } else {
          for (const thread of result.threads) {
            console.log(
              `${thread.id}\t${thread.title ?? thread.titleFallback ?? "-"}`,
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

function parseFacetQuery(
  queryJson: string | undefined,
): ThreadFacetQueryRequest {
  let value: unknown;
  try {
    value = JSON.parse(queryJson ?? "{}");
  } catch (error: unknown) {
    throw new Error(`Invalid facet query JSON: ${getErrorMessage(error)}`);
  }

  const result = threadFacetQueryRequestSchema.safeParse(value);
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
