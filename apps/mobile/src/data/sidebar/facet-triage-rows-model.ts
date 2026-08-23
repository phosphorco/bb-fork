import type { ThreadFacetQueryThread } from "@bb/server-contract";
import type { FacetTriageModel } from "./facet-triage-model";

export interface FacetTriageHeaderRow {
  type: "facet-triage-header";
  key: "facet-triage:header:my-progress";
  collapsed: boolean;
  threadCount: number | null;
}

export interface FacetTriageThreadRow {
  type: "facet-triage-thread";
  key: string;
  thread: ThreadFacetQueryThread;
}

export interface FacetTriageMessageRow {
  type: "facet-triage-message";
  key: string;
  kind: "status" | "loading" | "error" | "empty";
  label: string;
  retry: boolean;
}

export interface FacetTriageContinuationRow {
  type: "facet-triage-continuation";
  key: "facet-triage:continuation";
  loading: boolean;
}

export type FacetTriageListRow =
  | FacetTriageHeaderRow
  | FacetTriageThreadRow
  | FacetTriageMessageRow
  | FacetTriageContinuationRow;

export function buildFacetTriageRows(args: {
  collapsed: boolean;
  hasNextPage: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  model: FacetTriageModel;
}): FacetTriageListRow[] {
  const rows: FacetTriageListRow[] = [
    {
      type: "facet-triage-header",
      key: "facet-triage:header:my-progress",
      collapsed: args.collapsed,
      threadCount: args.hasNextPage ? null : args.model.threads.length,
    },
  ];
  if (args.collapsed) return rows;
  if (args.model.status !== null) {
    rows.push({
      type: "facet-triage-message",
      key: "facet-triage:status",
      kind: "status",
      label: args.model.status,
      retry: false,
    });
  }
  if (args.isLoading && args.model.threads.length === 0) {
    rows.push({
      type: "facet-triage-message",
      key: "facet-triage:loading",
      kind: "loading",
      label: "Loading progress…",
      retry: false,
    });
    return rows;
  }
  if (args.isError) {
    rows.push({
      type: "facet-triage-message",
      key: "facet-triage:error",
      kind: "error",
      label:
        args.model.threads.length === 0
          ? "Could not load progress."
          : "Could not refresh progress.",
      retry: true,
    });
  }
  if (args.model.threads.length === 0 && !args.isError) {
    rows.push({
      type: "facet-triage-message",
      key: "facet-triage:empty",
      kind: "empty",
      label: "No threads in My progress.",
      retry: false,
    });
  } else {
    for (const thread of args.model.threads) {
      rows.push({
        type: "facet-triage-thread",
        key: `facet-triage:thread:${thread.id}`,
        thread,
      });
    }
  }
  if (args.hasNextPage) {
    rows.push({
      type: "facet-triage-continuation",
      key: "facet-triage:continuation",
      loading: args.isFetchingNextPage,
    });
  }
  return rows;
}
