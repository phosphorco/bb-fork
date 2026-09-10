import type {
  SystemExecutionOptionsResponse,
  SystemProviderInfo,
  SystemProvidersQuery,
} from "@bb/server-contract";
import { signalRequestArgs, type CreateSdkAreaArgs } from "./common.js";

/** Select exactly one provider-discovery host source, or omit both for primary. */
export type ProviderHostRoutingArgs =
  | { environmentId: string; hostId?: never }
  | { environmentId?: never; hostId: string }
  | { environmentId?: never; hostId?: never };

export type ProviderListArgs = ProviderHostRoutingArgs & {
  capability?: SystemProvidersQuery["capability"];
  signal?: AbortSignal;
};
export type ProviderModelsArgs = ProviderHostRoutingArgs &
  (
    | {
        /** Load only `providerId`; avoids provider-wide discovery. */
        experimental_targeted: true;
        /** Workspace for primary/explicit-host workspace-scoped catalogs. */
        experimental_workspacePath?: string;
        providerId: string;
      }
    | {
        experimental_targeted?: false;
        experimental_workspacePath?: never;
        providerId?: string;
      }
  ) & { signal?: AbortSignal };

export type ProviderListResult = SystemProviderInfo[];
export type ProviderModelsResult = SystemExecutionOptionsResponse;

export interface ProvidersArea {
  /** List providers on the environment host, explicit host, or primary host. */
  list(args?: ProviderListArgs): Promise<ProviderListResult>;
  /** List models on the environment host, explicit host, or primary host. */
  models(args?: ProviderModelsArgs): Promise<ProviderModelsResult>;
}

export function createProvidersArea(args: CreateSdkAreaArgs): ProvidersArea {
  const { transport } = args;
  return {
    async list(input = {}) {
      return transport.readJson(
        transport.api.v1.system.providers.$get(
          {
            query: {
              capability: input.capability,
              environmentId: input.environmentId,
              hostId: input.hostId,
            },
          },
          ...signalRequestArgs(input.signal),
        ),
      );
    },
    async models(input = {}) {
      return transport.readJson(
        transport.api.v1.system["execution-options"].$get(
          {
            query: {
              environmentId: input.environmentId,
              hostId: input.hostId,
              providerId: input.providerId,
              experimental_targeted: input.experimental_targeted
                ? "true"
                : undefined,
              experimental_workspacePath: input.experimental_workspacePath,
            },
          },
          ...signalRequestArgs(input.signal),
        ),
      );
    },
  };
}
