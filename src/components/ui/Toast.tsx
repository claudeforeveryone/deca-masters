import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  dismissToast,
  pushToast,
  type ToastItem,
  type ToastTone,
} from "./toastQueue";

type ToastApi = {
  /** Shows a short confirmation or a transient problem. Returns the id (pass `id` to replace an earlier toast). */
  toast: (t: {
    message: string;
    tone?: ToastTone;
    id?: string;
    action?: ToastItem["action"];
  }) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS = 5000;
let counter = 0;

const ICONS = {
  info: { Icon: Info, cls: "text-electric-text" },
  success: { Icon: CircleCheck, cls: "text-good" },
  warn: { Icon: TriangleAlert, cls: "text-warn" },
  error: { Icon: CircleAlert, cls: "text-bad" },
} as const;

/**
 * Toasts are for transient news only (saved, copied, could not reach the server). Errors a person must fix stay
 * inline next to the field. Polite live region (errors assertive), at most three, auto-dismiss after 5s, paused
 * while hovered or focused.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const [paused, setPaused] = useState(false);

  const dismiss = useCallback(
    (id: string) => setQueue((q) => dismissToast(q, id)),
    [],
  );
  const toast = useCallback<ToastApi["toast"]>(
    ({ message, tone = "info", id, action }) => {
      const key = id ?? `t${++counter}`;
      setQueue((q) => pushToast(q, { id: key, message, tone, action }));
      return key;
    },
    [],
  );

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+0.75rem)] z-(--z-toast) flex flex-col items-center gap-2 px-4 md:right-6 md:bottom-6 md:left-auto md:items-end"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        {/* Two live regions so an error interrupts and a confirmation waits its turn. Plain aria-live, no status or
            alert role: an empty region with a role would sit in the accessibility tree on every page. Not
            display: contents either, which drops a live region from the tree in some browsers. */}
        <div
          aria-live="polite"
          className="flex flex-col items-center gap-2 md:items-end"
        >
          {queue
            .filter((t) => t.tone !== "error")
            .map((t) => (
              <ToastView key={t.id} t={t} paused={paused} onDismiss={dismiss} />
            ))}
        </div>
        <div
          aria-live="assertive"
          className="flex flex-col items-center gap-2 md:items-end"
        >
          {queue
            .filter((t) => t.tone === "error")
            .map((t) => (
              <ToastView key={t.id} t={t} paused={paused} onDismiss={dismiss} />
            ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({
  t,
  paused,
  onDismiss,
}: {
  t: ToastItem;
  paused: boolean;
  onDismiss: (id: string) => void;
}) {
  const left = useRef(AUTO_DISMISS_MS);
  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = window.setTimeout(() => onDismiss(t.id), left.current);
    return () => {
      window.clearTimeout(timer);
      left.current = Math.max(800, left.current - (Date.now() - started));
    };
  }, [paused, t.id, onDismiss]);

  const { Icon, cls } = ICONS[t.tone];
  return (
    <div className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded border border-stage-line bg-navy-deep py-3 pr-2 pl-4 text-on-navy shadow-overlay motion-safe:animate-[overlay-in_var(--dur-3)_var(--ease-out)]">
      <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${cls}`} />
      <p className="min-w-0 flex-1 pt-px">{t.message}</p>
      {t.action ? (
        <button
          type="button"
          onClick={() => {
            t.action?.onClick();
            onDismiss(t.id);
          }}
          className="min-h-9 shrink-0 rounded-xs px-2 font-semibold text-electric-text hover:bg-white/8"
        >
          {t.action.label}
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDismiss(t.id)}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-xs text-on-navy-2 hover:bg-white/8 hover:text-on-navy"
      >
        <X aria-hidden="true" className="size-4.5" />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
