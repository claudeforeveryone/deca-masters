// Placeholder mark. Swap for the official DECA logo only with permission.
export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#0B1F3A" />
      <rect x="9" y="9" width="14" height="14" rx="2" transform="rotate(45 16 16)" fill="#0B6FCB" />
      <rect x="13" y="13" width="6" height="6" rx="1" transform="rotate(45 16 16)" fill="#fff" />
    </svg>
  )
}
