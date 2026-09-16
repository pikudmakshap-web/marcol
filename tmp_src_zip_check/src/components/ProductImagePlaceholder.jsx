
/**
 * ProductImagePlaceholder
 * Fixed depth and blur effect.
 * Always shows the full aesthetic (blurred bg + white wash + sharp fg)
 * regardless of card hover state.
 */

const GREEN = '#8dc98d';
const GRAY = '#a8a8a8';
const ALPHA = 0.8;

function Shapes() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 200 210"
            width="100%"
            height="100%"
            aria-hidden="true"
        >
            {/* ↖ Green square — rotated ~-22° */}
            <rect
                x="8" y="8" width="88" height="88"
                fill={GREEN} fillOpacity={ALPHA}
                transform="rotate(-22 52 52)"
            />

            {/* ↗ Donut ring, center (148, 62) */}
            <circle cx="148" cy="62" r="50" fill={GRAY} fillOpacity={ALPHA} />
            <path d="M148,12 A50,50 0 0,0 148,112 Z" fill={GREEN} fillOpacity={ALPHA} />
            <circle cx="148" cy="62" r="24" fill="white" />

            {/* ↙ Gray square — rotated ~+20° */}
            <rect
                x="12" y="118" width="84" height="84"
                fill={GRAY} fillOpacity={ALPHA}
                transform="rotate(20 54 160)"
            />

            {/* ↘ Green upward triangle */}
            <polygon points="118,206 198,206 158,120" fill={GREEN} fillOpacity={ALPHA} />
        </svg>
    );
}

export default function ProductImagePlaceholder({ className = '' }) {
    return (
        <div
            className={`relative w-full h-full flex items-center justify-center overflow-hidden rounded-2xl ${className}`}
            style={{ 
                background: '#f8faf8',
                isolation: 'isolate' 
            }}
        >
            {/* ── Layer 1: large blurred background (Always visible) ─────────────────────────── */}
            <div
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    inset: '-15%',
                    opacity: 0.4,
                    filter: 'blur(14px)',
                    transform: 'scale(1.1)',
                    pointerEvents: 'none',
                    mixBlendMode: 'multiply',
                }}
            >
                <Shapes />
            </div>

            {/* ── Layer 2: white blur wash (Always visible) ──────────────────────────────────── */}
            <div
                aria-hidden="true"
                style={{
                    position: 'absolute', 
                    inset: 0,
                    background: 'rgba(255,255,255,0.45)',
                    backdropFilter: 'blur(1px)',
                    pointerEvents: 'none',
                    zIndex: 2
                }}
            />

            {/* ── Layer 3: small sharp foreground (Always visible) ──────────────────────────── */}
            <div
                style={{
                    position: 'relative',
                    zIndex: 10,
                    width: '75%',
                    height: '75%',
                    mixBlendMode: 'multiply',
                }}
            >
                <Shapes />
            </div>
        </div>
    );
}
