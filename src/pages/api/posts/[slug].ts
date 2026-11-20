import type { APIRoute } from 'astro';
import { getAdjacentPosts, getBlogPostBySlug } from '../../../lib/db';
import { renderMarkdown } from '../../../lib/markdown';

export const GET: APIRoute = async ({ params, locals }) => {
  const env = locals.runtime?.env;
  const slug = params.slug;
  if (!slug) {
    return new Response(JSON.stringify({ error: 'Missing slug' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const post = await getBlogPostBySlug(env, slug, false);
  if (!post) {
    return new Response(JSON.stringify({ error: 'Post not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const rendered = renderMarkdown(post.content_md);
  const adjacent = await getAdjacentPosts(env, slug);

  return new Response(
    JSON.stringify({
      post: {
        ...post,
        html: rendered.html,
        toc: rendered.toc,
        reading_time: rendered.readingTimeMinutes,
      },
      adjacent: {
        prev: adjacent.prev ? { slug: adjacent.prev.slug, title: adjacent.prev.title } : null,
        next: adjacent.next ? { slug: adjacent.next.slug, title: adjacent.next.title } : null,
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }
  );
};
