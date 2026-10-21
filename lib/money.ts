export type FeeBreakdown = {
  grossMinor: number;
  platformFeeMinor: number;
  fixedFeeMinor: number;
  processingFeeMinor: number;
  creatorNetMinor: number;
};

/** Integer-only calculation. bps is one hundredth of a percent (1000 = 10%). */
export function calculateFees(
  grossMinor: number,
  commissionBps: number,
  fixedFeeMinor = 0,
  processingFeeMinor = 0
): FeeBreakdown {
  if (!Number.isSafeInteger(grossMinor) || grossMinor < 0) throw new Error("Invalid gross amount");
  if (!Number.isSafeInteger(commissionBps) || commissionBps < 0 || commissionBps > 10_000) {
    throw new Error("Invalid commission rate");
  }
  if (![fixedFeeMinor, processingFeeMinor].every((amount) => Number.isSafeInteger(amount) && amount >= 0)) {
    throw new Error("Invalid fee amount");
  }
  // Half-up rounding, without floating point arithmetic.
  const percentageFee = Math.floor((grossMinor * commissionBps + 5_000) / 10_000);
  const platformFeeMinor = percentageFee + fixedFeeMinor;
  return {
    grossMinor,
    platformFeeMinor,
    fixedFeeMinor,
    processingFeeMinor,
    creatorNetMinor: Math.max(0, grossMinor - platformFeeMinor - processingFeeMinor)
  };
}
