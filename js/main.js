import { parseDate, hasPlayableUrl, itemKey, formatTime } from './utils.js';
import { favoritesStore, customStartsStore, markersStore, notesStore, lastListenedStore, prefsStore } from './storage.js';
import { createItemElement, updateCurrentInfo, renderMarkers, renderNotes } from './ui.js';
import { ClipEditor } from './clip-editor.js';
import { TranscriptView } from './transcript.js';
import { Tutorial } from './tutorial.js';
import { gamification } from './gamification.js';

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const els = {
        audioList: document.getElementById('audio-list'),
        audioPlayer: document.getElementById('audio-player'),
        currentInfo: document.getElementById('current-audio-info'),
        search: document.getElementById('search'),
        searchGroup: document.getElementById('search-group'),
        searchToggle: document.getElementById('search-toggle'),
        sort: document.getElementById('sort'),
        favBtn: document.getElementById('filter-favorites-btn'),
        resultsCount: document.getElementById('results-count'),
        favCheckbox: document.getElementById('filter-favorites'),
        playerSection: document.getElementById('player-section'),
        playerFavBtn: document.getElementById('player-fav-btn'),
        playerCollapseBtn: document.getElementById('player-collapse-btn'),
        nowTitle: document.getElementById('now-title'),
        startTimeLabel: document.getElementById('start-time-label'),
        progressArea: document.getElementById('progress-area'),
        progressRail: document.getElementById('progress-rail'),
        progressFill: document.getElementById('progress-fill'),
        progressMarkers: document.getElementById('progress-markers'),
        currentTime: document.getElementById('current-time'),
        durationTime: document.getElementById('duration-time'),
        addMarkerBtn: document.getElementById('add-marker-btn'),
        markersList: document.getElementById('markers-list'),
        notesPanel: document.getElementById('notes-panel'),
        notesBtn: document.getElementById('player-notes-btn'),
        closeNotesBtn: document.getElementById('close-notes-btn'),
        newNoteBtn: document.getElementById('new-note-btn'),
        notesList: document.getElementById('notes-list'),

        itemTemplate: document.getElementById('audio-item-template'),

        // Custom Controls
        btnBack20: document.getElementById('btn-back-20'),
        btnPlay: document.getElementById('btn-play'),
        btnForward20: document.getElementById('btn-forward-20'),
        btnPrev: document.getElementById('btn-prev'),
        btnNext: document.getElementById('btn-next'),
        playbackRate: document.getElementById('playback-rate'),
        volume: document.getElementById('volume'),
        btnMute: document.getElementById('btn-mute'),
        quickNoteBtn: document.getElementById('btn-quick-note'),

        // Mini Player
        btnMiniPlay: document.getElementById('btn-mini-play'),
        progressRingCircle: document.querySelector('.progress-ring__circle'),

        // Clip Editor
        clip: {
            el: document.getElementById('clip-editor'),
            backdrop: document.getElementById('clip-backdrop'),
            closeBtn: document.getElementById('clip-close'),
            cancelBtn: document.getElementById('clip-cancel'),
            saveBtn: document.getElementById('clip-save'),
            startInput: document.getElementById('clip-start'),
            endInput: document.getElementById('clip-end'),
            lenEl: document.getElementById('clip-length'),
            rail: document.getElementById('clip-rail'),
            selection: document.getElementById('clip-selection'),
            handleStart: document.getElementById('clip-handle-start'),
            handleEnd: document.getElementById('clip-handle-end'),
            playhead: document.getElementById('clip-playhead'),
            textInput: document.getElementById('clip-text'),
            playBtn: document.getElementById('clip-play'),
            back5: document.getElementById('clip-back-5'),
            fwd5: document.getElementById('clip-fwd-5'),
            setStart: document.getElementById('clip-set-start'),
            setEnd: document.getElementById('clip-set-end'),
            loopChk: document.getElementById('clip-loop'),
        },
        // Transcript
        transcript: {
            panel: document.getElementById('transcript-panel'),
            btn: document.getElementById('player-transcript-btn'),
            closeBtn: document.getElementById('close-transcript-btn'),
            searchInput: document.getElementById('transcript-search-input'),
            content: document.getElementById('transcript-content'),
        },
        // Mobile Menu
        navMenuToggle: document.getElementById('nav-menu-toggle'),
        navMenuContent: document.getElementById('nav-menu-content'),

        helpBtn: document.getElementById('help-btn'),
        themeToggle: document.getElementById('theme-toggle'),
    };

    // State
    const state = {
        allItems: [],
        filteredItems: [],
        currentIndex: -1,
        favorites: favoritesStore.get(),
    };

    // Initialize Clip Editor
    const clipEditor = new ClipEditor(els.clip, els.audioPlayer, (start, end, text) => {
        const item = state.allItems[state.currentIndex];
        if (!item) return;
        const currentNotes = notesStore.get()[itemKey(item)] || [];
        const title = text.split('\n')[0]?.slice(0, 60) || `Note ${currentNotes.length + 1}`;
        const newNotes = [...currentNotes, { start, end, text, title }].sort((a, b) => a.start - b.start);

        const key = itemKey(item);
        const map = notesStore.get();
        map[key] = newNotes;
        notesStore.set(map); // Save full map

        // Re-render
        renderNotes(newNotes, els.notesList, null,
            (t) => seekTo(t),
            (idx) => deleteNote(idx)
        );
    });

    const transcriptView = new TranscriptView(els.transcript, els.audioPlayer, (t) => seekTo(t));
    const tutorial = new Tutorial();

    // --- Core Logic ---

    function getStartFor(item) {
        const t = customStartsStore.get()[itemKey(item)];
        return (typeof t === 'number' && t >= 0) ? t : 0;
    }

    function toggleFavorite(item) {
        const key = itemKey(item);
        if (state.favorites.has(key)) state.favorites.delete(key);
        else state.favorites.add(key);

        favoritesStore.save(state.favorites);

        // Refresh current button if playing
        const current = state.allItems[state.currentIndex];
        if (current && itemKey(current) === key) {
            updatePlayerFavBtn(current);
        }

        // If filter active, refresh list
        if (els.favCheckbox.checked) applyFilters();
        else {
            // Just re-render card
            // Optimization: Find card in DOM? Or just re-render list if not huge
            applyFilters();
        }
    }

    function updatePlayerFavBtn(item) {
        if (!els.playerFavBtn) return;
        const active = state.favorites.has(itemKey(item));
        els.playerFavBtn.classList.toggle('active', active);
        els.playerFavBtn.setAttribute('aria-pressed', String(active));
    }

    function seekTo(seconds) {
        const s = Math.max(0, Math.min(seconds, (els.audioPlayer.duration || 0) - 0.5));
        try { els.audioPlayer.currentTime = s; } catch { }
    }

    function togglePlay() {
        if (els.audioPlayer.paused) {
            els.audioPlayer.play().catch(() => { });
        } else {
            els.audioPlayer.pause();
        }
    }

    function tryPlay(idxInFiltered) {
        const item = state.filteredItems[idxInFiltered];
        if (!item) return;

        if (!hasPlayableUrl(item)) {
            els.currentInfo.innerHTML = '<p>Audio link not available.</p>';
            return;
        }

        const url = item.cloudinary_matches[0].cloudinary_url;
        els.audioPlayer.src = url;

        const start = getStartFor(item);
        const savedResume = lastListenedStore.get();
        let resumeTime = 0;
        if (savedResume && savedResume.key === itemKey(item)) {
            resumeTime = Number(savedResume.time) || 0;
        }

        const desiredSeek = Math.max(start || 0, resumeTime);

        const onLoaded = () => {
            if (desiredSeek > 0) seekTo(desiredSeek);
            els.audioPlayer.play().catch(() => { });

            // Save state immediately
            saveLastListened({ item, url, time: desiredSeek });
            els.audioPlayer.removeEventListener('loadedmetadata', onLoaded);
        };

        els.audioPlayer.addEventListener('loadedmetadata', onLoaded);

        updateCurrentInfo(els.currentInfo, item);

        // Clear old playing class
        const playing = els.audioList.querySelector('.audio-item.playing');
        if (playing) playing.classList.remove('playing');

        // Add new playing class
        const cards = els.audioList.querySelectorAll('.audio-item');
        if (cards[idxInFiltered]) cards[idxInFiltered].classList.add('playing');

        state.currentIndex = state.allItems.indexOf(item);

        if (els.nowTitle) els.nowTitle.textContent = item.title || 'Untitled';
        if (els.playerSection) els.playerSection.classList.remove('hidden');

        updatePlayerFavBtn(item);
        if (els.startTimeLabel) els.startTimeLabel.textContent = `Start at: ${formatTime(start)}`;

        // Render markers/notes when ready
        const renderWhenReady = () => {
            const markers = markersStore.get()[itemKey(item)] || [];
            renderMarkers(markers, els.progressMarkers, els.markersList, els.audioPlayer.duration,
                (t) => seekTo(t),
                (idx) => deleteMarker(idx)
            );

            const notes = notesStore.get()[itemKey(item)] || [];
            renderNotes(notes, els.notesList, null,
                (t) => seekTo(t),
                (idx) => deleteNote(idx)
            );

            updateProgressUI();
            els.audioPlayer.removeEventListener('loadedmetadata', renderWhenReady);
        };
        els.audioPlayer.addEventListener('loadedmetadata', renderWhenReady);

        // Load transcript if available
        if (item.day) {
            transcriptView.load(item.day);
        }
    }

    function renderList(list = state.filteredItems) {
        els.audioList.innerHTML = '';
        let lastChapter = null;

        if (!list.length) {
            els.audioList.innerHTML = '<div class="audio-item disabled"><h3 class="item-title">No results</h3></div>';
            return;
        }

        list.forEach((item, idx) => {
            // Insert Chapter Header if chapter changed
            const chapter = item.chapter || 0;
            if (chapter !== lastChapter) {
                const headerDiv = document.createElement('div');
                headerDiv.className = 'chapter-header';
                headerDiv.innerHTML = `<h2>Chapter ${chapter}</h2><p>Bhagavad Gita</p>`;
                els.audioList.appendChild(headerDiv);
                lastChapter = chapter;
            }

            const isFav = state.favorites.has(itemKey(item));
            const card = createItemElement(item, isFav, els.itemTemplate);
            const cardEl = card.querySelector('.audio-item');
            if (!cardEl) return;

            cardEl.tabIndex = 0;

            if (!hasPlayableUrl(item)) {
                cardEl.classList.add('disabled');
                cardEl.setAttribute('aria-disabled', 'true');
            }

            // Click to play audio
            cardEl.addEventListener('click', (e) => {
                if (e.target.closest('.item-fav-btn')) return;
                tryPlay(idx);
            });

            cardEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tryPlay(idx); }
            });

            // Heart button
            const favBtn = cardEl.querySelector('.item-fav-btn');
            favBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(item);
            });

            els.audioList.appendChild(cardEl);
        });

        if (els.resultsCount) els.resultsCount.textContent = String(state.filteredItems.length);
    }

    function applyFilters() {
        const q = (els.search?.value || '').trim().toLowerCase();
        const sortMode = els.sort?.value || 'day-asc';
        const favOnly = els.favCheckbox?.checked;

        state.filteredItems = state.allItems.filter(it => {
            if (!q) return true;
            const hay = [it.title, it.speaker, it.class_type, it.day?.toString(), it.date].filter(Boolean).join(' ').toLowerCase();
            return hay.includes(q);
        }).filter(it => !favOnly || state.favorites.has(itemKey(it)));

        // Sorting
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
        const byTitle = (a, b) => collator.compare(a.title || '', b.title || '');
        const byDay = (a, b) => {
            const chA = Number(a.chapter) || 0;
            const chB = Number(b.chapter) || 0;
            if (chA !== chB) return chA - chB;
            return (Number(a.day) || 0) - (Number(b.day) || 0);
        };
        const byDate = (a, b) => (parseDate(a.date) || 0) - (parseDate(b.date) || 0);

        switch (sortMode) {
            case 'day-desc': state.filteredItems.sort((a, b) => byDay(b, a)); break;
            case 'date-desc': state.filteredItems.sort((a, b) => byDate(b, a)); break;
            case 'date-asc': state.filteredItems.sort(byDate); break;
            case 'title-desc': state.filteredItems.sort((a, b) => byTitle(b, a)); break;
            case 'title-asc': state.filteredItems.sort(byTitle); break;
            case 'day-asc': default: state.filteredItems.sort(byDay);
        }

        renderList();
    }

    function saveLastListened(p) {
        const item = p?.item || state.allItems[state.currentIndex];
        const url = p?.url || els.audioPlayer.currentSrc;
        const time = typeof p?.time === 'number' ? p.time : Math.floor(els.audioPlayer.currentTime || 0);

        if (!item || !url) return;

        const data = {
            key: itemKey(item),
            url,
            time,
            meta: { title: item.title, day: item.day }
        };
        lastListenedStore.set(data);
    }

    function restoreLastListened() {
        const data = lastListenedStore.get();
        if (!data || !data.key) return;

        const item = state.allItems.find(it => itemKey(it) === data.key);
        if (!item || !data.url) return;

        els.audioPlayer.src = data.url;
        const start = getStartFor(item);
        const seek = Math.max(Number(data.time) || 0, start || 0);

        const onLoaded = () => {
            try { els.audioPlayer.currentTime = seek; } catch { }
            els.audioPlayer.removeEventListener('loadedmetadata', onLoaded);
        };
        els.audioPlayer.addEventListener('loadedmetadata', onLoaded);

        updateCurrentInfo(els.currentInfo, item);
        if (els.nowTitle) els.nowTitle.textContent = item.title || 'Untitled';
        if (els.playerSection) els.playerSection.classList.remove('hidden');
        updatePlayerFavBtn(item);
        state.currentIndex = state.allItems.indexOf(item);
        if (els.startTimeLabel) els.startTimeLabel.textContent = `Start at: ${formatTime(start)}`;

        // Wait for user to hit play, but show markers
        const renderWhenReady = () => {
            const markers = markersStore.get()[itemKey(item)] || [];
            renderMarkers(markers, els.progressMarkers, els.markersList, els.audioPlayer.duration, (t) => seekTo(t), (i) => deleteMarker(i));
            const notes = notesStore.get()[itemKey(item)] || [];
            renderNotes(notes, els.notesList, null, (t) => seekTo(t), (i) => deleteNote(i));
            updateProgressUI();
            els.audioPlayer.removeEventListener('loadedmetadata', renderWhenReady);
        };
        els.audioPlayer.addEventListener('loadedmetadata', renderWhenReady);

        // Load transcript
        if (item.day) {
            transcriptView.load(item.day);
        }
    }

    // CRUD for Markers/Notes
    function deleteMarker(idx) {
        const item = state.allItems[state.currentIndex];
        if (!item) return;
        const key = itemKey(item);
        const map = markersStore.get();
        const arr = map[key] || [];
        arr.splice(idx, 1);
        map[key] = arr;
        markersStore.set(map);

        const markers = arr;
        renderMarkers(markers, els.progressMarkers, els.markersList, els.audioPlayer.duration, (t) => seekTo(t), (i) => deleteMarker(i));
    }

    function deleteNote(idx) {
        const item = state.allItems[state.currentIndex];
        if (!item) return;
        const key = itemKey(item);
        const map = notesStore.get();
        const arr = map[key] || [];
        arr.splice(idx, 1);
        map[key] = arr;
        notesStore.set(map);

        const notes = arr;
        renderNotes(notes, els.notesList, null, (t) => seekTo(t), (i) => deleteNote(i));
    }

    function addMarker() {
        const item = state.allItems[state.currentIndex];
        if (!item) return;
        const t = Math.floor(els.audioPlayer.currentTime || 0);
        const label = prompt('Marker label (optional):', '');

        const key = itemKey(item);
        const map = markersStore.get();
        const arr = map[key] || [];
        arr.push({ time: t, label: label || '' });
        arr.sort((a, b) => a.time - b.time);
        map[key] = arr;
        markersStore.set(map);

        renderMarkers(arr, els.progressMarkers, els.markersList, els.audioPlayer.duration, (x) => seekTo(x), (i) => deleteMarker(i));
    }

    function updateProgressUI() {
        if (!els.progressFill || !els.currentTime || !els.durationTime) return;
        const dur = els.audioPlayer.duration || 0;
        const cur = els.audioPlayer.currentTime || 0;
        const pct = dur ? Math.min(100, (cur / dur) * 100) : 0;

        els.progressFill.style.width = `${pct}%`;
        els.currentTime.textContent = formatTime(cur);
        els.durationTime.textContent = formatTime(dur);
        els.progressArea?.setAttribute('aria-valuenow', String(Math.round(pct)));
    }

    let lastActiveNoteIdx = -1;
    function updateActiveNoteHighlight() {
        const item = state.allItems[state.currentIndex];
        if (!item) return;
        const notes = notesStore.get()[itemKey(item)] || [];
        if (!notes.length) return;

        const t = els.audioPlayer.currentTime || 0;
        const idx = notes.findIndex(n => t >= n.start && t < n.end);

        if (idx === lastActiveNoteIdx) return;
        lastActiveNoteIdx = idx;

        const clear = (c) => c?.querySelectorAll('.note-row-t.active').forEach(e => e.classList.remove('active'));
        clear(els.notesList);

        if (idx >= 0) {
            const sel = `[data-index="${idx}"]`;
            const rowA = els.notesList?.querySelector(sel);
            if (rowA && !(els.notesPanel?.classList.contains('is-hidden'))) {
                rowA.scrollIntoView({ block: 'nearest' });
            }
        }
    }

    function playNext() {
        if (!state.filteredItems.length) return;
        const currentItem = state.allItems[state.currentIndex];
        if (!currentItem && state.filteredItems.length) { tryPlay(0); return; }

        const idxInFiltered = state.filteredItems.indexOf(currentItem);
        let nextIdx = (idxInFiltered >= 0 ? (idxInFiltered + 1) % state.filteredItems.length : 0);

        // Find next playable
        for (let i = 0; i < state.filteredItems.length; i++) {
            const candidate = state.filteredItems[nextIdx];
            if (hasPlayableUrl(candidate)) { tryPlay(nextIdx); break; }
            nextIdx = (nextIdx + 1) % state.filteredItems.length;
        }
    }

    // --- Wire Events ---

    // Search/Filter
    els.search?.addEventListener('input', applyFilters);
    els.searchToggle?.addEventListener('click', () => {
        const isActive = els.searchGroup.classList.toggle('active');
        if (isActive) {
            els.search.focus();
        }
    });

    els.navMenuToggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        els.navMenuContent?.classList.toggle('is-open');
    });

    document.addEventListener('click', (e) => {
        if (els.navMenuContent && !els.navMenuContent.contains(e.target)) {
            els.navMenuContent.classList.remove('is-open');
        }
    });

    els.favBtn?.addEventListener('click', () => {
        els.favCheckbox.checked = !els.favCheckbox.checked;
        els.favBtn.classList.toggle('active', els.favCheckbox.checked);
        applyFilters();
    });

    els.sort?.addEventListener('change', () => {
        applyFilters();
        els.navMenuContent?.classList.remove('is-open');
    });

    els.favCheckbox?.addEventListener('change', applyFilters);

    // Audio Player Events
    els.btnPlay?.addEventListener('click', () => {
        togglePlay();
    });

    els.audioPlayer.addEventListener('play', () => { if (els.btnPlay) els.btnPlay.textContent = '⏸'; });
    els.audioPlayer.addEventListener('pause', () => { if (els.btnPlay) els.btnPlay.textContent = '▶'; });
    els.audioPlayer.addEventListener('ended', () => {
        saveLastListened({ time: 0 });
        playNext();
    });
    els.audioPlayer.addEventListener('timeupdate', () => {
        saveLastListened();
        updateProgressUI();
        updateActiveNoteHighlight();
    });

    els.btnNext?.addEventListener('click', playNext);

    els.btnBack20?.addEventListener('click', () => seekTo((els.audioPlayer.currentTime || 0) - 20));
    els.btnForward20?.addEventListener('click', () => seekTo((els.audioPlayer.currentTime || 0) + 20));
    els.btnMute?.addEventListener('click', () => {
        els.audioPlayer.muted = !els.audioPlayer.muted;
        els.btnMute.textContent = els.audioPlayer.muted ? '🔇' : '🔈';
    });

    els.volume?.addEventListener('input', () => {
        const v = Math.max(0, Math.min(1, parseFloat(els.volume.value || '1') || 1));
        els.audioPlayer.volume = v;
        prefsStore.setVolume(v);
    });

    els.playbackRate?.addEventListener('change', () => {
        const v = parseFloat(els.playbackRate.value || '1') || 1;
        els.audioPlayer.playbackRate = Math.max(0.25, Math.min(3, v));
        prefsStore.setRate(v);
    });

    // Notes Panel
    els.notesBtn?.addEventListener('click', () => {
        const hidden = els.notesPanel.classList.contains('is-hidden');
        els.notesPanel.classList.toggle('is-hidden', !hidden);
        els.notesPanel.setAttribute('aria-expanded', hidden ? 'true' : 'false');
        if (hidden) {
            const item = state.allItems[state.currentIndex];
            if (item) {
                const notes = notesStore.get()[itemKey(item)] || [];
                renderNotes(notes, els.notesList, null, (t) => seekTo(t), (i) => deleteNote(i));
            }
        }
    });
    els.closeNotesBtn?.addEventListener('click', () => {
        els.notesPanel.classList.add('is-hidden');
    });

    // Transcript Toggle
    els.transcript.btn?.addEventListener('click', () => transcriptView.toggle());

    // New Note / Quick Note
    els.newNoteBtn?.addEventListener('click', () => clipEditor.open());
    els.quickNoteBtn?.addEventListener('click', () => {
        const t = Math.floor(els.audioPlayer.currentTime || 0);
        clipEditor.open(t, t + 10);
    });

    // --- Mini Player & Collapse Logic ---
    const toggleCollapse = (e) => {
        if (e) e.stopPropagation();
        const card = els.playerSection;
        const isCollapsed = card.classList.toggle('collapsed');
        console.log('Player collapsed:', isCollapsed);

        // Update ARIA for accessibility
        els.playerCollapseBtn?.setAttribute('aria-expanded', String(!isCollapsed));
    };

    els.playerCollapseBtn?.addEventListener('click', toggleCollapse);

    // Mini Play Button
    els.btnMiniPlay?.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('Mini play clicked');
        togglePlay();
    });

    // Expand on tap (if not clicking mini-controls or other buttons)
    const playerHeader = document.querySelector('.player-header');
    playerHeader?.addEventListener('click', (e) => {
        const card = els.playerSection;
        if (card.classList.contains('collapsed')) {
            // If they clicked the header but NOT a specific button/control inside it
            if (!e.target.closest('.mini-controls') && !e.target.closest('.player-actions')) {
                console.log('Expanding via header tap');
                card.classList.remove('collapsed');
                els.playerCollapseBtn?.setAttribute('aria-expanded', 'true');
            }
        }
    });

    // Sync Mini-Play Icon
    els.audioPlayer.addEventListener('play', () => {
        if (els.btnMiniPlay) els.btnMiniPlay.textContent = '⏸';
    });
    els.audioPlayer.addEventListener('pause', () => {
        if (els.btnMiniPlay) els.btnMiniPlay.textContent = '▶';
    });
    // ------------------------------------

    // Markers
    els.addMarkerBtn?.addEventListener('click', addMarker);

    // Progress Bar Interaction
    els.progressRail?.addEventListener('click', (e) => {
        const rect = els.progressRail.getBoundingClientRect();
        const x = ('touches' in e && e.touches.length ? e.touches[0].clientX : e.clientX);
        const pct = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
        seekTo((els.audioPlayer.duration || 0) * pct);
    });

    // Restore Prefs
    const startRate = prefsStore.getRate();
    els.audioPlayer.playbackRate = startRate;
    if (els.playbackRate) els.playbackRate.value = String(startRate);

    const startVol = prefsStore.getVolume();
    els.audioPlayer.volume = startVol;
    // Tutorial
    els.helpBtn?.addEventListener('click', () => tutorial.show());

    // Main Tutorial (First Visit)
    if (!localStorage.getItem('tutorial_seen')) {
        setTimeout(() => tutorial.show(), 1500);
    }

    // Hero Tutorial Button
    const heroTutBtn = document.getElementById('hero-tutorial-btn');
    if (heroTutBtn) {
        heroTutBtn.addEventListener('click', () => tutorial.show());
    }

    // Theme Toggle
    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        prefsStore.setTheme(theme);
        if (els.themeToggle) {
            els.themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
        }
    };

    els.themeToggle?.addEventListener('click', () => {
        const current = prefsStore.getTheme();
        applyTheme(current === 'light' ? 'dark' : 'light');
    });

    // Initialize Theme
    applyTheme(prefsStore.getTheme());

    // Update Nav Streak
    const updateNavStreak = () => {
        const streakEl = document.getElementById('nav-streak-val');
        if (streakEl) streakEl.textContent = gamification.getStats().streak;
    };
    updateNavStreak();

    // Level Up Modal Handler
    const lvModal = document.getElementById('level-up-modal');
    const lvVal = document.getElementById('new-level-val');
    const lvClose = document.getElementById('level-up-close');

    window.addEventListener('bg-level-up', (e) => {
        if (!lvModal || !lvVal) return;
        lvVal.textContent = e.detail.level;
        lvModal.classList.remove('is-hidden');
    });

    lvClose?.addEventListener('click', () => {
        lvModal.classList.add('is-hidden');
    });

    // Activity tracking & Progress Sync
    let lastTrackTime = 0;
    els.audioPlayer.addEventListener('timeupdate', () => {
        const now = Date.now();
        if (now - lastTrackTime > 60000 && !els.audioPlayer.paused) {
            gamification.recordActivity(1); // Add 1 minute
            lastTrackTime = now;
            updateNavStreak();
        }

        // Sync Mini-Player Circular Progress
        // Sync Mini-Player Circular Progress
        if (els.progressRingCircle && els.audioPlayer.duration) {
            const radius = els.progressRingCircle.r.baseVal.value || 18;
            const circumference = radius * 2 * Math.PI;
            const progress = (els.audioPlayer.currentTime / els.audioPlayer.duration) || 0;
            const offset = circumference - (progress * circumference);

            els.progressRingCircle.style.strokeDasharray = `${circumference} ${circumference}`;
            els.progressRingCircle.style.strokeDashoffset = offset;
        }
    });

    // Initial Load
    fetch('./bg_chapter_info.json')
        .then(res => res.ok ? res.json() : [])
        .then(data => {
            state.allItems = Array.isArray(data) ? data.filter(x => x && (x.title || x.filename)) : [];
            // Seed custom starts
            const startsMap = customStartsStore.get();
            for (const it of state.allItems) {
                if (typeof it.start_time === 'number' && it.start_time >= 0) {
                    startsMap[itemKey(it)] = Math.floor(it.start_time);
                }
            }
            // (Don't save back to store, just use in memory or only save if user edits? 
            // Original code just added them to the map. Let's keep it in memory mostly, but original code didn't save explicitly unless user set one)
            // Wait, original code: `customStarts[itemKey(it)] = ...` then later `saveStarts()` only called on user button click. 
            // So we can just update the store default values? No, that overwrites user prefs.
            // Let's just merge: use saved if exists, else use file value.
            // Actually original code overwrites `customStarts` on load loop. 
            // Better behavior: Check if key exists in store, if not use file value.


            // Interactive & Random Roaming Background Icons
            const iconLayer = document.getElementById('scattered-icons');
            if (iconLayer) {
                const icons = Array.from(iconLayer.querySelectorAll('.icon-item.roaming'));
                icons.forEach((icon, i) => {
                    const side = i % 2 === 0 ? 'left' : 'right';
                    const iconsPerSide = icons.length / 2;
                    const sideIndex = Math.floor(i / 2);

                    const roam = () => {
                        // Vertical Slotting: Divide screen into icon.length/2 vertical zones
                        const slotHeight = 90 / iconsPerSide;
                        const slotTop = (sideIndex * slotHeight) + 5;

                        // Keep icons in side gutters (0-15% or 85-100%)
                        const x = side === 'left'
                            ? Math.random() * 15
                            : 85 + Math.random() * 15;

                        // Randomize Y within its assigned slot to prevent clustering
                        const y = slotTop + (Math.random() * slotHeight);

                        const duration = 20 + Math.random() * 20;

                        icon.style.transition = `left ${duration}s linear, top ${duration}s linear, transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease, filter 0.4s ease`;
                        icon.style.left = `${x}%`;
                        icon.style.top = `${y}%`;

                        setTimeout(roam, duration * 1000);
                    };

                    // Initial setup
                    icon.style.transform = `rotate(${Math.random() * 360}deg)`;
                    icon.style.opacity = '0';
                    setTimeout(() => { icon.style.opacity = '0.6'; roam(); }, i * 300);

                    // Touch/Hover Interaction
                    const activate = () => {
                        icon.classList.add('is-active');
                        setTimeout(() => icon.classList.remove('is-active'), 3000);
                    };
                    icon.addEventListener('mouseenter', activate);
                    icon.addEventListener('touchstart', (e) => {
                        activate();
                        // Optional: don't preventDefault so scrolling still works
                    }, { passive: true });
                });
            }

            // Audio Seeking Logic (Click AND Drag)
            if (els.progressArea) {
                let isDragging = false;

                const seek = (e) => {
                    const rect = els.progressArea.getBoundingClientRect();
                    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
                    const pct = x / rect.width;
                    const dur = els.audioPlayer.duration;
                    if (dur) {
                        els.audioPlayer.currentTime = pct * dur;
                        updateProgressUI();
                    }
                };

                els.progressArea.addEventListener('mousedown', (e) => {
                    isDragging = true;
                    seek(e);
                });

                document.addEventListener('mousemove', (e) => {
                    if (isDragging) seek(e);
                });

                document.addEventListener('mouseup', () => {
                    isDragging = false;
                });

                // Touch support for mobile
                els.progressArea.addEventListener('touchstart', (e) => {
                    isDragging = true;
                    seek(e.touches[0]);
                });

                document.addEventListener('touchmove', (e) => {
                    if (isDragging) seek(e.touches[0]);
                });

                document.addEventListener('touchend', () => {
                    isDragging = false;
                });
            }

            // 3-Dot Menu Toggle
            const menuBtn = document.getElementById('btn-player-menu');
            const menuPanel = document.getElementById('player-menu');
            menuBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                menuPanel?.classList.toggle('is-open');
            });

            // Close menu when clicking outside
            document.addEventListener('click', () => {
                menuPanel?.classList.remove('is-open');
            });

            menuPanel?.addEventListener('click', (e) => e.stopPropagation());

            // Sleep Timer
            let sleepTimerId = null;
            const sleepTimerSelect = document.getElementById('sleep-timer');
            sleepTimerSelect?.addEventListener('change', () => {
                const mins = parseInt(sleepTimerSelect.value, 10);
                if (sleepTimerId) clearTimeout(sleepTimerId);

                if (mins > 0) {
                    sleepTimerId = setTimeout(() => {
                        els.audioPlayer.pause();
                        sleepTimerSelect.value = '0';
                        alert('Sleep timer ended. Audio paused.');
                    }, mins * 60 * 1000);
                }
            });

            // Loop Mode
            const loopToggle = document.getElementById('loop-toggle');
            loopToggle?.addEventListener('change', () => {
                els.audioPlayer.loop = loopToggle.checked;
            });

            // Add Marker from menu
            const addMarkerBtn = document.getElementById('btn-add-marker');
            addMarkerBtn?.addEventListener('click', () => {
                addMarker();
                menuPanel?.classList.remove('is-open');
            });

            // Keyboard Shortcuts
            document.addEventListener('keydown', (e) => {
                // Don't trigger if typing in an input
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

                switch (e.code) {
                    case 'Space':
                        e.preventDefault();
                        togglePlay();
                        break;
                    case 'ArrowLeft':
                        e.preventDefault();
                        seekTo(Math.max(0, els.audioPlayer.currentTime - 5));
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        seekTo(els.audioPlayer.currentTime + 5);
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        els.audioPlayer.volume = Math.min(1, els.audioPlayer.volume + 0.1);
                        if (els.volume) els.volume.value = String(els.audioPlayer.volume);
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        els.audioPlayer.volume = Math.max(0, els.audioPlayer.volume - 0.1);
                        if (els.volume) els.volume.value = String(els.audioPlayer.volume);
                        break;
                    case 'KeyM':
                        els.audioPlayer.muted = !els.audioPlayer.muted;
                        break;
                }
            });

            applyFilters();
            restoreLastListened();
        })
        .catch(err => {
            console.error(err);
            els.audioList.innerHTML = '<div class="audio-item disabled"><h3 class="item-title">Error loading data</h3></div>';
        });
});

// --- Feedback Feature Logic ---
window.addEventListener('tutorial-complete', () => {
    console.log('Tutorial complete. Scheduling feedback popup for 2 minutes.');

    // Show top link immediately? User said "after 2min make pop up and make a glowing text".
    // I will show them both after 2 minutes to be consistent.
    setTimeout(() => {
        showFeedback();
    }, 120000); // 2 minutes
});

function showFeedback() {
    const popup = document.getElementById('feedback-popup');
    const topLink = document.getElementById('top-feedback-link');
    const closeBtn = document.getElementById('feedback-close');

    // Show Popup
    if (popup) {
        popup.classList.remove('is-hidden');
        if (closeBtn) {
            closeBtn.onclick = () => {
                popup.classList.add('is-hidden');
            };
        }
    }

    // Show Top Link
    if (topLink) {
        topLink.classList.remove('is-hidden');
    }
}
