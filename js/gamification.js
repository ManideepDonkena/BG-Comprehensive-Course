import { userProfileStore, activityStore } from './storage.js';

export class Gamification {
    constructor() {
        this.profile = userProfileStore.get();
        this.activities = activityStore.get();
    }

    /**
     * Records listening minutes for the current day.
     * @param {number} minutesAdded 
     */
    recordActivity(minutesAdded) {
        const today = new Date().toISOString().split('T')[0];
        let activity = this.activities.find(a => a.date === today);

        if (!activity) {
            activity = { date: today, minutes: 0, points: 0 };
            this.activities.push(activity);
        }

        activity.minutes += minutesAdded;

        // Award points: 10 points per minute
        const pointsAwarded = Math.floor(minutesAdded * 10);
        activity.points += pointsAwarded;
        this.profile.points += pointsAwarded;

        this.updateStreak(today);
        this.checkLevelUp();

        userProfileStore.set(this.profile);
        activityStore.set(this.activities);
    }

    /**
     * Updates the daily streak based on the last active date.
     * @param {string} today - YYYY-MM-DD
     */
    updateStreak(today) {
        if (this.profile.lastActiveDate === today) return;

        const lastActive = this.profile.lastActiveDate ? new Date(this.profile.lastActiveDate) : null;
        const now = new Date(today);

        if (lastActive) {
            const diffDays = Math.floor((now - lastActive) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                this.profile.streak += 1;
            } else if (diffDays > 1) {
                this.profile.streak = 1;
            }
        } else {
            this.profile.streak = 1;
        }

        this.profile.lastActiveDate = today;
    }

    /**
     * Simple level calculation: Level = floor(sqrt(points / 100)) + 1
     */
    checkLevelUp() {
        const newLevel = Math.floor(Math.sqrt(this.profile.points / 100)) + 1;
        if (newLevel > this.profile.level) {
            this.profile.level = newLevel;
            // You could trigger a visual event here
            window.dispatchEvent(new CustomEvent('bg-level-up', { detail: { level: newLevel } }));
        }
    }

    getStats() {
        return {
            streak: this.profile.streak,
            points: this.profile.points,
            level: this.profile.level,
            dailyGoalMinutes: this.profile.dailyGoalMinutes,
            todayMinutes: this.getTodayMinutes()
        };
    }

    getTodayMinutes() {
        const today = new Date().toISOString().split('T')[0];
        const activity = this.activities.find(a => a.date === today);
        return activity ? activity.minutes : 0;
    }
}

export const gamification = new Gamification();
