import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { useLiveSearchParams } from "./useLiveSearchParams";

type Api = ReturnType<typeof useLiveSearchParams> & {
  navigate: ReturnType<typeof useNavigate>;
};

function Harness({ expose }: { expose: (api: Api) => void }) {
  const api = useLiveSearchParams();
  const navigate = useNavigate();
  const loc = useLocation();
  expose({ ...api, navigate });
  return <output data-testid="loc">{loc.search}</output>;
}

function setup(path = "/events") {
  let api!: Api;
  render(
    <MemoryRouter initialEntries={[path]}>
      <Harness expose={(a) => (api = a)} />
    </MemoryRouter>,
  );
  return () => api;
}

/** One click: read the URL as it stands, add a key, write it back. */
function click(api: Api, key: string, value: string) {
  const next = api.read();
  next.set(key, value);
  api.write(next);
}

describe("useLiveSearchParams", () => {
  it("lets a second write build on a first that has not rendered yet", () => {
    const api = setup();
    // Both clicks use the handlers from one render, as two quick clicks before a re-render do.
    const rendered = api();
    act(() => {
      click(rendered, "compare", "PFL");
      click(rendered, "cluster", "finance");
    });
    expect(screen.getByTestId("loc").textContent).toBe(
      "?compare=PFL&cluster=finance",
    );
  });

  it("reads what is rendered once writes have caught up", () => {
    const api = setup("/events?q=tax");
    expect(api().read().get("q")).toBe("tax");
    act(() => click(api(), "q", "loans"));
    expect(api().read().toString()).toBe("q=loans");
    expect(api().params.get("q")).toBe("loans");
  });

  it("lets the URL moving on its own win over older writes", () => {
    const api = setup("/events?q=tax");
    act(() => click(api(), "q", "loans"));
    act(() => api().navigate("/events?cluster=marketing"));
    expect(api().read().toString()).toBe("cluster=marketing");
  });
});
