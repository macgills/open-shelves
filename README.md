# Open Shelves

A runtime dependency-free static library and discovery interface for public-domain books, designed for GitHub Pages and hosted from an Ireland/EU context.

Live site: https://macgills.github.io/open-shelves/

## What exists now

- 15 complete English-language public-domain books in the curated reader catalogue
- Automated ingestion from a Project Gutenberg mirror during each build
- A discovery interface for Harvard Library's Institutional Books 1.0 release
- A token-backed export of the Harvard volume-level metadata catalogue
- Responsive, accessible catalogue and reader pages
- Client-side title, author, and subject search
- Per-book rights and provenance records
- Conservative build-time checks requiring named authors to have died at least 71 years before the build year
- A plain-text importer for independently sourced additions
- Node tests and GitHub Pages deployment

The curated reader catalogue and the Harvard discovery catalogue are deliberately separate:

- `src/catalogue.json` declares books whose complete text Open Shelves imports and renders for reading.
- The Harvard exporter creates a searchable discovery index for the much larger Institutional Books collection.
- Open Shelves does not attempt to commit or deploy Harvard's roughly terabyte-scale OCR corpus to GitHub Pages.

Generated book JSON is recreated in `src/content/books` by the ingestion step and is not the source of truth.

## Harvard Institutional Books

Harvard Library's Institutional Books 1.0 release contains approximately 983,000 digitised public-domain volumes. Open Shelves makes the release more visible by exporting compact volume-level metadata into static search shards during the Pages build.

The GitHub Actions workflow reads an `HF_TOKEN` repository secret belonging to a Hugging Face account that has accepted the dataset's access terms. The token is used only during the build and is never written into the generated site or repository.

When `HF_TOKEN` is available, the workflow runs:

```bash
python -m pip install --disable-pip-version-check 'datasets>=3,<5'
python scripts/export_harvard.py
```

This produces the static metadata assets consumed by the Harvard search page. A missing token does not break deployment; the site instead publishes the Harvard overview without the full metadata index.

To regenerate the Harvard metadata locally:

```bash
export HF_TOKEN=hf_...
python -m pip install 'datasets>=3,<5'
python scripts/export_harvard.py
npm run build
```

Do not commit the token or generated credentials. The exported metadata should contain only fields intentionally selected by `scripts/export_harvard.py`.

## Run

```bash
npm test
npm run build
npm run dev
```

`npm run build` downloads and imports the curated Gutenberg catalogue before generating the site. To rebuild only from already-imported local JSON, use `npm run build:offline`.

Open `http://localhost:4173/open-shelves/`.

## Curated catalogue policy

A catalogue entry records the Gutenberg ebook ID, author death year, original publication year, subjects, and a human-written description. The importer:

1. downloads plain text from the configured Gutenberg mirror;
2. strips the Gutenberg distribution wrapper;
3. detects chapter-like headings and creates reader sections;
4. writes exact source and retrieval metadata;
5. rejects books that fail the conservative Irish copyright check.

Override the mirror for local builds with:

```bash
GUTENBERG_MIRROR=https://your-approved-mirror.example npm run build
```

Project Gutenberg asks automated users to use mirrors or offline feeds rather than crawl its main website. Open Shelves therefore uses a mirror for text ingestion and links readers to the canonical Gutenberg landing page for provenance.

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

## Licensing and provenance

The software is MIT-licensed. Book records, source texts, Harvard metadata, and generated discovery assets are not automatically covered by the software licence. Every readable edition must carry its own provenance and rights basis, and upstream dataset terms still apply to access and redistribution.