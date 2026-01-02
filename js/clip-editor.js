import { secToPretty, prettyToSec, pctToTime, timeToPct } from './utils.js';

export class ClipEditor {
    constructor(dom, player, onSave) {
        this.dom = dom; // Object containing DOM elements
        this.player = player; // Audio element
        this.onSave = onSave; // Callback(start, end, text)

        this.state = { open: false, start: 0, end: 0 };
        this.init();
    }

    init() {
        // Wire events
        this.dom.closeBtn?.addEventListener('click', () => this.close());
        this.dom.cancelBtn?.addEventListener('click', () => this.close());
        this.dom.backdrop?.addEventListener('click', () => this.close());

        // Inputs
        this.dom.startInput?.addEventListener('change', () => {
            const val = prettyToSec(this.dom.startInput.value || '0');
            this.state.start = Math.max(0, Math.min(val, this.player.duration || 0));
            if (this.state.end < this.state.start) this.state.end = this.state.start;
            this.updateUI();
        });

        this.dom.endInput?.addEventListener('change', () => {
            const val = prettyToSec(this.dom.endInput.value || '0');
            this.state.end = Math.max(0, Math.min(val, this.player.duration || 0));
            if (this.state.end < this.state.start) this.state.start = this.state.end;
            this.updateUI();
        });

        // Transport
        this.dom.playBtn?.addEventListener('click', () => {
            if (this.player.paused) {
                this.player.play().catch(() => { });
                this.dom.playBtn.textContent = 'Pause';
            } else {
                this.player.pause();
                this.dom.playBtn.textContent = 'Play';
            }
        });

        this.dom.back5?.addEventListener('click', () => {
            this.player.currentTime = Math.max(0, (this.player.currentTime || 0) - 5);
            this.updateUI();
        });

        this.dom.fwd5?.addEventListener('click', () => {
            this.player.currentTime = Math.min(this.player.duration || 0, (this.player.currentTime || 0) + 5);
            this.updateUI();
        });

        this.dom.setStart?.addEventListener('click', () => {
            this.state.start = Math.min(this.player.currentTime || 0, this.state.end);
            this.updateUI();
        });

        this.dom.setEnd?.addEventListener('click', () => {
            this.state.end = Math.max(this.player.currentTime || 0, this.state.start);
            this.updateUI();
        });

        this.dom.saveBtn?.addEventListener('click', () => {
            if (this.onSave) {
                const text = (this.dom.textInput?.value || '').trim();
                let end = this.state.end;
                if (end <= this.state.start) end = Math.min((this.player.duration || 0), this.state.start + 3);
                this.onSave(this.state.start, end, text);
            }
            this.close();
        });

        // Rail interaction
        if (this.dom.rail) {
            this.dom.rail.addEventListener('click', (e) => {
                const rect = this.dom.rail.getBoundingClientRect();
                const x = e.clientX;
                const pct = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
                this.player.currentTime = pctToTime(pct, this.player.duration);
                this.updateUI();
            });
        }

        // Handles
        this.setupHandle(this.dom.handleStart, 'start');
        this.setupHandle(this.dom.handleEnd, 'end');

        // Time update logic for looping
        this.player.addEventListener('timeupdate', () => {
            if (!this.state.open) return;
            this.updateUI();

            if (this.dom.loopChk?.checked) {
                const t = this.player.currentTime || 0;
                if (t >= this.state.end - 0.05) {
                    this.player.currentTime = this.state.start;
                }
            }
        });
    }

    setupHandle(handle, which) {
        if (!handle) return;
        let dragging = false;

        const onMove = (e) => {
            if (!dragging) return;
            const rect = this.dom.rail.getBoundingClientRect();
            const clientX = ('touches' in e && e.touches.length ? e.touches[0].clientX : e.clientX);
            const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const t = pctToTime(pct, this.player.duration);

            if (which === 'start') {
                this.state.start = t;
                // Push end if start goes past it
                if (this.state.end < t) this.state.end = t;
            } else {
                this.state.end = t;
                // Push start if end goes past it
                if (this.state.start > t) this.state.start = t;
            }

            // Optional: Scrub audio to the handle being dragged for feedback
            if (Math.abs((this.player.currentTime || 0) - t) > 0.1) {
                this.player.currentTime = t;
            }

            this.updateUI();
        };

        const onUp = () => {
            dragging = false;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onUp);
        };

        const onDown = (e) => {
            e.preventDefault(); // Prevent text selection
            e.stopPropagation(); // Prevent rail click
            dragging = true;
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
            window.addEventListener('touchmove', onMove, { passive: false });
            window.addEventListener('touchend', onUp);
        };

        handle.addEventListener('mousedown', onDown);
        handle.addEventListener('touchstart', onDown, { passive: false });
    }

    open(presetStart, presetEnd) {
        if (!this.player.duration) return;

        this.state.start = Math.max(0, Math.min(presetStart ?? Math.floor(this.player.currentTime || 0), this.player.duration));
        this.state.end = Math.max(this.state.start, Math.min(presetEnd ?? (this.state.start + 15), this.player.duration));
        this.state.open = true;

        this.dom.el.classList.remove('is-hidden');
        this.dom.backdrop?.classList.remove('is-hidden');
        this.dom.el.setAttribute('aria-hidden', 'false');

        if (this.dom.textInput) this.dom.textInput.value = '';
        if (this.dom.playBtn) this.dom.playBtn.textContent = this.player.paused ? 'Play' : 'Pause';

        this.updateUI();
    }

    close() {
        this.state.open = false;
        this.dom.el.classList.add('is-hidden');
        this.dom.backdrop?.classList.add('is-hidden');
        this.dom.el.setAttribute('aria-hidden', 'true');
    }

    updateUI() {
        if (!this.state.open) return;
        const dur = this.player.duration || 1;

        const a = Math.max(0, Math.min(this.state.start, this.state.end));
        const b = Math.max(this.state.start, this.state.end);

        const lp = timeToPct(a, dur) * 100;
        const rp = timeToPct(b, dur) * 100;

        if (this.dom.selection) {
            this.dom.selection.style.left = `${lp}%`;
            this.dom.selection.style.width = `${Math.max(0, rp - lp)}%`;
        }

        if (this.dom.handleStart) {
            this.dom.handleStart.style.left = `${lp}%`;
            this.dom.handleStart.setAttribute('aria-valuenow', String(Math.round(lp)));
            // Bring active or left-most to front if close?
            // Actually, if they overlap, we want to be able to grab the "top" one.
            // With push logic, dragging the top one (End) left pushes Start.
            // Dragging Top one right moves End.
            // So we just need to ensure End is on top? It is by DOM order.
            // But if we want to drag Start RIGHT, we can't if End is covering it.
            // But dragging End Right works. 
            // Dragging Start Left works if we could click it. 
            // If they are equal, End covers Start.
            // Dragging End Left -> pushes Start Left. Correct.
            // Dragging End Right -> moves End Right. Correct.
            // So we don't strictly need z-index hacks with push logic.
        }

        if (this.dom.handleEnd) {
            this.dom.handleEnd.style.left = `${rp}%`;
            this.dom.handleEnd.setAttribute('aria-valuenow', String(Math.round(rp)));
        }

        if (this.dom.playhead) {
            const php = timeToPct(this.player.currentTime || 0, dur) * 100;
            this.dom.playhead.style.left = `${php}%`;
        }

        if (this.dom.startInput) this.dom.startInput.value = secToPretty(a);
        if (this.dom.endInput) this.dom.endInput.value = secToPretty(b);
        if (this.dom.lenEl) this.dom.lenEl.textContent = `${(b - a).toFixed(1)}s`;
    }
}
