import html from "./index.html";
import css from "./app-css.txt";
import app from "./app-client.txt";

const PATH_PREFIXES = ["/gamble", "/clublambda"];

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const prefix = PATH_PREFIXES.find((item) => {
      return url.pathname === item || url.pathname.startsWith(`${item}/`);
    });

    if (!prefix) {
      return new Response("Not found", { status: 404 });
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
