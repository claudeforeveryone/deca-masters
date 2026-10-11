import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  primeContent,
  resetContentCache,
  type ContentIndex,
} from "../../lib/content";
import { RouteMeta } from "./RouteMeta";

const INDEX = {
  events: [
    {
      code: "PMK",
      name: "Principles of Marketing",
      summary: "Fixture summary.",
      cluster: "marketing",
    },
  ],
  exams: [],
  vocab: [],
  roleplays: [],
} as unknown as ContentIndex;

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <RouteMeta />
    </MemoryRouter>,
  );

afterEach(() => {
  resetContentCache();
  vi.unstubAllGlobals();
  document.title = "";
  document.head.innerHTML = "";
});

describe("RouteMeta", () => {
  it("names a static page at once", () => {
    at("/privacy");
    expect(document.title).toBe("Privacy Policy | DECA Masters");
  });

  it("names an event page from the cached index", async () => {
    primeContent("index.json", INDEX);
    at("/events/PMK");
    await waitFor(() =>
      expect(document.title).toBe(
        "Principles of Marketing (PMK) | DECA Masters",
      ),
    );
  });

  it("never flashes 'not found' or noindex while the index loads", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    document.title = "Principles of Marketing (PMK) | DECA Masters";
    at("/events/PMK");
    expect(document.title).toBe("Principles of Marketing (PMK) | DECA Masters");
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });
});
