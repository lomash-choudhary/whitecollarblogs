# Connecting a website to the Blog CMS

How to take a website that has only hand-written blog posts and give it a
`content/blog` folder the CMS can publish into, so an article written in the
portal appears on that site at `/resources/<slug>` after one push.

This was written while doing it for **OVO Painting** — from the working
integration in `../ovopainting` (the fork everything was developed and tested
on) into the production repo `../migration-folder/ovopainting`
(`Homeowner-Marketers-Websites/ovopainting`). Every step below was actually
run; the commands are the ones that were used, not an idealised version.

The same steps work for `durohomes` and `rangerwebsite`. Which files are copied
byte-for-byte and which have to be written per site is answered in
**[Part C — Doing this for the other two websites](#part-c--doing-this-for-the-other-two-websites)**.

---

## What "the same rendering everywhere" actually means

The short answer to *"we use one Google-Docs markdown parser, so is the blog
rendering the same on all three websites?"* is: **the meaning is identical, the
paint is not.**

One markdown file produces the **same block list** on every site, because the
parser is one file copied byte-identical into all four repos. What each site
then does with those blocks is its own CSS.

| Layer | File | Same everywhere? |
|---|---|---|
| What markdown *means* — headings, lists, tables, callouts, Key Takeaways, FAQ | `src/lib/markdownBlocks.ts` | **Byte-identical.** Copy it. |
| What meta tags an article emits | `src/lib/articleSeo.ts` | **Byte-identical.** Copy it. |
| What JSON-LD an article emits | `src/lib/articleSchema.ts` | **Byte-identical.** Copy it. |
| Who this website is — name, origin, blog path, logo, default author | `src/lib/seoSite.ts` | Per site. ~35 lines. |
| How a block is *painted* — fonts, colours, spacing | `src/components/blog/BlockContent.tsx` | Per site. It is this site's styling. |
| Glue from markdown to this site's own `BlogPost` shape | `src/lib/markdownBlog.ts` | Per site, but ~95% identical. |
| The receiving GitHub Action | `.github/workflows/publish-blog.yml` | Identical apart from `TARGET_BRANCH` and the live URL printed in the summary. |
| The article validator | `.github/scripts/validate-blog.mjs` | **Byte-identical.** Copy it. |

So: **four files are a straight copy, three are per-site, and one workflow needs
two lines changed.** That is the whole job. A writer who publishes the same
article to all three sites gets the same headings, the same tables, the same
FAQ accordion and the same meta tags on all three — each drawn in that site's
own typeface and colours.

**The rule that keeps it that way:** the four copied files must hash the same in
every repo. Check it, never assume it:

```bash
cd ~/Developer/SmallGrpProject
shasum -a 256 whitecollarblogs/src/lib/markdownBlocks.ts \
  {ovopainting,durohomes,rangerwebsite}/src/lib/markdownBlocks.ts
```

Each command must print one hash, repeated. If a site needs the parser to
behave differently, it does not — it needs its `BlockContent.tsx` changed.

---

## Before you start

- The CMS repo (`whitecollarblogs`) is the origin of the four shared files.
  Copy **out of it**, or out of a site repo already known to be in sync.
- Know the target repo's **default branch**. `repository_dispatch` only ever
  reads the workflow file from the default branch — a workflow living anywhere
  else is never run. OVO's is `main`; Durahome's is `design-updates`.
- The production repo has hand-written articles already. **Nothing in this
  guide deletes one.** Every change is additive: new files, new optional type
  fields, and three existing files re-pointed at a function that returns the
  hand-written articles *plus* the markdown ones.

---

## Part A — The website repo

### Step 0 — Branch, and write down the baseline

```bash
cd ~/Developer/SmallGrpProject/migration-folder/ovopainting
git checkout -b feat/mirgation-to-main-website

npx tsc --noEmit ; echo "tsc exit: $?"
npx eslint src 2>&1 | tail -3
```

Recorded for this migration:

| Check | Before |
|---|---|
| `npx tsc --noEmit` | clean (exit 0) |
| `npx eslint src` | 277 problems (223 errors, 54 warnings) |

**Treat the lint count as the gate, not zero.** These repos predate strict
typing and carry hundreds of pre-existing `no-explicit-any` errors. The
question at the end is only *"is it still 277?"* — expecting zero sends you off
fixing several hundred unrelated things.

Run `npx eslint src`, not `npm run lint`: a bare `npm run lint` also walks
`.kilo/`, a second checkout of the same repo, and reports roughly four times as
many problems.

### Step 1 — Copy the four files that are the same on every website

Three library files plus the validator. Copy them **out of the CMS repo**,
which is where the originals live, after checking the copies you are about to
overwrite from are themselves in sync.

```bash
cd ~/Developer/SmallGrpProject

# 1. Prove the source is in sync before copying anything out of it.
for f in markdownBlocks articleSeo articleSchema; do
  shasum -a 256 whitecollarblogs/src/lib/$f.ts \
    {ovopainting,durohomes,rangerwebsite}/src/lib/$f.ts
done          # each group must print one hash, four times

# 2. Copy.
SRC=whitecollarblogs/src/lib
DST=migration-folder/ovopainting/src/lib
cp $SRC/markdownBlocks.ts $SRC/articleSeo.ts $SRC/articleSchema.ts $DST/

mkdir -p migration-folder/ovopainting/.github/scripts
cp ovopainting/.github/scripts/validate-blog.mjs \
   migration-folder/ovopainting/.github/scripts/

# 3. Prove the copy landed byte-identical.
for f in markdownBlocks articleSeo articleSchema; do
  shasum -a 256 whitecollarblogs/src/lib/$f.ts migration-folder/ovopainting/src/lib/$f.ts
done
```

What each one is:

- **`markdownBlocks.ts`** (1,274 lines) — the parser. Turns a markdown file into
  an ordered block list: headings h1–h6, paragraphs, nested and mixed lists,
  tables with per-column alignment, images with captions, video, YouTube and
  Vimeo embeds, code fences, blockquotes, rules, `:::note`/`:::tip`/
  `:::warning`/`:::key` callouts, a `## Key Takeaways` box and a `## FAQ`
  accordion, plus every inline mark. It is dependency-free on purpose, so it
  can be copied rather than kept in version lockstep across four
  `package.json` files.
- **`articleSeo.ts`** — builds the Next `Metadata` object: title, description,
  canonical, the full Open Graph set **and the Twitter card** (a page that sets
  `openGraph` and not `twitter` silently inherits the homepage's card).
- **`articleSchema.ts`** — builds the schema.org `@graph`: `BlogPosting`,
  `FAQPage` when the article has questions, `BreadcrumbList`, and an
  `Organization` only when the site's own layout does not already render one.
- **`.github/scripts/validate-blog.mjs`** — refuses a malformed article in CI
  before it can break the build.

**No new npm dependencies.** All four are plain TypeScript/ESM with no imports
beyond `next`'s types — `package.json` is not touched in this whole migration.

**Verified:** all four files hash identically in the CMS repo and in the
production site repo.

### Step 2 — Copy the three files that describe *this* website

```bash
cd ~/Developer/SmallGrpProject
cp ovopainting/src/lib/seoSite.ts      migration-folder/ovopainting/src/lib/
cp ovopainting/src/lib/markdownBlog.ts migration-folder/ovopainting/src/lib/
cp ovopainting/src/components/blog/BlockContent.tsx \
   migration-folder/ovopainting/src/components/blog/
```

For OVO these three came over unchanged — both repos are the same website, so
the styling and the identity already match. On a *new* website they are the
three files you write by hand. What each has to say:

**`seoSite.ts`** — ~35 lines, the only place this website is described:

```ts
export const SEO_SITE: SchemaSite = {
  siteName: "OVO Painting",                 // og:site_name and the <title> suffix
  baseUrl: "https://www.ovopainting.com",   // every absolute URL is built from this
  blogPath: "/resources",                   // where CMS articles are served
  locale: "en_US",
  defaultOgImage: "/images/services/interior-painting-hero.webp",
  logo: "/images/logo.png",
  organizationType: "LocalBusiness",
  organizationId: "https://www.ovopainting.com#organization",
  defaultAuthor: { name: "Sebastian Thomas", role: "Founder & Lead Painter" },
};
```

Three of those are traps:

- **`blogPath` must match three other places** — `blogPath` for this site in the
  CMS's `src/config/sites.ts`, and the live URL printed by this repo's workflow
  summary. The first drives the portal's "view it live" link, the second drives
  the canonical. Disagreement points a reader or a crawler at a 404.
- **`organizationId` is only set when this site's own `layout.tsx` actually
  *renders* an organization node on every page** — and it must match that node's
  `@id` **character for character**. OVO's is
  `https://www.ovopainting.com#organization`, with *no* slash before the `#`.
  An id off by one character is a second organization rather than a reference to
  the first, and every article then has a `publisher` pointing at a node on no
  page. Grep for the render, not the import:
  ```bash
  grep -n 'ld+json' src/app/layout.tsx      # confirmed: OVO renders LocalBusiness
  ```
- **`defaultOgImage` must name a file that is really in `public/`.** Checked:
  ```bash
  ls public/images/services/interior-painting-hero.webp public/images/logo.png
  ```

**`markdownBlog.ts`** — reads every `.md` in `content/blog`, parses it with the
shared parser, and returns it in the same `BlogPost` shape the hand-written
`blogRegistry` already uses. It is per-site only because it names that site's
fallback hero and house author. Its three exported functions are what the rest
of the site calls:

| Function | Returns |
|---|---|
| `getAllBlogPosts()` | hand-written registry **plus** markdown, markdown winning a slug clash |
| `getBlogPost(slug)` | one article, from either source |
| `getAllBlogSlugs()` | every slug, for `generateStaticParams` and the sitemap |

**One real fix was needed here.** The copied file carried
`FALLBACK_HERO = "/images/services/interior-painting.png"` — a file that has
never existed in this repo, only the `-hero.webp` and `-service.webp` variants
do. Every article published without a feature image would have opened with a
broken picture, silently: `next/image` renders the alt text for a missing local
asset, so it looks fine in the CMS and wrong on the page. Corrected here to
`/images/services/interior-painting-hero.webp`, with the reason in a comment
above it.

> **Back-port that fix.** `../ovopainting/src/lib/markdownBlog.ts` still has the
> broken path, and so will any site you copied from before reading this.

**`BlockContent.tsx`** — this site's renderer: one `case` per block type, in
OVO's fonts and colours. This is the file you rewrite for a new website, and
the one file that is *supposed* to differ between sites. Two rules it already
obeys and a new one must too:

- **Adding a block type to the parser means adding a `case` here, in every
  site's copy, in the same pass.** Anything less and a writer gets formatting
  that works on some sites only.
- **An inline mark takes its colour from the panel, not the page.**
  `renderInline(nodes, isDark)` exists because the Key Takeaways box and the
  table header are painted in the site's dark ink — hard-coded, an inline
  `` `code` `` chip inside the takeaways box renders charcoal-on-charcoal and
  disappears: present in the DOM, invisible on screen.

### Step 3 — Widen `blogData.ts`, do not replace it

`src/data/blogData.ts` holds this site's hand-written articles — **60 of them in
the production repo**, against 22 in the fork the integration was built on.

**Do not copy this file across.** It is the one file where the two repos hold
genuinely different *content*, and copying the fork's version would delete 38
live articles. What the CMS needs from it is only a handful of **optional**
fields on the existing interfaces:

| Interface | Added | Why |
|---|---|---|
| `BlogAuthor` | `url?` | `author.url` in the `BlogPosting`; Google asks for it to tell two writers of the same name apart |
| `BlogSection` | `level?: 1 \| 2` | `#` and `##` are two heading levels, not one |
| `BlogSection` | `blocks?: Block[]` | the parsed, ordered content of a markdown section |
| `BlogPost` | `seo?: ArticleSeoInput` | the article's front matter, unresolved |
| `BlogPost` | `introBlocks?`, `conclusionBlocks?` | ordered intro/conclusion content |
| `BlogPost` | `keyTakeawaysBlock?`, `faqBlock?` | the rich forms of the two panels |
| `BlogPost` | `panelsInFlow?: boolean` | see below |

Plus two type-only imports at the top of the file:

```ts
import type { Block, FaqBlock, TakeawaysBlock } from "@/lib/markdownBlocks";
import type { ArticleSeoInput } from "@/lib/articleSeo";
```

Every added field is optional, so all 60 hand-written articles stay valid
without being touched.

**Verified additive:**

```bash
git diff --stat src/data/blogData.ts
#  src/data/blogData.ts | 49 +++++++++++++++++++++++++++++++++++++++++++++++++
#  1 file changed, 49 insertions(+)        <- zero deletions

grep -c '^  "[a-z0-9-]*": {' src/data/blogData.ts    # 60, unchanged
```

`49 insertions(+)` with **no deletions**, and the registry still has 60 entries.
If a diff here ever shows a deletion, stop — something replaced the file instead
of widening it.

**What `panelsInFlow` is for.** A markdown article's Key Takeaways box and FAQ
accordion are rendered **where the writer typed them**, from the block flow.
The template also has its own fixed slots for those two panels, which is how the
hand-written articles draw them. Without this flag the template would draw both
copies — and the hand-written articles have no block list, so the flag is
simply absent on them and their slots keep working. `keyTakeaways` and `faqs`
stay populated for a markdown article too, because the table of contents and the
FAQPage JSON-LD are built from them, and neither of those draws a box.

### Step 4 — Point the article route at the markdown

`src/app/resources/[slug]/page.tsx` is the page that serves one article. In the
production repo it had not been touched since the two repos diverged, so the
fork's version copies over whole:

```bash
cp 'ovopainting/src/app/resources/[slug]/page.tsx' \
   'migration-folder/ovopainting/src/app/resources/[slug]/page.tsx'
```

Three changes are in it:

1. **The lookup**: `blogRegistry[slug]` becomes `getBlogPost(slug)`, and
   `Object.keys(blogRegistry)` in `generateStaticParams` becomes
   `getAllBlogSlugs()`. That one swap is what makes a CMS article reachable —
   both functions return the hand-written articles *and* the markdown ones.
2. **`generateMetadata` calls `buildArticleMetadata(...)`** instead of building
   a `Metadata` object by hand. The hand-written articles have no front matter,
   so their own fields are passed in as the input — the point being that the
   tag set is then identical for both kinds of article, and identical to the
   other two websites.
3. **The page emits `articleSchemaJson(...)`** in a single `<script
   type="application/ld+json">` above the template.

Two things in there that look optional and are not:

- **Emit `articleSchemaJson`, never `JSON.stringify` on the graph.** A literal
  `</script>` inside a FAQ answer would end the element as far as an HTML
  parser is concerned and everything after it would be parsed as markup. The
  helper escapes `<`, `>`, `&` and the two line separators.
- **The not-found branch sets `robots: { index: false, follow: false }`.**

**Verified:** `git diff --stat` shows this file changed and nothing else.

### Step 5 — The article template

```bash
cp ovopainting/src/components/blog/BlogDetailPage.tsx \
   migration-folder/ovopainting/src/components/blog/
```

`BlogDetailPage.tsx` renders one article. The fork's version differs from the
production one in four ways, and **one of those four is a change production made
that the fork never had** — so this is the one file in the whole migration that
cannot be copied and left alone.

What the copy brings in:

1. **It renders `BlockContent`** for `post.introBlocks`, `section.blocks` and
   `post.conclusionBlocks` — the markdown half of an article. The legacy named
   fields (`paragraphs`, `subsections`, `table`, `list`) are still rendered right
   below, because the 60 hand-written articles are built out of those. **Do not
   delete the legacy branches.**
2. **It no longer renders `Navbar`, `Footer` and `MobileBottomBar`.** The root
   `layout.tsx` already renders all three around `{children}`, so the old
   version served **two of each** on every article page. Only the footer showed
   it: the other two are fixed-position and the duplicate landed exactly on the
   original, which is how a page carries duplicated chrome for months and still
   looks right. Count the tags in the served HTML rather than reading the JSX:
   ```bash
   curl -s http://localhost:3000/resources/<slug> | grep -c '<footer'   # must be 1
   ```
3. **Two small correctness fixes**: `[text](url "nofollow")` now emits
   `rel="nofollow"`, and the hero caption bar renders only when the article
   actually has a caption. A CMS article has none — the front matter used to
   repeat the excerpt there, so every published article printed its own summary
   as a photo caption under the hero.

And what has to be **put back after copying**:

4. **The `{section.image && (...)}` block.** Production's most recent commit
   added a section-image renderer for hand-written articles; the fork never had
   it, so a straight copy silently deletes it. It was re-added by hand at the
   end of the section loop, with a comment saying why a markdown article does
   not use it (its images are blocks, drawn in place by `BlockContent`).

**How to catch this on another site:** before copying a shared component, ask
what the destination changed on its own since the two repos diverged.

```bash
cd migration-folder/ovopainting
git remote add testfork ../../ovopainting && git fetch testfork main
BASE=$(git merge-base HEAD testfork/main)
git diff --stat $BASE..HEAD -- src/components/blog/BlogDetailPage.tsx
# 19 insertions -> read them, and re-apply them after the copy

git remote remove testfork      # temporary: it exists only for this check
```

That merge-base diff is the check. Run it for **every** file you overwrite. For
this migration it came back empty for `[slug]/page.tsx`, `sitemap.ts` and
`tips-for-painting/page.tsx`, and non-empty only for `BlogDetailPage.tsx`,
`blogData.ts` and `next.config.ts` — which is exactly the set handled by hand.

**Verified:** `grep -n "section.image"` finds the block again, and
`grep -n "Navbar\|Footer\|MobileBottomBar"` finds nothing.

### Step 6 — The listing page and the sitemap

Two more files swap `blogRegistry` for the markdown-aware function. Both were
untouched in production since the repos diverged, so both copy over whole:

```bash
cp ovopainting/src/app/resources/tips-for-painting/page.tsx \
   migration-folder/ovopainting/src/app/resources/tips-for-painting/page.tsx
cp ovopainting/src/app/sitemap.ts migration-folder/ovopainting/src/app/sitemap.ts
```

**`/resources/tips-for-painting`** is the article index — `/resources` itself is
a hub page whose Tips section links to it. It now reads `getAllBlogPosts()` and
**sorts newest first**, so an article just published from the portal leads the
page instead of appearing wherever object order happened to put it. Its card
excerpt also falls back through `sections[0].paragraphs[0] → introText[0] →
metaDescription`, because a markdown article's first section may open with a
list or a table rather than a paragraph, and the old single expression rendered
an empty card for it.

**`sitemap.ts`** replaces `Object.keys(blogRegistry)` with `getAllBlogSlugs()`,
so a CMS article is in `/sitemap.xml` on the first deploy after it lands.

```
// Every article — hand-written plus everything published from the CMS.
const blogPosts = getAllBlogSlugs().map((slug) => ({
  url: `${BASE_URL}/resources/${slug}`, ...
}));
```

**Both of these are server-only.** `markdownBlog.ts` touches the filesystem, so
it may be imported from a server component, `sitemap.ts` or a route handler —
never from a `"use client"` file. If a site's listing page is a client component
(Ranger's is), the server page reads the articles and passes a trimmed,
serialisable array across the boundary.

### Step 7 — Allow the CMS image host

The CMS uploads cover and in-article images to Supabase storage, so published
markdown points at `https://<project>.supabase.co/...`. `next/image` **throws**
on a host that is not configured — a published article would 500 the whole page,
not show a broken image. One entry in `next.config.ts`:

```ts
{
  // Cover and in-article images uploaded through the Blog CMS.
  protocol: "https",
  hostname: "**.supabase.co",
},
```

**Never widen this to `hostname: "**"`.** That turns `/_next/image` into an
unauthenticated open proxy that will fetch and re-serve any URL on the internet
from this domain, on this project's bandwidth. Add hosts by name.

`next.config.ts` in production carries 136 redirects the fork does not have, so
this was an in-place edit, not a copy: `git diff --stat next.config.ts` shows
`9 insertions(+)` and no deletions.

### Step 8 — Create `content/blog`

```bash
mkdir -p migration-folder/ovopainting/content/blog
cp ovopainting/content/blog/README.md migration-folder/ovopainting/content/blog/
```

**The folder starts empty apart from the README, and that is deliberate.** This
is the production repo; the articles that belong on the live site are the ones
already in `blogData.ts`, and every *new* article arrives here from the CMS. The
markdown files sitting in the fork's `content/blog` are development output and
were **not** carried over.

The README documents the front-matter shape for anyone hand-writing a file, and
`markdownBlog.ts` skips `readme.md` by name, so it never becomes an article.
Two things were corrected in the copy: the example `heroImage` pointed at
`/images/services/interior-painting.png`, which does not exist in this repo
(same bug as Step 2), and `heroImageCaption` now says it is for hand-written
articles only.

Checked that nothing ignores the folder:

```bash
git check-ignore -v content/blog/README.md    # no output = tracked
```

**Every `.md` file here becomes a live URL.** A file named `cron-test.md`
becomes `https://www.ovopainting.com/resources/cron-test`, in the sitemap and on
the listing page. Do not park scratch files here.

### Step 9 — The receiving GitHub Action

```bash
mkdir -p migration-folder/ovopainting/.github/workflows
cp ovopainting/.github/workflows/publish-blog.yml \
   migration-folder/ovopainting/.github/workflows/
# then set TARGET_BRANCH (below)
```

The workflow listens for `repository_dispatch: types: [publish-blog]`, decodes
the base64 markdown the CMS sends, writes it to `content/blog/<slug>.md`,
validates it, **builds the site**, commits, and optionally pings a Vercel deploy
hook. The build step is what stops a broken article taking the live site down.

Exactly two lines are site-specific:

| Line | Value here |
|---|---|
| `env.TARGET_BRANCH` | `feat/mirgation-to-main-website` — the migration branch |
| the `Live URL` in the summary step | `https://www.ovopainting.com/resources/${SLUG}` |

**`TARGET_BRANCH` is the only place a branch name appears.** Every step reads
`${TARGET_BRANCH}`, so changing where articles land is this one line and nothing
else. The branch does not have to exist on the remote yet — the first publish
creates it from the default branch.

It is set to the **migration branch** here, not to `main`, so that anything
published while the PR is open lands on the branch under review rather than
straight onto the live site.

> **Flip it to `main` after the PR merges.** With `TARGET_BRANCH` still naming a
> branch that has been merged and deleted, the workflow re-creates that branch
> from `main` and commits the article to it — a publish that reports success,
> shows a green Action, and never reaches a reader. The Vercel deploy step is
> gated off for the same reason (see below), and the run summary prints
> *"not live"* instead of a URL, which is the only warning you get.

Production's default branch, for when that flip happens:

```bash
git remote show origin | grep -i 'HEAD branch'     # HEAD branch: main
```

Four things about this workflow that are easy to get wrong:

- **The workflow file has to live on the *default* branch.** `repository_dispatch`
  loads it from the default branch only — a dispatch runs the default branch's
  copy of the file whatever branch you are working on. **So nothing publishes to
  this site until this migration branch is merged**, and there is no way to test
  a dispatch from a feature branch. The manual `workflow_dispatch` input exists
  as the escape hatch, and it has the same limitation.
- **Where the workflow *runs* and where it *commits* are two different things.**
  The run always happens on the default branch and the Actions tab will always
  say so, however the run behaves. The commit target is `TARGET_BRANCH`.
- **The Vercel deploy-hook step is gated on the target being the default
  branch**, because the hook rebuilds whatever branch Vercel is configured to
  build, not the branch just pushed. Firing it from a feature branch would
  redeploy production from unrelated content. Do not ungate it. The secret
  `VERCEL_DEPLOY_HOOK_URL` is optional and only needed if this repo's Vercel git
  integration is off.
- **Pushing this file needs SSH, not a PAT.** GitHub refuses to let a Personal
  Access Token create or modify anything under `.github/workflows/` unless the
  token carries the `workflow` scope, and the push is rejected outright:
  ```bash
  git remote set-url origin git@github.com:Homeowner-Marketers-Websites/ovopainting.git
  ```
  An SSH key has no scope concept. The other way round is the GitHub web editor,
  which is a browser session rather than a PAT — commit the file to the
  **default branch** there. (Note `credential.useHttpPath` is unset on this
  machine and the macOS keychain holds one entry for `github.com`, so one token
  serves every GitHub repo; creating a new token does not help until the old one
  is erased.)

The workflow commits as whoever triggered the publish
(`github.actor` + their GitHub no-reply address), because **Vercel only builds
commits whose author it can tie to an account** — an invented bot address gets
the deployment refused. Override with the repository variables
`CMS_COMMIT_NAME` / `CMS_COMMIT_EMAIL` if a platform needs a specific address.

### Step 10 — Verify, by rendering rather than by reading

`npx tsc --noEmit`, `npx eslint src` and `npm run build` are the whole safety
net in these repos — there is no test suite. None of them notices a meta tag
that has quietly stopped being emitted, so the last check is to serve a real
article and read the HTML.

```bash
cd migration-folder/ovopainting
npx tsc --noEmit ; echo $?      # 0
npx eslint src 2>&1 | tail -3   # compare with the number from Step 0
npm run build                   # must succeed
```

| Check | Before | After |
|---|---|---|
| `tsc --noEmit` | clean | clean |
| `eslint src` | 277 problems (223 errors, 54 warnings) | 276 problems (223 errors, 53 warnings) |
| `npm run build` | passes | passes |

**`tsc` is not reproducible while a dev server is running.** `tsconfig.json`
includes `.next/dev/types/**/*.ts`, so a background Next process rewriting those
files mid-run produces unrelated errors — during this migration one run reported
four `Cannot find namespace 'google'` errors in `LeadForm.tsx`, a file nothing
had touched, and the next clean run was empty. `rm -f tsconfig.tsbuildinfo`,
stop the dev server, and re-run before believing a `tsc` failure.

#### The render check

Drop one real CMS-published markdown file into `content/blog` as a temporary
fixture, serve it, read the `<head>`, then delete it.

```bash
cp ../../ovopainting/content/blog/limewash-vs-whitewash-brick.md content/blog/
npm run dev -- -p 3010
curl -s http://localhost:3010/resources/limewash-vs-whitewash-brick > /tmp/art.html
```

What was checked, and what came back:

| Check | Result |
|---|---|
| Article, listing and hub all 200; unknown slug 404 | ✅ |
| Full meta set incl. `twitter:card/title/description/image` | ✅ all present |
| `<title>` carries the site suffix, `og:title` does not | ✅ |
| `canonical` = `https://www.ovopainting.com/resources/<slug>` | ✅ |
| `og:image` is the Supabase URL, served through `/_next/image` | ✅ |
| `article:published_time` ISO, `article:author` | ✅ |
| JSON-LD: exactly one `BlogPosting`, one `BreadcrumbList`, one `FAQPage` | ✅ |
| `publisher` `@id` resolves to the `LocalBusiness` the layout renders | ✅ not dangling |
| No duplicated `@id` anywhere on the page | ✅ |
| Body blocks: 1 table (thead + 10 rows), 5 `<details>` FAQ items, Key Takeaways box, figure, 10 `<h2>`, 15 `<h3>` | ✅ |
| Chrome: `<footer>` × 1, `<main>` × 1, `<h1>` × 1 | ✅ no duplication |
| Article appears on `/resources/tips-for-painting` and in `/sitemap.xml` | ✅ |

**Regression check on what was already live** — five hand-written articles
(`atlanta-bathroom-cabinet-painting`, `atlanta-paint-colors`,
`white-dove-vs-swiss-coffee`, `matte-vs-satin`,
`ceiling-paint-same-color-as-walls`): all 200, one footer, one `<h1>`, headings
intact, no duplicated schema nodes. They also now emit a proper `BlogPosting` +
`BreadcrumbList` graph they did not have before, because they go through the
same route.

Then put the tree back:

```bash
rm content/blog/limewash-vs-whitewash-brick.md
pkill -f "next dev"
```

**Counting tags: use a parser, not `grep -c`.** `grep -c '<h2'` counts *lines*,
and minified SSR output puts a whole article on a few lines — it reported 1 `h2`
for a page with 10. `grep -o '<h2[ >]' | wc -l`, or the small Python snippet
used above.

---

## Part B — The CMS side

Nothing in the CMS's code changes. `src/config/sites.ts` already has the
`ovopainting` entry with `blogPath: '/resources'` and the corrected
`defaultHeroImage`, and **that file never holds a repository coordinate** —
where a site deploys to comes from its env vars, via its `envPrefix`.

So the whole switch from the development fork to the production repo is three
environment variables in `whitecollarblogs/.env`:

```
OVO_GITHUB_REPO=Homeowner-Marketers-Websites/ovopainting   # was lomash-choudhary/ovopainting
OVO_GITHUB_TOKEN=<fine-grained PAT for THAT repo>          # the old one is scoped to the fork
OVO_SITE_BASE_URL=https://www.ovopainting.com              # unchanged
```

> **This has deliberately not been done yet.** Flipping `OVO_GITHUB_REPO` while
> `OVO_GITHUB_TOKEN` is still the fork's token makes every publish fail with a
> 404 from GitHub, and the new token has to be created by hand anyway. Do both
> in one edit, **after this branch is merged to `main`** — until then the
> workflow is not on the default branch and a dispatch does nothing at all.

Rules about these three that are worth not rediscovering:

- **Owner and repo stay in one variable.** Both halves go into the
  `api.github.com/repos/<owner>/<repo>/dispatches` path, and a bare repo name is
  ambiguous — a fork keeps the name and changes the owner, which is exactly the
  situation here. Split across two vars they can be half-updated into a repo
  that does not exist. `REPO_SLUG` in `sites.ts` validates the pair before
  either half reaches a URL.
- **A repo coordinate must never have a code fallback.** A stale default owner
  dispatches a finished article into the wrong repository. An unset var is
  reported by `missingSiteEnv()` and surfaces as a publish failure naming the
  variable.
- **The token needs Contents: read and write, and nothing else.** A
  `repository_dispatch` is a Contents-write operation and never touches a
  workflow file, so this token must **not** carry a `workflow` scope. Keep it
  separate from whatever credential a human pushes with. Scope it to that one
  repository.
- Set the same three in the CMS's **Vercel** project, not just locally.

### What the CMS actually sends

One `repository_dispatch` with `event_type: publish-blog` and a payload of
`slug`, `title` and the whole markdown file base64-encoded. The file it builds
carries this front matter, which is what `markdownBlog.ts` on the site reads:

```
slug, title, metaTitle, metaDescription, metaKeywords, canonicalUrl, excerpt,
category, targetKeyword, publishDate, publishedTime, readTime,
heroImage, heroImageAlt, ogImageUrl, coverImageAlt,
authorName, authorRole, authorImage, authorUrl, source
```

**Adding a meta tag later is four edits plus a copy**: the field in
`src/collections/Posts.ts`, the column in `scripts/upgrade-db-multisite.mjs`,
the front-matter key in `src/lib/publishToSite.ts`, and the tag in
`articleSeo.ts` — then copy `articleSeo.ts` to all four repos. The site's
`markdownBlog.ts` needs no change: it calls `seoInputFromFrontmatter`, the only
place a front-matter key name appears.

**A new field must also go into `PUBLISHABLE_FIELDS` in `Posts.ts`.** The CMS
only re-dispatches when something a reader would notice has changed; a field
left out of that list saves, reports success, and never leaves the CMS.

### Publishing the first article to production

1. Merge this branch to `main`, so `publish-blog.yml` is on the default branch.
   **Until then nothing publishes** — `repository_dispatch` reads the workflow
   from the default branch only, and there is no way to test one from a feature
   branch.
2. **Set `TARGET_BRANCH` to `main`** in `.github/workflows/publish-blog.yml` on
   the default branch. It ships as `feat/mirgation-to-main-website` so that a
   publish during review lands on the branch under review; left that way after
   the merge, every article commits to a branch nothing deploys.
3. Set the three env vars above (CMS `.env` *and* Vercel).
4. In the portal, pick **OVO Painting** in the site switcher, write or paste an
   article, resolve every image brief (an unresolved `[Feature image — …]` tag
   blocks publishing), and move it to **Published**.
5. Watch the Action in `Homeowner-Marketers-Websites/ovopainting`. It will say
   it ran on `main` — that is where it *runs*; where it *commits* is
   `TARGET_BRANCH`.
6. The article lands at `content/blog/<slug>.md`, Vercel rebuilds, and it is
   live at `https://www.ovopainting.com/resources/<slug>`, on
   `/resources/tips-for-painting`, and in `/sitemap.xml`.

**A post marked `dispatched` in the CMS only means GitHub accepted the
request.** The CMS cannot see whether the workflow later succeeded.

### Before publishing to a slug: the shadow check

A hand-written folder under `src/app/resources/` **beats** a markdown file of
the same slug — a static route segment wins over a dynamic one in Next.js.
Publishing to a slug that already has a folder commits the file, reports
success, and silently keeps showing the old page.

```bash
cd migration-folder/ovopainting
for f in content/blog/*.md; do
  s=$(basename "$f" .md)
  [ -d "src/app/resources/$s" ] && echo "SHADOWED: $s"
done
```

OVO currently has 16 static folders under `src/app/resources/`
(`matte-vs-satin`, `interior-painting-cost`, `white-dove-vs-swiss-coffee`, …).
None collides today. It is a **content** decision, not a code fix: removing the
folder deletes another author's page, and renaming the CMS slug changes the URL.

There is a second, softer collision: a slug that matches a key in
`blogRegistry`. There, **markdown wins** — `getAllBlogPosts()` spreads the
markdown over the registry — so a CMS article can supersede a hand-written one,
and a typo can silently replace one. Check before publishing:

```bash
grep -n '"<slug>":' src/data/blogData.ts
```

---

## Part C — Doing this for the other two websites

`durohomes` and `rangerwebsite` are wired to the CMS in exactly this shape
already, but both checkouts point at development forks
(`lomash-choudhary/durohomes`, `lomash-choudhary/rangerwebsite`). When their
production repos come along, this is the same ten steps with a different set of
per-site values.

### The copy matrix

| File | Durahome | Ranger | How |
|---|---|---|---|
| `src/lib/markdownBlocks.ts` | same | same | `cp`, then `shasum` |
| `src/lib/articleSeo.ts` | same | same | `cp`, then `shasum` |
| `src/lib/articleSchema.ts` | same | same | `cp`, then `shasum` |
| `.github/scripts/validate-blog.mjs` | same | same | `cp` |
| `.github/workflows/publish-blog.yml` | 2 lines differ | 2 lines differ | `cp`, then edit `TARGET_BRANCH` + live URL |
| `src/lib/seoSite.ts` | per site | per site | write ~35 lines |
| `src/lib/markdownBlog.ts` | per site | per site | copy, then change fallback hero + house author |
| `src/components/blog/BlockContent.tsx` | per site | per site | this is the site's styling |
| `src/data/blogData.ts` (or equivalent) | per site | per site | **widen, never copy** |
| `content/blog/` | new | new | README only |

### The per-site values

| | OVO | Durahome | Ranger |
|---|---|---|---|
| `siteName` | OVO Painting | Durahome Painting Plus | Ranger Painting |
| `baseUrl` | `https://www.ovopainting.com` | `https://durahomepainting.com` | `https://www.rangerpainting.com` |
| `blogPath` | `/resources` | `/resources` | `/resources` |
| default branch | `main` | **`design-updates`** — it has no `main` at all | `main` |
| `trailingSlash` | — | **`true`** | — |
| `organizationId` | set | **unset** | **unset** |
| `defaultAuthor` | Sebastian Thomas | must **not** be a `Person` named after the company | — |

**All three serve a CMS publish from `/resources/<slug>`**, so one portal
publish gives one URL shape and a writer never has to remember which site puts
articles where.

### The traps that are specific to each

**Durahome**

- Its repo's **default branch is `design-updates`**. The workflow must live
  there, and Vercel must build that branch. Committing it to a `main` that does
  not exist means `repository_dispatch` never finds it.
- `next.config.ts` sets `trailingSlash: true`, so `seoSite.ts` must set
  `trailingSlash` too — otherwise the canonical points at the redirect rather
  than the page.
- **No `organizationId`.** Its `layout.tsx` *imports* three schema helpers and
  renders none of them. It was given an `organizationId` on the strength of that
  import, and every article then pointed `publisher` at a node on no page on the
  site — a dangling `@id` resolves to nothing, so those articles had **no
  publisher at all**. Grep for the render, not the import:
  `grep -n 'ld+json' src/app/layout.tsx`.
- Its renderer styles with inline `style` objects, and Tailwind's preflight sets
  `list-style: none` on every `ul`/`ol` — inline padding does not undo that. Its
  `BlockContent.tsx` sets `listStyleType` and `display: 'list-item'` by hand,
  and a nested ordered list also needs `start` or it renumbers from one.
- A `<details>` needs a visible toggle: Durahome cannot express a parent's
  `[open]` state in utility classes, so it ships two rules plus
  `summary::-webkit-details-marker { display: none }` as one scoped `<style>`
  inside `FaqPanel`. Without it the FAQ looks like static cards.
- **Durahome lists CMS articles nowhere.** Its sitemap has them and
  `/resources/<slug>` serves them, but `/resources` renders a static hub and no
  page on the site reads `content/blog`. A published article is findable by
  Google and invisible to a human browsing the site. Worth fixing during that
  site's migration — it is the one thing OVO has that Durahome does not.

**Ranger**

- It has **two blog roots** and they must never overlap. Its 19 hand-written
  articles stay at `/blog/<slug>`, where they are indexed; only CMS articles are
  at `/resources`. `/blog` and `/blog/[slug]` read `blogRegistry` **only** —
  never `getAllBlogPosts()`, which also returns markdown. `/resources/[slug]`
  reads `tipsRegistry` plus `getMarkdownPosts()` — never `blogRegistry`. Read
  either root with `getAllBlogPosts()` and the same article becomes reachable at
  two URLs with two canonicals pointing different ways.
- Its `seoSite.ts` therefore has a **second** constant, `SEO_SITE_BLOG`, with
  `blogPath: "/blog"` for the hand-written half.
- Its `/resources` listing is a server `page.tsx` wrapping a client
  `ResourcesContent.tsx`, because the body owns accordions and motion.
  `markdownBlog` is server-only, so the server half reads the markdown and
  passes a trimmed, serialisable array across the boundary. **Do not move that
  `fs` call into the client file.**

**Both** still have the *older* `publish-blog.yml` — OVO's gained the
`TARGET_BRANCH` block, theirs have not. Copy OVO's over before relying on a
branch target there, and re-set the live URL in the summary step.

### Adding a feature after all this

The whole point of the split is that a change has a known blast radius:

- **A markdown feature** (a new block type) = one parser change + **one `case`
  in each of the four renderers**, in the same pass. Anything less and a writer
  gets formatting that works on some sites only.
- **A meta tag** = four edits in the CMS + copy `articleSeo.ts` to all four.
- **A schema property** = one edit in `articleSchema.ts` + copy to all four.
- **Nothing** about the CMS's own document conventions — the Google-Docs
  importer, the `(H2)` markers, the image briefs — reaches a website at all.
  Those run once, in the editor, before the markdown is ever written.

---

## Part D — Reference

### The whole change, as a file list

Nine new files, six edited, nothing deleted.

```
NEW   src/lib/markdownBlocks.ts              copied, byte-identical
NEW   src/lib/articleSeo.ts                  copied, byte-identical
NEW   src/lib/articleSchema.ts               copied, byte-identical
NEW   src/lib/seoSite.ts                     per site
NEW   src/lib/markdownBlog.ts                per site (fallback hero corrected)
NEW   src/components/blog/BlockContent.tsx   per site
NEW   .github/workflows/publish-blog.yml     TARGET_BRANCH: the migration branch
NEW   .github/scripts/validate-blog.mjs      copied, byte-identical
NEW   content/blog/README.md                 the folder the CMS publishes into

EDIT  src/data/blogData.ts                   +49, -0   optional fields only
EDIT  src/app/resources/[slug]/page.tsx      +61, -23  markdown lookup + SEO + schema
EDIT  src/components/blog/BlogDetailPage.tsx +... renders blocks; section.image kept
EDIT  src/app/resources/tips-for-painting/page.tsx  lists markdown, newest first
EDIT  src/app/sitemap.ts                     +3, -3    getAllBlogSlugs()
EDIT  next.config.ts                         +9, -0    **.supabase.co image host
```

Totals: `6 files changed, 231 insertions(+), 65 deletions(-)` on the tracked
files. The 65 deletions are all replaced lines inside the four re-pointed files
— **no article, no route and no component was removed.**

### Things that fail silently, in the order worth checking

When a publish "works" and nothing appears on the site:

1. **Actions disabled in the target repo.** GitHub disables them by default in
   a new fork.
2. **The workflow is not on the target repo's default branch.**
   `repository_dispatch` only looks there.
3. **Vercel is building a different branch** from the one the Action commits to.
4. **Vercel is building a different repo.** This is not hypothetical: while the
   CMS pointed at the fork, `www.ovopainting.com/resources/<slug>` 404'd every
   CMS article even though the markdown was committed and the workflow ran —
   the live domain was simply not built from the repo the CMS published to.
   **Check this before debugging the renderer.**
5. **A static folder shadows the slug** (Part B).
6. **A meta value changed but the post was not re-dispatched.** The CMS only
   re-dispatches when `hasPublishableChange` says something a reader would
   notice changed, so editing a meta description on an already-published post
   changes nothing live until it is dispatched again.

And two that look like the renderer being broken when it is not:

- **A renderer fix lives in the site's repo, so it is not fixed until it is
  pushed there.** Editing `BlockContent.tsx` locally changes nothing a reader
  sees. `git -C <site> rev-list --left-right --count @{u}...HEAD` — local edits
  and `origin` are two different answers to "is it fixed".
- **A local site checkout goes behind after every CMS publish**, because the
  workflow commits to the same branch. `git pull --rebase` first, then push.
  `--rebase` is not optional here: `pull.rebase` is unset on this machine, so a
  bare `git pull` aborts with "Need to specify how to reconcile divergent
  branches", which reads like a broken remote and is not.

### Final checklist for this migration

- [x] Branch `feat/mirgation-to-main-website` created off production `main`
- [x] Four shared files copied and hash-verified against the CMS
- [x] `seoSite.ts` values checked against real files and the layout's `@id`
- [x] `markdownBlog.ts` fallback hero corrected to a file that exists
- [x] `blogData.ts` widened, not replaced — 60 articles intact, zero deletions
- [x] Article route, listing and sitemap read `markdownBlog`
- [x] Production's `section.image` block re-added after the template copy
- [x] `**.supabase.co` added to `images.remotePatterns` (and not `**`)
- [x] `content/blog/` created with README only
- [x] Workflow installed, `TARGET_BRANCH: feat/mirgation-to-main-website`,
      live URL correct
- [x] `tsc` clean, lint not worse (277 → 276), `npm run build` passes
- [x] One real CMS article rendered end to end and then removed
- [x] Five hand-written articles re-checked for regressions
- [ ] **Merge to `main`** — nothing publishes until the workflow is on the
      default branch
- [ ] **Flip `TARGET_BRANCH` to `main`** once merged, or every article commits
      to a branch nothing deploys and the summary quietly says "not live"
- [ ] **Point the CMS at the production repo** — `OVO_GITHUB_REPO` +
      a new `OVO_GITHUB_TOKEN`, locally and in Vercel
- [ ] Publish one article from the portal and confirm the live URL
- [ ] Back-port the `FALLBACK_HERO` fix to `../ovopainting`
