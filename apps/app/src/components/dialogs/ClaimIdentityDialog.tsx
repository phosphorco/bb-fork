import { useState, type FormEvent } from "react";
import { p6rNormalizeHandle } from "@bb/domain";
import { Button } from "@bb/shared-ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@bb/shared-ui/dialog";
import { Input } from "@bb/shared-ui/input";
import {
  p6rIsRemoteAppContext,
  p6rShouldOfferClaimedIdentity,
  p6rSetClaimedDisplayName,
  useP6rClaimedIdentity,
} from "@/lib/claimed-identity-store";
import { useSystemConfig } from "@/hooks/queries/system-queries";

// Session-scoped so "Not now" doesn't nag again until the next visit, while a
// fresh session still offers the prompt to an unidentified remote viewer.
const P6R_DISMISSED_SESSION_KEY = "bb.p6rClaimedIdentity.promptDismissed";

function p6rWasPromptDismissedThisSession(): boolean {
  try {
    return sessionStorage.getItem(P6R_DISMISSED_SESSION_KEY) === "true";
  } catch {
    return false;
  }
}

function p6rMarkPromptDismissed(): void {
  try {
    sessionStorage.setItem(P6R_DISMISSED_SESSION_KEY, "true");
  } catch {
    // Best-effort; worst case the prompt reappears on reload.
  }
}

/**
 * First-load identity prompt for remote sessions: asks for a display name so
 * this viewer's actions are attributed (claimed identity — presence and
 * attribution only, never authorization). Desktop/localhost sessions never see
 * it; they run as the local operator.
 */
export function P6rClaimIdentityDialog() {
  const identity = useP6rClaimedIdentity();
  const systemConfig = useSystemConfig();
  const [dismissed, setDismissed] = useState(p6rWasPromptDismissedThisSession);
  const [p6rDisplayName, setDisplayName] = useState("");
  // Wait for the server boundary before offering the lower-assurance claim.
  // A provider-authenticated browser must never be asked to identify itself
  // again or be allowed to form a parallel claimed identity.
  const open = p6rShouldOfferClaimedIdentity({
    remote: p6rIsRemoteAppContext(),
    serverBoundaryResolved:
      systemConfig.isSuccess &&
      systemConfig.data.p6rCurrentPrincipalProfile !== undefined,
    assurance: systemConfig.data?.p6rCurrentPrincipalProfile?.assurance ?? null,
    hasClaimedIdentity: identity !== null,
    dismissed,
  });
  if (!open) {
    return null;
  }
  const p6rHandle = p6rNormalizeHandle(p6rDisplayName);

  const dismiss = () => {
    p6rMarkPromptDismissed();
    setDismissed(true);
  };
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (p6rSetClaimedDisplayName(p6rDisplayName) !== null) {
      dismiss();
    }
  };

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : dismiss())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Who's here?</DialogTitle>
          <DialogDescription>
            You're viewing this bb remotely. Add a display name so your messages
            and presence are attributed to you — everyone with access can see
            it.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Input
              aria-label="Display name"
              value={p6rDisplayName}
              placeholder="e.g. Alice"
              maxLength={128}
              autoFocus
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => setDisplayName(event.target.value)}
            />
            {p6rHandle.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                You'll appear as @{p6rHandle}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={dismiss}>
              Not now
            </Button>
            <Button type="submit" disabled={p6rHandle.length === 0}>
              Continue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
