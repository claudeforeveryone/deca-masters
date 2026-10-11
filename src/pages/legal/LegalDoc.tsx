// The frame for /terms and /privacy: one h1, the effective date and the "not lawyer-reviewed" note up front, a
// contents list (sticky beside the text on wide screens, a plain list above it on phones), and numbered sections at a
// reading measure. Plain HTML only, so the prerender ships the whole text.
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export const CONTACT_EMAIL = "josephislockedin@gmail.com";
export const EFFECTIVE = { iso: "2026-10-11", label: "October 11, 2026" };

export type LegalSection = { id: string; title: string; body: ReactNode };

/** A bulleted list inside a section. */
export function Bullets({ children }: { children: ReactNode }) {
  return (
    <ul className="grid list-disc gap-2 pl-5 marker:text-ink-3">{children}</ul>
  );
}

/** A term and what it means, for "what we collect" style lists. */
export function Defs({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-3">
      {items.map(([term, def]) => (
        <div key={term} className="grid gap-0.5">
          <dt className="font-semibold text-ink">{term}</dt>
          <dd>{def}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Mail() {
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
}

export function LegalDoc({
  title,
  lede,
  summary,
  sections,
  sibling,
}: {
  title: string;
  lede: string;
  /** The short version, in a few bullet points, before the full text. */
  summary: ReactNode[];
  sections: LegalSection[];
  sibling: { to: string; label: string };
}) {
  return (
    <article>
      <header className="border-b border-line pb-6">
        <h1 className="text-display">{title}</h1>
        <p className="mt-3 max-w-(--measure) text-lg text-ink-2">{lede}</p>
        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="text-ink-3">Effective</dt>
            <dd className="font-semibold">
              <time dateTime={EFFECTIVE.iso}>{EFFECTIVE.label}</time>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink-3">Reviewed by a lawyer</dt>
            <dd className="font-semibold">No</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink-3">Questions</dt>
            <dd>
              <Mail />
            </dd>
          </div>
        </dl>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-16">
        <div className="min-w-0 max-w-(--measure)">
          <section
            aria-labelledby="short-version"
            className="rounded border border-line bg-surface p-5 sm:p-6"
          >
            <h2 id="short-version" className="text-title">
              The short version
            </h2>
            <ul className="mt-4 grid list-disc gap-2 pl-5 text-ink-2 marker:text-ink-3">
              {summary.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>

          <nav aria-label="On this page" className="mt-10 lg:hidden">
            <Contents sections={sections} />
          </nav>

          <ol className="mt-10 grid gap-10">
            {sections.map((s, i) => (
              <li key={s.id}>
                <section
                  id={s.id}
                  aria-labelledby={`${s.id}-h`}
                  className="scroll-mt-[calc(var(--bar-h)+1.5rem)]"
                >
                  <h2 id={`${s.id}-h`} className="text-title">
                    <span className="mr-3 font-mono text-base font-normal text-ink-3 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {s.title}
                  </h2>
                  <div className="mt-4 grid gap-4 text-ink-2">
                    {s.body}
                  </div>
                </section>
              </li>
            ))}
          </ol>

          <p className="mt-12 border-t border-line pt-6 text-sm text-ink-3">
            See also the <Link to={sibling.to}>{sibling.label}</Link> and the{" "}
            <Link to="/credits">credits for every source</Link>.
          </p>
        </div>

        <nav aria-label="Contents" className="hidden lg:block">
          <div className="sticky top-[calc(var(--bar-h)+1.5rem)]">
            <Contents sections={sections} />
          </div>
        </nav>
      </div>
    </article>
  );
}

function Contents({ sections }: { sections: LegalSection[] }) {
  return (
    <>
      <p className="text-micro font-semibold tracking-wide text-ink-3 uppercase">
        On this page
      </p>
      <ol className="mt-3 grid gap-0.5 text-sm">
        {sections.map((s, i) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="flex min-h-9 items-baseline gap-2.5 py-1 text-ink-2 no-underline hover:text-ink hover:underline"
            >
              <span className="font-mono text-micro text-ink-3 tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              {s.title}
            </a>
          </li>
        ))}
      </ol>
    </>
  );
}
