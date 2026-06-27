import html from "./index.html";
import css from "./app-css.txt";
import app from "./app-client.txt";

const PATH_PREFIXES = ["/gamble", "/clublambda"];
const FONT_NAMES = new Set([
  "Exposure-205TF-VAR.woff2",
  "Exposure-205TF-VAR-Italic.woff2",
  "OpenRunde-Regular.woff2",
  "OpenRunde-Medium.woff2",
  "JetBrainsMono-Variable.woff2"
]);

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const prefix = PATH_PREFIXES.find((item) => {
      return url.pathname === item || url.pathname.startsWith(`${item}/`);
    });

    if (!prefix) {
      return new Response("Not found", { status: 404 });
    }

    if (url.pathname.startsWith(`${prefix}/fonts/`)) {
      const fontName = decodeURIComponent(url.pathname.split("/").pop() || "");
      if (!FONT_NAMES.has(fontName)) {
        return new Response("Not found", { status: 404 });
      }

      const fontResponse = await fetch(`https://21.community.poke.site/fonts/${fontName}`, {
        cf: { cacheTtl: 86400, cacheEverything: true }
      });

      if (!fontResponse.ok) {
        return new Response("Font unavailable", { status: 502 });
      }

      return new Response(fontResponse.body, {
        headers: {
          "content-type": "font/woff2",
          "cache-control": "public, max-age=86400"
        }
      });
    }

    if (url.pathname === `${prefix}/app.css`) {
      return new Response(css, {
        headers: {
          "content-type": "text/css; charset=utf-8",
          "cache-control": "public, max-age=120"
        }
      });
    }

    if (url.pathname === `${prefix}/app.js`) {
      return new Response(app.replaceAll("__CLUB_LAMBDA_BASE__", prefix), {
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "public, max-age=120"
        }
      });
    }

    const headers = new Headers({
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=120"
    });

    headers.set("x-club-lambda-route", prefix);

    return new Response(html.replaceAll("__CLUB_LAMBDA_BASE__", prefix), {
      headers
    });
  }
};
