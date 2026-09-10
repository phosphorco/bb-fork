import { BbHttpError, type BrowserBbSdk } from "@bb/sdk/browser";
import {
  MY_PROGRESS_SAVED_FACET_QUERY,
  type MyProgressFacetPage,
  type MyProgressPageParam,
  type MyProgressQueryMode,
} from "./facet-triage-contract";

const MY_PROGRESS_PAGE_SIZE = 25;

/**
 * Fetch one server-ordered page. A missing progress facet gets exactly one
 * narrower, participant-only request; it never broadens to an all-thread list.
 */
export async function fetchMyProgressPage(args: {
  pageParam: MyProgressPageParam;
  sdk: {
    threads: Pick<BrowserBbSdk["threads"], "queryFacets">;
  };
  signal: AbortSignal;
}): Promise<MyProgressFacetPage> {
  const query = (mode: MyProgressQueryMode) =>
    args.sdk.threads.queryFacets({
      scope: MY_PROGRESS_SAVED_FACET_QUERY.scope,
      filters: [...MY_PROGRESS_SAVED_FACET_QUERY.filters],
      pageSize: MY_PROGRESS_PAGE_SIZE,
      signal: args.signal,
      ...(args.pageParam.cursor === undefined
        ? {}
        : { cursor: args.pageParam.cursor }),
      ...(mode === "progress"
        ? { order: MY_PROGRESS_SAVED_FACET_QUERY.order }
        : {}),
    });

  if (args.pageParam.mode === "participants-only") {
    return {
      mode: "participants-only",
      response: await query("participants-only"),
    };
  }

  try {
    return { mode: "progress", response: await query("progress") };
  } catch (error) {
    if (!(error instanceof BbHttpError) || error.code !== "facet_unavailable") {
      throw error;
    }
    return {
      mode: "participants-only",
      response: await query("participants-only"),
    };
  }
}

export function nextMyProgressPageParam(
  page: MyProgressFacetPage,
): MyProgressPageParam | undefined {
  return page.response.nextCursor === null
    ? undefined
    : { cursor: page.response.nextCursor, mode: page.mode };
}

export type {
  MyProgressFacetPage,
  MyProgressPageParam,
  MyProgressQueryMode,
} from "./facet-triage-contract";
