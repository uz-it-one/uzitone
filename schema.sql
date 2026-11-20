-- Cloudflare D1 Schema for uzit.one

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
