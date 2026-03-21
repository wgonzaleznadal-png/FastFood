import type { ActiveShift } from "@/store/shiftStore";

export function mapShiftFromApi(s: Record<string, unknown> | null): ActiveShift | null {
  if (!s || typeof s.id !== "string") return null;
  return {
    ...(s as unknown as ActiveShift),
    initialCash: Number(s.initialCash),
    deliverySettlementAmount: s.deliverySettlementAmount != null ? Number(s.deliverySettlementAmount) : undefined,
    deliverySettlementExpectedCash: s.deliverySettlementExpectedCash != null ? Number(s.deliverySettlementExpectedCash) : undefined,
    deliverySettlementDifference: s.deliverySettlementDifference != null ? Number(s.deliverySettlementDifference) : undefined,
  };
}
