/**
 * The site's own mark: a blue block with an electric baseline (same as the favicon), then the name. It is not DECA's
 * diamond and must not become one: DECA's logo and trade dress are reserved for chartered associations and chapters.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0">
        <rect width="16" height="16" fill="var(--deca-blue)" />
        <rect y="11" width="16" height="5" fill="var(--electric)" />
      </svg>
      <span className="font-display text-[1.3rem] leading-none font-bold tracking-[-0.01em] whitespace-nowrap">
        DECA <span className="text-electric-text">Masters</span>
      </span>
    </span>
  );
}
