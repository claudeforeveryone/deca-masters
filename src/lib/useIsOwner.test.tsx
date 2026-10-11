import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isPlatformOwner } from "../api/owner";
import { useAuth } from "./auth";
import { resetOwnerChecks, useIsOwner } from "./useIsOwner";

// Seams: the server's answer (api/owner) and the signed-in user (auth).
vi.mock("../api/owner", () => ({ isPlatformOwner: vi.fn() }));
vi.mock("./auth", () => ({ useAuth: vi.fn() }));
const check = vi.mocked(isPlatformOwner);
const auth = vi.mocked(useAuth);

function signedIn(id: string | null, loading = false) {
  auth.mockReturnValue({
    loading,
    user: id ? { id } : null,
  } as unknown as ReturnType<typeof useAuth>);
}

function Probe({ name = "probe" }: { name?: string }) {
  return <p data-testid={name}>{useIsOwner()}</p>;
}

afterEach(() => {
  check.mockReset();
  auth.mockReset();
  resetOwnerChecks();
});

describe("useIsOwner", () => {
  it("is denied for a signed-out visitor without asking the server", () => {
    signedIn(null);
    render(<Probe />);
    expect(screen.getByTestId("probe").textContent).toBe("denied");
    expect(check).not.toHaveBeenCalled();
  });

  it("waits while the session is still loading", () => {
    signedIn(null, true);
    render(<Probe />);
    expect(screen.getByTestId("probe").textContent).toBe("checking");
  });

  it("follows the server's answer and asks once for every caller", async () => {
    signedIn("u1");
    check.mockResolvedValue(true);
    render(
      <>
        <Probe name="a" />
        <Probe name="b" />
      </>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("a").textContent).toBe("owner"),
    );
    expect(screen.getByTestId("b").textContent).toBe("owner");
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("reports a failed check and asks again next time", async () => {
    signedIn("u1");
    check.mockRejectedValueOnce(new Error("offline"));
    const first = render(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId("probe").textContent).toBe("error"),
    );
    first.unmount();
    check.mockResolvedValueOnce(false);
    render(<Probe />);
    await waitFor(() =>
      expect(screen.getByTestId("probe").textContent).toBe("denied"),
    );
    expect(check).toHaveBeenCalledTimes(2);
  });
});
