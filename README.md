# Open Shelves

A static, human-facing browser and OCR reader for Harvard Institutional Books 1.0.

Live site: https://macgills.github.io/open-shelves/

## What it does

- Browses the official 983,004-volume metadata collection in pages; search is optional.
- Opens a selected volume dynamically and renders its OCR one page at a time.
- Uses each visitor's own Hugging Face access rather than embedding a shared token.
- Sends metadata and OCR requests directly to the official Hugging Face Dataset Viewer API.
- Stores the short-lived OAuth token only in `sessionStorage`, so it is scoped to the current browser tab.
- Publishes no Harvard metadata shards and no copy of the 947 GB OCR corpus.
- Runs as a dependency-free static GitHub Pages site.

The earlier Project Gutenberg catalogue and ingestion pipeline have been removed. Harvard Institutional Books is now the entire product.

## Access flow

Institutional Books is a gated public dataset. Open Shelves cannot accept the publisher's terms on a visitor's behalf.

A visitor:

1. follows the link to the official Institutional Books page on Hugging Face;
2. reviews and accepts the official terms there;
3. confirms that step in Open Shelves;
4. signs in with Hugging Face;
5. grants the `gated-repos` OAuth scope;
6. browses metadata and opens OCR volumes using their own approved session.

If the visitor has not been granted access, the official API rejects the request and Open Shelves explains that the terms must be accepted first.

## OAuth

Open Shelves is a public OAuth client using PKCE. Its Client ID Metadata Document is served as JSON at:

```text
https://macgills.github.io/open-shelves/oauth-cimd.json
```

The `.json` suffix is intentional. GitHub Pages derives response MIME types from file extensions and does not support per-file response headers, while a CIMD document must be returned as JSON.

The callback is:

```text
https://macgills.github.io/open-shelves/oauth/callback/huggingface/
```

Requested scopes:

```text
openid profile gated-repos
```

There is no client secret in the repository or browser bundle. The production build binds both OAuth initiation and callback exchange to the same exact client ID URL.

The former `HF_TOKEN` GitHub Actions secret is no longer used and can be deleted from the repository settings. Build-time access was removed because it would create a redistributed metadata index; the current design leaves dataset access with each authorised visitor.

## How browsing works

The browser resolves the official dataset configuration and split, then requests 24-row slices from:

```text
https://datasets-server.huggingface.co/rows
```

Search uses the Dataset Viewer `/search` endpoint. A random-shelf button jumps to another metadata offset without requiring a query.

Each metadata result retains its official row index and barcode. Opening a result requests the corresponding row from the full OCR dataset and verifies the barcode before displaying `text_by_page_gen`, falling back to `text_by_page_src` when post-processed OCR is unavailable.

The reader keeps only the currently opened volume in memory and renders one page at a time. Very large volumes can still take time to download because the official row contains the complete page array.

## Run locally

```bash
npm test
npm run build
npm run dev
```

Open:

```text
http://localhost:4173/open-shelves/
```

The production OAuth metadata is tied to the GitHub Pages URL. The site can be built and inspected locally, but the production Hugging Face callback is intended to run at the deployed URL.

## Repository layout

```text
scripts/build.mjs                         Static page generator and production OAuth binding
scripts/serve.mjs                         Local static server
public/assets/harvard.js                  Browser, search, OAuth initiation, OCR reader
public/assets/oauth-callback.js           PKCE token exchange
public/oauth/callback/huggingface/        OAuth callback page
public/oauth-cimd.json                    Public OAuth client metadata
.github/workflows/pages.yml               Test, build, verification, and Pages deployment
```

## Security and data handling

- No Hugging Face token is committed or generated during deployment.
- OAuth uses PKCE and a public client without a client secret.
- The access token is kept in `sessionStorage`; closing the tab discards it.
- The token is sent only to Hugging Face endpoints.
- Open Shelves does not proxy, persist, index, or republish dataset rows.
- Dataset access and use remain governed by the Institutional Data Initiative's terms and Hugging Face's access controls.

## Independence

Open Shelves is not operated or endorsed by Harvard, the Institutional Data Initiative, Google, HathiTrust, or Hugging Face.

## Licence

The Open Shelves software is MIT-licensed. That software licence does not alter or replace the terms governing Institutional Books, its metadata, or its OCR text.
