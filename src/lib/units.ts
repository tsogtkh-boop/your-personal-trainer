// Weight unit handling. Storage is always canonical kilograms; these helpers
// convert to/from the user's chosen display unit (kg or lb).

export type Units = 'metric' | 'imperial';

const LB_PER_KG = 2.2046226218;

export const kgToLb = (kg: number): number => kg * LB_PER_KG;
export const lbToKg = (lb: number): number => lb / LB_PER_KG;

export const weightUnit = (u: Units): string => (u === 'imperial' ? 'lb' : 'kg');

/** Format a stored kg value for display in the user's unit (no unit suffix). */
export function displayWeight(kg: number, u: Units): string {
  if (!kg) return '0';
  if (u === 'imperial') return `${Math.round(kgToLb(kg))}`;
  const r = Math.round(kg * 10) / 10;
  return Number.isInteger(r) ? `${r}` : `${r}`;
}

/** Format a stored kg value with its unit suffix, e.g. "40 kg" / "88 lb". */
export function displayWeightWithUnit(kg: number, u: Units): string {
  return `${displayWeight(kg, u)} ${weightUnit(u)}`;
}

/** Parse a value the user typed in their unit back into kilograms for storage. */
export function parseWeightToKg(text: string, u: Units): number {
  const n = parseFloat(text) || 0;
  return u === 'imperial' ? lbToKg(n) : n;
}

/** Round a kg value to a sensible increment for its display unit, returned in kg. */
export function roundToIncrement(kg: number, u: Units): number {
  if (u === 'imperial') {
    const lb = Math.round(kgToLb(kg) / 5) * 5; // nearest 5 lb
    return lbToKg(lb);
  }
  return Math.round(kg / 2.5) * 2.5; // nearest 2.5 kg
}
