/**
 * Parses a date string in "dd-mm-yyyy" format into a timestamp.
 * @param {string} d - Date string.
 * @returns {number} Timestamp or NaN.
 */
export function parseDate(d) {
    if (!d) return NaN;
    const parts = d.split('-');
    if (parts.length !== 3) return NaN;
    const [dd, mm, yyyy] = parts.map(p => parseInt(p, 10));
    return new Date(yyyy, (mm || 1) - 1, dd || 1).getTime();
}

/**
 * Checks if an item has a valid cloudinary URL.
 * @param {object} item 
 * @returns {boolean}
 */
export function hasPlayableUrl(item) {
    return Array.isArray(item.cloudinary_matches) && 
           item.cloudinary_matches.length > 0 && 
           item.cloudinary_matches[0] && 
           item.cloudinary_matches[0].cloudinary_url;
}

/**
 * Generates a unique key for an item.
 * @param {object} item 
 * @returns {string}
 */
export function itemKey(item) {
    return (item.filename || item.title || '') + '|' + (item.date || '') + '|' + (item.day ?? '');
}

/**
 * Formats seconds into MM:SS.
 * @param {number} sec 
 * @returns {string}
 */
export function formatTime(sec) {
    const s = Math.floor(sec || 0);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2,'0')}`;
}

/**
 * Formats seconds into M:SS.S (pretty format for inputs).
 * @param {number} sec 
 * @returns {string}
 */
export function secToPretty(sec) {
    const s = Math.max(0, Number(sec)||0);
    const m = Math.floor(s/60); 
    const r = (s%60).toFixed(1);
    return `${m}:${r.padStart(4,'0')}`;
}

/**
 * Parses "M:SS.S" or "S" string into seconds.
 * @param {string} txt 
 * @returns {number}
 */
export function prettyToSec(txt) {
    const m = String(txt||'').trim().split(':');
    if (m.length===1) return parseFloat(m[0]||'0')||0;
    const mm = parseFloat(m[0]||'0')||0; 
    const ss = parseFloat(m[1]||'0')||0; 
    return mm*60+ss;
}

/**
 * Converts percentage (0-1) to time based on duration.
 * @param {number} pct 
 * @param {number} duration 
 * @returns {number}
 */
export function pctToTime(pct, duration) { 
    return (duration||0) * Math.max(0, Math.min(1, pct)); 
}

/**
 * Converts time to percentage (0-1).
 * @param {number} sec 
 * @param {number} duration 
 * @returns {number}
 */
export function timeToPct(sec, duration) { 
    const d = (duration||0)||1; 
    return Math.max(0, Math.min(1, sec/d)); 
}
