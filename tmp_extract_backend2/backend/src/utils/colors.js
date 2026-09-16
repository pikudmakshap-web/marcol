const CATEGORY_COLORS_BASE = [

  
  "#D32F2F", "#1976D2", "#388E3C", "#F57C00", "#7B1FA2",
  "#0288D1", "#C2185B", "#0097A7", "#689F38", "#FFA000",

  "#512DA8", "#00796B", "#AFB42B", "#E64A19", "#5D4037",
  "#455A64", "#8E24AA", "#3949AB", "#1E88E5", "#039BE5",

  "#00ACC1", "#00897B", "#43A047", "#7CB342", "#C0CA33",
  "#FDD835", "#FFB300", "#FB8C00", "#F4511E", "#6D4C41",

  "#757575", "#78909C", "#AD1457", "#6A1B9A", "#4527A0",
  "#283593", "#1565C0", "#0277BD", "#00838F", "#00695C",

  "#2E7D32", "#558B2F", "#9E9D24", "#F9A825", "#FF8F00",
  "#EF6C00", "#D84315", "#4E342E", "#37474F", "#546E7A"


];

function hexToRgba(hex, alpha = 0.15) {
    const normalized = String(hex || '').trim().replace('#', '');
    const full = normalized.length === 3
        ? normalized.split('').map((char) => char + char).join('')
        : normalized;

    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);

    if ([r, g, b].some((value) => Number.isNaN(value))) {
        return `rgba(209, 213, 219, ${alpha})`;
    }

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Keep the server palette in rgba(…, 0.15) so all category backgrounds are consistent.
const CATEGORY_COLORS = CATEGORY_COLORS_BASE.map((hex) => hexToRgba(hex, 0.15));

module.exports = { CATEGORY_COLORS, hexToRgba };
