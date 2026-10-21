export function commissionMinor(grossMinor: number, basisPoints: number, fixedMinor: number): number {
  if (!Number.isSafeInteger(grossMinor) || grossMinor < 0) throw new Error("Invalid gross amount");
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0 || basisPoints > 10000) throw new Error("Invalid commission rate");
  if (!Number.isSafeInteger(fixedMinor) || fixedMinor < 0) throw new Error("Invalid fixed fee");
  return Math.min(grossMinor, Math.floor((grossMinor * basisPoints + 5000) / 10000) + fixedMinor);
}

export function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);
}
