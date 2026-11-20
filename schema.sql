-- Cloudflare D1 Schema for uzit.one (Optimized for Cloudflare Free Tier)

CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS selected_projects (
    repo_name TEXT PRIMARY KEY,
    display_order INTEGER DEFAULT 0,
    status_label TEXT DEFAULT '진행 중',
    custom_description TEXT,
    cached_lang TEXT,
    cached_stars INTEGER DEFAULT 0,
    cached_url TEXT,
    updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_selected_projects_order
ON selected_projects(display_order ASC, repo_name ASC);

CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    content_md TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    is_published INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_published_created
ON blog_posts(is_published, created_at DESC, id DESC);

-- Remove old default welcome post once if it existed from earlier version
DELETE FROM blog_posts
WHERE slug = 'welcome-to-uzit-one'
  AND NOT EXISTS (SELECT 1 FROM app_meta WHERE key = 'removed_default_welcome_post');

INSERT OR REPLACE INTO app_meta (key, value)
VALUES ('removed_default_welcome_post', '1');
