export const DEFAULT_SEASON = '2026';

/**
 * Per-season hero background overrides.
 * - `youTubeVideoId`: YouTube video ID to use instead of the auto-detected one.
 * - `backgroundPosition`: CSS background-position value (default: 'center 30%').
 */
export const HERO_BG_OVERRIDES = {
    // Example:
     '2024': { youTubeVideoId: '7gKXBsmdeWQ', backgroundPosition: 'center 20%' },
};

export const START_LIST_OVERFLOW_THRESHOLD = 40;
export const MOBILE_VIEWPORT_MAX_WIDTH_PX = 800;
export const MOBILE_VIEWPORT_MEDIA_QUERY = `(max-width: ${MOBILE_VIEWPORT_MAX_WIDTH_PX}px)`;
