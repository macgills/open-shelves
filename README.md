# Open Shelves

A dependency-free static library for rights-cleared public-domain books, designed for GitHub Pages and hosted from an Ireland/EU context.

## What exists now

- Responsive, accessible catalog and reader pages
- Client-side title/author/subject search
- Per-book rights and provenance records
- Conservative build-time check requiring named authors to have died at least 71 years before the build year
- Plain-text importer
- Node tests and GitHub Pages deployment

The included book is intentionally a **placeholder preview**, not a mirrored corpus. That keeps the repository lawful by default while the first complete editions are imported from independently verified sources.

## Run

```bash
npm test
npm run build
npm run dev
```

Open `http://localhost:4173/open-shelves-/`.

## Import a complete, rights-cleared text

```bash
npm run import:book -- \
  --title="The Happy Prince" \
  --author="Oscar Wilde" \
  --death-year=1900 \
  --published-year=1888 \
  --source-name="Your verified source edition" \
  --source-url="https://example.org/item" \
  --rights-basis="Author died in 1900; source text and edition-specific material verified for redistribution in Ireland." \
  --subjects="Fairy tales,Compassion" \
  --file="./incoming/the-happy-prince.txt"
```

Do not import a modern translation, introduction, illustration set, or typographical edition merely because the underlying work is old. Each can carry separate rights.

## Repository name

The generated URLs currently assume the GitHub repository is named `open-shelves-`. Change `/open-shelves-/` in `scripts/build.mjs`, `scripts/serve.mjs`, and the README if you choose another name.

## Licensing

The software is MIT-licensed. Book records and text are not covered by the software licence; every book must include its own provenance and rights basis.
