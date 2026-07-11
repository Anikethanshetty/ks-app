import { Prisma } from "@prisma/client";

/**
 * Money helpers. In the DB money is `Decimal(10,2)` (rupees). On the wire it is
 * integer paise (TRD §5.1). `float` never appears anywhere in this path.
 */

export type Decimal = Prisma.Decimal;
export const Decimal = Prisma.Decimal;

/** Rupees Decimal → integer paise. Exact for 2-dp inputs; rounds otherwise. */
export function toPaise(rupees: Prisma.Decimal | string | number): number {
  return new Prisma.Decimal(rupees).mul(100).toDecimalPlaces(0).toNumber();
}

/** Multiply a unit price (rupees) by a quantity, result as rupees Decimal(2dp). */
export function lineTotal(
  unitPrice: Prisma.Decimal,
  quantity: Prisma.Decimal | number,
): Prisma.Decimal {
  return unitPrice.mul(quantity).toDecimalPlaces(2);
}
