import { handleLead } from "./lead.js";

/**
 * Cloudflare Worker: статика из ASSETS + POST /api/lead → Telegram.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/lead") {
      return handleLead(request, env);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("ASSETS binding missing", { status: 500 });
  },
};
