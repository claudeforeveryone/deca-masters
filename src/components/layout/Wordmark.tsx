/**
 * The site's own mark, set like the original DECA Masters lockup: "DECA", a hairline, then "MASTERS" in spaced caps.
 * It is type only, never DECA's diamond logo: DECA's logo and trade dress are reserved for chartered associations and
 * chapters. Colours follow the surrounding text, with "DECA" in the accent on light surfaces.
 */
export function Wordmark({
  className = "",
  inverse = false,
}: {
  className?: string;
  inverse?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className={`text-[1.25rem] leading-none font-extrabold tracking-[-0.03em] ${inverse ? "text-white" : "text-link"}`}
      >
        DECA
      </span>
      <span
        aria-hidden="true"
        className={`h-5 w-px ${inverse ? "bg-white/30" : "bg-line-strong"}`}
      />
      <span
        className={`text-[0.8125rem] leading-none font-bold tracking-[0.14em] uppercase ${inverse ? "text-white" : "text-ink"}`}
      >
        Masters
      </span>
    </span>
  );
}
