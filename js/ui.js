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
    const title = item.title || 'Untitled';
    const speaker = item.speaker || 'Unknown speaker';
    const classType = item.class_type || 'Class';
    const day = item.day != null ? `Day ${item.day}` : '';
    const date = item.date || '';

    clone.querySelector('.item-title').textContent = title;

    const favBtn = clone.querySelector('.card-fav');
    if (isFavorite) {
        favBtn.classList.add('active');
        favBtn.setAttribute('aria-pressed', 'true');
    }

    const badge = clone.querySelector('.meta-day');
    if (day) {
        badge.textContent = day;
        badge.hidden = false;
    }

    const typeEl = clone.querySelector('.meta-type');
    if (classType) typeEl.textContent = classType;

    const dateEl = clone.querySelector('.meta-date');
    if (date) dateEl.textContent = `• ${date}`;

    const speakerEl = clone.querySelector('.meta-speaker');
    if (speaker) speakerEl.textContent = `• ${speaker}`;

    const noAudioEl = clone.querySelector('.meta-no-audio');
    if (!playable && noAudioEl) noAudioEl.hidden = false;

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

