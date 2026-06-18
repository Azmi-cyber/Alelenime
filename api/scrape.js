const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');

// ============================================
// 🔥 IMPOR SCRAPERS
// ============================================
const nontonanimeid = require('../utils/nontonanimeid');
const anichin = require('../utils/anichin');

// ============================================
// 🔥 CACHE (agar tidak kena blokir IP)
// ============================================
const cache = new NodeCache({ stdTTL: 300 }); // cache 5 menit

// ============================================
// 🔥 RATE LIMITER (batas request)
// ============================================
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 30, // maks 30 request per menit
  message: { success: false, error: 'Terlalu banyak request. Tunggu 1 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// 🔥 APP
// ============================================
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', limiter); // Terapkan rate limit ke semua endpoint /api

// ============================================
// 🔥 HOME
// ============================================
app.get('/', (req, res) => {
  res.json({
    name: 'Alelen!me',
    url: 'https://alelenime.vercel.app',
    version: '2.0.0',
    endpoints: {
      '/api/scrape': 'GET - Semua data (cache 5 menit)',
      '/api/scrape/nontonanimeid': 'GET - Anime dari NontonAnimeID',
      '/api/scrape/nontonanimeid/ongoing': 'GET - Ongoing anime',
      '/api/scrape/nontonanimeid/schedule': 'GET - Jadwal rilis',
      '/api/scrape/anichin': 'GET - Donghua dari Anichin',
      '/api/detail/nontonanimeid?url=...': 'GET - Detail anime',
      '/api/detail/anichin?url=...': 'GET - Detail donghua + download',
      '/api/stream/nontonanimeid?url=...': 'GET - Halaman streaming anime',
      '/api/stream/anichin?url=...': 'GET - Halaman streaming donghua',
      '/api/search?q=...': 'GET - Cari di semua sumber'
    }
  });
});

// ============================================
// 🔥 FUNGSI CACHE WRAPPER
// ============================================
function withCache(key, fn) {
  return async (req, res) => {
    try {
      const cached = cache.get(key);
      if (cached) {
        console.log(`✅ Cache hit: ${key}`);
        return res.json({ success: true, cached: true, data: cached });
      }

      const data = await fn();
      cache.set(key, data);
      res.json({ success: true, cached: false, data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  };
}

// ============================================
// 🔥 ENDPOINTS
// ============================================

// --- ALL SCRAPE ---
app.get('/api/scrape', withCache('all', async () => {
  const [anime, donghua] = await Promise.all([
    nontonanimeid.scrapeAll(),
    anichin.scrapeAll()
  ]);
  return [...anime, ...donghua];
}));

// --- NONTONANIMEID ---
app.get('/api/scrape/nontonanimeid', withCache('nontonanimeid_all', nontonanimeid.scrapeAll));
app.get('/api/scrape/nontonanimeid/ongoing', withCache('nontonanimeid_ongoing', nontonanimeid.scrapeOngoing));
app.get('/api/scrape/nontonanimeid/schedule', withCache('nontonanimeid_schedule', nontonanimeid.scrapeSchedule));

// --- ANICHIN ---
app.get('/api/scrape/anichin', withCache('anichin_all', anichin.scrapeAll));

// --- DETAIL ---
app.get('/api/detail/nontonanimeid', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ success: false, error: 'URL required' });
  const cacheKey = `detail_nontonanimeid_${url}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, cached: true, data: cached });
  const data = await nontonanimeid.scrapeDetail(url);
  cache.set(cacheKey, data);
  res.json({ success: true, cached: false, data });
});

app.get('/api/detail/anichin', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ success: false, error: 'URL required' });
  const cacheKey = `detail_anichin_${url}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, cached: true, data: cached });
  const data = await anichin.scrapeDetail(url);
  cache.set(cacheKey, data);
  res.json({ success: true, cached: false, data });
});

// --- STREAMING ---
app.get('/api/stream/nontonanimeid', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ success: false, error: 'URL required' });
  const data = await nontonanimeid.scrapeStreaming(url);
  res.json({ success: true, data });
});

app.get('/api/stream/anichin', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ success: false, error: 'URL required' });
  const data = await anichin.scrapeStreaming(url);
  res.json({ success: true, data });
});

// --- SEARCH ---
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ success: false, error: 'Query required' });

  const cacheKey = `search_${q.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, cached: true, data: cached });

  const [anime, donghua] = await Promise.all([
    nontonanimeid.scrapeAll(),
    anichin.scrapeAll()
  ]);
  const all = [...anime, ...donghua];
  const filtered = all.filter(item => 
    item.title.toLowerCase().includes(q.toLowerCase())
  );
  cache.set(cacheKey, filtered);
  res.json({ success: true, cached: false, data: filtered });
});

module.exports = app;
