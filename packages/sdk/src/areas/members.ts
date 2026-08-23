import type { P6rMember } from "@bb/server-contract";
import type { CreateSdkAreaArgs } from "./common.js";

export interface P6rMemberAddArgs {
  p6rHandle: string;
}

export interface P6rMemberRemoveArgs {
  p6rHandle: string;
}

export type P6rMemberListResult = P6rMember[];
export type P6rMemberAddResult = P6rMember;
export type P6rMemberRemoveResult = { ok: true };

export interface P6rMembersArea {
  p6rAdd(args: P6rMemberAddArgs): Promise<P6rMemberAddResult>;
  p6rList(): Promise<P6rMemberListResult>;
  p6rRemove(args: P6rMemberRemoveArgs): Promise<P6rMemberRemoveResult>;
}

export function p6rCreateMembersArea(args: CreateSdkAreaArgs): P6rMembersArea {
  const { transport } = args;
  return {
    async p6rAdd(input) {
      return transport.readJson(
        transport.api.v1["p6r-members"].$post({
          json: { p6rHandle: input.p6rHandle },
        }),
      );
    },
    async p6rList() {
      const response = await transport.readJson(
        transport.api.v1["p6r-members"].$get({}),
      );
      return response.p6rMembers;
    },
    async p6rRemove(input) {
      return transport.readJson(
        transport.api.v1["p6r-members"].$delete({
          json: { p6rHandle: input.p6rHandle },
        }),
      );
    },
  };
}
