const HEX_3 = /^#([0-9a-f]{3})$/i;
const HEX_6 = /^#([0-9a-f]{6})$/i;
const RGB_RGBA = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i;

const clamp255 = (value) => Math.max(0, Math.min(255, Number(value) || 0));
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

function parseColor(value) {
    if (!value || typeof value !== 'string') return null;
    const color = value.trim();

    const hex3 = color.match(HEX_3);
    if (hex3) {
        const [r, g, b] = hex3[1].split('').map((char) => parseInt(char + char, 16));
        return { r, g, b };
    }

    const hex6 = color.match(HEX_6);
    if (hex6) {
        const full = hex6[1];
        return {
            r: parseInt(full.slice(0, 2), 16),
            g: parseInt(full.slice(2, 4), 16),
            b: parseInt(full.slice(4, 6), 16)
        };
    }

    const rgb = color.match(RGB_RGBA);
    if (rgb) {
        return {
            r: clamp255(rgb[1]),
            g: clamp255(rgb[2]),
            b: clamp255(rgb[3])
        };
    }

    return null;
}

export function toSolidColor(value, fallback = 'rgb(100, 116, 139)') {
    const parsed = parseColor(value);
    if (!parsed) return fallback;
    return `rgb(${parsed.r}, ${parsed.g}, ${parsed.b})`;
}

export function toStrongSolidColor(value, fallback = 'rgb(71, 85, 105)') {
    const parsed = parseColor(value);
    if (!parsed) return fallback;

    // We model the chip background as rgba(base, 0.15) on top of white,
    // then darken the foreground color until contrast is strong and readable.
    const baseAlpha = 0.15;
    const bg = blendOverWhite(parsed, baseAlpha);
    const targetContrast = 4.5;

    let factor = 0.75;
    let candidate = scaleRgb(parsed, factor);
    let ratio = contrastRatio(candidate, bg);

    while (ratio < targetContrast && factor > 0.08) {
        factor -= 0.04;
        candidate = scaleRgb(parsed, factor);
        ratio = contrastRatio(candidate, bg);
    }

    if (ratio < 3.8) {
        return fallback;
    }

    return `rgb(${candidate.r}, ${candidate.g}, ${candidate.b})`;
}

export function toBackgroundRgba(value, alpha = 0.15, fallback = 'rgba(100, 116, 139, 0.15)') {
    const parsed = parseColor(value);
    if (!parsed) return fallback;
    const safeAlpha = clamp01(alpha);
    return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${safeAlpha})`;
}

export function isWhiteLikeColor(value) {
    const parsed = parseColor(value);
    if (!parsed) return false;
    return parsed.r >= 245 && parsed.g >= 245 && parsed.b >= 245;
}

function scaleRgb(rgb, factor) {
    return {
        r: clamp255(Math.round(rgb.r * factor)),
        g: clamp255(Math.round(rgb.g * factor)),
        b: clamp255(Math.round(rgb.b * factor))
    };
}

function blendOverWhite(rgb, alpha) {
    const a = clamp01(alpha);
    return {
        r: clamp255(Math.round((rgb.r * a) + (255 * (1 - a)))),
        g: clamp255(Math.round((rgb.g * a) + (255 * (1 - a)))),
        b: clamp255(Math.round((rgb.b * a) + (255 * (1 - a))))
    };
}

function channelToLinear(channel) {
    const c = channel / 255;
    if (c <= 0.03928) return c / 12.92;
    return ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(rgb) {
    const r = channelToLinear(rgb.r);
    const g = channelToLinear(rgb.g);
    const b = channelToLinear(rgb.b);
    return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
}

function contrastRatio(a, b) {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    const lighter = Math.max(la, lb);
    const darker = Math.min(la, lb);
    return (lighter + 0.05) / (darker + 0.05);
}
