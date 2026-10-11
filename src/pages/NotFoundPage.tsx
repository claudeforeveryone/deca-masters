import { Link } from "react-router-dom";
import { buttonClass } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";

export function NotFoundPage() {
  return (
    <EmptyState
      headingLevel={1}
      title="Page not found"
      body="This address does not go anywhere on DECA Masters. Check the link, or start again from the home page."
      action={
        <Link to="/" className={buttonClass("secondary")}>
          Go to the home page
        </Link>
      }
    />
  );
}
