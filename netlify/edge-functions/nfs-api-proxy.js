/**
 * nfs-api-proxy.js — Netlify Edge Function
 * Proxies /joetime/api/* → http://20.165.197.60:8000/api/*
 * Solves mixed-content: HTTPS Netlify page → HTTP VM API
 */

const VM_API = 'http://20.165.197.60:8000';
const COOKIE_NAME = 'nfs_access';
const SECRET      = 'hs-nfs-2026-x7q';
const PASSWORD    = 'dodgers';
const TOKEN       = btoa(`${PASSWORD}:${SECRET}`);

export default async function handler(req, context) {
  // Auth check — must have valid cookie
  const cookies = req.headers.get('cookie') ?? '';
  if (!cookies.includes(`${COOKIE_NAME}=${TOKEN}`)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Strip /joetime prefix, forward to VM
  const url     = new URL(req.url);
  const apiPath = url.pathname.replace(/^\/joetime/, '');
  const target  = `${VM_API}${apiPath}${url.search}`;

  const proxyReq = new Request(target, {
    method:  req.method,
    headers: { 'Content-Type': 'application/json' },
    body:    req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
  });

  const resp = await fetch(proxyReq);

  // 304 pass-through
  if (resp.status === 304) {
    return new Response(null, { status: 304 });
  }

  const body = await resp.text();
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };
  // Forward ETag so browser can skip re-download
  const etag = resp.headers.get('etag');
  if (etag) headers['ETag'] = etag;
  headers['Cache-Control'] = 'no-cache';

  return new Response(body, { status: resp.status, headers });
}
