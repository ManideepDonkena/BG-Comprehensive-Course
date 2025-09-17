
document.addEventListener('DOMContentLoaded', () => {
    const audioListEl = document.getElementById('audio-list');
    const audioPlayer = document.getElementById('audio-player');
    const currentAudioInfoEl = document.getElementById('current-audio-info');
    const searchInput = document.getElementById('search');
    const sortSelect = document.getElementById('sort');
    const resultsCountEl = document.getElementById('results-count');
    const favOnlyCheckbox = document.getElementById('filter-favorites');
    const playerSection = document.getElementById('player-section');
    const playerFavBtn = document.getElementById('player-fav-btn');
    const playerCollapseBtn = document.getElementById('player-collapse-btn');
    const nowTitleEl = document.getElementById('now-title');
    const startTimeLabel = document.getElementById('start-time-label');
    // const setStartBtn = document.getElementById('set-start-btn');
    // const clearStartBtn = document.getElementById('clear-start-btn');
    // const exportBtn = document.getElementById('export-json-btn');

    const jsonFilePath = './bg_chapter_info.json';

    let allItems = [];
    let filteredItems = [];
    let currentIndex = -1;
    let favorites = new Set();
    const LAST_KEY = 'bg_audio_last_listened';
    const STARTS_KEY = 'bg_audio_custom_starts';
    let customStarts = {};

    function parseDate(d) {
        // Expected format "dd-mm-yyyy"; fallback to NaN
        if (!d) return NaN;
        const parts = d.split('-');
        if (parts.length !== 3) return NaN;
        const [dd, mm, yyyy] = parts.map(p => parseInt(p, 10));
        return new Date(yyyy, (mm || 1) - 1, dd || 1).getTime();
    }

    function hasPlayableUrl(item) {
        return Array.isArray(item.cloudinary_matches) && item.cloudinary_matches.length > 0 && item.cloudinary_matches[0] && item.cloudinary_matches[0].cloudinary_url;
    }

    function itemKey(item) {
        return (item.filename || item.title || '') + '|' + (item.date || '') + '|' + (item.day ?? '');
    }

    function itemHTML(item) {
        const playable = !!hasPlayableUrl(item);
        const title = item.title || 'Untitled';
        const speaker = item.speaker || 'Unknown speaker';
        const classType = item.class_type || 'Class';
        const day = item.day != null ? `Day ${item.day}` : '';
        const date = item.date || '';
        const favActive = favorites.has(itemKey(item)) ? 'active' : '';
        return `
            <h3 class="item-title">${title}</h3>
            <button class="icon-btn card-fav ${favActive}" title="Toggle favorite" aria-label="Toggle favorite" type="button">❤</button>
            <div class="item-meta">
                ${day ? `<span class="badge">${day}</span>` : ''}
                ${classType ? `<span>${classType}</span>` : ''}
                ${date ? `<span>• ${date}</span>` : ''}
                ${speaker ? `<span>• ${speaker}</span>` : ''}
                ${!playable ? `<span style="color:#ef4444">• No audio link</span>` : ''}
            </div>
        `;
    }

    function updateResultsCount() {
        if (resultsCountEl) resultsCountEl.textContent = String(filteredItems.length);
    }

    function clearPlayingState() {
        const playing = audioListEl.querySelector('.audio-item.playing');
        if (playing) playing.classList.remove('playing');
    }

    function setCurrentInfo(item) {
        if (!item) return;
        currentAudioInfoEl.innerHTML = `
            <strong>Title:</strong> ${item.title || ''}<br>
            <strong>Day:</strong> ${item.day ?? ''}<br>
            <strong>Class Type:</strong> ${item.class_type || ''}<br>
            <strong>Date:</strong> ${item.date || ''}<br>
            <strong>Speaker:</strong> ${item.speaker || ''}
        `;
    }

    function renderList() {
        audioListEl.innerHTML = '';
        if (!filteredItems.length) {
            const empty = document.createElement('div');
            empty.className = 'audio-item disabled';
            empty.innerHTML = '<h3 class="item-title">No results</h3><div class="item-meta">Try a different search.</div>';
            audioListEl.appendChild(empty);
            updateResultsCount();
            return;
        }
        filteredItems.forEach((item, idx) => {
            const card = document.createElement('article');
            card.className = 'audio-item';
            card.tabIndex = 0; // keyboard focusable
            card.innerHTML = itemHTML(item);
            if (!hasPlayableUrl(item)) {
                card.classList.add('disabled');
                card.setAttribute('aria-disabled', 'true');
            }
            card.addEventListener('click', () => tryPlay(idx));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tryPlay(idx); }
            });
            // favorite button
            const favBtn = card.querySelector('.card-fav');
            favBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(item);
                // re-render card to reflect state
                card.innerHTML = itemHTML(item);
                // rebind the fav button listener after re-render
                const newFavBtn = card.querySelector('.card-fav');
                newFavBtn?.addEventListener('click', (ev) => { ev.stopPropagation(); toggleFavorite(item); card.innerHTML = itemHTML(item); });
            });
            audioListEl.appendChild(card);
        });
        updateResultsCount();
    }

    function tryPlay(filteredIdx) {
        const item = filteredItems[filteredIdx];
        if (!item) return;
        if (!hasPlayableUrl(item)) {
            currentAudioInfoEl.innerHTML = '<p>Audio link not available.</p>';
            return;
        }
        const url = item.cloudinary_matches[0].cloudinary_url;
        audioPlayer.src = url;
        const start = getStartFor(item);
        const resume = getSavedResumeTimeFor(item);
        const desiredSeek = Math.max(start || 0, resume || 0);
        const onLoaded = () => {
            if (desiredSeek > 0) {
                try { audioPlayer.currentTime = desiredSeek; } catch {}
            }
            audioPlayer.play().catch(() => {});
            // save last listened immediately with the desired starting point
            saveLastListened({ item, url, time: desiredSeek });
            audioPlayer.removeEventListener('loadedmetadata', onLoaded);
        };
        audioPlayer.addEventListener('loadedmetadata', onLoaded);
        setCurrentInfo(item);
        clearPlayingState();
        // mark current as playing
        const el = audioListEl.children[filteredIdx];
        if (el) el.classList.add('playing');
        // track index in the allItems array
        currentIndex = allItems.indexOf(item);
    // update floating player header
    if (nowTitleEl) nowTitleEl.textContent = item.title || 'Untitled';
    // show player if hidden
    if (playerSection?.classList.contains('hidden')) playerSection.classList.remove('hidden');
    // update player fav button state
    updatePlayerFavBtn(item);
        // reflect start label
        updateStartLabel(item);
    }

    function applyFilters() {
    const q = (searchInput?.value || '').trim().toLowerCase();
        const sort = sortSelect?.value || 'day-asc';
    const favOnly = !!favOnlyCheckbox?.checked;
    filteredItems = allItems.filter(it => {
            if (!q) return true;
            const hay = [it.title, it.speaker, it.class_type, it.day?.toString(), it.date].filter(Boolean).join(' ').toLowerCase();
            return hay.includes(q);
    }).filter(it => !favOnly || favorites.has(itemKey(it)));
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
        const byTitle = (a,b) => collator.compare(a.title || '', b.title || '');
        const byDay = (a,b) => (a.day||0) - (b.day||0);
        const byDate = (a,b) => (parseDate(a.date) || 0) - (parseDate(b.date) || 0);
        switch (sort) {
            case 'day-desc': filteredItems.sort((a,b)=> byDay(b,a)); break;
            case 'date-desc': filteredItems.sort((a,b)=> byDate(b,a)); break;
            case 'date-asc': filteredItems.sort(byDate); break;
            case 'title-desc': filteredItems.sort((a,b)=> byTitle(b,a)); break;
            case 'title-asc': filteredItems.sort(byTitle); break;
            case 'day-asc':
            default: filteredItems.sort(byDay);
        }
        renderList();
    }

    // favorites persistence
    try {
        const raw = localStorage.getItem('bg_audio_favorites') || '[]';
        favorites = new Set(JSON.parse(raw));
    } catch { favorites = new Set(); }

    function saveFavorites() {
        try { localStorage.setItem('bg_audio_favorites', JSON.stringify([...favorites])); } catch {}
    }

    function toggleFavorite(item) {
        const key = itemKey(item);
        if (favorites.has(key)) favorites.delete(key); else favorites.add(key);
        saveFavorites();
        // update player fav button if current item
        const current = allItems[currentIndex];
        if (current && itemKey(current) === key) updatePlayerFavBtn(current);
    }

    function updatePlayerFavBtn(item) {
        if (!playerFavBtn) return;
        const active = favorites.has(itemKey(item));
        playerFavBtn.classList.toggle('active', active);
        playerFavBtn.setAttribute('aria-pressed', String(active));
    }

    // custom starts persistence
    try {
        customStarts = JSON.parse(localStorage.getItem(STARTS_KEY) || '{}');
        if (typeof customStarts !== 'object' || customStarts === null) customStarts = {};
    } catch { customStarts = {}; }

    function saveStarts() {
        try { localStorage.setItem(STARTS_KEY, JSON.stringify(customStarts)); } catch {}
    }

    function getStartFor(item) {
        const t = customStarts[itemKey(item)];
        return typeof t === 'number' && t >= 0 ? t : 0;
    }

    function updateStartLabel(item) {
        if (!startTimeLabel) return;
        const t = getStartFor(item);
        startTimeLabel.textContent = `Start at: ${formatTime(t)}`;
    }

    function formatTime(sec) {
        const s = Math.floor(sec || 0);
        const m = Math.floor(s / 60);
        const r = s % 60;
        return `${m}:${r.toString().padStart(2,'0')}`;
    }

    // Fetch data
    fetch(jsonFilePath)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            // Clean and keep only valid objects
            allItems = Array.isArray(data) ? data.filter(x => x && (x.title || x.filename)) : [];
            // Seed customStarts from existing start_time fields if present
            for (const it of allItems) {
                if (typeof it.start_time === 'number' && it.start_time >= 0) {
                    customStarts[itemKey(it)] = Math.floor(it.start_time);
                }
            }
            applyFilters();
            // attempt restore of last listened
            restoreLastListened();
        })
        .catch(err => {
            console.error('Error fetching or processing audio data:', err);
            audioListEl.innerHTML = '<div class="audio-item disabled"><h3 class="item-title">Error loading audio list</h3></div>';
        });

    // Wire controls
    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (sortSelect) sortSelect.addEventListener('change', applyFilters);
    if (favOnlyCheckbox) favOnlyCheckbox.addEventListener('change', applyFilters);

    // Player buttons
    playerCollapseBtn?.addEventListener('click', () => {
        playerSection?.classList.toggle('collapsed');
    });
    playerFavBtn?.addEventListener('click', () => {
        const current = allItems[currentIndex];
        if (!current) return;
        toggleFavorite(current);
        updatePlayerFavBtn(current);
    });

    // Start-time buttons (commented for future use)
    // setStartBtn?.addEventListener('click', () => {
    //     const current = allItems[currentIndex];
    //     if (!current) return;
    //     const cur = Math.floor(audioPlayer.currentTime || 0);
    //     customStarts[itemKey(current)] = cur;
    //     saveStarts();
    //     updateStartLabel(current);
    // });
    // clearStartBtn?.addEventListener('click', () => {
    //     const current = allItems[currentIndex];
    //     if (!current) return;
    //     delete customStarts[itemKey(current)];
    //     saveStarts();
    //     updateStartLabel(current);
    // });

    // Export updated JSON (commented for future use)
    // exportBtn?.addEventListener('click', () => {
    //     if (!Array.isArray(allItems) || !allItems.length) return;
    //     const out = allItems.map(it => {
    //         const copy = { ...it };
    //         const st = customStarts[itemKey(it)];
    //         if (typeof st === 'number' && st >= 0) copy.start_time = st;
    //         return copy;
    //     });
    //     const blob = new Blob([JSON.stringify(out, null, 4)], { type: 'application/json' });
    //     const url = URL.createObjectURL(blob);
    //     const a = document.createElement('a');
    //     a.href = url;
    //     a.download = 'bg_chapter_info.updated.json';
    //     document.body.appendChild(a);
    //     a.click();
    //     document.body.removeChild(a);
    //     URL.revokeObjectURL(url);
    // });

    // Save last listened on time update and when paused/ended
    function saveLastListened(payload) {
        const p = payload || {};
        // prefer current playing state if available
        const item = p.item ?? allItems[currentIndex];
        const url = p.url ?? audioPlayer.currentSrc;
        const time = typeof p.time === 'number' ? p.time : Math.floor(audioPlayer.currentTime || 0);
        if (!item || !url) return;
        const data = { key: itemKey(item), url, time, meta: { title: item.title, day: item.day, date: item.date, speaker: item.speaker } };
        try { localStorage.setItem(LAST_KEY, JSON.stringify(data)); } catch {}
    }

    function restoreLastListened() {
        let data = null;
        try { data = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); } catch { data = null; }
        if (!data || !data.key) return;
        // find item in allItems matching stored key
        const item = allItems.find(it => itemKey(it) === data.key) || null;
        const url = data.url;
        if (!item || !url) return;
        audioPlayer.src = url;
    // set time after metadata loaded. honor custom start-time and saved time
    const start = getStartFor(item);
    const seekTo = Math.max(Number(data.time) || 0, start || 0);
        const onLoaded = () => {
            try { audioPlayer.currentTime = seekTo; } catch {}
            audioPlayer.removeEventListener('loadedmetadata', onLoaded);
        };
        audioPlayer.addEventListener('loadedmetadata', onLoaded);
        // update UI without autoplay
        setCurrentInfo(item);
        if (nowTitleEl) nowTitleEl.textContent = item.title || 'Untitled';
        playerSection?.classList.remove('hidden');
        updatePlayerFavBtn(item);
        currentIndex = allItems.indexOf(item);
    updateStartLabel(item);
    }

    function getSavedResumeTimeFor(item) {
        try {
            const data = JSON.parse(localStorage.getItem(LAST_KEY) || 'null');
            if (!data || !data.key) return 0;
            if (data.key !== itemKey(item)) return 0;
            const t = Number(data.time) || 0;
            return t > 0 ? t : 0;
        } catch { return 0; }
    }

    audioPlayer.addEventListener('timeupdate', () => saveLastListened());
    audioPlayer.addEventListener('pause', () => saveLastListened());
    audioPlayer.addEventListener('ended', () => saveLastListened({ time: 0 }));
});
