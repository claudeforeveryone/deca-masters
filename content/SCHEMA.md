# DECA content schema (DECA Masters v2)

> **2026-10-11 user decision, overrides everything below that says "original":** DECA Masters ships no AI-written
> questions, vocab or role plays. See the SOURCED CONTENT addendum at the end. The original-content rules below
> survive only for formats, IDs, areas and validation.
>
> **2026-10-18 user decision:** the past DECA exam banks are back. Exam files may carry questions from past DECA
> cluster exam booklets (licence `DECA past exam (MBA Research)`, ids from `<prefix>-1001` up, keys from the booklet,
> choices in booklet order). Each one is credited to its booklet and to MBA Research and DECA Inc. as copyright holders.

(Superseded) All practice content is ORIGINAL, written for DECA Masters. Never copy DECA Inc. exams, released role plays or
other copyrighted material. Every file states that it is independent practice content, not official DECA material.
Facts about events (names, formats, team sizes) must come from official DECA sources and carry `officialUrl` and
`verifiedAt`.

## content/events.json

```json
{
  "season": "2026-2027",
  "source": "deca.org competitive events pages, checked <date>",
  "events": [
    {
      "code": "PMK",
      "name": "Principles of Marketing",
      "category": "Principles of Business Administration Events",
      "cluster": "marketing",
      "exam": "business-admin-core",
      "components": ["exam", "roleplay"],
      "teamSize": "1",
      "summary": "Original one or two sentence description.",
      "officialUrl": "https://www.deca.org/...",
      "verifiedAt": "2026-10-11",
      "notes": null
    }
  ]
}
```

- `cluster`: `core` | `business-management` | `entrepreneurship` | `finance` | `hospitality-tourism` | `marketing` | `personal-finance`
- `exam`: one of the exam slugs below or `null` when the event has no exam.
- `components`: any of `exam`, `roleplay`, `case-study` (team decision making), `written`, `presentation`,
  `simulation`, `portfolio`, `online`.
- Unknown fields are `null`, never guessed.

## content/exams/<slug>.json

Slugs: `business-admin-core`, `business-management`, `entrepreneurship`, `finance`, `hospitality-tourism`,
`marketing`, `personal-financial-literacy`.

```json
{
  "slug": "marketing",
  "title": "Marketing Cluster Exam",
  "cluster": "marketing",
  "blurb": "Original practice questions covering the marketing cluster's instructional areas.",
  "disclaimer": "Independent practice questions written for DECA Masters. Not official DECA exam content.",
  "questions": [
    {
      "id": "mkt-001",
      "area": "Channel Management",
      "pi": null,
      "difficulty": 2,
      "stem": "Question text.",
      "choices": ["A text", "B text", "C text", "D text"],
      "answer": 1,
      "explanation": "Why B is right and why the tempting wrong option is wrong.",
      "source": "original"
    }
  ]
}
```

- Exactly 4 choices, one correct answer, `answer` is the 0-based index.
- `area`: a DECA instructional area name (Business Law, Channel Management, Communications, Customer Relations,
  Economics, Emotional Intelligence, Entrepreneurship, Financial Analysis, Human Resources Management,
  Information Management, Market Planning, Marketing, Marketing-Information Management, Operations, Pricing,
  Product/Service Management, Professional Development, Promotion, Selling, Strategic Management, Knowledge
  Management, Risk Management, Customer Service, etc.). Use the areas that the cluster's exam actually covers.
- `pi`: an official performance indicator code like `MK:001` ONLY when verified from a public DECA/MBA Research
  source; otherwise `null`.
- `difficulty`: 1 easy, 2 medium, 3 hard. Aim for about 30 / 50 / 20.
- Answer positions balanced (each of A-D roughly 25%).
- IDs: prefix per exam (`core`, `bma`, `ent`, `fin`, `ht`, `mkt`, `pfl`) + 3-digit number, unique.
- Neutral North American context; currency in generic dollars; no real brands in a negative light.

## content/vocab/<slug>.json

```json
{
  "slug": "marketing",
  "title": "Marketing terms",
  "terms": [
    {
      "id": "mkt-v-001",
      "term": "Market segmentation",
      "definition": "Original plain-language definition.",
      "area": "Market Planning"
    }
  ]
}
```

## content/roleplays/<cluster>.json

```json
{
  "cluster": "marketing",
  "disclaimer": "Original practice scenarios written for DECA Masters. Not official DECA role plays.",
  "scenarios": [
    {
      "id": "rp-mkt-01",
      "eventCodes": ["PMK", "AAM"],
      "title": "Short title",
      "participantRole": "You are the assistant manager of ...",
      "judgeRole": "The judge plays the store owner who ...",
      "situation": "Original scenario text, 150-250 words.",
      "task": "What the participant must present or recommend.",
      "performanceIndicators": [
        {
          "area": "Promotion",
          "text": "Explain the role of promotion as a marketing function."
        }
      ],
      "prepMinutes": 10,
      "presentMinutes": 10,
      "judgeQuestions": ["A follow-up question the judge may ask."],
      "rubricNotes": "What a strong answer covers."
    }
  ]
}
```

- Performance indicator `text` should paraphrase the public PI wording style; mark nothing as official unless it is.
- Prep and presentation minutes must match the event format in events.json.

## SOURCED CONTENT addendum (2026-10-11, user decision)

Every item is either openly licensed material reused under its licence, or a clearly labelled placeholder.

- Every question and vocab term has `source` as an object, replacing the old `"original"` string:
  `{ "title": "...", "url": "...", "licence": "CC BY 4.0 | CC BY-SA 4.0 | CC BY-NC 4.0 | CC BY-NC-SA 4.0 | CC0 | Public domain (US federal work) | DECA past exam (MBA Research)", "attribution": "exact TASL line", "adapted": true, "keyFrom": "source | verified" }`.
- Every exam/vocab/roleplay file has a top-level `"status": "sourced" | "placeholder"`, `"sources": [...]` and, for
  placeholders, a `"placeholderNote"`. Each `sources` entry needs `title`, `url`, `licence` and `attribution`, and
  every item's `source.url` must be listed there exactly (the database loader checks the same rule). A whole work
  (book, glossary, site) is one entry. When items cite a page inside it (a chapter, a quiz, a glossary entry), list
  that page too as `{ "title", "url", "licence", "attribution", "partOf": "<url of the whole work's entry>" }`: same
  licence as the work, and its attribution is the work's line. The credits page and the public files show whole
  works only; each item already links its own page. (Repo addition, 2026-10-11, deca-integrate-core.) The exam `disclaimer` becomes: "Questions reused from openly licensed sources
  (credited on each question). Not official DECA exam content."
- Role-play files hold links to DECA's official public samples, never copied text: `{ "cluster", "status": "placeholder", "events": [ { "eventCode", "eventName", "officialSamples": [{ "title", "url", "season" }], "format": { "prepMinutes", "presentationMinutes", "judgeRole" }, "placeholder": true, "note" } ] }`.
- `official-samples.json` lists DECA's official sample exam links per cluster (links only).
- `SOURCES.md` records each source, its licence quote and URL, and the per-exam mapping.
- Balanced answer positions and the 30/50/20 difficulty split do not apply to sourced questions; keep the
  source's order of choices unless reformatting to 4 choices.
- The UI shows source + licence on each question/term and has a credits/attribution page. The owner console imports
  more content (JSON/CSV, same fields; `source` and `licence` required).
- Files under `_archive-ai-written/` never ship.
