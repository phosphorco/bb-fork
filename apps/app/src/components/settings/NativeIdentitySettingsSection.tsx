import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@bb/shared-ui/avatar";
import { Button } from "@bb/shared-ui/button";
import { SettingsSection } from "@/components/ui/settings-section.js";
import { sdk } from "@/lib/sdk";

export function NativeIdentitySettingsSection() {
  const query = useQuery({ queryKey: ["system", "native-identity"],
    queryFn: ({ signal }) => sdk.system.nativeIdentity({ signal }), retry: false,
    staleTime: 0,
  });
  const identity = query.data;
  return <SettingsSection title="Identity">
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0" aria-live="polite">
        {query.isPending ? <p>Checking identity…</p> : identity?.status === "ready" && !query.isError ? (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-8 w-8" aria-hidden="true">
              {identity.actor.presentation.avatarUrl ? <AvatarImage src={identity.actor.presentation.avatarUrl} alt="" /> : null}
              <AvatarFallback>{identity.actor.presentation.displayName.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate" title={identity.actor.presentation.displayName}>{identity.actor.presentation.displayName}</p>
              {identity.actor.presentation.handle ? <p className="truncate text-sm text-muted-foreground">{identity.actor.presentation.handle}</p> : null}
            </div>
          </div>
        ) : <p className="text-sm text-muted-foreground">{!query.isError && identity?.status === "unsupported" ? "No identity provider is configured." : identity?.status === "unauthenticated" ? "This request is not authenticated." : "Identity is unavailable."}</p>}
      </div>
      <Button variant="outline" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh identity</Button>
    </div>
  </SettingsSection>;
}
