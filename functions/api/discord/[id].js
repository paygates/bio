const JSON_HEADERS = { 'content-type': 'application/json', 'cache-control': 'public, max-age=1800' };
const send = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });

export async function onRequestGet({ params, env }) {
  const id = String(params.id || '');
  if (!/^\d{17,22}$/.test(id)) return send({}, 400);

  if (env.DISCORD_TOKEN) {
    const r = await fetch(`https://discord.com/api/v10/users/${id}`, {
      headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` },
      cf: { cacheTtl: 1800, cacheEverything: true }
    });
    if (r.ok) return new Response(await r.text(), { status: 200, headers: JSON_HEADERS });
  }

  try {
    const r = await fetch(`https://discord.dog/${id}`, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; SukaWorld/1.0)' },
      cf: { cacheTtl: 1800, cacheEverything: true }
    });
    if (!r.ok) return send({}, 404);
    const html = await r.text();
    const av = html.match(new RegExp(`avatars/${id}/([a-zA-Z0-9_]+)\\.(?:png|gif|webp)`));
    const title = html.match(/<title>\s*([^<]*?)\s*[—–-]\s*Discord\.dog/i);
    return send({
      id,
      username: null,
      global_name: title ? title[1].replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'") : null,
      avatar: av ? av[1] : null
    });
  } catch (_) {
    return send({}, 502);
