// ============================================================
// SELECCIONADOR DE COLOR DE TEXTO SEGÚN CONTRASTE
// ============================================================
// Dado un color de fondo hexadecimal, elige texto 'light' (blanco)
// o 'dark' (negro) usando la fórmula de brillo percibido YIQ,
// para asegurar legibilidad en las etiquetas de las colas.

export function pickTextColor(backgroundColor: string): 'light' | 'dark' {
  const hex = backgroundColor.trim().match(/^#([0-9a-fA-F]{6})$/);
  if (!hex) return 'light'; // Si no es hex válido, asume fondo oscuro

  const r = parseInt(hex[1].slice(0, 2), 16);
  const g = parseInt(hex[1].slice(2, 4), 16);
  const b = parseInt(hex[1].slice(4, 6), 16);

  // Fórmula YIQ: si el brillo es ≥ 128, el fondo es claro → texto oscuro
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? 'dark' : 'light';
}
