// Types for validate.mjs, so TypeScript code in src/ (the owner console's import screen) can run the same content
// rules as the build: import { validateDocument } from "../../../content/validate.mjs".

export type ContentKind =
  "events" | "exam" | "vocab" | "roleplay" | "official-samples";

export type CorpusEntry = { path: string; doc: unknown; parseError?: string };

export declare const EXAMS: Record<
  | "business-admin-core"
  | "business-management"
  | "entrepreneurship"
  | "finance"
  | "hospitality-tourism"
  | "marketing"
  | "personal-financial-literacy",
  { cluster: string; prefix: string }
>;
export declare const CLUSTERS: readonly string[];
export declare const COMPONENTS: readonly string[];
export declare const LICENCES: readonly string[];
export declare const STATUSES: readonly ["sourced", "placeholder"];
export declare const KEY_FROM: readonly ["source", "verified"];

/** True for a page DECA Inc. publishes (deca.org, decadirect.org, decaplus.org, DECA's CDN files, DECA's Issuu). */
export declare function isOfficialDecaUrl(url: unknown): boolean;

/** The content kind from the path inside content/ when known, else from the document's shape. */
export declare function kindOf(doc: unknown, path?: string): ContentKind | null;

/** Errors for one parsed document. */
export declare function validateDocument(
  doc: unknown,
  path?: string,
): { kind: ContentKind | null; errors: string[] };

/** Errors for a set of files: per-file rules, cross-file ids, role-play events vs events.json, the archive guard. */
export declare function validateCorpus(entries: CorpusEntry[]): string[];

/** Non-blocking advice (for example an uneven answer spread in a sourced bank). */
export declare function auditCorpus(entries: CorpusEntry[]): string[];
