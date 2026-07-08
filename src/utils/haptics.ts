/**
 * Advanced Centralized Haptic Feedback Utility for InkFlow AI's Web Preview.
 * Mimics the native Android HapticManager with:
 * - LocalStorage persistence for the haptic setting: 'off' | 'light' | 'normal' | 'strong'
 * - Adaptive amplitude scaling via duration multipliers (0x, 0.5x, 1x, 1.5x)
 * - Intelligent frequency rate-limiting to prevent battery drain and motor strain
 * - Robust exception fallbacks for iframe sandbox constraints
 */

export type HapticStrength = "off" | "light" | "normal" | "strong";

const STORAGE_KEY = "inkflow_haptic_strength";

// Load initial setting or default to normal
let cachedStrength: HapticStrength = "normal";
if (typeof window !== "undefined") {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && ["off", "light", "normal", "strong"].includes(saved)) {
    cachedStrength = saved as HapticStrength;
  }
}

/**
 * Gets the current haptic feedback strength setting.
 */
export function getHapticSetting(): HapticStrength {
  return cachedStrength;
}

/**
 * Sets the haptic feedback strength setting and persists it.
 */
export function setHapticSetting(setting: HapticStrength) {
  cachedStrength = setting;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, setting);
  }
}

// Rate limiter to prevent motor exhaustion and excessive battery drain
let lastVibrateTime = 0;
const MIN_INTERVAL_MS = 80; // Match Android HapticManager rate-limiter threshold

/**
 * Triggers premium haptic feedback via the Web Vibration API.
 * 
 * @param pattern - Duration in ms or a pattern array of [vibrate, pause, vibrate]
 */
export function triggerHaptic(pattern: number | number[]) {
  if (cachedStrength === "off") return;

  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }

  // Rate Limiting: Avoid rapid repeated vibrations (e.g., during fast drawing)
  const now = Date.now();
  if (now - lastVibrateTime < MIN_INTERVAL_MS) {
    return;
  }
  lastVibrateTime = now;

  // Scale duration based on strength multiplier
  const multiplier = cachedStrength === "light" ? 0.5 : cachedStrength === "strong" ? 1.5 : 1.0;

  try {
    if (Array.isArray(pattern)) {
      const scaledPattern = pattern.map((val, idx) => {
        // Vibrate values are at even indices [vibrate, pause, vibrate]
        return idx % 2 === 0 ? Math.max(1, Math.round(val * multiplier)) : val;
      });
      navigator.vibrate(scaledPattern);
    } else {
      const scaledDuration = Math.max(1, Math.round(pattern * multiplier));
      navigator.vibrate(scaledDuration);
    }
  } catch (e) {
    // Gracefully catch security/permission errors in iframe preview sandbox
  }
}
