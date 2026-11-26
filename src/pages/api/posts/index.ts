import type { APIRoute } from 'astro';
import { jsonResponse } from '../../../lib/api';
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

  const formattedPosts = posts.map((post) => ({
    id: post.id,
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    tags: post.tags,
    created_at: post.created_at,
    updated_at: post.updated_at,
    reading_time: calculateReadingTime(post.content_md),
  }));

  return jsonResponse({ posts: formattedPosts });
};
