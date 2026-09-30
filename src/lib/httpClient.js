'use strict';

// Ambil BASE_URL dari environment Vercel, fallback ke URL default
const BASE_URL = process.env.BASE_URL || 'https://z2.idlixku.com';

// Path disesuaikan dengan struktur folder baru (tanpa cfBypass/)
const { fetchHtml, browserFetch } = require('./cookieHarvester');
const { getStreamData, getEpisodeStreamData } = require('./streamClient');

// In-flight deduplication cache
const _pendingRequests = new Map();

function deduplicatedFetch(key, fn) {
  if (_pendingRequests.has(key)) {
    return _pendingRequests.get(key);
  }

  const promise = (async () => {
    try {
      return await fn();
    } finally {
      _pendingRequests.delete(key);
    }
  })();

  _pendingRequests.set(key, promise);
  return promise;
}

// ── Public API ──────────────────────────────────────────────────────────────────

const httpClient = {
  async get(path) {
    const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    return deduplicatedFetch(`html:${url}`, async () => {
      const data = await fetchHtml(url);
      return { data };
    });
  },

  async getJson(path) {
    const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    return deduplicatedFetch(`json:${url}`, async () => {
      const res = await browserFetch(url, {
        headers: { accept: 'application/json' },
      });
      if (!res.ok) return null;
      try { return JSON.parse(res.text); } catch (_) { return null; }
    });
  },

  async getStreamData(slug) {
    return getStreamData(slug);
  },

  async getEpisodeStreamData(slug, season, episode) {
    return getEpisodeStreamData(slug, season, episode);
  },

  async close() {}
};

module.exports = httpClient;
