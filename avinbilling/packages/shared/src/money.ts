export type Paise = number & { readonly __brand: 'Paise' };

export function asPaise(value: number): Paise {
  if (!Number.isSafeInteger(value)) {
    throw new Error('Money must be a safe integer number of paise.');
  }
  return value as Paise;
}

export function rupeesToPaise(rupees: number): Paise {
  return asPaise(Math.round(rupees * 100));
}

export function formatInr(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(paise / 100);
}

export function percentageOf(paise: number, basisPoints: number): Paise {
  return asPaise(Math.round((paise * basisPoints) / 10_000));
}
