# uzit.one

Personal portfolio & markdown blog for **Uz_it_one** (`@uz-it-one`), built with **Astro**, **Tailwind CSS**, and **Cloudflare Pages & Workers (D1)**.

## Features

- **Minimal Editorial Single-Column Layout**: Focused typography (`Pretendard Variable` & `JetBrains Mono`) with a text-only `Dark` / `Light` theme toggle.
- **Main Portfolio (`/`)**:
  - Live GitHub Profile integration (`https://github.com/uz-it-one`)
  - Affiliations: **Soongsil University** (School of Liberal Studies) & **YOURSSU** (`https://yourssu.com/`)
  - Curated Active Projects: Automatically fetches public repositories directly owned by `uz-it-one` (excluding Organization repositories) and displays the user-selected projects.
  - Recent Markdown Blog Posts preview.
- **Markdown Blog (`/blog`, `/blog/[slug]`)**:
  - Tag filtering, instant search, GFM markdown rendering, Table of Contents (TOC), and syntax-highlighted code blocks with copy button.
- **Direct-Access Admin Console (`/admin`)**:
  - Accessible exclusively via direct `/admin` URL entry (no public admin links).
  - **Projects Manager**: Check/uncheck owned GitHub repositories in real time, reorder, and customize status labels or descriptions.
  - **Blog Editor**: Write, preview in split-view, and publish or save draft markdown posts directly in the browser.

## Development

```bash
npm install
npm run dev
```

## Testing & Build

```bash
npm test
npm run build
```

## Deployment (GitHub Actions -> Cloudflare Pages)

Pushing to `main` triggers `.github/workflows/deploy.yml`, which runs tests, builds the project, and deploys to Cloudflare Pages (`uzitone`).

Required GitHub Repository Secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
