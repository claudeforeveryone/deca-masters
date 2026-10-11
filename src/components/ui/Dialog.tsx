import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { IconButton } from "./Button";

type Shared = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Actions, right-aligned at the bottom (primary last). */
  footer?: ReactNode;
};

/**
 * Native <dialog> opened with showModal(): the page behind is inert, focus starts inside, Escape and a press on the
 * scrim close it, and focus returns to whatever opened it. The page does not scroll underneath.
 */
function useModal(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      opener.current = document.activeElement as HTMLElement | null;
      if (typeof el.showModal === "function") el.showModal();
      else el.setAttribute("open", "");
      document.documentElement.style.overflow = "hidden";
    } else if (!open && el.open) {
      if (typeof el.close === "function") el.close();
      else el.removeAttribute("open");
    }
    if (!open) {
      document.documentElement.style.overflow = "";
      opener.current?.focus?.();
      opener.current = null;
    }
  }, [open]);

  useEffect(
    () => () => {
      document.documentElement.style.overflow = "";
    },
    [],
  );

  const handlers = {
    // Escape: keep React in charge of the open state.
    onCancel: (e: SyntheticEvent) => {
      e.preventDefault();
      onClose();
    },
    // A press on the dialog element itself (not its panel) is a press on the scrim.
    onMouseDown: (e: MouseEvent<HTMLDialogElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
  };
  return { ref, handlers };
}

function Header({
  title,
  titleId,
  description,
  descId,
  onClose,
}: {
  title: string;
  titleId: string;
  description?: ReactNode;
  descId: string;
  onClose: () => void;
}) {
  return (
    <header className="flex items-start gap-4 border-b border-line px-5 pt-4 pb-4 sm:px-6">
      <div className="min-w-0 flex-1 pt-1.5">
        <h2 id={titleId} className="text-title">
          {title}
        </h2>
        {description ? (
          <div id={descId} className="mt-1.5 text-ink-2">
            {description}
          </div>
        ) : null}
      </div>
      <IconButton
        label="Close"
        icon={<X aria-hidden="true" />}
        onClick={onClose}
        className="-mr-2"
      />
    </header>
  );
}

const SURFACE =
  "border border-line bg-surface p-0 text-ink shadow-dialog backdrop:bg-scrim open:backdrop:motion-safe:animate-[scrim-in_var(--dur-3)_var(--ease-out)]";

/** A centred modal for a task that needs protected focus (confirm, short form). Not for content a page could hold. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: Shared & { size?: "sm" | "md" | "lg" }) {
  const { ref, handlers } = useModal(open, onClose);
  const titleId = useId();
  const descId = useId();
  const width =
    size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-xl";
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      {...handlers}
      className={`${SURFACE} m-auto w-[calc(100%-2rem)] ${width} max-h-[calc(100dvh-2rem)] rounded open:motion-safe:animate-[overlay-in_var(--dur-3)_var(--ease-out)]`}
    >
      {open ? (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <Header
            title={title}
            titleId={titleId}
            description={description}
            descId={descId}
            onClose={onClose}
          />
          {children ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {children}
            </div>
          ) : null}
          {footer ? (
            <footer className="flex flex-wrap justify-end gap-3 border-t border-line px-5 py-4 sm:px-6">
              {footer}
            </footer>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}

/** A side sheet: from the right on wider screens, from the bottom on phones. Filters, details, secondary flows. */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: Shared) {
  const { ref, handlers } = useModal(open, onClose);
  const titleId = useId();
  const descId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      {...handlers}
      className={`${SURFACE} mx-0 mt-auto mb-0 max-h-[88dvh] w-full max-w-none rounded-t open:motion-safe:animate-[drawer-in-bottom_var(--dur-4)_var(--ease-out)] sm:my-0 sm:mr-0 sm:ml-auto sm:h-dvh sm:max-h-none sm:w-[min(28rem,100%)] sm:rounded-none sm:open:motion-safe:animate-[drawer-in-right_var(--dur-4)_var(--ease-out)]`}
    >
      {open ? (
        <div className="flex h-full max-h-[88dvh] flex-col sm:max-h-none">
          <Header
            title={title}
            titleId={titleId}
            description={description}
            descId={descId}
            onClose={onClose}
          />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {children}
          </div>
          {footer ? (
            <footer className="flex flex-wrap justify-end gap-3 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
              {footer}
            </footer>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
