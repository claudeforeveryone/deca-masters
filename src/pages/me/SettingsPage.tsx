import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { PagePlaceholder } from "../../components/layout/PagePlaceholder";
import { Panel } from "../../components/ui/Panel";
import { useThemePref, type ThemePref } from "../../lib/theme";

const OPTIONS: { value: ThemePref; label: string; Icon: LucideIcon }[] = [
  { value: "system", label: "Match my device", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

export function SettingsPage() {
  const [theme, setTheme] = useThemePref();
  return (
    <PagePlaceholder
      title="Settings"
      lede="Appearance, email preferences, your password and deleting your account."
      status="Email preferences, password changes and account deletion are being rebuilt. Appearance works now."
    >
      <Panel aria-labelledby="appearance-heading" className="mt-4">
        <h2 id="appearance-heading" className="text-2xl">
          Appearance
        </h2>
        <p className="mt-2 text-ink-2">Saved on this device only.</p>
        <fieldset className="mt-5">
          <legend className="sr-only">Theme</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {OPTIONS.map(({ value, label, Icon }) => (
              <label
                key={value}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border border-line px-4 py-3 transition-colors duration-(--dur-1) hover:border-line-strong has-checked:border-accent has-checked:bg-surface-2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
              >
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={theme === value}
                  onChange={() => setTheme(value)}
                  className="sr-only"
                />
                <Icon aria-hidden="true" className="size-5 text-ink-2" />
                <span className="font-semibold">{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </Panel>
    </PagePlaceholder>
  );
}
