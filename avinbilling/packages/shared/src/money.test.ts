import { describe, expect, it } from 'vitest';
import { areaSquareFeet, inchesToMillimetres, roundUp } from './measurements.js';
import { percentageOf, rupeesToPaise } from './money.js';

describe('calculation primitives', () => {
  it('stores rupees as integer paise', () => {
    expect(rupeesToPaise(1250.5)).toBe(125050);
  });

  it('calculates basis-point percentages deterministically', () => {
    expect(percentageOf(10000, 1800)).toBe(1800);
  });

  it('normalizes dimensions and area', () => {
    expect(inchesToMillimetres(48)).toBe(1219);
    expect(areaSquareFeet(1219.2, 1524)).toBeCloseTo(20, 3);
    expect(roundUp(11.42, 0.5)).toBe(11.5);
  });
});
