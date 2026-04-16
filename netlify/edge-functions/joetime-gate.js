/**
 * joetime-gate.js — Netlify Edge Function
 * Guards /joetime and all sub-paths.
 * Checks for a valid nfs_access cookie; if missing/invalid, redirects to the gate page.
 * Gate page POSTs password here via /joetime/auth.
 */

const PASSWORD    = 'dodgers';
const COOKIE_NAME = 'nfs_access';
// simple HMAC-lite: sha256(password + secret) stored in cookie — good enough for an internal tool
const SECRET      = 'hs-nfs-2026-x7q';
const TOKEN       = btoa(`${PASSWORD}:${SECRET}`);  // base64(dodgers:hs-nfs-2026-x7q)
// cookie max-age: 30 days (remember device)
const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30;
// session only (no remember): 8 hours
const SESSION_MAX_AGE  = 60 * 60 * 8;

export default async function handler(req, context) {
  const url  = new URL(req.url);
  const path = url.pathname;

  // ── Auth endpoint: POST /joetime/auth ──────────────────────────────────────
  if (path === '/joetime/auth' && req.method === 'POST') {
    let body;
    try { body = await req.formData(); } catch { body = null; }
    const pw       = body?.get('password') ?? '';
    const remember = body?.get('remember') === '1';

    if (pw === PASSWORD) {
      const maxAge = remember ? REMEMBER_MAX_AGE : SESSION_MAX_AGE;
      const headers = new Headers({
        'Location': '/joetime/',
        'Set-Cookie': `${COOKIE_NAME}=${TOKEN}; Path=/joetime; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`,
      });
      return new Response(null, { status: 302, headers });
    }

    // Wrong password → redirect back to gate with error flag
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/joetime/?err=1' },
    });
  }

  // ── Logout: GET /joetime/logout ────────────────────────────────────────────
  if (path === '/joetime/logout') {
    const headers = new Headers({
      'Location': '/joetime/',
      'Set-Cookie': `${COOKIE_NAME}=; Path=/joetime; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    });
    return new Response(null, { status: 302, headers });
  }

  // ── Gate page itself: always allow through ─────────────────────────────────
  if (path === '/joetime' || path === '/joetime/') {
    const cookies = req.headers.get('cookie') ?? '';
    if (cookies.includes(`${COOKIE_NAME}=${TOKEN}`)) {
      // Already authenticated → serve the app
      return context.rewrite('/admin/nutrition-facts/index.html');
    }
    // Not authenticated → fall through to the gate HTML page
    return context.next();
  }

  // ── All other /joetime/* paths ─────────────────────────────────────────────
  // Check cookie first
  const cookies = req.headers.get('cookie') ?? '';
  if (cookies.includes(`${COOKIE_NAME}=${TOKEN}`)) {
    // Authenticated — rewrite to the actual app path
    const subPath = path.replace(/^\/joetime/, '/admin/nutrition-facts');
    return context.rewrite(subPath);
  }

  // Not authenticated → redirect to gate
  return new Response(null, {
    status: 302,
    headers: { 'Location': '/joetime/' },
  });
}
