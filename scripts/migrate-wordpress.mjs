// scripts/migrate-wordpress.mjs
// Migrates all WordPress blog posts to Payload CMS (Lexical JSON format)
// Handles: paragraphs, headings, bold/italic, links, lists, blockquotes,
//          inline images (WP CDN URL), YouTube embeds, WP shortcode embeds
//
// Run with: node scripts/migrate-wordpress.mjs

import * as fs from 'fs';

// ─── CONFIG — SET THESE BEFORE RUNNING ───────────────────────────────────────
const WP_BASE_URL        = 'https://www.whitecollaradvice.com';
const AUTHOR_ID          = 1;    // ID of Justin Paperny in your authors table
const PUBLISHED_STAGE_ID = 5;    // ID of "Published" in pipeline_stages table
const BATCH_SIZE         = 10;   // Posts per batch
const OUTPUT_FILE        = './scripts/migration-log.json';
const DRY_RUN            = false; // true = test without writing to DB
// ─────────────────────────────────────────────────────────────────────────────

// ── HELPERS ──────────────────────────────────────────────────────────────────

function stripHtmlTags(html) {
  if (!html) return '';
  const cleaned = html.replace(/<[^>]+>/g, ' ');
  return cleaned
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractYouTubeId(str) {
  // Matches: youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID
  const m = str.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

function createText(text, format = 0) {
  return { type: 'text', text, format, version: 1 };
}

function createParagraph(children) {
  if (typeof children === 'string') children = [createText(children)];
  if (!children || children.length === 0) children = [createText('')];
  return { type: 'paragraph', format: '', indent: 0, version: 1, children };
}

function createHeading(tag, text) {
  return { type: 'heading', tag, format: '', indent: 0, version: 1,
    children: [createText(text)] };
}

function createQuote(text) {
  return { type: 'quote', format: '', indent: 0, version: 1,
    children: [createParagraph(text)] };
}

function createListItem(text, value = 1) {
  return { type: 'listitem', value, format: '', indent: 0, version: 1,
    children: [createText(text)] };
}

function createList(listType, items) {
  return {
    type: 'list', listType, start: 1,
    tag: listType === 'bullet' ? 'ul' : 'ol',
    format: '', indent: 0, version: 1,
    children: items.map((t, i) => createListItem(t, i + 1))
  };
}

// Lexical image node — stores WP CDN URL directly (no upload needed)
function createImageNode(src, alt = '', width = null, height = null) {
  return {
    type: 'image',
    src,
    url: src, // Added for Next.js frontend rendering
    alt: alt || '',
    width: width || undefined,
    height: height || undefined,
    maxWidth: 800,
    format: '',
    version: 1,
  };
}

// Lexical YouTube embed node
function createYouTubeNode(videoId) {
  return {
    type: 'youtube',
    videoID: videoId,
    format: '',
    version: 1,
  };
}

// Generic embed (for non-YouTube iframes)
function createEmbedParagraph(url) {
  return createParagraph([{
    type: 'link',
    url,
    target: '_blank',
    rel: 'noopener noreferrer',
    fields: {
      url,
      newTab: true,
      rel: ['noopener', 'noreferrer']
    },
    format: '',
    indent: 0,
    version: 1,
    children: [createText(url)]
  }]);
}

function stripHtmlTagsPreserveSpaces(html) {
  if (!html) return '';
  let cleaned = html.replace(/<[^>]+>/g, ' ');
  if (!cleaned.trim()) {
    return ' ';
  }
  const hasLeadingSpace = /^\s/.test(html);
  const hasTrailingSpace = /\s$/.test(html);
  let processed = cleaned
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/\s+/g, ' ')
    .trim();

  if (hasLeadingSpace) {
    processed = ' ' + processed;
  }
  if (hasTrailingSpace) {
    processed = processed + ' ';
  }
  return processed.replace(/\s+/g, ' ');
}

// ── INLINE FORMATTER ─────────────────────────────────────────────────────────
// Converts inline HTML (bold, italic, links, images) into Lexical children[]

function parseInlineChildren(html) {
  const children = [];

  // Tokenise inline elements: <strong>, <b>, <em>, <i>, <a>, <img>
  const tokenRe = /(<strong[^>]*>[\s\S]*?<\/strong>|<b[^>]*>[\s\S]*?<\/b>|<em[^>]*>[\s\S]*?<\/em>|<i[^>]*>[\s\S]*?<\/i>|<a [^>]*>[\s\S]*?<\/a>|<img [^>]*\/?>)/gi;
  const parts = html.split(tokenRe);

  for (const part of parts) {
    if (!part) continue;

    if (/^<img /i.test(part)) {
      const src = (part.match(/data-src="([^"]+)"/i) || [])[1]
               || (part.match(/data-lazy-src="([^"]+)"/i) || [])[1]
               || (part.match(/src="([^"]+)"/i) || [])[1];
      const alt   = (part.match(/alt="([^"]*)"/i) || [])[1] || '';
      const w     = parseInt((part.match(/width="(\d+)"/i) || [])[1]);
      const h     = parseInt((part.match(/height="(\d+)"/i) || [])[1]);
      if (src) children.push(createImageNode(src, alt, w || null, h || null));

    } else if (/<(strong|b|em|i)\b/i.test(part)) {
      let format = 0;
      if (/<(strong|b)\b/i.test(part)) format |= 1;
      if (/<(em|i)\b/i.test(part)) format |= 2;
      const text = stripHtmlTagsPreserveSpaces(part);
      if (text) children.push(createText(text, format));

    } else if (/^<a /i.test(part)) {
      const href = (part.match(/href="([^"]+)"/i) || [])[1];
      const text = stripHtmlTagsPreserveSpaces(part);
      let format = 0;
      if (/<(strong|b)\b/i.test(part)) format |= 1;
      if (/<(em|i)\b/i.test(part)) format |= 2;
      
      const originalRel = (part.match(/rel="([^"]+)"/i) || [])[1] || '';
      const relArray = originalRel.split(/\s+/).filter(Boolean);
      const isNofollow = relArray.includes('nofollow');
      const linkRel = ['noopener', 'noreferrer'];
      if (isNofollow) {
        linkRel.push('nofollow');
      }

      if (href && text) {
        children.push({
          type: 'link',
          url: href,
          target: '_blank',
          rel: 'noopener noreferrer',
          fields: {
            url: href,
            newTab: true,
            rel: linkRel
          },
          format: '',
          indent: 0,
          version: 1,
          children: [createText(text, format)]
        });
      } else if (text) {
        children.push(createText(text, format));
      }

    } else {
      const text = stripHtmlTagsPreserveSpaces(part);
      if (text) children.push(createText(text));
    }
  }

  return children.length > 0 ? children : [createText(stripHtmlTagsPreserveSpaces(html))];
}

// ── HTML → LEXICAL NODES ─────────────────────────────────────────────────────

function htmlToLexicalNodes(html) {
  if (!html || !html.trim()) return [createParagraph('')];

  // Strip "About Justin Paperny / About the Author" section at the end of the HTML content
  // Safely strips only the header and immediately following bio paragraph, keeping any trailing elements like videos.
  let cleaned = html.replace(/<(h2|h3)[^>]*>\s*About (Justin Paperny|the Author|Justin)\s*<\/\1>(?:\s*<p[^>]*>[\s\S]*?<\/p>)?/gi, '');

  // 1. Strip WP shortcodes (except embed ones we handle specially)
  cleaned = cleaned
    .replace(/\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/gi, '$1')  // keep caption content
    .replace(/\[gallery[^\]]*\]/gi, '')
    .replace(/\[\/?(vc_|et_)[^\]]*\]/gi, '')  // Visual Composer / Divi
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  const nodes = [];

  // 2. Split HTML into top-level block tokens
  // We process the HTML sequentially, handling each block type
  const blockRe = /<(h[1-6]|p|blockquote|ul|ol|pre|figure|div|iframe|[a-z]+)[^>]*>([\s\S]*?)<\/\1>|<img [^>]*\/?>|\[embed\]([\s\S]*?)\[\/embed\]/gi;

  let lastIndex = 0;
  let match;

  while ((match = blockRe.exec(cleaned)) !== null) {
    // Handle any raw text between blocks
    const before = cleaned.slice(lastIndex, match.index).trim();
    if (before) {
      const text = stripHtmlTags(before);
      if (text) nodes.push(createParagraph(text));
    }
    lastIndex = match.index + match[0].length;

    const fullMatch = match[0];
    const tag       = (match[1] || '').toLowerCase();
    const inner     = match[2] || '';

    // ── YouTube shortcode [embed]URL[/embed]
    if (match[3]) {
      const ytId = extractYouTubeId(match[3].trim());
      if (ytId) {
        nodes.push(createYouTubeNode(ytId));
      } else {
        nodes.push(createEmbedParagraph(match[3].trim()));
      }
      continue;
    }

    // ── Standalone <img>
    if (/^<img /i.test(fullMatch)) {
      const src = (fullMatch.match(/data-src="([^"]+)"/i) || [])[1]
               || (fullMatch.match(/data-lazy-src="([^"]+)"/i) || [])[1]
               || (fullMatch.match(/src="([^"]+)"/i) || [])[1];
      const alt = (fullMatch.match(/alt="([^"]*)"/i) || [])[1] || '';
      const w   = parseInt((fullMatch.match(/width="(\d+)"/i) || [])[1]);
      const h   = parseInt((fullMatch.match(/height="(\d+)"/i) || [])[1]);
      if (src && !src.includes('gravatar')) {
        nodes.push(createImageNode(src, alt, w || null, h || null));
      }
      continue;
    }

    // ── <iframe> — check for YouTube
    if (tag === 'iframe') {
      const src = (fullMatch.match(/src="([^"]+)"/i) || [])[1] || '';
      const ytId = extractYouTubeId(src);
      if (ytId) {
        nodes.push(createYouTubeNode(ytId));
      } else if (src) {
        nodes.push(createEmbedParagraph(src));
      }
      continue;
    }

    // ── Headings
    if (/^h[1-6]$/.test(tag)) {
      const text = stripHtmlTags(inner).trim();
      if (!text) continue;
      const level = parseInt(tag[1]);
      const lexTag = level <= 2 ? 'h2' : level === 3 ? 'h3' : 'h4';
      nodes.push(createHeading(lexTag, text));
      continue;
    }

    // ── Blockquote
    if (tag === 'blockquote') {
      const text = stripHtmlTags(inner).trim();
      if (text) nodes.push(createQuote(text));
      continue;
    }

    // ── Unordered list
    if (tag === 'ul') {
      const items = [];
      const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch;
      while ((liMatch = liRe.exec(inner)) !== null) {
        const t = stripHtmlTags(liMatch[1]).trim();
        if (t) items.push(t);
      }
      if (items.length > 0) nodes.push(createList('bullet', items));
      continue;
    }

    // ── Ordered list
    if (tag === 'ol') {
      const items = [];
      const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch;
      while ((liMatch = liRe.exec(inner)) !== null) {
        const t = stripHtmlTags(liMatch[1]).trim();
        if (t) items.push(t);
      }
      if (items.length > 0) nodes.push(createList('number', items));
      continue;
    }

    // ── <figure> — look for img or YouTube inside
    if (tag === 'figure') {
      const imgMatch = inner.match(/<img [^>]*\/?>/i);
      if (imgMatch) {
        const src = (imgMatch[0].match(/data-src="([^"]+)"/i) || [])[1]
                 || (imgMatch[0].match(/data-lazy-src="([^"]+)"/i) || [])[1]
                 || (imgMatch[0].match(/src="([^"]+)"/i) || [])[1];
        const alt = (imgMatch[0].match(/alt="([^"]*)"/i) || [])[1] || '';
        if (src && !src.includes('gravatar')) {
          nodes.push(createImageNode(src, alt));
        }
      }
      const iframeMatch = inner.match(/<iframe [^>]*src="([^"]+)"/i);
      if (iframeMatch) {
        const ytId = extractYouTubeId(iframeMatch[1]);
        if (ytId) nodes.push(createYouTubeNode(ytId));
        else nodes.push(createEmbedParagraph(iframeMatch[1]));
      }
      // Also extract any caption text
      const caption = inner.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i);
      if (caption) {
        const t = stripHtmlTags(caption[1]).trim();
        if (t) nodes.push(createParagraph([createText(t, 2)])); // italic caption
      }
      continue;
    }

    // ── <pre> / code block
    if (tag === 'pre') {
      const text = stripHtmlTags(inner).trim();
      if (text) {
        nodes.push({
          type: 'code',
          format: '',
          indent: 0,
          version: 1,
          children: [createText(text)]
        });
      }
      continue;
    }

    // ── <p> and everything else — parse inline
    const inlineChildren = parseInlineChildren(inner);

    // Check if p contains only an image
    if (inlineChildren.length === 1 && inlineChildren[0].type === 'image') {
      nodes.push(inlineChildren[0]);
      continue;
    }

    // Check if p contains only a YouTube link
    if (inlineChildren.length === 1 && inlineChildren[0].type === 'link') {
      const ytId = extractYouTubeId(inlineChildren[0].url || '');
      if (ytId) {
        nodes.push(createYouTubeNode(ytId));
        continue;
      }
    }

    // Regular paragraph
    const hasText = inlineChildren.some(c => c.type === 'text' && c.text.trim());
    const hasOther = inlineChildren.some(c => c.type !== 'text');
    if (hasText || hasOther) {
      nodes.push(createParagraph(inlineChildren));
    }
  }

  // Handle any remaining raw text after last block
  const remaining = cleaned.slice(lastIndex).trim();
  if (remaining) {
    // Check for YouTube URL in raw text
    const ytId = extractYouTubeId(remaining);
    if (ytId) {
      nodes.push(createYouTubeNode(ytId));
    } else {
      const text = stripHtmlTags(remaining);
      if (text) nodes.push(createParagraph(text));
    }
  }

  return nodes.length > 0 ? nodes : [createParagraph('')];
}

function buildLexicalContent(nodes) {
  return {
    root: { type: 'root', format: '', indent: 0, version: 1, children: nodes }
  };
}

// ── CATEGORY MAPPING ─────────────────────────────────────────────────────────

function mapToTargetRole(wpPost) {
  try {
    const categories = wpPost._embedded?.['wp:term']?.[0] || [];
    const tags        = wpPost._embedded?.['wp:term']?.[1] || [];
    const all = [...categories, ...tags].map(t => t.name.toLowerCase());

    if (all.some(c => c.includes('pre-sentence') || c.includes('investigation') || c.includes('indictment') || c.includes('plea')))
      return 'Pre-Sentence';
    if (all.some(c => c.includes('post-sentence') || c.includes('prison') || c.includes('bop') || c.includes('rdap') || c.includes('halfway')))
      return 'Post-Sentence';
    if (all.some(c => c.includes('reentry') || c.includes('re-entry') || c.includes('release') || c.includes('probation')))
      return 'Re-Entry';
    if (all.some(c => c.includes('reputation')))
      return 'Reputation';
  } catch (e) {}
  return 'General';
}

// ── READ TIME ────────────────────────────────────────────────────────────────

function estimateReadTime(html) {
  const words = stripHtmlTags(html || '').split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 200))} min read`;
}

// ── FEATURED IMAGE ───────────────────────────────────────────────────────────

function getFeaturedImageUrl(wpPost) {
  try {
    const m = wpPost._embedded?.['wp:featuredmedia']?.[0];
    return m?.source_url
      || m?.media_details?.sizes?.large?.source_url
      || m?.media_details?.sizes?.medium_large?.source_url
      || null;
  } catch { return null; }
}

// ── SLUG ─────────────────────────────────────────────────────────────────────

function generateSlug(wpPost) {
  if (wpPost.slug) return wpPost.slug;
  return stripHtmlTags(wpPost.title?.rendered || 'untitled')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ── BUILD PAYLOAD POST ───────────────────────────────────────────────────────

function buildPayloadPost(wpPost) {
  const title         = stripHtmlTags(wpPost.title?.rendered || 'Untitled');
  const slug          = generateSlug(wpPost);
  const htmlContent   = wpPost.content?.rendered || '';
  const excerpt       = stripHtmlTags(wpPost.excerpt?.rendered || '').slice(0, 300);
  const nodes         = htmlToLexicalNodes(htmlContent);
  const content       = buildLexicalContent(nodes);
  const coverImageUrl = getFeaturedImageUrl(wpPost);
  const targetRole    = mapToTargetRole(wpPost);
  const readTime      = estimateReadTime(htmlContent);
  const publishDate   = wpPost.date ? new Date(wpPost.date).toISOString() : new Date().toISOString();

  // Count node types for logging
  const imageCount   = nodes.filter(n => n.type === 'image').length;
  const youtubeCount = nodes.filter(n => n.type === 'youtube').length;

  return {
    title, slug, excerpt, content,
    author: AUTHOR_ID, stage: PUBLISHED_STAGE_ID,
    targetRole, readTime, publishDate,
    coverImageUrl: coverImageUrl || null,
    views: 0, likes: 0,
    _meta: { imageCount, youtubeCount, nodeCount: nodes.length }
  };
}

// ── SUPABASE INSERT ──────────────────────────────────────────────────────────

async function insertPost(post, supabaseUrl, supabaseKey) {
  const { _meta, ...data } = post; // strip internal meta before insert

  const res = await fetch(`${supabaseUrl}/rest/v1/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      title:           data.title,
      slug:            data.slug,
      excerpt:         data.excerpt,
      content:         data.content,
      author_id:       data.author,
      stage_id:        data.stage,
      target_role:     data.targetRole,
      read_time:       data.readTime,
      publish_date:    data.publishDate,
      cover_image_url: data.coverImageUrl,
      views:           data.views,
      likes:           data.likes,
    }),
  });

  if (res.status === 409) return { skipped: true, reason: 'duplicate slug' };
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status}: ${err}`);
  }

  const json = await res.json();
  return { inserted: true, id: json[0]?.id };
}

// ── LOAD ENV ─────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = './.env';
  if (!fs.existsSync(envPath)) throw new Error('.env file not found');
  const vars = {};
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const [key, ...val] = line.split('=');
    if (key && val.length) vars[key.trim()] = val.join('=').trim().replace(/^["']|["']$/g, '');
  }
  return vars;
}

// ── FETCH WP POSTS ────────────────────────────────────────────────────────────

async function fetchAllWordPressPosts() {
  console.log('📡 Fetching all WordPress posts...');
  let page = 1, totalPages = 1, all = [];

  while (page <= totalPages) {
    const url = `${WP_BASE_URL}/wp-json/wp/v2/posts?per_page=100&page=${page}&_embed=1`;
    process.stdout.write(`   Page ${page}/${totalPages}... `);
    const res = await fetch(url);
    if (!res.ok) { console.log(`❌ ${res.status}`); break; }
    totalPages = parseInt(res.headers.get('X-WP-TotalPages') || '1');
    const posts = await res.json();
    all = all.concat(posts);
    console.log(`✅ ${posts.length} posts`);
    page++;
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\n✅ Total fetched: ${all.length} posts\n`);
  return all;
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 WCA WordPress → Payload CMS Migration');
  console.log('=========================================\n');

  const env = loadEnv();
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  if (DRY_RUN) console.log('⚠️  DRY RUN — nothing will be written\n');

  // Load progress log
  let log = { migrated: [], skipped: [], failed: [] };
  if (fs.existsSync(OUTPUT_FILE)) {
    log = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
    console.log(`📋 Resuming: ${log.migrated.length} already migrated\n`);
  }
  const done = new Set(log.migrated.map(p => p.slug));

  const wpPosts   = await fetchAllWordPressPosts();
  const remaining = wpPosts.filter(p => !done.has(p.slug));

  console.log(`📊 Total: ${wpPosts.length} | Done: ${done.size} | Remaining: ${remaining.length}\n`);
  if (remaining.length === 0) { console.log('✅ Nothing left to migrate!'); return; }

  let inserted = 0, skipped = 0, failed = 0;

  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(remaining.length / BATCH_SIZE);
    console.log(`\n📦 Batch ${batchNum}/${totalBatches} — posts ${i + 1}–${Math.min(i + BATCH_SIZE, remaining.length)}`);

    for (const wpPost of batch) {
      const title = stripHtmlTags(wpPost.title?.rendered || 'Untitled');
      process.stdout.write(`   "${title.slice(0, 55).padEnd(55)}" `);

      try {
        const post   = buildPayloadPost(wpPost);
        const { _meta } = post;

        if (DRY_RUN) {
          const info = [];
          if (_meta.imageCount)   info.push(`${_meta.imageCount} img`);
          if (_meta.youtubeCount) info.push(`${_meta.youtubeCount} yt`);
          console.log(`[DRY RUN] ${_meta.nodeCount} nodes ${info.length ? '(' + info.join(', ') + ')' : ''}`);
          inserted++;
          continue;
        }

        const result = await insertPost(post, SUPABASE_URL, SUPABASE_KEY);

        if (result.skipped) {
          console.log(`⏭  skipped`);
          log.skipped.push({ slug: post.slug, wpId: wpPost.id, reason: result.reason });
          skipped++;
        } else {
          const info = [];
          if (_meta.imageCount)   info.push(`${_meta.imageCount} img`);
          if (_meta.youtubeCount) info.push(`${_meta.youtubeCount} yt`);
          console.log(`✅ id:${result.id} ${info.length ? '(' + info.join(', ') + ')' : ''}`);
          log.migrated.push({ slug: post.slug, wpId: wpPost.id, payloadId: result.id,
            images: _meta.imageCount, youtube: _meta.youtubeCount });
          inserted++;
        }
      } catch (err) {
        console.log(`❌ ${err.message.slice(0, 60)}`);
        log.failed.push({ wpId: wpPost.id, slug: wpPost.slug, error: err.message });
        failed++;
      }

      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(log, null, 2));
      await new Promise(r => setTimeout(r, 150));
    }

    if (i + BATCH_SIZE < remaining.length) {
      process.stdout.write('   ⏳ Cooling down 2s...');
      await new Promise(r => setTimeout(r, 2000));
      console.log(' done');
    }
  }

  // Summary
  console.log('\n=========================================');
  console.log('✅ Migration complete!');
  console.log(`   Inserted : ${inserted}`);
  console.log(`   Skipped  : ${skipped} (duplicate slugs)`);
  console.log(`   Failed   : ${failed}`);

  const totalImages   = log.migrated.reduce((s, p) => s + (p.images   || 0), 0);
  const totalYouTube  = log.migrated.reduce((s, p) => s + (p.youtube  || 0), 0);
  console.log(`   Images migrated  : ${totalImages}`);
  console.log(`   YouTube embeds   : ${totalYouTube}`);
  console.log(`   Log: ${OUTPUT_FILE}\n`);

  if (log.failed.length > 0) {
    console.log('⚠️  Failed posts:');
    for (const f of log.failed) console.log(`   WP ${f.wpId} (${f.slug}): ${f.error}`);
  }
}

main().catch(err => { console.error('\n💥', err); process.exit(1); });
