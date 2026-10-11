import { afterEach, describe, expect, it, vi } from "vitest";
import {
  contentReads,
  loadContentIndex,
  peekContentIndex,
  primeContent,
  resetContentCache,
  type ContentIndex,
} from "./content";

const INDEX = {
  events: [],
  exams: [],
  vocab: [],
  roleplays: [],
} as unknown as ContentIndex;

afterEach(() => {
  resetContentCache();
  vi.unstubAllGlobals();
});

describe("content priming", () => {
  it("has nothing to peek before a load", () => {
    expect(peekContentIndex()).toBeNull();
  });

  it("serves primed data synchronously and to loaders, without fetching", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    primeContent("index.json", INDEX);
    expect(peekContentIndex()).toBe(INDEX);
    expect(await loadContentIndex()).toBe(INDEX);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("remembers a finished load, so a page mounted later renders it at once", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(INDEX))),
    );
    await loadContentIndex();
    expect(peekContentIndex()).toEqual(INDEX);
  });

  it("lists the files a render peeked at, for the prerender to embed", () => {
    primeContent("index.json", INDEX);
    peekContentIndex();
    expect(contentReads()).toEqual(["index.json"]);
    resetContentCache();
    expect(contentReads()).toEqual([]);
  });
});
