import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

type Tone = "info" | "success" | "warn" | "error";

const TONES: Record<Tone, { box: string; icon: string; Icon: LucideIcon }> = {
  info: { box: "border-line bg-surface-2", icon: "text-link", Icon: Info },
  success: {
    box: "border-good/35 bg-good-surface",
    icon: "text-good",
    Icon: CircleCheck,
  },
  warn: {
    box: "border-warn/35 bg-warn-surface",
    icon: "text-warn",
    Icon: TriangleAlert,
  },
  error: {
    box: "border-bad/35 bg-bad-surface",
    icon: "text-bad",
    Icon: CircleAlert,
  },
};

/** A status or error message. Errors use role="alert" so screen readers announce them at once. */
export function Notice({
  tone = "info",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  const { box, icon, Icon } = TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex gap-3 rounded border p-4 text-ink ${box}`}
    >
      <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${icon}`} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
