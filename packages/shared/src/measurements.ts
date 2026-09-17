export type Millimetres = number & { readonly __brand: 'Millimetres' };

export function asMillimetres(value: number): Millimetres {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Dimensions must be non-negative integer millimetres.');
  }
  return value as Millimetres;
}

export function inchesToMillimetres(inches: number): Millimetres {
  return asMillimetres(Math.round(inches * 25.4));
}

export function areaSquareFeet(widthMm: number, heightMm: number): number {
  return (widthMm * heightMm) / 92_903.04;
}

export function roundUp(value: number, increment: number): number {
  if (increment <= 0) throw new Error('Rounding increment must be positive.');
  return Math.ceil(value / increment) * increment;
}
