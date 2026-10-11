import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../lib/auth";
import { ToastProvider } from "../ui/Toast";
import {
  FeedbackProvider,
  ReportItemButton,
  useFeedback,
  type FeedbackSink,
} from "./Feedback";

// Seams: who is signed in (auth) and where reports go (the sink the provider is given).
vi.mock("../../lib/auth", () => ({ useAuth: vi.fn() }));
const auth = vi.mocked(useAuth);
const signedIn = (yes: boolean) =>
  auth.mockReturnValue({
    loading: false,
    user: yes ? { id: "u1" } : null,
  } as unknown as ReturnType<typeof useAuth>);

function sink(): FeedbackSink & { send: ReturnType<typeof vi.fn> } {
  return {
    send: vi.fn(async () => {}),
    listMine: vi.fn(async () => []),
  };
}

function Opener() {
  const { openFeedback } = useFeedback();
  return (
    <button type="button" onClick={openFeedback}>
      Open feedback
    </button>
  );
}

function renderWith(s: FeedbackSink, child = <Opener />) {
  return render(
    <MemoryRouter initialEntries={["/events/PMK?tab=x"]}>
      <ToastProvider>
        <FeedbackProvider sink={s}>{child}</FeedbackProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

afterEach(() => auth.mockReset());

describe("Send feedback", () => {
  it("sends the kind, the words and the page path, then shows the member's reports", async () => {
    signedIn(true);
    const s = sink();
    renderWith(s);
    fireEvent.click(screen.getByRole("button", { name: "Open feedback" }));
    const drawer = await screen.findByRole("dialog", { name: "Send feedback" });
    fireEvent.click(within(drawer).getByLabelText(/An idea/));
    fireEvent.change(within(drawer).getByLabelText("What happened?"), {
      target: { value: "Add a timer sound at two minutes." },
    });
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Send feedback" }),
    );
    await waitFor(() =>
      expect(s.send).toHaveBeenCalledWith({
        kind: "feature",
        message: "Add a timer sound at two minutes.",
        pagePath: "/events/PMK",
      }),
    );
    await within(drawer).findByRole("heading", { name: "Nothing sent yet" });
  });

  it("asks for a few words instead of sending an empty report", async () => {
    signedIn(true);
    const s = sink();
    renderWith(s);
    fireEvent.click(screen.getByRole("button", { name: "Open feedback" }));
    const drawer = await screen.findByRole("dialog", { name: "Send feedback" });
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Send feedback" }),
    );
    await within(drawer).findByText(/Add a few words/);
    expect(s.send).not.toHaveBeenCalled();
  });

  it("points a signed-out visitor to sign in or email, with no form", async () => {
    signedIn(false);
    renderWith(sink());
    fireEvent.click(screen.getByRole("button", { name: "Open feedback" }));
    const drawer = await screen.findByRole("dialog", { name: "Send feedback" });
    expect(within(drawer).getByRole("link", { name: /Sign in/ })).toBeTruthy();
    expect(within(drawer).queryByLabelText("What happened?")).toBeNull();
  });
});

describe("Report this term", () => {
  it("reports a term with term wording and its id", async () => {
    signedIn(true);
    const s = sink();
    renderWith(s, <ReportItemButton itemId="mkt-v-001" />);
    fireEvent.click(screen.getByRole("button", { name: "Report this term" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Report this term",
    });
    expect(within(dialog).queryByLabelText(/Wrong answer/)).toBeNull();
    fireEvent.click(within(dialog).getByLabelText("The term is unclear"));
    fireEvent.change(within(dialog).getByLabelText("Anything to add?"), {
      target: { value: "Two meanings" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Send report" }),
    );
    await waitFor(() =>
      expect(s.send).toHaveBeenCalledWith({
        kind: "vocab_issue",
        message: "The term is unclear: Two meanings",
        pagePath: "/events/PMK",
        questionId: "mkt-v-001",
      }),
    );
  });
});
