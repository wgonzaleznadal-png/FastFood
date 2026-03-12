"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePermissionsStore } from "@/store/permissionsStore";
import { Center, Loader } from "@mantine/core";

export default function MenuPage() {
  const router = useRouter();
  const { can } = usePermissionsStore();

  useEffect(() => {
    if (can("menu.pedidos_kg")) {
      router.replace("/dashboard/menu/pedidos-kg");
    }
  }, [can, router]);

  return (
    <Center h={300}>
      <Loader color="orange" />
    </Center>
  );
}
