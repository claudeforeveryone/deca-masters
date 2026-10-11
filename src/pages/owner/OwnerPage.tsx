import { useEffect, useState } from "react";
import { PagePlaceholder } from "../../components/layout/PagePlaceholder";
import { RouteFallback } from "../../components/layout/RouteFallback";
import { EmptyState } from "../../components/ui/EmptyState";
import { Notice } from "../../components/ui/Notice";
import { isPlatformOwner } from "../../api/owner";

type State =
  | { status: "checking" }
  | { status: "owner" }
  | { status: "denied" }
  | { status: "error"; message: string };

/**
 * The owner console's front door. The database decides (public.is_platform_owner(), keyed on the signed-in user's
 * id); this page only reflects the answer. Every owner query must check again on the server.
 */
export function OwnerPage() {
  const [state, setState] = useState<State>({ status: "checking" });

  useEffect(() => {
    let active = true;
    isPlatformOwner()
      .then((ok) => {
        if (active) setState({ status: ok ? "owner" : "denied" });
      })
      .catch((err: unknown) => {
        if (active)
          setState({
            status: "error",
            message:
              err instanceof Error
                ? err.message
                : "Could not check owner access.",
          });
      });
    return () => {
      active = false;
    };
  }, []);

  if (state.status === "checking")
    return <RouteFallback label="Checking access" />;
  if (state.status === "error")
    return <Notice tone="error">{state.message}</Notice>;
  if (state.status === "denied")
    return (
      <EmptyState
        headingLevel={1}
        title="Not authorized"
        body="This page is for the site owner only. Your account does not have owner access."
      />
    );
  return (
    <PagePlaceholder
      title="Owner console"
      lede="Aggregate usage for the site owner: sign-ups, active members, practice volume. Counts under five are hidden."
    />
  );
}
