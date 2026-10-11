---
name: DECA Masters
description: Competition Terminal, an independent DECA practice tool on a navy stage with one electric edge light
colors:
  stage: "#071634"
  stage-deep: "#040a18"
  stage-raised: "#0c1f45"
  stage-line: "#1b2f57"
  stage-line-strong: "#5a74a2"
  navy: "#002d6b"
  deca-blue: "#0072ce"
  electric: "#008dff"
  electric-text: "#4dabff"
  on-navy: "#f2f6fc"
  on-navy-2: "#afbeda"
  on-stage-3: "#8fa3c6"
  canvas: "#f3f6fb"
  surface: "#ffffff"
  surface-2: "#e9f0f9"
  ink: "#0b1730"
  ink-2: "#364563"
  ink-3: "#56647f"
  line: "#d8e0ec"
  line-strong: "#78879f"
  link: "#0062b3"
  good: "#0a7a3d"
  bad: "#b71a31"
  warn: "#7d5200"
typography:
  hero:
    fontFamily: "Saira Semi Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "clamp(3rem, 1.5rem + 6.2vw, 6rem)"
    fontWeight: 700
    lineHeight: 0.92
    letterSpacing: "-0.02em"
  display:
    fontFamily: "Saira Semi Condensed, Arial Narrow, system-ui, sans-serif"
    fontWeight: 700
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Saira Semi Condensed, Arial Narrow, system-ui, sans-serif"
    fontWeight: 700
  body:
    fontFamily: "Instrument Sans Variable, system-ui, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  lead:
    fontFamily: "Instrument Sans Variable, system-ui, Segoe UI, sans-serif"
    fontSize: "1.1875rem"
  control:
    fontFamily: "Instrument Sans Variable, system-ui, Segoe UI, sans-serif"
    fontSize: "0.95rem"
  data:
    fontFamily: "JetBrains Mono Variable, ui-monospace, Consolas, monospace"
    fontFeature: "tnum"
rounded:
  control: "2px"
  card: "4px"
  max: "6px"
spacing:
  gutter-phone: "16px"
  gutter-tablet: "24px"
  gutter-desktop: "32px"
  shell-max: "76rem"
  bar: "56px"
  tabbar: "60px"
  section-y: "64px"
  section-y-wide: "96px"
components:
  button-primary:
    backgroundColor: "{colors.deca-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 20px"
  button-on-navy:
    backgroundColor: "{colors.on-navy}"
    textColor: "{colors.stage}"
    rounded: "{rounded.control}"
    height: "52px"
    padding: "0 24px"
  button-on-navy-outline:
    textColor: "{colors.on-navy}"
    rounded: "{rounded.control}"
    height: "52px"
    padding: "0 24px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "44px"
  tag:
    rounded: "{rounded.control}"
    height: "24px"
    padding: "0 8px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "24px"
  top-bar:
    backgroundColor: "{colors.stage}"
    textColor: "{colors.on-navy}"
    height: "56px"
---

# Design System: DECA Masters

## Overview

**Creative North Star: "The Competition Terminal"**

DECA Masters looks like the board at a competition: a deep navy stage, one electric edge light, refined white type, and
event codes as the primary keys of everything. The signed-out landing is the stage itself (navy in both colour
schemes) with a faceted metal structure of six cluster sectors, lit from inside through its seams; the app pages follow the visitor's
scheme in a refined white with navy-black ink, and the navy top bar and footer frame both.

Density is a program, not a dashboard: ruled rows, fixed columns that never move, mono for codes, timers and counts,
and plain sentence-case words for everything else. Motion is one authored moment (the hero's assembly and headline)
plus small state answers to what the visitor does. The system refuses the gradient hero with a device mock-up and a row
of three cards, glass as decoration, and anything that implies DECA Inc. made it (no DECA diamond logo, ever).

**Key Characteristics:**

- Navy stage (#071634 to #040a18) with a single electric accent; never a second accent hue.
- Corners from 2px (controls) to 6px (the ceiling); nothing rounder.
- The 45 degree facet square is the repeated unit: list marker, progress tick, cluster key, journey stop.
- Mono only for measured things: event codes, timers, scores, counts, routes.
- Illustrative numbers always carry an "Illustrative values" tag; empty data says so in words.

## Colors

One navy family, one electric light, and a refined white for the working pages.

### Primary

- **DECA Blue** (#0072ce): the one primary action per light view (buttons, the selected filter fill's partner), never decoration.
- **Electric** (#008dff): edge light on the stage: the tab underline, the selected cluster outline, chart lines and bars, focus on light surfaces, the 3D rim and sweep.
- **Electric Text** (#4dabff): electric as readable text on navy (7.3:1): event codes, times on the format board, stage links.

### Neutral

- **Stage** (#071634) / **Stage Deep** (#040a18) / **Stage Raised** (#0c1f45): the landing, the auth side panel, the top bar and footer. Deep for alternate bands and the closing scene; Raised for selected rows and panels on the stage.
- **Stage Line** (#1b2f57): decorative hairlines on navy. **Stage Line Strong** (#5a74a2): control boundaries on navy (3:1 or better).
- **On Navy** (#f2f6fc), **On Navy 2** (#afbeda), **On Stage 3** (#8fa3c6): primary, secondary and tertiary text on the stage.
- **Canvas** (#f3f6fb), **Surface** (#ffffff), **Surface 2** (#e9f0f9): the light working pages; Surface 2 is the quiet blue-tinted step for selected rows, wells and table heads.
- **Ink** (#0b1730), **Ink 2** (#364563), **Ink 3** (#56647f): navy-black text, never pure black.
- **Line** (#d8e0ec) does the structural work; **Line Strong** (#78879f) is for input borders.

### Named Rules

**The One Light Rule.** Electric is the only light source. It marks the selected, the focused and the live; it never fills large areas and never becomes a gradient behind text.

**The Cluster Key Rule.** DECA's cluster colours (finance #009b46, marketing #cc1d36, business management #f7bc00, entrepreneurship #7c8689, hospitality #0b74bf, personal finance #91c659) appear only as small facet markers, never as fills behind text.

## Typography

**Display Font:** Saira Semi Condensed (with Arial Narrow, system-ui)
**Body Font:** Instrument Sans Variable (with system-ui, Segoe UI)
**Label/Mono Font:** JetBrains Mono Variable (with ui-monospace, Consolas), always tabular

**Character:** a squared, slightly condensed display face with timetable and scoreboard energy over a sturdy reading sans; mono is reserved for the numbers and codes a competitor scans.

### Hierarchy

- **Hero** (700, clamp(3rem, 1.5rem + 6.2vw, 6rem), 0.92, -0.02em): the landing's H1 and the closing H2 only.
- **Display** (700, about 2.5 to 3.5rem): section headings and page titles.
- **Title** (700, about 1.5rem): card, panel and list headings.
- **Body** (400, 1rem, about 1.5): reading text, capped near 68ch. **Lead** (1.1875rem) for the first paragraph under a heading.
- **Control** (0.95rem): text inside buttons, nav links, tabs, menu items, table cells and list rows.
- **Data** (JetBrains Mono, tabular): event codes, timers, scores, counts, minutes, routes.

### Named Rules

**The Measured Mono Rule.** Mono is for measured things only. Words such as "Solo", "Pairs" or "Every event" stay in the body face, even in a table of numbers.

**The No Eyebrow Rule.** No small label above a heading. The heading carries itself; supporting facts go after it.

## Layout

One page column (76rem max, gutters 16px on phones, 24px from 640px, 32px from 1024px) under a 56px navy bar; phones add a 60px bottom tab bar. The landing runs edge to edge: each section is a full-bleed band (main keeps its box; the band reaches the viewport edges minus the scrollbar) with its own column inside, separated by stage hairlines, 64px of section padding (96px from 1024px). Two-column splits are asymmetric (about 4:7 for text beside a tool window; 1:1 for the explorer, with the structure sticky on wide screens). Tables become definition-list blocks on phones rather than scrolling. The scrollbar gutter is reserved so pages never shift sideways as they grow.

## Elevation & Depth

Flat by default with tonal steps; elevation is declared once per surface, a border or a shadow, never both.

### Shadow Vocabulary

- **Overlay** (`box-shadow: 0 16px 40px -16px rgb(3 10 26 / 0.45), 0 2px 6px rgb(3 10 26 / 0.12)`): menus, popovers, the command palette, toasts.
- **Dialog** (`box-shadow: 0 32px 80px -24px rgb(3 10 26 / 0.6), 0 4px 12px rgb(3 10 26 / 0.18)`): dialogs and drawers over the scrim.
- **Edge highlight** (`box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.07)`): the cut-metal top edge on navy panels and the top bar.

### Named Rules

**The No Ghost Card Rule.** A hairline border is the card's elevation. A card with a border gets no soft shadow under it.

## Shapes

Hard-edged and machined: 2px on controls (buttons, inputs, tags, chips), 4px on cards, windows and panels, 6px as the ceiling. No pills except where a native control insists. The recurring geometry is the 45 degree facet square and the triangular facet of the Strategy Universe structure; selection is an outline or a fill, never a coloured side stripe.

## Components

### Buttons

- **Shape:** squared (2px); 44px tall by default, 52px for hero actions, 36px only in dense pointer tables.
- **Primary:** DECA Blue fill with white text; hover and press deepen the blue (#005faf, #004d8f) and press drops 1px.
- **On navy:** a near-white fill with stage text for the main action; an outline (Stage Line Strong) for the second.
- **Secondary / Quiet:** white with a strong line border that turns blue on hover; quiet is an underlined text action.

### Chips (filter chips)

- **Style:** 40px tall, 2px corners, line-strong border; an optional cluster facet and a mono count.
- **State:** selected fills with ink (or on-navy on the stage); single-choice chips are a radio group with arrow keys.

### Cards / Containers

- **Corner Style:** 4px. **Background:** Surface on light pages, Stage Raised on the stage.
- **Shadow Strategy:** none at rest (see Elevation). **Border:** one hairline. **Internal Padding:** 20px, 24px from 640px.
- **App window:** the landing's tool previews are light windows on the stage (the real kit in its light theme), 6px corners, a bar naming the route in mono and a tag saying what kind of preview it is.

### Inputs / Fields

- **Style:** white, 2px corners, line-strong border, 44px tall; labels above, hints and errors below and wired to the input.
- **Focus:** the global 2px focus ring (electric on light, a pale blue on navy). **Error:** the bad colour on the border and message.

### Navigation

- **Top bar:** stage navy, 56px, wordmark, main nav with an electric underline on the current route, the command palette trigger (Ctrl or Cmd K, and /) and an account menu. **Phone:** a 60px bottom tab bar with a 2px electric marker over the current tab.
- **Command palette:** a native dialog with a combobox; pages, events (searchable by code) and actions.

### The Strategy Universe (signature)

A 96-panel faceted metal structure: six 60 degree sectors (one per career cluster) lit from inside, the light showing only through the seams between plates, an orbit ring with one tick per published event, and an electric sweep. It renders in WebGL only on capable desktops; everywhere else, and underneath while it loads, an SVG poster projected from the same geometry. In the explorer, the selected cluster's sector lifts out and turns to the camera; hovering a cluster lifts it part way.

## Do's and Don'ts

### Do:

- **Do** keep the landing navy in both colour schemes and the working pages in the visitor's scheme.
- **Do** compute every count, time and format fact from the published content; show "None", "n of m" or an honest empty state when the data is missing.
- **Do** tag made-up numbers "Illustrative values" on the window that shows them.
- **Do** keep 3D behind Mount3D: lazy chunk, device tier, poster first, paused off screen.

### Don't:

- **Don't** use the DECA diamond logo or anything that implies DECA Inc. made or endorses the site.
- **Don't** round anything past 6px, add glass outside panels floating on the 3D canvas, or add a second accent hue.
- **Don't** put a coloured border-left on a list item or card to show selection; use an outline or a fill.
- **Don't** use mono for words, or a small label above a heading.
- **Don't** fade the first viewport's largest text in from transparent; it holds back the page's largest paint.
