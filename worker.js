import html from "./index.html";

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
