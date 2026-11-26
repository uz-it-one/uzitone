import type { APIRoute } from 'astro';
import { errorResponse, jsonResponse } from '../../../lib/api';
import { getAdjacentPosts, getBlogPostBySlug } from '../../../lib/db';
import { renderMarkdown } from '../../../lib/markdown';

export const GET: APIRoute = async ({ params, locals }) => {
  const env = locals.runtime?.env;
  const slug = params.slug;
  if (!slug) {
    return errorResponse('Missing slug', 400);
  }

  const post = await getBlogPostBySlug(env, slug, false);
  if (!post) {
    return errorResponse('Post not found', 404);
  }

  const rendered = renderMarkdown(post.content_md);
  const adjacent = await getAdjacentPosts(env, slug);

  return jsonResponse({
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
  });
};
