import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed de base de datos...");

  const tenant = await prisma.tenant.upsert({
    where: { id: "cmlybry6o0000t9jmmb50758t" },
    update: {},
    create: {
      id: "cmlybry6o0000t9jmmb50758t",
      name: "Plaza Nadal",
      plan: "PREMIUM",
      isActive: true,
    },
  });

  console.log("✅ Tenant creado:", tenant.name);

  const hashedPassword = await bcrypt.hash("admin123", 10);
  
  const user = await prisma.user.upsert({
    where: { email: "admin@plazanadal.com" },
    update: {},
    create: {
      email: "admin@plazanadal.com",
      password: hashedPassword,
      name: "Administrador",
      role: "OWNER",
      tenantId: tenant.id,
    },
  });

  console.log("✅ Usuario administrador creado:", user.email);

  const products = await prisma.product.createMany({
    data: [
      {
        tenantId: tenant.id,
        name: "Rabas",
        description: "Rabas fritas con limón",
        price: 8500,
        unitType: "UNIT",
        section: "CARTA",
        category: "COMIDA",
        destination: "COCINA",
        isAvailable: true,
        isAvailableForBot: true,
        sortOrder: 1,
      },
      {
        tenantId: tenant.id,
        name: "Tortillas",
        description: "Tortillas de papa",
        price: 6000,
        unitType: "UNIT",
        section: "CARTA",
        category: "COMIDA",
        destination: "COCINA",
        isAvailable: true,
        isAvailableForBot: true,
        sortOrder: 2,
      },
      {
        tenantId: tenant.id,
        name: "Paella",
        description: "Paella marinera",
        price: 3500,
        pricePerKg: 3500,
        unitType: "KG",
        section: "KILO",
        destination: "COCINA",
        isAvailable: true,
        isAvailableForBot: true,
        sortOrder: 1,
      },
      {
        tenantId: tenant.id,
        name: "Arroz con Pollo",
        description: "Arroz con pollo casero",
        price: 3000,
        pricePerKg: 3000,
        unitType: "KG",
        section: "KILO",
        destination: "COCINA",
        isAvailable: true,
        isAvailableForBot: true,
        sortOrder: 2,
      },
    ],
    skipDuplicates: true,
  });

  console.log("✅ Productos creados:", products.count);
  console.log("\n🎉 Seed completado!");
  console.log("\n📋 Credenciales:");
  console.log("   Email: admin@plazanadal.com");
  console.log("   Contraseña: admin123");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
