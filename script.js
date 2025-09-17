
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
    const progressArea = document.getElementById('progress-area');
    const progressRail = document.getElementById('progress-rail');
    const progressFill = document.getElementById('progress-fill');
    const progressMarkers = document.getElementById('progress-markers');
    const currentTimeEl = document.getElementById('current-time');
    const durationTimeEl = document.getElementById('duration-time');
    const addMarkerBtn = document.getElementById('add-marker-btn');
    const markersListEl = document.getElementById('markers-list');
    // Notes UI elements
    const notesPanel = document.getElementById('notes-panel');
    const notesBtn = document.getElementById('player-notes-btn');
    const closeNotesBtn = document.getElementById('close-notes-btn');
    const newNoteBtn = document.getElementById('new-note-btn');
    const notesListEl = document.getElementById('notes-list');
    const selectionRangeEl = document.getElementById('selection-range');
    const composeEl = document.getElementById('note-compose');
    const noteTextEl = document.getElementById('note-text');
    const saveNoteBtn = document.getElementById('save-note-btn');
    const cancelNoteBtn = document.getElementById('cancel-note-btn');
    const noteRangeLabel = document.getElementById('note-range-label');
    // Custom controls
    const btnBack20 = document.getElementById('btn-back-20');
    const btnPlay = document.getElementById('btn-play');
    const btnForward20 = document.getElementById('btn-forward-20');
    const btnNext = document.getElementById('btn-next');
    const playbackRateSel = document.getElementById('playback-rate');
    const volumeRange = document.getElementById('volume');
    const btnMute = document.getElementById('btn-mute');
    const quickNoteBtn = document.getElementById('btn-quick-note');
    const inlineNotesEl = document.getElementById('inline-notes');
    // Clip editor modal refs
    const clipEditor = document.getElementById('clip-editor');
    const clipBackdrop = document.getElementById('clip-backdrop');
    const clipClose = document.getElementById('clip-close');
    const clipStartInput = document.getElementById('clip-start');
    const clipEndInput = document.getElementById('clip-end');
    const clipLenEl = document.getElementById('clip-length');
    const clipRail = document.getElementById('clip-rail');
    const clipSel = document.getElementById('clip-selection');
    const clipHandleStart = document.getElementById('clip-handle-start');
    const clipHandleEnd = document.getElementById('clip-handle-end');
    const clipPlayhead = document.getElementById('clip-playhead');
    const clipText = document.getElementById('clip-text');
    const clipSave = document.getElementById('clip-save');
    const clipCancel = document.getElementById('clip-cancel');
    const clipPlayBtn = document.getElementById('clip-play');
    const clipBack5 = document.getElementById('clip-back-5');
    const clipFwd5 = document.getElementById('clip-fwd-5');
    const clipSetStart = document.getElementById('clip-set-start');
    const clipSetEnd = document.getElementById('clip-set-end');
    const clipLoopChk = document.getElementById('clip-loop');

    const jsonFilePath = './bg_chapter_info.json';

    let allItems = [];
    let filteredItems = [];
    let currentIndex = -1;
    let favorites = new Set();
    const LAST_KEY = 'bg_audio_last_listened';
    const STARTS_KEY = 'bg_audio_custom_starts';
    let customStarts = {};
    const MARKERS_KEY = 'bg_audio_markers_v1';
    let markersByKey = {};
    const NOTES_KEY = 'bg_audio_notes_v1';
    let notesByKey = {};
    // Note selection state (legacy inline notes) — disabled in favor of clip editor
    // let noteSelection = null; // { phase: 'idle'|'pick-start'|'pick-end', start:number, end:number }

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
            <strong>Title:</strong> ${item.title|| '  '} &nbsp;   
            <strong>Day:</strong> ${item.day ?? '  '} &nbsp;   
            <strong>Class Type:</strong> ${item.class_type || '   '}   &nbsp;
            <strong>Date:</strong> ${item.date || '   '}   &nbsp;
            <strong>Speaker:</strong> ${item.speaker || '   '}   &nbsp;
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
    // render markers for this item (after potential duration known)
    const renderWhenReady = () => { renderMarkers(item); renderNotes(item); updateProgressUI(); audioPlayer.removeEventListener('loadedmetadata', renderWhenReady); };
    audioPlayer.addEventListener('loadedmetadata', renderWhenReady);
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

    // Markers persistence
    try {
        markersByKey = JSON.parse(localStorage.getItem(MARKERS_KEY) || '{}');
        if (!markersByKey || typeof markersByKey !== 'object') markersByKey = {};
    } catch { markersByKey = {}; }
    function saveMarkers() { try { localStorage.setItem(MARKERS_KEY, JSON.stringify(markersByKey)); } catch {} }
    function getMarkers(item) { return markersByKey[itemKey(item)] || []; }
    function setMarkers(item, arr) { markersByKey[itemKey(item)] = arr; saveMarkers(); }
    function addMarker(item, time, label) {
        const arr = [...getMarkers(item), { time: Math.max(0, Math.floor(time)), label: label || '' }];
        arr.sort((a,b)=>a.time-b.time);
        setMarkers(item, arr);
    }
    function removeMarker(item, idx) {
        const arr = getMarkers(item).slice();
        arr.splice(idx,1);
        setMarkers(item, arr);
    }

    function renderMarkers(item) {
        if (!progressMarkers || !progressRail) return;
        const dur = audioPlayer.duration || 0;
        progressMarkers.innerHTML = '';
        const markers = getMarkers(item);
        markers.forEach((m, i) => {
            if (!dur) return;
            const pct = (m.time / dur) * 100;
            const dot = document.createElement('button');
            dot.className = 'marker-dot';
            dot.style.left = `${pct}%`;
            dot.title = m.label ? `${m.label} (${formatTime(m.time)})` : formatTime(m.time);
            dot.setAttribute('aria-label', dot.title);
            dot.addEventListener('click', (e) => { e.stopPropagation(); seekTo(m.time); });
            progressMarkers.appendChild(dot);
        });

        // List view
        if (markersListEl) {
            markersListEl.innerHTML = '';
            markers.forEach((m, i) => {
                const row = document.createElement('div');
                row.className = 'marker-item';
                const left = document.createElement('div');
                left.className = 'label';
                left.textContent = m.label || `Marker ${i+1}`;
                const time = document.createElement('div');
                time.className = 'time';
                time.textContent = formatTime(m.time);
                const goBtn = document.createElement('button');
                goBtn.className = 'icon-btn';
                goBtn.textContent = 'Go';
                goBtn.title = 'Seek to marker';
                goBtn.addEventListener('click', ()=> seekTo(m.time));
                const delBtn = document.createElement('button');
                delBtn.className = 'icon-btn';
                delBtn.textContent = 'Remove';
                delBtn.addEventListener('click', ()=> { removeMarker(item, i); renderMarkers(item); });
                row.appendChild(left); row.appendChild(time); row.appendChild(goBtn); row.appendChild(delBtn);
                markersListEl.appendChild(row);
            });
        }
    }

    function seekTo(seconds) {
        const s = Math.max(0, Math.min(seconds, (audioPlayer.duration||0)-0.5));
        try { audioPlayer.currentTime = s; } catch {}
    }

    function updateProgressUI() {
        if (!progressFill || !currentTimeEl || !durationTimeEl) return;
        const dur = audioPlayer.duration || 0;
        const cur = audioPlayer.currentTime || 0;
        const pct = dur ? Math.min(100, (cur / dur) * 100) : 0;
        progressFill.style.width = `${pct}%`;
        currentTimeEl.textContent = formatTime(cur);
        durationTimeEl.textContent = formatTime(dur);
        // update a11y value
        progressArea?.setAttribute('aria-valuenow', String(Math.round(pct)));
    }

    // Click/drag/keyboard on progress
    function railPosToTime(evt) {
        const rect = progressRail.getBoundingClientRect();
        const x = ('touches' in evt && evt.touches.length ? evt.touches[0].clientX : evt.clientX);
        const pct = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
        return (audioPlayer.duration || 0) * pct;
    }
    // function handleProgressClickForNotes(e) {
    //     if (!noteSelection || noteSelection.phase === 'idle') return false;
    //     const t = Math.floor(railPosToTime(e));
    //     if (noteSelection.phase === 'pick-start') {
    //         noteSelection.start = t; noteSelection.end = t; noteSelection.phase = 'pick-end';
    //     } else if (noteSelection.phase === 'pick-end') {
    //         noteSelection.end = t;
    //         if (noteSelection.end < noteSelection.start) {
    //             const tmp = noteSelection.start; noteSelection.start = noteSelection.end; noteSelection.end = tmp;
    //         }
    //     }
    //     updateSelectionVisual();
    //     return true;
    // }
    progressRail?.addEventListener('click', (e) => {
        // Legacy inline note selection disabled; simple seek only
        seekTo(railPosToTime(e));
    });
    progressArea?.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); seekTo((audioPlayer.currentTime||0) - 5); }
        if (e.key === 'ArrowRight') { e.preventDefault(); seekTo((audioPlayer.currentTime||0) + 5); }
        if (e.key === 'Home') { e.preventDefault(); seekTo(0); }
        if (e.key === 'End') { e.preventDefault(); seekTo(audioPlayer.duration||0); }
    });
    // optional drag
    let dragging = false;
    progressRail?.addEventListener('mousedown', (e)=> { dragging = true; seekTo(railPosToTime(e)); });
    window.addEventListener('mousemove', (e)=> { if (dragging) seekTo(railPosToTime(e)); });
    window.addEventListener('mouseup', ()=> dragging = false);

    // Add marker
    addMarkerBtn?.addEventListener('click', () => {
        const current = allItems[currentIndex];
        if (!current) return;
        const t = Math.floor(audioPlayer.currentTime || 0);
        const label = prompt('Marker label (optional):', '');
        addMarker(current, t, label || '');
        renderMarkers(current);
    });

    // ===== Notes persistence and UI =====
    try {
        notesByKey = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}');
        if (!notesByKey || typeof notesByKey !== 'object') notesByKey = {};
    } catch { notesByKey = {}; }
    function saveNotes() { try { localStorage.setItem(NOTES_KEY, JSON.stringify(notesByKey)); } catch {} }
    function getNotes(item) { return notesByKey[itemKey(item)] || []; }
    function setNotes(item, arr) { notesByKey[itemKey(item)] = arr; saveNotes(); }

    let lastActiveNoteIdx = -1;
    function renderNotes(item) {
        if (!notesListEl) return;
        notesListEl.innerHTML = '';
        if (inlineNotesEl) inlineNotesEl.innerHTML = '';
        notesListEl.classList.add('transcript');
        inlineNotesEl?.classList.add('transcript');
        const list = getNotes(item);
        if (!list.length) {
            const empty = document.createElement('div');
            empty.className = 'note-empty';
            empty.textContent = 'No notes yet.';
            notesListEl.appendChild(empty);
            if (inlineNotesEl) inlineNotesEl.appendChild(empty.cloneNode(true));
            lastActiveNoteIdx = -1;
            return;
        }
        const buildRow = (n, i) => {
            const row = document.createElement('div');
            row.className = 'note-row-t';
            row.dataset.index = String(i);
            row.tabIndex = 0;
            const text = document.createElement('div');
            text.className = 'note-line-text';
            text.textContent = n.text || n.title || `Note ${i+1}`;
            const right = document.createElement('div');
            right.className = 'note-line-right';
            const time = document.createElement('span');
            time.className = 'note-time-range';
            time.textContent = `${formatTime(n.start)}–${formatTime(n.end)}`;
            const delBtn = document.createElement('button');
            delBtn.className = 'note-delete';
            delBtn.textContent = 'Delete';
            delBtn.title = 'Delete note';
            delBtn.addEventListener('click', (e)=>{ e.stopPropagation(); const arr = getNotes(item).slice(); arr.splice(i,1); setNotes(item, arr); renderNotes(item); });
            right.appendChild(time); right.appendChild(delBtn);
            row.appendChild(text); row.appendChild(right);
            row.addEventListener('click', ()=> seekTo(n.start));
            row.addEventListener('keydown', (e)=>{ if (e.key==='Enter' || e.key===' ') { e.preventDefault(); seekTo(n.start); }});
            return row;
        };
        list.forEach((n,i)=>{
            const row1 = buildRow(n,i);
            notesListEl.appendChild(row1);
            if (inlineNotesEl) inlineNotesEl.appendChild(buildRow(n,i));
        });
        lastActiveNoteIdx = -1;
        updateActiveNoteHighlight();
    }

    function updateActiveNoteHighlight() {
        const current = allItems[currentIndex];
        if (!current) return;
        const list = getNotes(current);
        if (!list.length) return;
        const t = audioPlayer.currentTime || 0;
        const idx = list.findIndex(n => t >= n.start && t < n.end);
        if (idx === lastActiveNoteIdx) return;
        lastActiveNoteIdx = idx;
        const clear = (container) => {
            container?.querySelectorAll('.note-row-t.active').forEach(el=> el.classList.remove('active'));
        };
        clear(notesListEl); clear(inlineNotesEl);
        if (idx >= 0) {
            const sel = `[data-index="${idx}"]`;
            const rowA = notesListEl?.querySelector(sel);
            const rowB = inlineNotesEl?.querySelector(sel);
            rowA?.classList.add('active'); rowB?.classList.add('active');
            // auto-scroll side panel only when visible
            if (rowA && !(document.getElementById('notes-panel')?.classList.contains('is-hidden'))) {
                rowA.scrollIntoView({ block: 'nearest' });
            }
        }
    }

    function showNotesPanel(show) {
        if (!notesPanel) return;
        notesPanel.classList.toggle('is-hidden', !show);
        notesPanel.setAttribute('aria-expanded', show ? 'true' : 'false');
    }

    // function resetSelection() {
    //     noteSelection = { phase: 'idle', start: 0, end: 0 };
    //     selectionRangeEl?.classList.add('is-hidden');
    //     selectionRangeEl?.setAttribute('aria-hidden', 'true');
    //     if (composeEl) composeEl.classList.add('is-hidden');
    //     if (noteTextEl) noteTextEl.value = '';
    //     if (noteRangeLabel) noteRangeLabel.textContent = '';
    // }
    // resetSelection();

    // function startNewNote() {
    //     if (!audioPlayer.duration) return;
    //     showNotesPanel(true);
    //     noteSelection = { phase: 'pick-start', start: Math.floor(audioPlayer.currentTime||0), end: Math.floor(audioPlayer.currentTime||0) };
    //     if (composeEl) composeEl.classList.remove('is-hidden');
    //     if (noteRangeLabel) noteRangeLabel.textContent = 'Click the bar to set start…';
    // }

    // function updateSelectionVisual() {
    //     if (!selectionRangeEl) return;
    //     const dur = audioPlayer.duration || 0;
    //     if (!dur || !noteSelection || noteSelection.phase === 'idle') { selectionRangeEl.classList.add('is-hidden'); return; }
    //     const a = Math.max(0, Math.min(noteSelection.start, noteSelection.end));
    //     const b = Math.max(noteSelection.start, noteSelection.end);
    //     const leftPct = (a / dur) * 100;
    //     const widthPct = Math.max(0, ((b - a) / dur) * 100);
    //     selectionRangeEl.style.left = `${leftPct}%`;
    //     selectionRangeEl.style.width = `${widthPct}%`;
    //     selectionRangeEl.classList.toggle('is-hidden', widthPct <= 0.5);
    //     selectionRangeEl.setAttribute('aria-hidden', widthPct <= 0.5 ? 'true' : 'false');
    //     if (noteRangeLabel) noteRangeLabel.textContent = `${formatTime(a)}–${formatTime(b)}${noteSelection.phase==='pick-end'?' (pick end…)':''}`;
    // }

    // ===== Clip editor logic =====
    let clipState = { open: false, start: 0, end: 0 };
    function secToPretty(sec) {
        const s = Math.max(0, Number(sec)||0);
        const m = Math.floor(s/60); const r = (s%60).toFixed(1);
        return `${m}:${r.padStart(4,'0')}`;
    }
    function prettyToSec(txt) {
        const m = String(txt||'').trim().split(':');
        if (m.length===1) return parseFloat(m[0]||'0')||0;
        const mm = parseFloat(m[0]||'0')||0; const ss = parseFloat(m[1]||'0')||0; return mm*60+ss;
    }
    function pctToTime(pct) { return (audioPlayer.duration||0) * Math.max(0, Math.min(1, pct)); }
    function timeToPct(sec) { const d = (audioPlayer.duration||0)||1; return Math.max(0, Math.min(1, sec/d)); }
    function updateClipUI() {
        const d = audioPlayer.duration||0; if (!d) return;
        const a = Math.max(0, Math.min(clipState.start, clipState.end));
        const b = Math.max(clipState.start, clipState.end);
        const lp = timeToPct(a)*100; const rp = timeToPct(b)*100;
        if (clipSel) { clipSel.style.left = `${lp}%`; clipSel.style.width = `${Math.max(0, rp-lp)}%`; }
        if (clipHandleStart) { clipHandleStart.style.left = `${lp}%`; clipHandleStart.setAttribute('aria-valuenow', String(Math.round(lp))); }
        if (clipHandleEnd) { clipHandleEnd.style.left = `${rp}%`; clipHandleEnd.setAttribute('aria-valuenow', String(Math.round(rp))); }
        if (clipPlayhead) clipPlayhead.style.left = `${timeToPct(audioPlayer.currentTime||0)*100}%`;
        if (clipStartInput) clipStartInput.value = secToPretty(a);
        if (clipEndInput) clipEndInput.value = secToPretty(b);
        if (clipLenEl) clipLenEl.textContent = `${(b-a).toFixed(1)}s`;
    }
    function openClipEditor(presetStart, presetEnd) {
        const d = audioPlayer.duration||0; if (!d) return;
        clipState.start = Math.max(0, Math.min(presetStart ?? Math.floor(audioPlayer.currentTime||0), d));
        clipState.end = Math.max(clipState.start, Math.min(presetEnd ?? (clipState.start+15), d));
        clipEditor?.classList.remove('is-hidden');
        clipBackdrop?.classList.remove('is-hidden');
        clipEditor?.setAttribute('aria-hidden','false');
        updateClipUI();
        clipState.open = true;
    if (clipPlayBtn) clipPlayBtn.textContent = audioPlayer.paused ? 'Play' : 'Pause';
    }
    function closeClipEditor() {
        clipEditor?.classList.add('is-hidden');
        clipBackdrop?.classList.add('is-hidden');
        clipEditor?.setAttribute('aria-hidden','true');
        clipState.open = false;
    }
    clipClose?.addEventListener('click', closeClipEditor);
    clipCancel?.addEventListener('click', closeClipEditor);
    clipBackdrop?.addEventListener('click', closeClipEditor);
    newNoteBtn?.addEventListener('click', () => openClipEditor());
    quickNoteBtn?.addEventListener('click', () => openClipEditor(Math.floor(audioPlayer.currentTime||0), Math.floor((audioPlayer.currentTime||0)+10)));
    // Inputs
    clipStartInput?.addEventListener('change', () => { clipState.start = Math.max(0, Math.min(prettyToSec(clipStartInput.value||'0'), (audioPlayer.duration||0))); if (clipState.end < clipState.start) clipState.end = clipState.start; updateClipUI(); });
    clipEndInput?.addEventListener('change', () => { clipState.end = Math.max(0, Math.min(prettyToSec(clipEndInput.value||'0'), (audioPlayer.duration||0))); if (clipState.end < clipState.start) clipState.start = clipState.end; updateClipUI(); });
    // Drag handles
    function dragHandle(handle, which) {
        let dragging = false;
        const onMove = (e) => {
            if (!dragging) return; const rect = clipRail.getBoundingClientRect();
            const x = ('touches' in e && e.touches.length ? e.touches[0].clientX : e.clientX);
            const pct = Math.max(0, Math.min(1, (x-rect.left)/rect.width));
            const t = pctToTime(pct);
            if (which==='start') { clipState.start = Math.min(t, clipState.end); }
            else { clipState.end = Math.max(t, clipState.start); }
            updateClipUI();
        };
        const onUp = () => { dragging = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
        handle?.addEventListener('mousedown', (e)=>{ e.preventDefault(); dragging = true; window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp); });
    }
    dragHandle(clipHandleStart, 'start');
    dragHandle(clipHandleEnd, 'end');
    // Click rail to seek
    clipRail?.addEventListener('click', (e)=>{
        const rect = clipRail.getBoundingClientRect();
        const x = e.clientX; const pct = Math.max(0, Math.min(1, (x-rect.left)/rect.width));
        seekTo(pctToTime(pct)); updateClipUI();
    });
    // Transport
    clipPlayBtn?.addEventListener('click', ()=>{
        if (audioPlayer.paused) { audioPlayer.play().catch(()=>{}); clipPlayBtn.textContent = 'Pause'; }
        else { audioPlayer.pause(); clipPlayBtn.textContent = 'Play'; }
    });
    clipBack5?.addEventListener('click', ()=>{ seekTo((audioPlayer.currentTime||0)-5); updateClipUI(); });
    clipFwd5?.addEventListener('click', ()=>{ seekTo((audioPlayer.currentTime||0)+5); updateClipUI(); });
    clipSetStart?.addEventListener('click', ()=>{ clipState.start = Math.min(audioPlayer.currentTime||0, clipState.end); updateClipUI(); });
    clipSetEnd?.addEventListener('click', ()=>{ clipState.end = Math.max(audioPlayer.currentTime||0, clipState.start); updateClipUI(); });
    // Loop selection
    audioPlayer.addEventListener('timeupdate', ()=>{
        if (!clipState.open) return;
        if (!clipLoopChk?.checked) return;
        const t = audioPlayer.currentTime||0;
        if (t >= clipState.end - 0.05) { seekTo(clipState.start); }
    });
    // Save
    clipSave?.addEventListener('click', () => {
        const current = allItems[currentIndex]; if (!current) return;
        const start = Math.floor(clipState.start||0); let end = Math.floor(clipState.end||0);
        if (end <= start) end = Math.min((audioPlayer.duration||0), start+3);
        const text = (clipText?.value||'').trim();
        const title = text.split('\n')[0]?.slice(0,60) || `Note ${(getNotes(current).length)+1}`;
        const arr = [...getNotes(current), { start, end, text, title }].sort((a,b)=>a.start-b.start);
        setNotes(current, arr);
        renderNotes(current);
        closeClipEditor();
    });
    // Keep playhead in modal in sync
    audioPlayer.addEventListener('timeupdate', ()=> { if (clipState.open) updateClipUI(); });

    // Notes UI buttons
    notesBtn?.addEventListener('click', () => {
        const show = notesPanel?.classList.contains('is-hidden');
        showNotesPanel(!!show);
        if (show) {
            const current = allItems[currentIndex];
            if (current) renderNotes(current);
        }
    });
    closeNotesBtn?.addEventListener('click', () => { showNotesPanel(false); /* resetSelection disabled */ });
    // newNoteBtn is handled above to openClipEditor(); legacy startNewNote disabled
    // cancelNoteBtn?.addEventListener('click', () => resetSelection());
    // saveNoteBtn legacy handler disabled in favor of clip editor save

    // === Custom controls wiring ===
    btnBack20?.addEventListener('click', () => seekTo((audioPlayer.currentTime||0) - 20));
    btnForward20?.addEventListener('click', () => seekTo((audioPlayer.currentTime||0) + 20));
    btnPlay?.addEventListener('click', () => {
        if (audioPlayer.paused) {
            audioPlayer.play().catch(()=>{}); btnPlay.textContent = '⏸';
        } else {
            audioPlayer.pause(); btnPlay.textContent = '▶';
        }
    });
    audioPlayer.addEventListener('play', () => { if (btnPlay) btnPlay.textContent = '⏸'; });
    audioPlayer.addEventListener('pause', () => { if (btnPlay) btnPlay.textContent = '▶'; });
    playbackRateSel?.addEventListener('change', () => {
        const v = parseFloat(playbackRateSel.value || '1') || 1;
        audioPlayer.playbackRate = Math.max(0.25, Math.min(3, v));
        try { localStorage.setItem('bg_audio_rate', String(audioPlayer.playbackRate)); } catch {}
    });
    volumeRange?.addEventListener('input', () => {
        const v = Math.max(0, Math.min(1, parseFloat(volumeRange.value || '1') || 1));
        audioPlayer.volume = v;
        try { localStorage.setItem('bg_audio_volume', String(v)); } catch {}
    });
    btnMute?.addEventListener('click', () => {
        audioPlayer.muted = !audioPlayer.muted;
        btnMute.textContent = audioPlayer.muted ? '🔇' : '🔈';
    });
    // restore saved rate/volume
    try {
        const r = parseFloat(localStorage.getItem('bg_audio_rate') || '1') || 1; audioPlayer.playbackRate = r; if (playbackRateSel) playbackRateSel.value = String(r);
        const v = parseFloat(localStorage.getItem('bg_audio_volume') || '1') || 1; audioPlayer.volume = v; if (volumeRange) volumeRange.value = String(v);
    } catch {}
    // Next track
    function playNext() {
        if (!filteredItems.length) return;
        if (currentIndex < 0) { tryPlay(0); return; }
        const currentItem = allItems[currentIndex];
        const idxInFiltered = filteredItems.indexOf(currentItem);
        let nextIdx = (idxInFiltered >= 0 ? (idxInFiltered + 1) % filteredItems.length : 0);
        // find next playable
        for (let i=0;i<filteredItems.length;i++) {
            const candidate = filteredItems[nextIdx];
            if (hasPlayableUrl(candidate)) { tryPlay(nextIdx); break; }
            nextIdx = (nextIdx + 1) % filteredItems.length;
        }
    }
    btnNext?.addEventListener('click', playNext);
    audioPlayer.addEventListener('ended', playNext);
    // Quick note legacy inline handler disabled; use openClipEditor quick-note wiring above
    // quickNoteBtn?.addEventListener('click', () => {
    //     if (!audioPlayer.duration) return;
    //     showNotesPanel(true);
    //     noteSelection = { phase: 'pick-end', start: Math.floor(audioPlayer.currentTime||0), end: Math.floor((audioPlayer.currentTime||0) + 10) };
    //     if (composeEl) composeEl.classList.remove('is-hidden');
    //     updateSelectionVisual();
    // });

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
    const renderWhenReady = () => { renderMarkers(item); renderNotes(item); updateProgressUI(); audioPlayer.removeEventListener('loadedmetadata', renderWhenReady); };
    audioPlayer.addEventListener('loadedmetadata', renderWhenReady);
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

    audioPlayer.addEventListener('timeupdate', () => { saveLastListened(); updateProgressUI(); updateActiveNoteHighlight(); });
    audioPlayer.addEventListener('pause', () => saveLastListened());
    audioPlayer.addEventListener('ended', () => saveLastListened({ time: 0 }));
});
