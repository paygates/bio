const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

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
const sameSite = (req) => {
  const ref = req.headers.get('referer') || req.headers.get('origin');
  if (!ref) return true;
  try { return new URL(ref).host === new URL(req.url).host; } catch (_) { return false; }
};
const note = (title, msg) => new Response(
  `<body style="background:#050505;color:#888;font:14px monospace;padding:24px"><b style="color:#ccc">${title}</b><p>${msg}</p></body>`,
  { headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': 'sandbox' } });

export async function onRequestGet({ request }) {
  if (!sameSite(request)) return new Response('forbidden', { status: 403 });
  const target = new URL(request.url).searchParams.get('url') || '';
  if (blocked(target)) return note('Blocked', 'That address can\u2019t be opened here.');

  let r;
  try {
    r = await fetch(target, { headers: { 'user-agent': UA, accept: request.headers.get('accept') || '*/*', 'accept-language': 'en-US,en;q=0.9' }, redirect: 'follow', cf: { cacheTtl: 300 } });
  } catch (_) { return note('Could not load', 'The site did not respond.'); }

  const final = r.url || target;
  const ct = r.headers.get('content-type') || '';
  const headers = new Headers({
    'content-type': ct,
    'cache-control': 'public, max-age=300',
    'content-security-policy': 'sandbox allow-scripts allow-forms allow-popups',
    'x-robots-tag': 'noindex'
  });
  if (!/text\/html/i.test(ct)) return new Response(r.body, { status: r.status, headers });

  const script = `(function(){var B=${JSON.stringify(final)};function P(u){parent.postMessage({suka:'nav',url:u},'*')}
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var raw=a.getAttribute('href')||'';
if(raw.charAt(0)==='#'){e.preventDefault();var t=document.getElementById(raw.slice(1));if(t)t.scrollIntoView();return}
if(!/^https?:/i.test(a.href))return;e.preventDefault();P(a.href)},true);
document.addEventListener('submit',function(e){var f=e.target;e.preventDefault();if((f.method||'get').toLowerCase()!=='get')return;
var u=new URL(f.getAttribute('action')||B,B);new FormData(f).forEach(function(v,k){if(typeof v==='string')u.searchParams.set(k,v)});P(u.href)},true)})();`;
  const inject = `<base href="${final.replace(/"/g, '&quot;')}"><script>${script}</script>`;
  let done = false;
  return new HTMLRewriter()
    .on('head', { element(e) { done = true; e.prepend(inject, { html: true }); } })
    .on('body', { element(e) { if (!done) { done = true; e.before(inject, { html: true }); } } })
    .on('meta[http-equiv]', { element(e) { const v = (e.getAttribute('http-equiv') || '').toLowerCase(); if (v === 'content-security-policy' || v === 'refresh') e.remove(); } })
    .transform(new Response(r.body, { status: r.status, headers }));
}
