function blocked(u) {
  try {
    const x = new URL(u), h = x.hostname.toLowerCase();
    if (!/^https?:$/.test(x.protocol)) return true;
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.includes(':')) return true;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
      const [a, b] = h.split('.').map(Number);
      if (a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return true;
    }
    return false;
  } catch (_) { return true; }
}
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });

export async function onRequestPost({ request }) {
  const ref = request.headers.get('referer') || request.headers.get('origin');
  if (ref) { try { if (new URL(ref).host !== new URL(request.url).host) return json({ error: 'forbidden' }, 403); } catch (_) { return json({ error: 'forbidden' }, 403); } }
  let o; try { o = await request.json(); } catch (_) { return json({ error: 'bad request' }, 400); }
  const method = String(o.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'].includes(method)) return json({ error: 'method not allowed' }, 405);
  if (blocked(o.url)) return json({ error: 'blocked host' }, 403);
  try {
    const r = await fetch(o.url, {
      method, headers: { 'user-agent': 'curl/8.5.0', accept: '*/*', ...(o.headers || {}) },
      body: ['GET', 'HEAD'].includes(method) ? undefined : o.body, redirect: 'follow'
    });
    const buf = await r.arrayBuffer();
    const ct = r.headers.get('content-type') || '';
    const text = /text|json|xml|javascript|svg|html/i.test(ct) || !ct;
    const MAX = 500000;
    let body = text ? new TextDecoder().decode(buf.byteLength > MAX ? buf.slice(0, MAX) : buf) : `[binary data, ${buf.byteLength} bytes, ${ct}]`;
    if (text && buf.byteLength > MAX) body += '\n[truncated]';
    return json({ url: r.url, status: r.status, statusText: r.statusText, http: 'HTTP/2', headers: [...r.headers.entries()], body });
  } catch (e) { return json({ error: String(e.message || e) }, 502); }
}
