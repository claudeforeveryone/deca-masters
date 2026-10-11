// Helpers shared by the practice, run and review pages.
import { useLayoutEffect, useRef } from "react";
import { useNavigationType } from "react-router-dom";
import { bankSummary, type BankExam } from "../../api/questions";
import { CLUSTERS, type ClusterSlug } from "../../lib/content";
import { MODES } from "../../lib/practiceModes";
import type { RunKind } from "../../api/practice";

let bank: Promise<BankExam[]> | null = null;

/** The bank summary, fetched once per visit (pass fresh to refetch, as the practice page does on every open). */
export function loadBank(fresh = false): Promise<BankExam[]> {
  if (!bank || fresh)
    bank = bankSummary().catch((e: unknown) => {
      bank = null;
      throw e;
    });
  return bank;
}

/** "Finance Cluster Exam" -> "Finance", "Personal Financial Literacy Exam" -> "Personal Financial Literacy". */
export const shortExamTitle = (title: string) =>
  title.replace(/(\s+(cluster|exam))+$/i, "");

export const asCluster = (
  c: string | null | undefined,
): ClusterSlug | undefined =>
  c && c in CLUSTERS ? (c as ClusterSlug) : undefined;

/** What a run is called in lists: its label, or its mode's name. */
export function runName(kind: RunKind, label: string | null): string {
  if (label) return label;
  return MODES.find((m) => m.kind === kind)?.name ?? "Practice";
}

const DATE = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "Oct 11, 2:40 p.m." in the visitor's own time zone. */
export const when = (iso: string) => DATE.format(new Date(iso));

/** The exam's display title from the bank, or a readable fallback built from its slug. */
export function examTitle(
  slug: string | null,
  exams: BankExam[] | null,
): string {
  if (!slug) return "Every exam";
  const hit = exams?.find((e) => e.exam === slug);
  if (hit) return shortExamTitle(hit.title);
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * The shell keeps the window's scroll across routes, so a page opened from far down another one
 * (Start sits at the bottom of the practice page) would open at its footer. Start at the top,
 * except on back and forward, where the browser keeps its own place.
 */
export function useTopOnArrival() {
  const how = useRef(useNavigationType());
  useLayoutEffect(() => {
    if (how.current !== "POP") window.scrollTo(0, 0);
  }, []);
}
