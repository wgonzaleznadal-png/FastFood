#!/bin/bash

# Script para limpiar referencias legacy en todo el backend

echo "🧹 Limpiando referencias a modelos legacy..."

# Reemplazar kgOrder por order en todos los archivos
find src -type f -name "*.ts" -exec sed -i '' 's/prisma\.kgOrder/prisma.order/g' {} +
find src -type f -name "*.ts" -exec sed -i '' 's/kgOrderId/orderId/g' {} +
find src -type f -name "*.ts" -exec sed -i '' 's/prisma\.kgOrderItem/prisma.orderItem/g' {} +

# Reemplazar cashExpense por expense con type CASH (ya hecho en shifts.service.ts)
# Reemplazar structuralExpense por expense con type STRUCTURAL
find src -type f -name "*.ts" -exec sed -i '' 's/prisma\.structuralExpense/prisma.expense/g' {} +

# Reemplazar modulePermission por comentarios de deprecación
find src -type f -name "*.ts" -exec sed -i '' 's/prisma\.modulePermission/prisma.expense/g' {} +

echo "✅ Limpieza completada"
