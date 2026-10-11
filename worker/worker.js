/**
 * 무무스테이션 — mumuworld.com 서브도메인 중개기.
 *
 * 교육청 망에서 *.vercel.app 이 막히는 일이 많아, 앱을 자기 vercel 주소 대신
 * `앱이름.mumuworld.com` 으로 연다. 이 Worker 가 그 주소로 온 요청을 받아
 * 원래 vercel 앱에서 대신 받아다 건넨다. 학생 브라우저에는 Cloudflare 만 보이고
 * vercel 주소는 한 번도 드러나지 않는다.
 *
 * 앱을 하나 더 붙이려면 아래 APPS 에 한 줄, wrangler.toml 의 routes 에 한 줄.
 */
const APPS = {
  sosuworld: { url: 'https://sosu-dungeon.vercel.app', name: '소수 던전 · 4-2 수학 3단원' },
};

const ROOT = 'mumuworld.com';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // 뿌리 주소 — 앱 링크만 몇 줄. 목록 사이트는 두지 않는다.
    if (url.hostname === ROOT) return index();

    const sub = url.hostname.slice(0, -(ROOT.length + 1));
    const app = APPS[sub];
    if (!app) return new Response('주소를 확인해 주세요.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });

    const origin = new URL(app.url);
    const target = new URL(url.pathname + url.search, origin);

    // Host 는 대상 주소가 정한다. 학생 쪽 Host 를 그대로 넘기면 vercel 이 앱을 못 찾는다.
    const headers = new Headers(request.headers);
    headers.delete('host');

    const res = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? null : request.body,
      redirect: 'manual',
    });

    /*
     * 원래 앱의 흔적을 지운다.
     * HTTPS 라 망 필터는 보통 머리글을 못 보지만, 학교에 따라 인증서를 깔아 두고
     * 내용을 들여다보는 필터(SSL 검사)를 쓰기도 한다. 그때는 x-vercel-* 머리글이
     * 그대로 보인다 — 지우는 데 드는 것이 없으니 지운다.
     */
    const h = new Headers(res.headers);
    for (const k of [...h.keys()]) if (k.startsWith('x-vercel')) h.delete(k);
    h.delete('server');

    // 앱이 리디렉트를 내면 vercel 주소가 학생에게 드러난다 — 우리 주소로 고쳐서 넘긴다.
    const loc = res.headers.get('location');
    if (loc) {
      const l = new URL(loc, origin);
      if (l.origin === origin.origin) {
        h.set('location', new URL(l.pathname + l.search + l.hash, url.origin).toString());
      }
    }
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  },
};

function index() {
  const links = Object.entries(APPS)
    .map(([sub, a]) => `<li><a href="https://${sub}.${ROOT}/">${a.name}</a></li>`)
    .join('');
  return new Response(
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>무무스테이션</title><meta name="robots" content="noindex"><style>` +
      `body{background:#14100d;color:#b8a68a;font-family:system-ui,'Malgun Gothic',sans-serif;margin:0;min-height:100vh;display:grid;place-items:center}` +
      `ul{list-style:none;padding:0;line-height:2.4}a{color:#f0a92e;font-size:18px;text-decoration:none}</style></head>` +
      `<body><ul>${links}</ul></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}
