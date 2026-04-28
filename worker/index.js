/**
 * Notion API CORS Proxy — Cloudflare Worker
 *
 * Sits between your time tracker app and the Notion API.
 * Injects the auth token server-side so it never appears in browser code.
 *
 * ─── SETUP ────────────────────────────────────────────────────────────────
 * 1. In the Cloudflare dashboard, create a new Worker and paste this file.
 * 2. Go to Settings → Variables → add a Secret:
 *      Name:   NOTION_TOKEN
 *      Value:  your ntn_... token
 * 3. Deploy. Copy the Worker URL (looks like
 *      https://notion-proxy.yourname.workers.dev)
 *    — you'll paste it into the time tracker app as WORKER_URL.
 * ──────────────────────────────────────────────────────────────────────────
 */

const NOTION_API     = "https://api.notion.com";
const NOTION_VERSION = "2022-06-28";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {

    // ── CORS preflight ────────────────────────────────────────────────────
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // ── Validate token is configured ──────────────────────────────────────
    if (!env.NOTION_TOKEN) {
      return new Response(
        JSON.stringify({ error: "NOTION_TOKEN secret not set on Worker." }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // ── Forward request to Notion API ─────────────────────────────────────
    const incoming = new URL(request.url);
    const target   = NOTION_API + incoming.pathname + incoming.search;

    const headers = new Headers({
      "Authorization":  `Bearer ${env.NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type":   "application/json",
    });

    const proxied = new Request(target, {
      method:  request.method,
      headers,
      body:    ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    });

    const notion   = await fetch(proxied);
    const response = new Response(notion.body, notion);

    // Attach CORS headers to every response
    Object.entries(CORS).forEach(([k, v]) => response.headers.set(k, v));

    return response;
  },
};
