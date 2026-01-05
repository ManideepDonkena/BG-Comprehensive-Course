/**
 * Transcript Manager
 */
export class TranscriptView {
    constructor(els, audioPlayer, onSeek) {
        this.els = els;
        this.audioPlayer = audioPlayer;
        this.onSeek = onSeek;
        this.lines = [];
        this.activeLineIdx = -1;
        this.lastAutoScrollTime = 0;

        this.init();
    }

    init() {
        this.els.closeBtn?.addEventListener('click', () => this.close());
        this.els.searchInput?.addEventListener('input', () => this.handleSearch());

        this.audioPlayer.addEventListener('timeupdate', () => this.sync());
    }

    async load(dayNumber) {
        console.log('TranscriptView: Attempting to load Day', dayNumber);
        this.els.content.innerHTML = `<div class="transcript-placeholder">Loading transcript for Day ${dayNumber}...</div>`;
        this.lines = [];
        this.activeLineIdx = -1;

        try {
            const resp = await fetch(`./Transcript/Day-${dayNumber}.txt`);
            console.log('TranscriptView: Fetch response', resp.status, resp.ok);
            if (!resp.ok) throw new Error('Not found');
            const text = await resp.text();
            console.log('TranscriptView: Fetched text length', text.length);
            this.parse(text);
            this.render();
        } catch (e) {
            console.warn('TranscriptView: Error loading Day', dayNumber, e);
            this.els.content.innerHTML = `<div class="transcript-placeholder">No transcript available for this recording.</div>`;
        }
    }

    parse(text) {
        const segments = text.split(/\n\s*\n/);
        this.lines = segments.map(seg => {
            const lines = seg.trim().split('\n');
            if (lines.length < 2) return null;

            // Simple timestamp parse: 00:00:48 - 00:01:28
            const timeMatch = lines[0].match(/(\d{2}:\d{2}:\d{2})\s*-\s*(\d{2}:\d{2}:\d{2})/);
            if (!timeMatch) return null;

            const start = this.toSeconds(timeMatch[1]);
            const end = this.toSeconds(timeMatch[2]);

            // Remaining lines are text
            const fullText = lines.slice(1).join(' ');
            const speakerMatch = fullText.match(/^([^:]+):\s*(.*)/);

            return {
                start,
                end,
                speaker: speakerMatch ? speakerMatch[1] : '',
                text: speakerMatch ? speakerMatch[2] : fullText,
                raw: fullText
            };
        }).filter(Boolean);
        console.log('TranscriptView: Parsed lines count', this.lines.length);
    }

    toSeconds(hms) {
        const [h, m, s] = hms.split(':').map(Number);
        return h * 3600 + m * 60 + s;
    }

    render() {
        if (!this.lines.length) return;

        this.els.content.innerHTML = '';
        this.lines.forEach((line, idx) => {
            const el = document.createElement('div');
            el.className = 'transcript-line';
            el.dataset.index = idx;

            const timeStr = this.formatHms(line.start);

            el.innerHTML = `
                <span class="line-time">${timeStr}</span>
                ${line.speaker ? `<span class="line-speaker">${line.speaker}</span>` : ''}
                <div class="line-text">${line.text}</div>
            `;

            el.addEventListener('click', () => {
                this.onSeek(line.start);
                this.activeLineIdx = idx;
                this.updateHighlights();
            });

            this.els.content.appendChild(el);
        });
    }

    formatHms(sec) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.floor(sec % 60);
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    sync() {
        if (!this.lines.length || this.els.panel.classList.contains('is-hidden')) return;

        const time = this.audioPlayer.currentTime;
        const idx = this.lines.findIndex(l => time >= l.start && time < l.end);

        if (idx !== this.activeLineIdx && idx !== -1) {
            this.activeLineIdx = idx;
            this.updateHighlights();
            this.scrollToActive();
        }
    }

    updateHighlights() {
        const lines = this.els.content.querySelectorAll('.transcript-line');
        lines.forEach(l => l.classList.remove('active'));

        if (this.activeLineIdx !== -1) {
            const activeEl = this.els.content.querySelector(`[data-index="${this.activeLineIdx}"]`);
            activeEl?.classList.add('active');
        }
    }

    scrollToActive() {
        const activeEl = this.els.content.querySelector(`[data-index="${this.activeLineIdx}"]`);
        if (activeEl) {
            const now = Date.now();
            // Don't auto-scroll if user scrolled recently? (Simple implementation for now)
            activeEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }

    handleSearch() {
        const query = this.els.searchInput.value.toLowerCase();
        const lines = this.els.content.querySelectorAll('.transcript-line');

        lines.forEach((el, idx) => {
            const line = this.lines[idx];
            const matches = line.raw.toLowerCase().includes(query);
            el.classList.toggle('matched', query && matches);

            if (query && matches && !this.foundFirst) {
                // Optional: scroll to first match
            }
        });
    }

    open() {
        this.els.panel.classList.remove('is-hidden');
        this.els.panel.setAttribute('aria-expanded', 'true');
        this.sync(); // Update highlight immediately
    }

    close() {
        this.els.panel.classList.add('is-hidden');
        this.els.panel.setAttribute('aria-expanded', 'false');
    }

    toggle() {
        if (this.els.panel.classList.contains('is-hidden')) this.open();
        else this.close();
    }
}
