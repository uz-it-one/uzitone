import type { APIRoute } from 'astro';
import { getBlogPosts } from '../../../lib/db';
import { calculateReadingTime } from '../../../lib/markdown';

export const GET: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;
  const url = new URL(request.url);
  const tag = url.searchParams.get('tag') ?? undefined;
  const search = url.searchParams.get('search') ?? undefined;

  const posts = await getBlogPosts(env, {
    includeDrafts: false,
    tag,
    search,
  });

  const formatted = posts.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    tags: p.tags,
    created_at: p.created_at,
    updated_at: p.updated_at,
    reading_time: calculateReadingTime(p.content_md),
  }));

  return new Response(JSON.stringify({ posts: formatted }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
