// Development only: every primitive in src/components/ui, in each state, for building and reviewing the kit.
// App.tsx registers this route only when import.meta.env.DEV is true, so production has no route and no chunk for it.
// The sample text here is filler for layout, never content: it does not ship.
import {
  Bell,
  CircleHelp,
  Download,
  LogOut,
  Settings,
  SlidersHorizontal,
  User,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, IconButton } from "../../components/ui/Button";
import { Card, CardLink } from "../../components/ui/Card";
import {
  BarList,
  LineChart,
  Sparkline,
} from "../../components/ui/charts/Charts";
import { Combobox } from "../../components/ui/Combobox";
import { CommandPalette } from "../../components/ui/CommandPalette";
import { Dialog, Drawer } from "../../components/ui/Dialog";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Field, TextArea } from "../../components/ui/Field";
import { Checkbox, SearchField, Select } from "../../components/ui/Inputs";
import {
  Breadcrumbs,
  FilterChips,
  StatRow,
  StatTile,
} from "../../components/ui/Navigation";
import { Menu, Popover } from "../../components/ui/Popover";
import {
  ProgressBar,
  ProgressRing,
  TickProgress,
} from "../../components/ui/Progress";
import { Skeleton, SkeletonText } from "../../components/ui/Skeleton";
import {
  Table,
  TableFrame,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  type SortDirection,
} from "../../components/ui/Table";
import { Tabs } from "../../components/ui/Tabs";
import { FacetMarker, Kbd, Tag } from "../../components/ui/Tag";
import { useToast } from "../../components/ui/Toast";
import { Tooltip } from "../../components/ui/Tooltip";

function Block({
  id,
  title,
  children,
  stage = false,
}: {
  id: string;
  title: string;
  children: ReactNode;
  stage?: boolean;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className={`border-t py-10 ${stage ? "stage -mx-(--gutter) border-stage-line px-(--gutter)" : "border-line"}`}
    >
      <h2 id={`${id}-h`} className="text-title">
        {title}
      </h2>
      <div className="mt-6 grid gap-6">{children}</div>
    </section>
  );
}

const ROWS = [
  { code: "AAA", name: "Sample row one", value: 12 },
  { code: "BBB", name: "Sample row two", value: 7 },
  { code: "CCC", name: "Sample row three", value: 19 },
];

export function UiGalleryPage() {
  const { toast } = useToast();
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [combo, setCombo] = useState<string | null>(null);
  const [chips, setChips] = useState<string[]>(["a"]);
  const [multi, setMulti] = useState<string[]>([]);
  const [sort, setSort] = useState<SortDirection>("ascending");
  const [theme, setTheme] = useState("system");
  const [search, setSearch] = useState("");
  const rows = [...ROWS].sort((a, b) =>
    sort === "descending" ? b.value - a.value : a.value - b.value,
  );

  return (
    <div>
      <h1 className="text-display">UI kit</h1>
      <p className="mt-3 max-w-(--measure) text-ink-2">
        Development only. Every primitive in its states. Not in the production
        build.
      </p>

      <Block id="buttons" title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="quiet">Quiet</Button>
          <Button variant="danger">Danger</Button>
          <Button busy>Saving</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Tooltip content="Download">
            <IconButton label="Download" icon={<Download />} />
          </Tooltip>
        </div>
      </Block>

      <Block id="stage-buttons" title="On the stage" stage>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="onNavy">On navy</Button>
          <Button variant="onNavyOutline">On navy outline</Button>
          <IconButton label="Notifications" tone="onNavy" icon={<Bell />} />
          <Tag tone="stage">Stage tag</Tag>
        </div>
        <Tabs
          label="Stage tabs"
          tone="stage"
          tabs={[
            {
              id: "one",
              label: "First",
              panel: <p className="pt-4">Panel one</p>,
            },
            {
              id: "two",
              label: "Second",
              panel: <p className="pt-4">Panel two</p>,
            },
          ]}
        />
        <StatRow tone="stage">
          <StatTile tone="stage" label="Label" value="42" unit="%" />
          <StatTile tone="stage" label="Label" value="7" caption="Caption" />
        </StatRow>
        <Skeleton tone="stage" className="h-10 w-64" />
      </Block>

      <Block id="inputs" title="Inputs">
        <div className="grid max-w-xl gap-5">
          <Field label="Text field" hint="A hint under the label." />
          <Field
            label="With an error"
            error="Say what went wrong and how to fix it."
          />
          <TextArea label="Text area" rows={3} />
          <Select
            label="Select"
            options={[
              { value: "a", label: "Option A" },
              { value: "b", label: "Option B" },
            ]}
          />
          <Checkbox label="Checkbox" hint="With a hint." />
          <SearchField
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
            shortcut="/"
          />
          <Combobox
            label="Combobox"
            value={combo}
            onChange={setCombo}
            options={[
              { value: "1", label: "First option", code: "AAA" },
              { value: "2", label: "Second option", code: "BBB" },
              { value: "3", label: "Third option", code: "CCC" },
            ]}
          />
        </div>
      </Block>

      <Block
        id="overlays"
        title="Dialog, drawer, popover, menu, palette, toast"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => setDialog(true)}>
            Open dialog
          </Button>
          <Button variant="secondary" onClick={() => setDrawer(true)}>
            <SlidersHorizontal aria-hidden="true" className="size-4.5" />
            Open drawer
          </Button>
          <Popover
            label="Popover"
            trigger={(p) => (
              <Button variant="secondary" {...p}>
                <CircleHelp aria-hidden="true" className="size-4.5" />
                Popover
              </Button>
            )}
          >
            {(close) => (
              <div className="grid max-w-64 gap-3 p-2">
                <p className="text-sm text-ink-2">A small non-modal panel.</p>
                <Button size="sm" onClick={close}>
                  Close
                </Button>
              </div>
            )}
          </Popover>
          <Menu
            label="Account"
            trigger={(p) => (
              <Button variant="secondary" {...p}>
                <User aria-hidden="true" className="size-4.5" />
                Menu
              </Button>
            )}
            items={[
              { kind: "heading", label: "Signed in as someone" },
              {
                kind: "link",
                label: "Settings",
                to: "/me/settings",
                icon: <Settings />,
              },
              { kind: "separator" },
              {
                kind: "radio",
                label: "System",
                checked: theme === "system",
                onSelect: () => setTheme("system"),
              },
              {
                kind: "radio",
                label: "Light",
                checked: theme === "light",
                onSelect: () => setTheme("light"),
              },
              {
                kind: "radio",
                label: "Dark",
                checked: theme === "dark",
                onSelect: () => setTheme("dark"),
              },
              { kind: "separator" },
              {
                kind: "action",
                label: "Sign out",
                onSelect: () => {},
                icon: <LogOut />,
                tone: "danger",
              },
            ]}
          />
          <Button variant="secondary" onClick={() => setPalette(true)}>
            Command palette <Kbd>Ctrl K</Kbd>
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast({ message: "Saved.", tone: "success" })}
          >
            Toast
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast({
                message: "That did not save.",
                tone: "error",
                action: { label: "Retry", onClick: () => {} },
              })
            }
          >
            Error toast
          </Button>
        </div>
        <Dialog
          open={dialog}
          onClose={() => setDialog(false)}
          title="Dialog title"
          description="What this dialog is for, in one line."
          footer={
            <>
              <Button variant="secondary" onClick={() => setDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => setDialog(false)}>Confirm</Button>
            </>
          }
        >
          <Field label="A field inside" />
        </Dialog>
        <Drawer
          open={drawer}
          onClose={() => setDrawer(false)}
          title="Drawer title"
          footer={<Button onClick={() => setDrawer(false)}>Done</Button>}
        >
          <FilterChips
            label="Multiple"
            multiple
            chips={[
              { id: "x", label: "One" },
              { id: "y", label: "Two" },
            ]}
            value={multi}
            onChange={setMulti}
          />
        </Drawer>
        <CommandPalette
          open={palette}
          onClose={() => setPalette(false)}
          commands={[
            { id: "a", label: "Go to events", group: "Pages", run: () => {} },
            { id: "b", label: "Go to practice", group: "Pages", run: () => {} },
            {
              id: "c",
              label: "Switch to dark",
              group: "Actions",
              run: () => {},
            },
          ]}
        />
      </Block>

      <Block id="navigation" title="Breadcrumbs, chips, tags">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: "Section", to: "/dev/ui" },
            { label: "Here" },
          ]}
        />
        <FilterChips
          label="Single choice"
          chips={[
            { id: "a", label: "Alpha", count: 12, cluster: "marketing" },
            { id: "b", label: "Beta", count: 8, cluster: "finance" },
            { id: "c", label: "Gamma", count: 3 },
          ]}
          value={chips}
          onChange={setChips}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Tag>Neutral</Tag>
          <Tag tone="accent">Accent</Tag>
          <Tag tone="good">Good</Tag>
          <Tag tone="warn">Warn</Tag>
          <Tag tone="bad">Bad</Tag>
          <Tag mono cluster="entrepreneurship">
            ABC
          </Tag>
          <FacetMarker cluster="hospitality-tourism" />
          <FacetMarker tone="electric" />
        </div>
      </Block>

      <Block id="data" title="Cards, table, stats, progress, charts">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="text-title">Card</h3>
            <p className="mt-2 text-ink-2">One thing per card.</p>
          </Card>
          <CardLink to="/dev/ui" title="Card link" meta="Meta line">
            The whole card is one link.
          </CardLink>
        </div>
        <TableFrame label="Sample table">
          <Table>
            <THead>
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th
                  numeric
                  sort={sort}
                  onSort={() =>
                    setSort((s) =>
                      s === "ascending" ? "descending" : "ascending",
                    )
                  }
                >
                  Value
                </Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <Tr key={r.code}>
                  <Td code>{r.code}</Td>
                  <Td>{r.name}</Td>
                  <Td numeric>{r.value}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableFrame>
        <StatRow>
          <StatTile
            label="Label"
            value="64"
            unit="%"
            delta={{ value: "5", direction: "up", good: true }}
          />
          <StatTile label="Label" value="12" caption="Caption" />
          <StatTile
            label="Label"
            value="3"
            delta={{ value: "1", direction: "down", good: false }}
          />
        </StatRow>
        <div className="flex flex-wrap items-center gap-8">
          <ProgressRing value={64} label="Ring" valueText="64 of 100">
            <span className="font-mono text-xl font-semibold">64</span>
          </ProgressRing>
          <div className="grid w-72 gap-4">
            <ProgressBar value={23} max={100} label="Bar" />
            <ProgressBar value={70} label="Electric" tone="electric" />
            <TickProgress done={4} total={7} label="Ticks" />
          </div>
          <Sparkline values={[3, 5, 4, 7, 6, 9]} label="Sample trend, 3 to 9" />
        </div>
        <LineChart
          label="Line chart"
          description="Sample series for layout."
          data={[40, 52, 49, 61, 66, 72].map((y, i) => ({ x: `P${i + 1}`, y }))}
          yMin={0}
          yMax={100}
        />
        <BarList
          label="Bar list"
          data={[
            { label: "First", value: 80 },
            { label: "Second", value: 55 },
            { label: "Third", value: 30 },
          ]}
          max={100}
        />
      </Block>

      <Block id="states" title="Loading, empty, error">
        <SkeletonText lines={3} />
        <EmptyState
          title="Nothing here yet"
          body="Say what is missing and the one useful next step."
          action={<Button>Do the next step</Button>}
        />
        <ErrorState
          body="Say what failed and how to recover."
          onRetry={() => {}}
        />
      </Block>
    </div>
  );
}
