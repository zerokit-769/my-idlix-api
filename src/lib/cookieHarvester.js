'use strict';

const BASE_URL = process.env.BASE_URL || 'https://z2.idlixku.com';
const STEALTH_API_URL = process.env.STEALTH_API_URL;

function generateDid() {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

async function stealthServiceFetch(url, { method = 'GET', body, headers = {} } = {}) {
  // Jika URL Stealth belum diatur di Vercel, gagalkan request agar tidak gantung
  if (!STEALTH_API_URL) {
    throw new Error('STEALTH_API_URL is not defined in environment variables.');
  }

  const payload = {
    url,
    method,
    disableMedia: true,
    headers: {
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9',
      ...headers,
    }
  };
  if (body) payload.postData = body;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // Batas aman serverless Vercel

  try {
    const res = await fetch(`${STEALTH_API_URL}/v1/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[stealthClient] HTTP error from stealth service: ${res.status}`);
      return { status: res.status, ok: false, text: '' };
    }

    const data = await res.json();
    if (data.status !== 'ok' || !data.solution) {
      console.warn(`[stealthClient] Stealth failed to solve:`, data);
      return { status: 500, ok: false, text: '' };
    }

    return {
      status: data.solution.status,
      ok: data.solution.status >= 200 && data.solution.status < 300,
      text: data.solution.response || ''
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function browserFetch(url, opts = {}) {
  return stealthServiceFetch(url, opts);
}

async function fetchHtml(url) {
  const res = await browserFetch(url, {
    headers: {
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    }
  });

  if (!res.ok) {
    console.warn(`[stealthClient] fetchHtml warning: ${res.status} on ${url}`);
  }

  return res.text || '';
}

async function getCookieHeader() {
  // Di mode serverless, cookie clearance diurus oleh Worker.
  // Kita cukup kirim device ID (did) tiruan jika API IDLIX memintanya.
  const did = process.env.DID || generateDid();
  const locale = process.env.NEXT_LOCALE || 'en';
  const cf = process.env.CF_CLEARANCE ? `cf_clearance=${process.env.CF_CLEARANCE}; ` : '';
  return `${cf}did=${did}; NEXT_LOCALE=${locale}`;
}

// Ekspor dummy invalidate agar tidak error saat dipanggil oleh fungsi lama
async function invalidate() {}

module.exports = { browserFetch, fetchHtml, getCookieHeader, invalidate };
