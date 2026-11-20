/// <reference path="../.astro/types.d.ts" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

interface Env {
  DB?: D1Database;
  KV?: KVNamespace;
  ADMIN_PASSWORD?: string;
  GITHUB_TOKEN?: string;
}

declare namespace App {
  interface Locals extends Runtime {}
}
