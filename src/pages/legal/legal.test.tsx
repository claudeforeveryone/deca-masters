import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PrivacyPage } from "./PrivacyPage";
import { TermsPage } from "./TermsPage";

const pages = [
  ["Privacy Policy", PrivacyPage],
  ["Terms of Use", TermsPage],
] as const;

describe.each(pages)("%s", (title, Page) => {
  const renderPage = () =>
    render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    );

  it("states the effective date, the missing lawyer review and the contact", () => {
    renderPage();
    screen.getByRole("heading", { level: 1, name: title });
    expect(screen.getByText("October 11, 2026").getAttribute("datetime")).toBe(
      "2026-10-11",
    );
    expect(document.body.textContent).toMatch(/not been reviewed by a lawyer/);
    expect(
      screen
        .getAllByRole("link", { name: "josephislockedin@gmail.com" })[0]
        .getAttribute("href"),
    ).toBe("mailto:josephislockedin@gmail.com");
  });

  it("says it is not affiliated with or endorsed by DECA Inc.", () => {
    renderPage();
    expect(document.body.textContent).toMatch(
      /not affiliated with,? (or endorsed by|endorsed by,? or sponsored by) DECA Inc/,
    );
  });

  it("links every contents entry to a section on the page", () => {
    renderPage();
    const nav = screen.getByRole("navigation", { name: "Contents" });
    const links = within(nav).getAllByRole("link");
    expect(links.length).toBeGreaterThan(5);
    for (const a of links) {
      const id = a.getAttribute("href")!.slice(1);
      expect(document.getElementById(id), id).not.toBeNull();
    }
  });
});

describe("privacy specifics", () => {
  it("explains the login shared with the FBLA site and how to delete data", () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    );
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/shared with our FBLA practice site/);
    expect(text).toMatch(/Delete your DECA data/);
    expect(text).toMatch(/13 months/);
    expect(text).toMatch(/PIPEDA/);
    expect(text).toMatch(/under 13/i);
  });

  it("points to the delete control in settings, which works at once, as well as email", () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    );
    const links = [...document.querySelectorAll("a")].map((a) =>
      a.getAttribute("href"),
    );
    expect(links).toContain("/me/settings#delete");
    expect(links).toContain("mailto:josephislockedin@gmail.com");
    expect(document.body.textContent).not.toMatch(/until you ask us to delete/);
  });
});
