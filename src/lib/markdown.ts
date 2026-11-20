import { Marked, Renderer } from 'marked';

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export interface RenderedMarkdown {
  html: string;
  toc: TocItem[];
  readingTimeMinutes: number;
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .trim()
    .replace(/[^\w\s가-힣-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function calculateReadingTime(markdown: string): number {
  const cleanText = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*`~>\-[\]()!]/g, ' ')
    .trim();
  if (!cleanText) return 1;
  const words = cleanText.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
}

export function renderMarkdown(markdown: string): RenderedMarkdown {
  const toc: TocItem[] = [];
  const slugCounts = new Map<string, number>();

  const renderer = new Renderer();

  renderer.heading = ({ text, depth }) => {
    const baseSlug = slugifyHeading(text) || `section-${toc.length + 1}`;
    const count = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, count + 1);
    const id = count === 0 ? baseSlug : `${baseSlug}-${count}`;

    if (depth >= 1 && depth <= 3) {
      toc.push({
        id,
        text: text.replace(/<[^>]*>/g, ''),
        level: depth,
      });
    }

    return `<h${depth} id="${id}" class="scroll-mt-24 group"><a href="#${id}" class="no-underline hover:underline">${text}</a></h${depth}>`;
  };

  renderer.code = ({ text, lang }) => {
    const language = (lang || 'text').trim();
    const escaped = escapeHtml(text);
    return `
<div class="code-block-wrapper my-5 rounded-lg border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface overflow-hidden">
  <div class="flex items-center justify-between px-4 py-2 border-b border-light-border dark:border-dark-border text-xs font-mono text-light-secondary dark:text-dark-secondary">
    <span>${escapeHtml(language)}</span>
    <button type="button" class="copy-code-btn px-2 py-0.5 rounded border border-light-border dark:border-dark-border hover:text-light-primary dark:hover:text-dark-primary transition-colors">Copy</button>
  </div>
  <pre class="p-4 overflow-x-auto text-sm font-mono leading-relaxed m-0 bg-transparent"><code class="language-${escapeHtml(language)}">${escaped}</code></pre>
</div>`;
  };

  const markedInstance = new Marked({
    gfm: true,
    breaks: true,
    renderer,
  });

  const rawHtml = markedInstance.parse(markdown) as string;
  // Strip any raw <script> tags for safety
  const safeHtml = rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  return {
    html: safeHtml,
    toc,
    readingTimeMinutes: calculateReadingTime(markdown),
  };
}
