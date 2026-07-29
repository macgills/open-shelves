# Open Shelves

A dependency-free static library for rights-cleared public-domain books, designed for GitHub Pages and hosted from an Ireland/EU context.

## What exists now

- 15 complete English-language public-domain books in the curated starter catalogue
- Automated ingestion from a Project Gutenberg mirror during each build
- Responsive, accessible catalogue and reader pages
- Client-side title, author, and subject search
- Per-book rights and provenance records
- Conservative build-time check requiring named authors to have died at least 71 years before the build year
- Plain-text importer for independently sourced additions
- Node tests and GitHub Pages deployment

The starter catalogue is declared in `src/catalogue.json`. Generated book JSON is recreated in `src/content/books` by the ingestion step and is not the source of truth.

## Run

```bash
npm test
npm run build
npm run dev
```

`npm run build` downloads and imports the curated catalogue before generating the site. To rebuild only from already-imported local JSON, use `npm run build:offline`.

Open `http://localhost:4173/open-shelves/`.

The deployed site is expected at `https://macgills.github.io/open-shelves/`.

## Catalogue policy

A catalogue entry records the Gutenberg ebook ID, author death year, original publication year, subjects, and a human-written description. The importer:

1. downloads plain text from the configured Gutenberg mirror;
2. strips the Gutenberg distribution wrapper;
3. detects chapter-like headings and creates reader sections;
4. writes exact source and retrieval metadata;
5. rejects books that fail the conservative Irish copyright check.

Override the mirror for local builds with `GUTENBERG_MIRROR=https://your-approved-mirror.example npm run build`.

Project Gutenberg itself warns automated users to use mirrors or its offline feeds rather than crawling the main website. Open Shelves therefore uses a mirror for text ingestion and links readers to the canonical Gutenberg landing page for provenance.

## Import an independently verified text

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

## Repository path

The generated URLs use the GitHub Pages project path `/open-shelves/`. The build and local server each define this once as `basePath`.

## Licensing

The software is MIT-licensed. Book records and text are not covered by the software licence; every book must include its own provenance and rights basis.
