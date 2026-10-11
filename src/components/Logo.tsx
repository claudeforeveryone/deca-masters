// DECA wordmark (from deca.org) + "Masters". DECA's logo is a trademark: confirm
// your chapter is allowed to use it before launching publicly.
export default function Logo({ inverse }: { inverse?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      {inverse ? (
        <img src="/deca-logo-white.svg" alt="DECA" className="h-[22px] w-auto" />
      ) : (
        <>
          <img src="/deca-logo-blue.svg" alt="DECA" className="h-[22px] w-auto dark:hidden" />
          <img src="/deca-logo-white.svg" alt="DECA" className="hidden h-[22px] w-auto dark:block" />
        </>
      )}
      <span className={`h-5 w-px ${inverse ? 'bg-white/30' : 'bg-line-strong'}`} aria-hidden />
      <span className={`text-[13px] font-bold uppercase tracking-[0.14em] ${inverse ? 'text-white' : 'text-navy'}`}>Masters</span>
    </span>
  )
}
