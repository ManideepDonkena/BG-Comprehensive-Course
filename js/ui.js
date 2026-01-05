import { hasPlayableUrl, itemKey, formatTime, secToPretty, timeToPct } from './utils.js';

/**
 * Generates the DOM element for a single audio item card using a template.
 */
export function createItemElement(item, isFavorite, template) {
    if (!template) {
        console.error('Template not found');
        return document.createElement('div');
    }

    const clone = template.content.cloneNode(true);

    const playable = !!hasPlayableUrl(item);
    let title = item.title || 'Untitled';

    // Clean title: Remove "BG Chapter X-" or "BG Chapter X " prefix to show only section
    // Regex covers: "BG Chapter 1-", "BG Chapter 2 - ", "BG Chapter 5 (5.1-6)" prefix removal if needed?
    // User requested: "2nd section" instead of "BG Chapter 2- 2nd section"
    // So we remove everything up to the first hyphen or just "BG Chapter \d+[- ]"
    title = title.replace(/^BG\s*Chapter\s*\d+[\s-]*(\d+(\.\d+)?[-]\d+)?/, '').replace(/^[-\s]+/, '').trim();

    const classType = item.class_type || 'Class';
    const day = item.day != null ? item.day : '';
    const chapter = item.chapter != null ? `Chapter ${item.chapter}` : '';


    // Popover Content (Simplified: just section name)
    const popMeta = clone.querySelector('.meta-date');
    if (popMeta) popMeta.textContent = chapter || classType;

    const popSubtitle = clone.querySelector('.popover-subtitle');
    if (popSubtitle) popSubtitle.textContent = title || 'Section';

    const descEl = clone.querySelector('.popover-description');
    if (descEl) descEl.style.display = 'none'; // User requested to hide description

    const cardEl = clone.querySelector('.audio-item');
    if (cardEl && isFavorite) {
        cardEl.classList.add('is-fav');
    }

    const badge = clone.querySelector('.meta-day');
    if (badge && day !== '') {
        badge.textContent = day;
    }

    const noAudioEl = clone.querySelector('.meta-no-audio');
    if (noAudioEl) noAudioEl.hidden = playable;

    // Force Hover via JS to resolve CSS hover issues
    const audioContent = clone.querySelector('.audio-item');
    if (audioContent) {
        // Use pointer events for better hybrid support
        audioContent.addEventListener('pointerenter', () => {
            audioContent.classList.add('force-visible');
        });
        audioContent.addEventListener('pointerleave', () => {
            audioContent.classList.remove('force-visible');
        });
    }

    return clone;
}

export function updateCurrentInfo(el, item) {
    if (!el || !item) return;
    // Simplified cleaner minimal display
    const title = item.title || 'Untitled';
    const speaker = item.speaker || '';
    const date = item.date || '';
    const parts = [
        `<strong>${title}</strong>`,
        speaker,
        date
    ].filter(Boolean).join(' <span style="opacity:0.4; margin:0 6px">•</span> ');

    el.innerHTML = parts;
}

export function renderMarkers(markers, progressMarkersEl, markersListEl, duration, seekCb, removeCb) {
    if (progressMarkersEl) {
        progressMarkersEl.innerHTML = '';
        markers.forEach(m => {
            if (!duration) return;
            const pct = (m.time / duration) * 100;
            const dot = document.createElement('button');
            dot.className = 'marker-dot';
            dot.style.left = `${pct}%`;
            dot.title = m.label ? `${m.label} (${formatTime(m.time)})` : formatTime(m.time);
            dot.setAttribute('aria-label', dot.title);
            dot.addEventListener('click', (e) => { e.stopPropagation(); seekCb(m.time); });
            progressMarkersEl.appendChild(dot);
        });
    }

    if (markersListEl) {
        markersListEl.innerHTML = '';
        markers.forEach((m, i) => {
            const row = document.createElement('div');
            row.className = 'marker-item';

            const left = document.createElement('div');
            left.className = 'label';
            left.textContent = m.label || `Marker ${i + 1}`;

            const time = document.createElement('div');
            time.className = 'time';
            time.textContent = formatTime(m.time);

            const goBtn = document.createElement('button');
            goBtn.className = 'icon-btn';
            goBtn.textContent = 'Go';
            goBtn.title = 'Seek to marker';
            goBtn.addEventListener('click', () => seekCb(m.time));

            const delBtn = document.createElement('button');
            delBtn.className = 'icon-btn';
            delBtn.textContent = 'Remove';
            delBtn.title = 'Remove marker';
            delBtn.addEventListener('click', () => removeCb(i));

            row.appendChild(left); row.appendChild(time); row.appendChild(goBtn); row.appendChild(delBtn);
            markersListEl.appendChild(row);
        });
    }
}

export function renderNotes(notes, notesListEl, unused, seekCb, deleteCb) {
    if (!notesListEl) return;
    notesListEl.innerHTML = '';
    notesListEl.classList.add('transcript');

    if (!notes.length) {
        const empty = document.createElement('div');
        empty.className = 'note-empty';
        empty.textContent = 'No notes yet.';
        notesListEl.appendChild(empty);
        return;
    }

    // ... helper ...
    const buildRow = (n, i) => {
        const row = document.createElement('div');
        row.className = 'note-row-t';
        row.dataset.index = String(i);
        row.tabIndex = 0;

        const text = document.createElement('div');
        text.className = 'note-line-text';
        text.textContent = n.text || n.title || `Note ${i + 1}`;

        const right = document.createElement('div');
        right.className = 'note-line-right';

        const time = document.createElement('span');
        time.className = 'note-time-range';
        time.textContent = `${formatTime(n.start)}–${formatTime(n.end)}`;

        const delBtn = document.createElement('button');
        delBtn.className = 'note-delete';
        delBtn.textContent = 'Delete';
        delBtn.title = 'Delete note';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteCb(i);
        });

        right.appendChild(time); right.appendChild(delBtn);
        row.appendChild(text); row.appendChild(right);

        row.addEventListener('click', () => seekCb(n.start));
        row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                seekCb(n.start);
            }
        });
        return row;
    };

    notes.forEach((n, i) => {
        notesListEl.appendChild(buildRow(n, i));
    });
}

