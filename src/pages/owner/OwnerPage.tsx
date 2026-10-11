// /owner: the owner console. Members-only (RequireAuth), its own lazy chunk, and gated on the server's answer to
// public.is_platform_owner() (keyed on the signed-in user's id, never an email). That answer only decides what renders:
// every deca_owner_* function checks ownership again and refuses anyone else. Anyone else gets a plain page.
import { Link } from "react-router-dom";
import {
  existingItemIds,
  ownerAuditSearch,
  ownerContent,
  ownerContentDetails,
  ownerEngagement,
  ownerFeedbackList,
  ownerFeedbackUpdate,
  ownerGrowth,
  ownerImportContent,
  ownerOverview,
  ownerPreparation,
  ownerQuestion,
  ownerSetLeaderboardHidden,
  ownerSetRetired,
  ownerSupportEmail,
  ownerUserSearch,
} from "../../api/owner";
import { listTerms } from "../../api/vocab";
import { RouteFallback } from "../../components/layout/RouteFallback";
import { buttonClass } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import type { ExamSlug } from "../../lib/content";
import { resetOwnerChecks, useIsOwner } from "../../lib/useIsOwner";
import { OwnerConsole } from "./OwnerConsole";
import type { OwnerSource } from "./shared";

const live: OwnerSource = {
  overview: ownerOverview,
  growth: ownerGrowth,
  engagement: ownerEngagement,
  preparation: ownerPreparation,
  content: ownerContent,
  question: ownerQuestion,
  term: async (deck, id) =>
    (await listTerms(deck as ExamSlug)).find((t) => t.id === id) ?? null,
  feedbackList: ownerFeedbackList,
  feedbackUpdate: ownerFeedbackUpdate,
  auditSearch: ownerAuditSearch,
  userSearch: (q) => ownerUserSearch(q),
  supportEmail: ownerSupportEmail,
  setLeaderboardHidden: ownerSetLeaderboardHidden,
  setRetired: ownerSetRetired,
  contentDetails: ownerContentDetails,
  existingIds: existingItemIds,
  importContent: ownerImportContent,
};

export function OwnerPage() {
  const state = useIsOwner();
  if (state === "checking") return <RouteFallback label="Checking access" />;
  if (state === "error")
    return (
      <ErrorState
        headingLevel={1}
        title="Could not check owner access"
        body="The check did not reach the server. Check your connection and try again."
        onRetry={() => {
          resetOwnerChecks();
          window.location.reload();
        }}
      />
    );
  if (state === "denied") return <NotAuthorized />;
  return <OwnerConsole source={live} />;
}

/** What everyone who is not an owner sees: no data, no hints about what is behind it. */
export function NotAuthorized() {
  return (
    <EmptyState
      headingLevel={1}
      title="Not authorized"
      body="This page is only for the people who run DECA Masters. Your account does not have owner access."
      action={
        <Link to="/" className={buttonClass("secondary")}>
          Back to home
        </Link>
      }
    />
  );
}
