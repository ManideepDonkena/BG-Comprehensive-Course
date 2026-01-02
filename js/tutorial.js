export class Tutorial {
    constructor() {
        this.steps = [
            {
                element: '.brand',
                title: 'Welcome to Gita Wisdom',
                content: 'This site is designed to help you listen and study Bhagavad Gita courses systematically.'
            },
            {
                element: '#search-toggle',
                title: 'Search Recordings',
                content: 'Use the magnifying glass to search for specific topics or days.'
            },
            {
                element: '#sort-toggle',
                title: 'Sort & Filter',
                content: 'Sort the list by day, date, or title. You can also filter by your favorites.'
            },
            {
                element: '.audio-list',
                title: 'Audio Cards',
                content: 'Click on any card to start playing the recording.'
            },
            {
                element: '#player-section',
                title: 'Audio Player',
                content: 'Control playback, speed, and volume here. You can also add notes and markers.'
            },
            {
                element: '#player-transcript-btn',
                title: 'Transcripts',
                content: 'View the text transcript for the current recording if available.'
            },
            {
                element: '#player-notes-btn',
                title: 'Notes & Clips',
                content: 'Create and view personal notes or clips linked to specific times in the audio.'
            },
            {
                element: '#player-collapse-btn',
                title: 'Minimize Player',
                content: 'On mobile, you can minimize the player to save space while still listening.'
            }
        ];
        this.currentStep = 0;
        this.overlay = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;

        // Create overlay elements
        this.overlay = document.createElement('div');
        this.overlay.className = 'tutorial-overlay is-hidden';
        this.overlay.innerHTML = `
            <div class="tutorial-card">
                <div class="tutorial-header">
                    <h3 class="tutorial-title"></h3>
                    <button class="tutorial-close">✕</button>
                </div>
                <div class="tutorial-body"></div>
                <div class="tutorial-footer">
                    <span class="tutorial-progress"></span>
                    <div class="tutorial-btns">
                        <button class="tutorial-prev">Back</button>
                        <button class="tutorial-next">Next</button>
                    </div>
                </div>
            </div>
            <div class="tutorial-pointer"></div>
        `;
        document.body.appendChild(this.overlay);

        this.overlay.querySelector('.tutorial-close').onclick = () => this.hide();
        this.overlay.querySelector('.tutorial-next').onclick = () => this.next();
        this.overlay.querySelector('.tutorial-prev').onclick = () => this.prev();

        this.initialized = true;
    }

    show() {
        this.init();
        this.currentStep = 0;
        this.overlay.classList.remove('is-hidden');
        this.render();
    }

    hide() {
        if (this.overlay) {
            this.overlay.classList.add('is-hidden');
            const highlighted = document.querySelector('.tutorial-highlight');
            if (highlighted) highlighted.classList.remove('tutorial-highlight');
        }
    }

    next() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.render();
        } else {
            this.hide();
            localStorage.setItem('tutorial_seen', 'true');
        }
    }

    prev() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.render();
        }
    }

    render() {
        const step = this.steps[this.currentStep];
        const card = this.overlay.querySelector('.tutorial-card');
        const title = this.overlay.querySelector('.tutorial-title');
        const body = this.overlay.querySelector('.tutorial-body');
        const progress = this.overlay.querySelector('.tutorial-progress');
        const nextBtn = this.overlay.querySelector('.tutorial-next');
        const prevBtn = this.overlay.querySelector('.tutorial-prev');

        title.textContent = step.title;
        body.textContent = step.content;
        progress.textContent = `${this.currentStep + 1} / ${this.steps.length}`;
        nextBtn.textContent = this.currentStep === this.steps.length - 1 ? 'Finish' : 'Next';
        prevBtn.style.display = this.currentStep === 0 ? 'none' : 'inline-block';

        // Highlighting
        const oldTarget = document.querySelector('.tutorial-highlight');
        if (oldTarget) oldTarget.classList.remove('tutorial-highlight');

        const target = document.querySelector(step.element);
        if (target) {
            target.classList.add('tutorial-highlight');
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            this.positionCard(target, card);
        } else {
            // Default center position if element not found
            card.style.top = '50%';
            card.style.left = '50%';
            card.style.transform = 'translate(-50%, -50%)';
            this.overlay.querySelector('.tutorial-pointer').style.display = 'none';
        }
    }

    positionCard(target, card) {
        const rect = target.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const pointer = this.overlay.querySelector('.tutorial-pointer');
        pointer.style.display = 'block';

        let top = rect.bottom + 20;
        let left = rect.left + (rect.width / 2) - (cardRect.width / 2);

        // Adjust if out of bounds
        if (left < 10) left = 10;
        if (left + cardRect.width > window.innerWidth - 10) left = window.innerWidth - cardRect.width - 10;
        if (top + cardRect.height > window.innerHeight - 10) {
            top = rect.top - cardRect.height - 20;
            pointer.className = 'tutorial-pointer pointer-bottom';
        } else {
            pointer.className = 'tutorial-pointer pointer-top';
        }

        card.style.top = `${top}px`;
        card.style.left = `${left}px`;
        card.style.transform = 'none';

        // Position pointer
        pointer.style.left = `${rect.left + (rect.width / 2)}px`;
        pointer.style.top = top + (pointer.classList.contains('pointer-top') ? -10 : cardRect.height) + 'px';
    }
}
