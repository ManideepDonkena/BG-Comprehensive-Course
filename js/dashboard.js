import { userProfileStore, activityStore, prefsStore } from './storage.js';
import { gamification } from './gamification.js';

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    initTheme();
    initAvatarSystem();
    initNameEditing();
});

function initTheme() {
    const savedTheme = prefsStore.getTheme();
    document.documentElement.setAttribute('data-theme', savedTheme);

    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        prefsStore.setTheme(next);
    });
}

function initDashboard() {
    const profile = userProfileStore.get();
    const stats = gamification.getStats();
    const activities = activityStore.get();

    // Basic Info
    document.getElementById('username-display').textContent = profile.username || 'Aspirant';
    document.getElementById('level-display').textContent = `Lv ${stats.level}`;

    // Avatar
    const avatarEl = document.getElementById('user-avatar');
    if (profile.avatar) {
        avatarEl.src = profile.avatar;
    }

    const joinedDate = new Date(profile.joinedDate);
    document.getElementById('joined-date').textContent = joinedDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    // Stats
    document.getElementById('streak-val').textContent = stats.streak;
    document.getElementById('points-val').textContent = stats.points;
    document.getElementById('rank-val').textContent = getRank(stats.level);

    // Goal Progress
    const todayMins = Math.round(stats.todayMinutes);
    const goalMins = stats.dailyGoalMinutes;
    document.getElementById('today-mins').textContent = todayMins;
    document.getElementById('goal-mins').textContent = goalMins;

    const progressPct = Math.min(100, (todayMins / goalMins) * 100);
    const circle = document.getElementById('goal-progress-bar');
    if (circle) {
        const radius = circle.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (progressPct / 100) * circumference;
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = offset;
    }

    // Activity List
    renderActivityList(activities);

    // Weekly Chart
    renderWeeklyChart(activities, stats.dailyGoalMinutes);
}

function renderWeeklyChart(activities, goalMins) {
    const barsContainer = document.getElementById('weekly-bars');
    if (!barsContainer) return;

    barsContainer.innerHTML = '';

    // Get start of current week (Monday)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 (Sun) to 6 (Sat)
    const mondayOffset = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const weekData = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dStr = d.toISOString().split('T')[0];

        const activity = activities.find(a => a.date === dStr);
        const mins = activity ? activity.minutes : 0;

        weekData.push({
            mins,
            isToday: dStr === today.toISOString().split('T')[0]
        });
    }

    weekData.forEach(data => {
        const barWrap = document.createElement('div');
        barWrap.className = 'bar-wrap';

        const height = Math.min(100, (data.mins / goalMins) * 100);
        const bar = document.createElement('div');
        bar.className = 'bar';
        if (data.mins >= goalMins) bar.classList.add('filled');
        if (data.isToday) bar.classList.add('today');
        bar.style.height = `${Math.max(5, height)}%`;
        bar.title = `${Math.round(data.mins)} mins`;

        barWrap.appendChild(bar);
        barsContainer.appendChild(barWrap);
    });
}

function initAvatarSystem() {
    const modal = document.getElementById('avatar-modal');
    const openBtn = document.getElementById('change-avatar-btn');
    const closeBtn = document.getElementById('close-avatar-modal');
    const options = document.querySelectorAll('.avatar-option');
    const uploadInput = document.getElementById('avatar-upload-input');

    openBtn?.addEventListener('click', () => modal?.classList.remove('is-hidden'));
    closeBtn?.addEventListener('click', () => modal?.classList.add('is-hidden'));

    options.forEach(opt => {
        opt.addEventListener('click', () => {
            const id = opt.dataset.id;
            const src = `assets/avatars/${id}.png`;
            updateAvatar(src);
            modal?.classList.add('is-hidden');
        });
    });

    uploadInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            updateAvatar(event.target.result);
            modal?.classList.add('is-hidden');
        };
        reader.readAsDataURL(file);
    });
}

function updateAvatar(src) {
    document.getElementById('user-avatar').src = src;
    const profile = userProfileStore.get();
    profile.avatar = src;
    userProfileStore.set(profile);
}

function initNameEditing() {
    const nameEl = document.getElementById('username-display');
    nameEl?.addEventListener('click', () => {
        const current = nameEl.textContent;
        const next = prompt('Enter your name:', current);
        if (next && next.trim()) {
            const trimmed = next.trim().substring(0, 20);
            nameEl.textContent = trimmed;
            const profile = userProfileStore.get();
            profile.username = trimmed;
            userProfileStore.set(profile);
        }
    });
}

function renderActivityList(activities) {
    const list = document.getElementById('activity-list');
    if (!list) return;

    if (activities.length === 0) {
        list.innerHTML = '<div class="empty-state">No activity tracked yet. Start listening to earn XP!</div>';
        return;
    }

    list.innerHTML = '';
    const sorted = [...activities].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);

    sorted.forEach(act => {
        const row = document.createElement('div');
        row.className = 'activity-row';
        row.innerHTML = `
            <div class="act-date">${formatActDate(act.date)}</div>
            <div class="act-details">${Math.round(act.minutes)} mins • <span class="act-xp">+${act.points} XP</span></div>
        `;
        list.appendChild(row);
    });
}

function formatActDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getRank(level) {
    if (level < 5) return 'Seeker';
    if (level < 15) return 'Learner';
    if (level < 30) return 'Practitioner';
    if (level < 50) return 'Scholar';
    return 'Gita Master';
}
