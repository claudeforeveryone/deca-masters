// Placeholder diamond mark. Drop the official DECA logo at public/deca-logo.png
// (with chapter permission) and swap this component for an <img>.
export default function Logo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect x="10" y="10" width="44" height="44" rx="6" transform="rotate(45 32 32)" fill="#0072CE" />
      <rect x="18" y="18" width="28" height="28" rx="4" transform="rotate(45 32 32)" fill="#fff" />
      <rect x="24" y="24" width="16" height="16" rx="2" transform="rotate(45 32 32)" fill="#0A2342" />
    </svg>
  )
}
