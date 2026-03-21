-- Efectivo que el cadete debía entregar según pedidos vs lo entregado; diferencia (negativo = falta)
ALTER TABLE "shifts" ADD COLUMN "deliverySettlementExpectedCash" DECIMAL(10,2);
ALTER TABLE "shifts" ADD COLUMN "deliverySettlementDifference" DECIMAL(10,2);
