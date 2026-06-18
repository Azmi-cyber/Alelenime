const axios = require('axios');
const cheerio = require('cheerio');

// 🔥 User-Agent rotasi
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/118.0.0.0 Safari/537.36',
];

// 🔥 Header acak
function getHeaders() {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  return {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
    'Referer': 'https://s13.nontonanimeid.boats/',
    'Cache-Control': 'no-cache',
  };
}

// 🔥 Fetch dengan retry
async function fetchHTML(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url, {
        headers: getHeaders(),
        timeout: 25000,
      });
      return res.data;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
}

// ============================================
// 🔥 1. SCRAPE ONGOING LIST
// ============================================
async function scrapeOngoing() {
  try {
    const html = await fetchHTML('https://s13.nontonanimeid.boats/ongoing-list/');
    const $ = cheerio.load(html);
    const results = [];

    $('.anime-item, .col-anime, .list-item, .ongoing-item').each((i, el) => {
      const title = $(el).find('.title a, .anime-title a, .judul a').text().trim();
      const link = $(el).find('.title a, .anime-title a, .judul a').attr('href');
      const poster = $(el).find('img').attr('src');
      const episode = $(el).find('.episode, .eps, .ep').text().trim() || 'Ongoing';

      if (title) {
        results.push({
          title,
          link: link || null,
          poster: poster || null,
          episode,
          source: 'nontonanimeid',
          type: 'ongoing'
        });
      }
    });

    return results;
  } catch (error) {
    console.error('❌ NontonAnimeID Ongoing error:', error.message);
    return [];
  }
}

// ============================================
// 🔥 2. SCRAPE ANIME LIST
// ============================================
async function scrapeAnimeList() {
  try {
    const html = await fetchHTML('https://s13.nontonanimeid.boats/anime/');
    const $ = cheerio.load(html);
    const results = [];

    $('.anime-item, .col-anime, .list-item, .anime-list-item').each((i, el) => {
      const title = $(el).find('.title a, .anime-title a, .judul a').text().trim();
      const link = $(el).find('.title a, .anime-title a, .judul a').attr('href');
      const poster = $(el).find('img').attr('src');
      const genre = $(el).find('.genre, .genres').text().trim();

      if (title) {
        results.push({
          title,
          link: link || null,
          poster: poster || null,
          genre,
          source: 'nontonanimeid',
          type: 'anime-list'
        });
      }
    });

    return results;
  } catch (error) {
    console.error('❌ NontonAnimeID List error:', error.message);
    return [];
  }
}

// ============================================
// 🔥 3. SCRAPE SCHEDULE (Jadwal Rilis)
// ============================================
async function scrapeSchedule() {
  try {
    const html = await fetchHTML('https://s13.nontonanimeid.boats/jadwal-rilis/');
    const $ = cheerio.load(html);
    const schedule = { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] };
    
    const dayMap = {
      'senin': 'monday', 'selasa': 'tuesday', 'rabu': 'wednesday',
      'kamis': 'thursday', 'jumat': 'friday', 'sabtu': 'saturday', 'minggu': 'sunday'
    };

    let currentDay = null;
    $('h3, .day-title, .schedule-day, .jadwal-day').each((i, el) => {
      const text = $(el).text().trim().toLowerCase();
      for (const [key, val] of Object.entries(dayMap)) {
        if (text.includes(key)) { currentDay = val; break; }
      }
    });

    $('.anime-item, .schedule-item, .list-item').each((i, el) => {
      const title = $(el).find('.title a, .anime-title').text().trim();
      const link = $(el).find('.title a, .anime-title a').attr('href');
      const time = $(el).find('.time, .jam').text().trim();
      if (title && currentDay && schedule[currentDay]) {
        schedule[currentDay].push({ title, link, time });
      }
    });

    return schedule;
  } catch (error) {
    console.error('❌ NontonAnimeID Schedule error:', error.message);
    return null;
  }
}

// ============================================
// 🔥 4. SCRAPE POPULAR SERIES
// ============================================
async function scrapePopular() {
  try {
    const html = await fetchHTML('https://s13.nontonanimeid.boats/popular-series/');
    const $ = cheerio.load(html);
    const results = [];

    $('.anime-item, .popular-item, .col-anime').each((i, el) => {
      const title = $(el).find('.title a, .anime-title a').text().trim();
      const link = $(el).find('.title a, .anime-title a').attr('href');
      const poster = $(el).find('img').attr('src');
      if (title) {
        results.push({ title, link, poster, source: 'nontonanimeid', type: 'popular' });
      }
    });

    return results;
  } catch (error) {
    console.error('❌ NontonAnimeID Popular error:', error.message);
    return [];
  }
}

// ============================================
// 🔥 5. SCRAPE DETAIL ANIME
// ============================================
async function scrapeDetail(url) {
  try {
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    const title = $('h1.entry-title, h1.title, .title-anime').first().text().trim();
    const poster = $('.thumb img, .poster img, .wp-post-image').attr('src');
    const synopsis = $('.sinopsis, .desc, .entry-content p, .summary').first().text().trim();

    // Info
    const info = {};
    $('.info-table tr, .info th, .info td, .detail-info tr').each((i, el) => {
      const text = $(el).text().trim();
      if (text.includes(':')) {
        const [key, ...val] = text.split(':');
        info[key.trim()] = val.join(':').trim();
      }
    });

    // Episode list
    const episodes = [];
    $('.episodelist ul li a, .list-episode li a, .episode-list a').each((i, el) => {
      const epTitle = $(el).text().trim();
      const epLink = $(el).attr('href');
      if (epTitle) episodes.push({ title: epTitle, link: epLink });
    });

    // Streaming links
    const streams = [];
    $('.download-link a, .mirror-link a, .streaming-link a, .link-download a').each((i, el) => {
      const label = $(el).text().trim();
      const href = $(el).attr('href');
      if (href && href.startsWith('http')) streams.push({ label: label || 'Link', href });
    });

    return { title, poster, synopsis, info, episodes, streams, source: 'nontonanimeid' };
  } catch (error) {
    console.error('❌ NontonAnimeID Detail error:', error.message);
    return null;
  }
}

// ============================================
// 🔥 6. SCRAPE STREAMING PAGE (Episode)
// ============================================
async function scrapeStreaming(url) {
  try {
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    const title = $('h1.entry-title, h1.title').first().text().trim();
    const poster = $('.thumb img, .poster img').attr('src');

    // Link streaming (iframe / video)
    const streams = [];
    $('iframe, .player iframe, .streaming iframe').each((i, el) => {
      const src = $(el).attr('src');
      if (src) streams.push({ label: `Server ${i+1}`, href: src });
    });

    // Link download
    const downloads = [];
    $('.download-link a, .mirror a, .download a').each((i, el) => {
      const label = $(el).text().trim();
      const href = $(el).attr('href');
      if (href && href.startsWith('http')) downloads.push({ label: label || `Download ${i+1}`, href });
    });

    return { title, poster, streams, downloads, source: 'nontonanimeid' };
  } catch (error) {
    console.error('❌ NontonAnimeID Streaming error:', error.message);
    return null;
  }
}

module.exports = {
  scrapeOngoing,
  scrapeAnimeList,
  scrapeSchedule,
  scrapePopular,
  scrapeDetail,
  scrapeStreaming,
  // Gabungan
  scrapeAll: async () => {
    const [ongoing, animeList, popular] = await Promise.all([
      scrapeOngoing(),
      scrapeAnimeList(),
      scrapePopular()
    ]);
    const all = [...ongoing, ...animeList, ...popular];
    const seen = new Set();
    return all.filter(item => {
      const key = item.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
};
