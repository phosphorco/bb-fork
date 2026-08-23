import type { P6rPresenceViewer } from "@bb/server-contract";
import { P6rPresenceAvatarRow } from "./PresenceAvatarRow";
import { P6rSidebarPresenceDots } from "./SidebarPresenceDots";
import { P6rTypingIndicator } from "./TypingIndicator";
import { StoryCard, StoryRow } from "../../../../.ladle/story-card";

export default {
  title: "thread/Presence",
};

function viewer(args: {
  p6rHandle: string;
  p6rDisplayName: string;
  p6rImageUrl?: string;
  p6rTyping?: boolean;
}): P6rPresenceViewer {
  return {
    p6rHandle: args.p6rHandle,
    p6rDisplayName: args.p6rDisplayName,
    p6rImageUrl: args.p6rImageUrl ?? null,
    p6rTyping: args.p6rTyping ?? false,
  };
}

const ALICE = viewer({ p6rHandle: "alice", p6rDisplayName: "Alice Chen" });
const BOB = viewer({ p6rHandle: "bob", p6rDisplayName: "Bob" });
const CAROL = viewer({ p6rHandle: "carol", p6rDisplayName: "Carol Q. Vance" });
const DANA = viewer({
  p6rHandle: "dana",
  p6rDisplayName: "Dana",
  p6rImageUrl:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%23888'/%3E%3C/svg%3E",
});
const ERIN = viewer({ p6rHandle: "erin", p6rDisplayName: "Erin" });

export function P6rAvatarRow() {
  return (
    <StoryCard>
      <StoryRow label="one viewer">
        <P6rPresenceAvatarRow p6rViewers={[ALICE]} />
      </StoryRow>
      <StoryRow label="initials + image avatar">
        <P6rPresenceAvatarRow p6rViewers={[ALICE, DANA]} />
      </StoryRow>
      <StoryRow label="overflow (+N past four)">
        <P6rPresenceAvatarRow p6rViewers={[ALICE, BOB, CAROL, DANA, ERIN]} />
      </StoryRow>
      <StoryRow label="small size (sidebar-adjacent surfaces)">
        <P6rPresenceAvatarRow p6rViewers={[ALICE, BOB]} size="sm" />
      </StoryRow>
      <StoryRow label="empty roster renders nothing">
        <P6rPresenceAvatarRow p6rViewers={[]} />
      </StoryRow>
    </StoryCard>
  );
}

export function P6rSidebarDots() {
  return (
    <StoryCard>
      <StoryRow label="one viewer">
        <P6rSidebarPresenceDots handles={["alice"]} />
      </StoryRow>
      <StoryRow label="overflow (+N past three)">
        <P6rSidebarPresenceDots handles={["alice", "bob", "carol", "dana"]} />
      </StoryRow>
    </StoryCard>
  );
}

export function P6rTyping() {
  return (
    <StoryCard>
      <StoryRow label="one typist">
        <P6rTypingIndicator handles={["alice"]} />
      </StoryRow>
      <StoryRow label="two typists">
        <P6rTypingIndicator handles={["alice", "bob"]} />
      </StoryRow>
      <StoryRow label="three or more">
        <P6rTypingIndicator handles={["alice", "bob", "carol"]} />
      </StoryRow>
      <StoryRow label="no typists renders nothing">
        <P6rTypingIndicator handles={[]} />
      </StoryRow>
    </StoryCard>
  );
}
