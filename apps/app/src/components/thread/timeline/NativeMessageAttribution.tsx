import type { NativeInputAttribution } from "@bb/domain";
import { Avatar, AvatarFallback, AvatarImage } from "@bb/shared-ui/avatar";

export function NativeMessageAttribution({ sources }: { sources: readonly NativeInputAttribution[] | undefined }) {
  if (!sources?.some(({ author }) => author.kind === "person" || author.kind === "external")) return null;
  return (
    <div className="mb-1 flex max-w-full flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-muted-foreground" data-native-attribution="">
      {sources.map(({ author, latestEditor }, index) => {
        if (author.kind !== "person" && author.kind !== "external") {
          return <span key={index}>{author.kind === "unknown" ? "Unknown source" : author.kind === "agent" ? "Agent" : "System"}</span>;
        }
        const { presentation, identity } = author.actor;
        const edited = latestEditor !== null && (latestEditor.identity.kind !== identity.kind || latestEditor.identity.key !== identity.key);
        return (
          <span key={index} className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
            <Avatar className="h-4 w-4" aria-hidden="true">
              {presentation.avatarUrl ? <AvatarImage src={presentation.avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-[9px]">{presentation.displayName.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <span className="max-w-60 truncate" title={presentation.displayName}>{presentation.displayName}</span>
            {author.kind === "external" ? <span>via {author.actor.identity.pluginId}</span> : null}
            {edited ? <span className="max-w-60 truncate" title={`Edited by ${latestEditor.presentation.displayName}`}>Edited by {latestEditor.presentation.displayName}</span> : null}
          </span>
        );
      })}
    </div>
  );
}
