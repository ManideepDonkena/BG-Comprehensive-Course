/**
 * LocalStorage wrapper helper.
 */
class Storage {
    constructor(key, defaultVal = {}) {
        this.key = key;
        this.defaultVal = defaultVal;
    }

    get() {
        try {
            const raw = localStorage.getItem(this.key);
            if (!raw) return this.defaultVal;
            const parsed = JSON.parse(raw);
            return (typeof parsed === 'object' && parsed !== null) ? parsed : this.defaultVal;
        } catch {
            return this.defaultVal;
        }
    }

    set(val) {
        try {
            localStorage.setItem(this.key, JSON.stringify(val));
        } catch (e) {
            console.error('Storage save failed', e);
        }
    }
}

// Specific stores
export const favoritesStore = {
    key: 'bg_audio_favorites',
    get: () => {
        try {
            const raw = localStorage.getItem('bg_audio_favorites') || '[]';
            return new Set(JSON.parse(raw));
        } catch { return new Set(); }
    },
    save: (set) => {
        try { localStorage.setItem('bg_audio_favorites', JSON.stringify([...set])); } catch { }
    }
};

export const customStartsStore = new Storage('bg_audio_custom_starts', {});
export const markersStore = new Storage('bg_audio_markers_v1', {});
export const notesStore = new Storage('bg_audio_notes_v1', {});
export const lastListenedStore = new Storage('bg_audio_last_listened', null);
export const userProfileStore = new Storage('bg_user_profile', {
    username: 'Aspirant',
    avatar: null, // Will be assigned randomly if null
    joinedDate: new Date().toISOString(),
    points: 0,
    dailyGoalMinutes: 30,
    lastActiveDate: null
});

// Helper to assign random avatar if not set
const currentProfile = userProfileStore.get();
if (!currentProfile.avatar) {
    const avatars = ['arjun', 'dhruv', 'prahlad', 'bharath'];
    const random = avatars[Math.floor(Math.random() * avatars.length)];
    currentProfile.avatar = `assets/avatars/${random}.png`;
    userProfileStore.set(currentProfile);
}

export const activityStore = new Storage('bg_user_activity', []); // Match the key used in recordActivity

export const prefsStore = {
    getRate: () => parseFloat(localStorage.getItem('bg_audio_rate') || '1') || 1,
    setRate: (v) => localStorage.setItem('bg_audio_rate', String(v)),
    getVolume: () => parseFloat(localStorage.getItem('bg_audio_volume') || '1') || 1,
    setVolume: (v) => localStorage.setItem('bg_audio_volume', String(v)),
    getTheme: () => localStorage.getItem('bg_audio_theme') || 'dark',
    setTheme: (v) => localStorage.setItem('bg_audio_theme', v)
};
