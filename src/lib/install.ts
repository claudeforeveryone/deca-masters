// "Install the app": browsers that support it fire beforeinstallprompt once, early, when the site qualifies (manifest,
// icons, a service worker). We keep that event so the command palette can offer a real "Install DECA Masters" action
// later, and report only what the taxonomy allows (install_prompt_shown with its outcome, app_installed).
// Browsers without the event (Safari, Firefox desktop) never see the action: there is nothing fake to click.

type InstallEvent = "install_prompt_shown" | "app_installed";
type Report = (
  name: InstallEvent,
  meta?: { source?: string; outcome?: string },
) => void;

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

export type Install = {
  available(): boolean;
  subscribe(fn: () => void): () => void;
  /** Shows the browser's own install prompt. `source` is a short token for analytics ("palette"). */
  prompt(source?: string): Promise<InstallOutcome>;
};

export function createInstall(target: EventTarget, report: Report): Install {
  let deferred: PromptEvent | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((fn) => fn());

  target.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
    notify();
  });
  target.addEventListener("appinstalled", () => {
    deferred = null;
    report("app_installed", undefined);
    notify();
  });

  return {
    available: () => deferred !== null,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async prompt(source = "palette") {
      const e = deferred;
      if (!e) return "unavailable";
      // A prompt event can be used once.
      deferred = null;
      notify();
      try {
        await e.prompt();
        const { outcome } = await e.userChoice;
        report("install_prompt_shown", { source, outcome });
        return outcome;
      } catch {
        return "unavailable";
      }
    },
  };
}
