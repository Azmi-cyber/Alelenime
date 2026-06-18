const axios = require('axios');
const cheerio = require('cheerio');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36',
];

function getHeaders() {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  return {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
    'Referer': 'https://anichin.moe/',
  };
}

async function fetchHTML(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url, { headers: getHeaders(), timeout: 25000 });
      return res.data;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
}

// ============================================
// 🔥 1. SCRAPE HOME + DONGHUA LIST
// ============================================
async function scrapeDonghuaList() {
  try {
    const html = await fetchHTML('https://anichin.moe/anime/');
    const $ = cheerio.load(html);
    const results = [];

    $('.anime-card, .donghua-card, .card-anime, .col-anime, .anime-item').each((i, el) => {
      const title = $(el).find('.title a, .anime-title a, .judul a').text().trim();
      const link = $(el).find('.title a, .anime-title a, .judul a').attr('href');
      const poster = $(el).find('img').attr('src');
      const episode = $(el).find('.episode, .eps, .ep').text().trim() || 'Ongoing';
      const genre = $(el).find('.genre, .genres').text().trim();

      if (title && link) {
        results.push({
          title,
          link: link.startsWith('http') ? link : `https://anichin.moe${link}`,
          poster: poster || null,
          episode,
          genre,
          source: 'anichin',
          type: 'donghua-list'
        });
      }
    });

    return results;
  } catch (error) {
    console.error('❌ Anichin List error:', error.message);
    return [];
  }
}

// ============================================
// 🔥 2. SCRAPE SCHEDULE
// ============================================
async function scrapeSchedule() {
  try {
    const html = await fetchHTML('https://anichin.moe/schedule/');
    const $ = cheerio.load(html);
    const schedule = { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] };
    
    const dayMap = {
      'senin': 'monday', 'selasa': 'tuesday', 'rabu': 'wednesday',
      'kamis': 'thursday', 'jumat': 'friday', 'sabtu': 'saturday', 'minggu': 'sunday'
    };

    let currentDay = null;
    $('h3, .day-title, .schedule-day').each((i, el) => {
      const text = $(el).text().trim().toLowerCase();
      for (const [key, val] of Object.entries(dayMap)) {
        if (text.includes(key)) { currentDay = val; break; }
      }
    });

    $('.schedule-item, .anime-item, .col-anime').each((i, el) => {
      const title = $(el).find('.title a, .anime-title').text().trim();
      const link = $(el).find('.title a, .anime-title a').attr('href');
      const time = $(el).find('.time, .jam').text().trim();
      if (title && currentDay && schedule[currentDay]) {
        schedule[currentDay].push({
          title,
          link: link ? (link.startsWith('http') ? link : `https://anichin.moe${link}`) : null,
          time
        });
      }
    });

    return schedule;
  } catch (error) {
    console.error('❌ Anichin Schedule error:', error.message);
    return null;
  }
}

// ============================================
// 🔥 3. SCRAPE DETAIL DONGHUA
// ============================================
async function scrapeDetail(url) {
  try {
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    const title = $('h1.entry-title, h1.title').first().text().trim();
    const poster = $('.poster img, .thumb img, .wp-post-image').attr('src');
    const synopsis = $('.sinopsis, .desc, .entry-content p, .summary').first().text().trim();

    // Info
    const info = {};
    $('.info-table tr, .info-list li, .detail-info tr').each((i, el) => {
      const key = $(el).find('th, .label, .name').text().trim().replace(':', '');
      const value = $(el).find('td, .value, .desc').text().trim();
      if (key && value) info[key] = value;
    });

    // Episode list
    const episodes = [];
    $('.episode-list a, .eps-list a, .list-episode a').each((i, el) => {
      const epTitle = $(el).text().trim();
      const epLink = $(el).attr('href');
      if (epTitle) {
        episodes.push({
          title: epTitle,
          link: epLink ? (epLink.startsWith('http') ? epLink : `https://anichin.moe${epLink}`) : null
        });
      }
    });

    // 🔥 DOWNLOAD LINKS (ini yang kamu minta!)
    const downloads = [];
    $('.download-link a, .mirror a, .download a, .link-download a').each((i, el) => {
      const label = $(el).text().trim();
      const href = $(el).attr('href');
      if (href && href.startsWith('http')) {
        downloads.push({ label: label || `Download ${i+1}`, href });
      }
    });

    return { title, poster, synopsis, info, episodes, downloads, source: 'anichin' };
  } catch (error) {
    console.error('❌ Anichin Detail error:', error.message);
    return null;
  }
}

// ============================================
// 🔥 4. SCRAPE STREAMING PAGE (Episode)
// ============================================
async function scrapeStreaming(url) {
  try {
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    const title = $('h1.entry-title, h1.title').first().text().trim();
    const poster = $('.thumb img, .poster img').attr('src');

    // Link streaming
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

    return { title, poster, streams, downloads, source: 'anichin' };
  } catch (error) {
    console.error('❌ Anichin Streaming error:', error.message);
    return null;
  }
}

module.exports = {
  scrapeDonghuaList,
  scrapeSchedule,
  scrapeDetail,
  scrapeStreaming,
  scrapeAll: async () => {
    const list = await scrapeDonghuaList();
    return list;
  }
};
