/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#3ce619",
                "primary-dark": "#2db812",
                "sage": {
                    50: "#f4f7f4",
                    100: "#e3e9e3",
                    200: "#c5d3c5",
                    300: "#9eb59e",
                    400: "#769376",
                    500: "#577657",
                    600: "#445d44",
                    700: "#324532",
                    800: "#243224",
                    900: "#182118",
                },
                "terracotta": {
                    50: "#fff8f6",
                    100: "#fbece8",
                    200: "#f6d5ce",
                    300: "#eca392",
                    400: "#e28a75",
                    500: "#d97b66",
                    600: "#bf604b",
                },
                "cream": "#f9f9f4",
                "stone": "#eef0eb",
                "sand": "#e8e4d9",
                "beige": "#f5f0e6",
                "background-light": "#f9f9f4",
                "background-dark": "#142111",
            },
            fontFamily: {
                "display": ["Manrope", "sans-serif"]
            },
            borderRadius: {
                "DEFAULT": "1rem",
                "lg": "1.5rem",
                "xl": "2rem",
                "2xl": "2.5rem",
                "3xl": "3.5rem",
                "4xl": "4.5rem",
                "full": "9999px"
            },
            boxShadow: {
                'soft': '0 10px 40px -10px rgba(87, 118, 87, 0.15)',
                'glow': '0 0 20px -5px rgba(60, 230, 25, 0.4)',
                'inner-light': 'inset 0 2px 4px 0 rgba(255, 255, 255, 0.6)',
                'card': '0 4px 20px -2px rgba(87, 118, 87, 0.08)',
                'pebble': '0 2px 5px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)',
            },
            animation: {
                'bounce': 'bounce 1s infinite',
            }
        },
    },
    plugins: [],
}
