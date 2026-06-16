export async function onRequest(context) {
  const url = new URL(context.request.url);

  const target =
    "https://situated-pendant-twelve-persons.trycloudflare.com" +
    url.pathname.replace("/api", "/api") +
    url.search;

  return fetch(target, {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.body,
  });
}
