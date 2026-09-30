'use strict';

/**
 * CacheService dengan dukungan Upstash Redis untuk Vercel Serverless,
 * serta fallback In-Memory (Map) untuk pengujian lokal/Jest.
 */

let Redis;
try {
  Redis = require('@upstash/redis').Redis;
} catch (_) {
  Redis = null;
}

class CacheService {
  constructor() {
    /** @type {Map<string, {data: *, timestamp: number}>} */
    this._store = new Map();

    // Inisialisasi Upstash Redis jika variabel environment tersedia di Vercel
    this._redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN && Redis)
      ? Redis.fromEnv()
      : null;
  }

  /**
   * Memeriksa apakah entri cache tersedia dan belum kedaluwarsa.
   * @param {string} key
   * @param {number} ttlHours
   * @returns {boolean}
   */
  isHit(key, ttlHours) {
    const entry = this._store.get(key);
    if (!entry) return false;
    return (Date.now() - entry.timestamp) < ttlHours * 3_600_000;
  }

  /**
   * Mengambil data dari cache.
   * @param {string} key
   * @returns {*} Data yang disimpan, atau null jika tidak ada.
   */
  get(key) {
    const entry = this._store.get(key);
    return entry ? entry.data : null;
  }

  /**
   * Menyimpan data ke dalam cache (simpan ke memori lokal & async sync ke Redis jika ada).
   * @param {string} key
   * @param {*} data
   */
  set(key, data) {
    const timestamp = Date.now();
    this._store.set(key, { data, timestamp });

    // Sinkronisasi asynchronous ke Redis di Vercel jika terhubung
    if (this._redis) {
      this._redis.set(key, JSON.stringify({ data, timestamp })).catch(err => {
        console.warn(`[Redis] Gagal menyimpan key ${key}:`, err.message);
      });
    }
  }

  /**
   * Menghapus semua entri cache.
   */
  clear() {
    this._store.clear();
    if (this._redis) {
      this._redis.flushdb().catch(() => {});
    }
  }
}

const instance = new CacheService();
module.exports = instance;
module.exports.CacheService = CacheService;
