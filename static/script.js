let allVideos = [];
let currentFilter = 'unwatched';
let currentSearch = '';
let currentCategory = 'all';
const VIDEOS_PER_PAGE = 12;
let currentPage = 1;
let totalPages = 1;

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    fetchVideos();
    setupEventListeners();
});

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        document.querySelector('.theme-icon').textContent = '☀️';
    } else {
        document.body.classList.remove('light-theme');
        document.querySelector('.theme-icon').textContent = '🌙';
    }
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    const icon = document.querySelector('.theme-icon');

    if (isLight) {
        icon.textContent = '☀️';
        localStorage.setItem('theme', 'light');
    } else {
        icon.textContent = '🌙';
        localStorage.setItem('theme', 'dark');
    }
}

async function fetchVideos() {
    try {
        const response = await fetch('/api/videos');
        allVideos = await response.json();
        renderVideos();
        renderChannels();
        populateCategories();
    } catch (error) {
        console.error("Failed to fetch videos:", error);
        document.getElementById('videoContainer').innerHTML = `<p class="error">Error loading videos. Please check backend.</p>`;
    }
}

function renderVideos() {
    const container = document.getElementById('videoContainer');
    container.innerHTML = '';

    let filtered = allVideos.filter(v => {
        const isWatched = v.Statut === "Vu";
        const titleMatch = v.Titre.toLowerCase().includes(currentSearch.toLowerCase());
        const authorMatch = v.Auteur.toLowerCase().includes(currentSearch.toLowerCase());

        let statusMatch = false;
        if (currentFilter === 'all') statusMatch = true;
        else if (currentFilter === 'watched' && isWatched) statusMatch = true;
        else if (currentFilter === 'unwatched' && !isWatched) statusMatch = true;
        else if (currentFilter === 'favorites' && v.favori) statusMatch = true;

        let catMatch = true;
        if (currentCategory === 'uncategorized') {
            catMatch = !v.Categorie || v.Categorie.trim() === '';
        } else if (currentCategory !== 'all') {
            const tags = v.Categorie.split(',').map(t => t.trim());
            catMatch = tags.includes(currentCategory);
        }

        return statusMatch && (titleMatch || authorMatch) && catMatch;
    });

    sortVideos(filtered);

    // Pagination calculations
    totalPages = Math.max(1, Math.ceil(filtered.length / VIDEOS_PER_PAGE));
    if (currentPage > totalPages) currentPage = totalPages;
    const startIdx = (currentPage - 1) * VIDEOS_PER_PAGE;
    const paginated = filtered.slice(startIdx, startIdx + VIDEOS_PER_PAGE);

    paginated.forEach(video => {
        // Fix: Use correct URL splitting logic
        const urlObj = new URL(video.URL);
        const vidId = urlObj.searchParams.get('v');

        const card = document.createElement('div');
        card.className = `card ${video.Statut === "Vu" ? 'watched' : ''}`;
        card.innerHTML = `
            <div class="card-image">
                <button class="fav-btn ${video.favori ? 'active' : ''}" 
                    onclick="toggleFavorite(event, '${video.URL}')" title="Favorite">
                    ${video.favori ? '★' : '☆'}
                </button>
                <img src="https://img.youtube.com/vi/${vidId}/hqdefault.jpg" alt="${video.Titre}">
                <span class="duration-tag">${video['Durée']}</span>
            </div>
            <div class="card-content">
                <div class="card-title" title="${video.Titre}">${video.Titre}</div>
                <div class="card-meta">
                    <span>👤 ${video.Auteur}</span><br>
                    <span>📅 ${video.Date}</span>
                </div>
                <input type="text" class="cat-input" placeholder="🏷️ Add tags..." value="${video.Categorie}" 
                    list="category-suggestions" onchange="updateMetadata('${video.URL}', null, this.value)">
                <div class="card-actions">
                    <a href="${video.URL}" target="_blank" class="action-btn watch-btn">Watch</a>
                    <button class="action-btn seen-btn ${video.Statut === "Vu" ? 'active' : ''}" 
                        onclick="updateMetadata('${video.URL}', '${video.Statut === "Vu" ? "" : "Vu"}', null)">
                        ${video.Statut === "Vu" ? 'Seen' : 'Mark Seen'}
                    </button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    renderPagination();
}

function renderPagination() {
    let paginationDiv = document.getElementById('paginationContainer');
    if (!paginationDiv) {
        paginationDiv = document.createElement('div');
        paginationDiv.id = 'paginationContainer';
        paginationDiv.className = 'pagination-controls';
        document.getElementById('videosView').appendChild(paginationDiv);
    }

    paginationDiv.innerHTML = '';

    if (totalPages <= 1) return;

    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.textContent = '← Précédent';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
        currentPage--;
        renderVideos();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.textContent = 'Suivant →';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => {
        currentPage++;
        renderVideos();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const info = document.createElement('span');
    info.className = 'page-info';
    info.textContent = `Page ${currentPage} sur ${totalPages}`;

    paginationDiv.appendChild(prevBtn);
    paginationDiv.appendChild(info);
    paginationDiv.appendChild(nextBtn);
}

async function toggleFavorite(event, url) {
    event.stopPropagation();
    const vid = allVideos.find(v => v.URL === url);
    if (!vid) return;

    const newFavori = !vid.favori;
    vid.favori = newFavori;
    renderVideos();

    try {
        await fetch('/api/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, favori: newFavori })
        });
    } catch (error) {
        console.error("Favorite update failed:", error);
    }
}

async function updateMetadata(url, status, category) {
    const payload = { url };
    if (status !== null) payload.status = status;
    if (category !== null) payload.category = category;

    // Optimistic UI update
    const vid = allVideos.find(v => v.URL === url);
    if (vid) {
        if (status !== null) vid.Statut = status;
        if (category !== null) vid.Categorie = category;
        renderVideos();
        if (category !== null) populateCategories();
    }

    try {
        await fetch('/api/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error("Update failed:", error);
    }
}

function populateCategories() {
    const categories = new Set();
    allVideos.forEach(v => {
        if (v.Categorie) {
            v.Categorie.split(',').forEach(t => categories.add(t.trim()));
        }
    });

    const sorted = Array.from(categories).sort();
    const filter = document.getElementById('categoryFilter');
    const datalist = document.getElementById('category-suggestions');

    // Update filter dropdown
    const currentVal = filter.value;
    filter.innerHTML = '<option value="all">All Categories</option><option value="uncategorized">Uncategorized</option>';
    sorted.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = `🏷️ ${c}`;
        filter.appendChild(opt);
    });
    filter.value = currentVal;

    // Update suggestions
    datalist.innerHTML = '';
    sorted.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        datalist.appendChild(opt);
    });
}

function sortVideos(videos) {
    const criteria = document.getElementById('sortSelect').value;
    videos.sort((a, b) => {
        if (criteria === 'date_desc') return b.Date.localeCompare(a.Date);
        if (criteria === 'date_asc') return a.Date.localeCompare(b.Date);
        if (criteria === 'duration_desc') return parseDuration(b['Durée']) - parseDuration(a['Durée']);
        if (criteria === 'duration_asc') return parseDuration(a['Durée']) - parseDuration(b['Durée']);
        if (criteria === 'author') return a.Auteur.localeCompare(b.Auteur);
        return 0;
    });
}

function parseDuration(d) {
    if (!d) return 0;
    const p = d.split(':').map(Number);
    if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
    if (p.length === 2) return p[0] * 60 + p[1];
    return p[0] || 0;
}

function switchView(view) {
    if (view === 'videos') {
        document.getElementById('videosView').classList.remove('hidden');
        document.getElementById('channelsView').classList.add('hidden');
    } else {
        document.getElementById('videosView').classList.add('hidden');
        document.getElementById('channelsView').classList.remove('hidden');
        renderChannels();
    }
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
}

function resetFilters() {
    currentSearch = '';
    currentFilter = 'unwatched';
    currentCategory = 'all';

    // Update UI elements
    document.getElementById('searchInput').value = '';
    document.getElementById('categoryFilter').value = 'all';

    // Reset active states for filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === 'unwatched');
    });

    switchView('videos');
    renderVideos();
}

function selectChannel(author) {
    currentSearch = author;
    document.getElementById('searchInput').value = author;
    switchView('videos');
    renderVideos();
}

function renderChannels() {
    const container = document.getElementById('channelContainer');
    container.innerHTML = '';

    // Group videos by author
    const channels = {};
    allVideos.forEach(v => {
        if (!channels[v.Auteur]) {
            channels[v.Auteur] = { name: v.Auteur, count: 0, thumbnail: v.thumbnail };
        }
        channels[v.Auteur].count++;
    });

    Object.values(channels).sort((a, b) => b.count - a.count).forEach(chan => {
        const div = document.createElement('div');
        div.className = 'channel-card';
        div.onclick = () => selectChannel(chan.name);
        div.innerHTML = `
            <div class="channel-info">
                <h3>👤 ${chan.name}</h3>
                <p>${chan.count} vidéos</p>
            </div>
        `;
        container.appendChild(div);
    });
}

function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', (e) => {
        currentSearch = e.target.value;
        currentPage = 1;
        renderVideos();
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            currentPage = 1;
            renderVideos();
        });
    });

    document.getElementById('sortSelect').addEventListener('change', () => { currentPage = 1; renderVideos(); });
    document.getElementById('categoryFilter').addEventListener('change', (e) => {
        currentCategory = e.target.value;
        currentPage = 1;
        renderVideos();
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // Settings Modal
    const modal = document.getElementById('settingsModal');
    const settingsBtn = document.getElementById('settingsBtn');
    const closeBtn = document.querySelector('.close-modal');
    const saveBtn = document.getElementById('saveSettingsBtn');

    settingsBtn.addEventListener('click', async () => {
        const response = await fetch('/api/settings');
        const settings = await response.json();
        document.getElementById('apiKeyInput').value = settings.api_key;
        document.getElementById('playlistIdInput').value = settings.playlist_id;
        modal.classList.add('active');
    });

    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    saveBtn.addEventListener('click', async () => {
        const apiKey = document.getElementById('apiKeyInput').value;
        const playlistId = document.getElementById('playlistIdInput').value;

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: apiKey, playlist_id: playlistId })
            });
            modal.classList.remove('active');
            // Full refresh after settings change
            fetchVideos();
        } catch (error) {
            alert('Failed to save settings');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }
    });
}
