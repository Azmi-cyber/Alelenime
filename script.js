const API_URL = '/api';

let currentData = [];
let currentSource = 'all';

// Load data
async function loadData(source = 'all') {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');
  
  loading.classList.add('show');
  content.innerHTML = '';

  try {
    let url = `${API_URL}/scrape`;
    if (source === 'anime') url = `${API_URL}/scrape/nontonanimeid`;
    else if (source === 'donghua') url = `${API_URL}/scrape/anichin`;

    const res = await fetch(url);
    const data = await res.json();
    
    if (data.success) {
      currentData = data.data || [];
      currentSource = source;
      renderCards(currentData);
      updateSourceInfo(source, currentData.length);
    } else {
      content.innerHTML = `<p style="color:#e74c3c;text-align:center;">❌ Error: ${data.error || 'Gagal memuat data'}</p>`;
    }
  } catch (error) {
    content.innerHTML = `<p style="color:#e74c3c;text-align:center;">❌ Koneksi gagal: ${error.message}</p>`;
  }

  loading.classList.remove('show');
}

// Render cards
function renderCards(data) {
  const content = document.getElementById('content');
  
  if (!data || data.length === 0) {
    content.innerHTML = '<p style="color:#666;text-align:center;padding:40px 0;">Tidak ada data ditemukan.</p>';
    return;
  }

  content.innerHTML = data.map(item => `
    <div class="card" onclick="openDetail('${encodeURIComponent(item.link || '')}', '${item.source}')">
      <img class="card-poster" src="${item.poster || 'https://via.placeholder.com/300x169/1a1a2e/666?text=No+Poster'}" 
           alt="${item.title}" 
           onerror="this.src='https://via.placeholder.com/300x169/1a1a2e/666?text=No+Poster'">
      <div class="card-content">
        <div class="card-title">${escapeHtml(item.title)}</div>
        <div class="card-episode">${item.episode || 'Ongoing'}</div>
        <span class="card-source ${item.source}">${item.source === 'nontonanimeid' ? '🇯🇵 Anime' : '🐉 Donghua'}</span>
      </div>
    </div>
  `).join('');
}

function escapeHtml(text) { if (!text) return ''; const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }

function updateSourceInfo(source, count) {
  const el = document.getElementById('sourceInfo');
  const names = { 'all': 'Semua sumber', 'anime': 'NontonAnimeID (Anime)', 'donghua': 'Anichin (Donghua)' };
  el.textContent = `Menampilkan ${count} item dari ${names[source] || 'sumber'}`;
}

function loadAll() { setActive('btnAll'); setNavActive('navHome'); loadData('all'); }
function loadAnime() { setActive('btnAnime'); setNavActive('navAnime'); loadData('anime'); }
function loadDonghua() { setActive('btnDonghua'); setNavActive('navDonghua'); loadData('donghua'); }

function setActive(id) {
  document.querySelectorAll('.filter-buttons button').forEach(b => b.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}
function setNavActive(id) {
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

// Search
async function searchAnime(event) {
  if (event && event.key && event.key !== 'Enter') return;
  const query = document.getElementById('searchInput').value.trim();
  if (!query) return loadAll();

  const loading = document.getElementById('loading');
  const content = document.getElementById('content');
  loading.classList.add('show');
  content.innerHTML = '';

  try {
    const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data.success) {
      currentData = data.data || [];
      renderCards(currentData);
      document.getElementById('sourceInfo').textContent = `Hasil pencarian: "${query}" (${currentData.length} ditemukan)`;
    }
  } catch (error) {
    content.innerHTML = `<p style="color:#e74c3c;text-align:center;">❌ Error: ${error.message}</p>`;
  }
  loading.classList.remove('show');
}

// Open detail modal
async function openDetail(encodedUrl, source) {
  if (!encodedUrl) { alert('Link detail tidak tersedia.'); return; }

  const modal = document.getElementById('modal');
  const body = document.getElementById('modalBody');
  modal.classList.add('show');
  body.innerHTML = '<div class="loading show"><div class="spinner"></div><p>Memuat detail...</p></div>';

  try {
    const url = decodeURIComponent(encodedUrl);
    const endpoint = source === 'nontonanimeid' ? 'nontonanimeid' : 'anichin';
    const res = await fetch(`${API_URL}/detail/${endpoint}?url=${encodeURIComponent(url)}`);
    const data = await res.json();

    if (data.success && data.data) {
      renderDetail(data.data, source);
    } else {
      body.innerHTML = '<p style="color:#e74c3c;">Gagal memuat detail.</p>';
    }
  } catch (error) {
    body.innerHTML = `<p style="color:#e74c3c;">Error: ${error.message}</p>`;
  }
}

// Render detail
function renderDetail(item, source) {
  const body = document.getElementById('modalBody');
  
  let infoHtml = '';
  if (item.info) {
    infoHtml = Object.entries(item.info).map(([k, v]) => 
      `<span>${escapeHtml(k)}: ${escapeHtml(v)}</span>`
    ).join('');
  }

  let episodesHtml = '';
  if (item.episodes && item.episodes.length > 0) {
    episodesHtml = `
      <div class="modal-episodes">
        <h3>📺 Daftar Episode (${item.episodes.length})</h3>
        <div class="ep-list">
          ${item.episodes.map(ep => `
            <a href="${ep.link || '#'}" target="_blank">${escapeHtml(ep.title || 'Episode')}</a>
          `).join('')}
        </div>
      </div>
    `;
  }

  let downloadsHtml = '';
  if (item.downloads && item.downloads.length > 0) {
    downloadsHtml = `
      <div class="modal-download">
        <h3>📥 Link Download</h3>
        <div class="download-list">
          ${item.downloads.map(d => `
            <a href="${d.href || '#'}" target="_blank">${escapeHtml(d.label || 'Download')}</a>
          `).join('')}
        </div>
      </div>
    `;
  }

  body.innerHTML = `
    ${item.poster ? `<img class="modal-poster" src="${item.poster}" alt="${item.title}" onerror="this.style.display='none'">` : ''}
    <div class="modal-title">${escapeHtml(item.title)}</div>
    <div class="modal-info">
      <span>📌 Sumber: ${source === 'nontonanimeid' ? 'NontonAnimeID' : 'Anichin'}</span>
      ${infoHtml}
    </div>
    ${item.synopsis ? `<div class="modal-synopsis">${escapeHtml(item.synopsis)}</div>` : ''}
    ${episodesHtml}
    ${downloadsHtml}
  `;
}

function closeModal() { document.getElementById('modal').classList.remove('show'); }
document.getElementById('modal').addEventListener('click', function(e) { if (e.target === this) closeModal(); });
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeModal(); });

// Load awal
document.addEventListener('DOMContentLoaded', () => { loadAll(); });
