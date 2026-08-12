# Blog Migration Guide & Instructions

This guide outlines the complete workflow, key files, and checklist that every developer and AI agent **MUST** read and follow before migrating any WordPress blog posts to this Payload CMS + Next.js repository.

---

## 📂 Key Files to Review

Before writing or running any migration script, familiarize yourself with these files in the repository:

1. [scripts/migrate-wordpress.mjs](file:///Users/nikhilshekhawat/Desktop/whitecollarblogs/scripts/migrate-wordpress.mjs)
   * The core migration script. It fetches WordPress content and converts HTML into the **Lexical JSON AST format** expected by Payload CMS.
2. [src/app/(public)/blogs/[slug]/page.tsx](file:///Users/nikhilshekhawat/Desktop/whitecollarblogs/src/app/(public)/blogs/%5Bslug%5D/page.tsx)
   * The Next.js frontend route that renders the blog posts. It handles parsing of Lexical nodes (paragraphs, images, headings, code, and YouTube embeds).
3. [.env](file:///Users/nikhilshekhawat/Desktop/whitecollarblogs/.env)
   * Environment configuration containing the PostgreSQL database uri, Payload encryption secret, and Supabase S3 storage details.

---

## 🚀 The Migration Workflow

Follow these steps exactly to migrate any new blog post:

### Step 1: Audit the Original Post
Before migrating, open the original post on `whitecollaradvice.com` (e.g., using Playwright or a browser) and document:
* **Inline images:** How many are in the body? What are their aspect ratios/original sizes?
* **Video embeds:** Are there any YouTube videos or non-YouTube iframes? Note the video IDs.
* **Layout details:** Does it show a cover image at the top of the body container? (Original posts generally **do not** show cover images at the top of detail pages).

### Step 2: Configure and Run the Migration
1. Update `scripts/migrate-wordpress.mjs` with your target slugs, credentials, or batch size.
2. Run the migration script locally:
   ```bash
   node scripts/migrate-wordpress.mjs
   ```
3. Run verification queries to inspect the inserted database contents (e.g. `SELECT content FROM posts WHERE slug = 'your-slug';`) and ensure the Lexical JSON structure parsed successfully.

### Step 3: Run a Local Build & Verify Rendering
1. Compile the Next.js site locally to ensure no compilation/type errors:
   ```bash
   npm run build
   ```
2. Start the local server and verify details visually:
   ```bash
   npm run dev
   ```
3. Check all aspects of the layout:
   * **Inline Image Sharpness:** Ensure small thumbnail images (like book covers) are sharp and constrained to their natural dimensions (no blurry stretching).
   * **YouTube Video rendering:** Verify the player loads and plays properly.
   * **No Cover Image on Top:** Confirm there is no duplicate featured image rendered at the top of the post.

### Step 4: Deploy to Vercel
> [!IMPORTANT]
> GitHub pushes do not automatically trigger Vercel builds due to webhook limitations. You must run a manual CLI production build/deploy to see your updates live.

Run the Vercel production deploy:
```bash
npx vercel deploy --prod
```

---

## ⚠️ Common Gotchas & Troubleshooting

### 1. Blurry / Stretched Body Images
If you notice that small inline thumbnail images are blown up to full width and look blurry:
* **The Cause:** Tailwind/global CSS resetting all body images to `w-full`.
* **The Fix:** Ensure `renderContent` extracts the original `width` attribute from the image node and applies it as a max-width constraint:
  ```tsx
  style={{ maxWidth: node.width ? `${node.width}px` : '100%', height: 'auto' }}
  ```

### 2. Missing Video Embeds
WordPress often stores YouTube video embeds as raw URLs (oembed format) or customized iframe shortcodes.
* **The Cause:** Next.js template lacks rendering code for the custom `youtube` block node.
* **The Fix:** Ensure the `youtube` node type is handled in `renderContent` inside `page.tsx` and maps correctly to an `iframe` with the correct `videoId`.

### 3. Duplicate Banner/Cover Image
The user has requested that **no featured/cover images** should show up at the top of detail pages, as it does not match the original layout.
* **The Cause:** Rendering `resolvedCoverImageUrl` at the top of the dynamic component.
* **The Fix:** Keep the cover image in the database for search cards and listings, but do **not** render it at the top of `page.tsx`.

---

## 📋 Pre-Launch Check

Before declaring a migration complete, verify the migrated post on Vercel against this checklist:
- [ ] Original WordPress text matches the migrated text exactly.
- [ ] No duplicate cover image displays at the top of the page.
- [ ] Inline body images render at correct relative widths with no blurriness.
- [ ] All YouTube embeds display correctly and can play.
- [ ] Headings render in the correct size hierarchy (`h1`, `h2`, `h3`).
- [ ] Desktop and mobile layout layouts are responsive and look premium.
