export class Tutorial {
    constructor() {
        this.steps = [
            {
                element: '.brand',
                title: 'Welcome to Bhakti Shastri',
                content: 'This guided course helps you study the Bhagavad Gita systematically.'
            },
            {
                element: '#nav-streak-btn',
                title: 'Daily Streak 🔥',
                content: 'Your streak increases every day you listen. Don\'t break the chain!'
            },
            {
                element: '.profile-btn',
                title: 'User Profile 👤',
                content: 'Track your XP, Levels, and stats here. Unlock badges as you progress.'
            },
            {
                element: '#search-toggle',
                title: 'Search & Sort',
                content: 'Find specific classes by title, day, or date.'
            },
            {
                element: '.audio-list',
                title: 'Audio Cards',
                content: 'Click any card to play. Hover to see details.'
            },
            {
                element: '#player-section',
                title: 'Audio Player',
                content: 'Control playback and see progress here.'
            },
            {
                element: '#btn-player-menu',
                title: 'Player Tools',
                content: 'Access Playback Speed, Sleep Timer, and Bookmarks here.'
            },
            {
                element: '#player-notes-btn',
                title: 'Notes & Clips',
                content: 'Create notes and save clips for the current recording.'
            },
            {
                element: '#player-transcript-btn',
                title: 'Transcript',
                content: 'Read along with the audio transcript.'
            },
            {
                element: '#top-feedback-link',
                title: 'Feedback',
                content: 'Help us improve by sharing your thoughts!'
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
            // Dispatch event for main.js to handle feedback timer
            window.dispatchEvent(new CustomEvent('tutorial-complete'));
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

        // Clean up any old image
        const oldImg = body.querySelector('.tutorial-img');
        if (oldImg) oldImg.remove();

        title.textContent = step.title;
        body.textContent = step.content;

        // Add Image if present
        if (step.image) {
            const img = document.createElement('img');
            img.src = step.image;
            img.className = 'tutorial-img';
            img.style.width = '100%';
            img.style.marginBottom = '12px';
            img.style.borderRadius = '8px';
            img.style.maxHeight = '150px';
            img.style.objectFit = 'cover';
            body.insertBefore(img, body.firstChild);
        }

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

        // Mobile Layout: Sticky Bottom
        if (window.innerWidth < 768) {
            card.style.top = 'auto'; // Reset top
            card.style.bottom = '20px';
            card.style.left = '50%';
            card.style.transform = 'translateX(-50%)';
            card.style.width = '90%';
            card.style.maxWidth = '400px';

            // Hide pointer on mobile as card is detached
            pointer.style.display = 'none';
            return;
        }

        // Desktop Layout: Smart Positioning
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

        // Position pointer relative to target center
        pointer.style.left = `${rect.left + (rect.width / 2)}px`;
        // Top calculation: if pointing down (pointer-top), it's above card (at card top - 10). 
        // If pointing up (pointer-bottom), it's below card (at card top + height).
        const pointerY = pointer.classList.contains('pointer-top') ? top - 10 : top + cardRect.height;
        pointer.style.top = `${pointerY}px`;
    }
}
