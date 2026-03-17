"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  TextInput,
  PasswordInput,
  Button,
  Paper,
  Title,
  Text,
  Stack,
  Alert,
  Divider,
} from "@mantine/core";
import { IconAlertCircle, IconChefHat } from "@tabler/icons-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, getApiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import styles from "./register.module.css";

const registerSchema = z.object({
  tenantName: z.string().min(2, "Mínimo 2 caracteres"),
  tenantSlug: z
    .string()
    .min(2, "Mínimo 2 caracteres")
    .regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
  ownerName: z.string().min(2, "Ingresá tu nombre"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterForm) => {
    setError(null);
    try {
      const res = await api.post("/auth/register", data);
      setAuth(res.data.user, res.data.tenant);
      router.push("/dashboard");
    } catch (err) {
      setError(getApiErrorMessage(err, "Error al registrar. Intentá de nuevo."));
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.brand}>
        <IconChefHat size={40} color="#f97316" />
        <span className={styles.brandName}>GastroDash</span>
        <span className={styles.brandVersion}>2.0</span>
      </div>

      <Paper className={styles.card} shadow="lg" radius="xl" p="xl">
        <Title order={2} className={styles.title}>
          Registrá tu local
        </Title>
        <Text className={styles.subtitle}>
          Empezá gratis. Sin tarjeta de crédito.
        </Text>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack gap="md" mt="lg">
            {error && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md">
                {error}
              </Alert>
            )}

            <Divider label="Tu negocio" labelPosition="left" />

            <TextInput
              label="Nombre del local"
              placeholder="Mi Restaurante"
              error={errors.tenantName?.message}
              {...register("tenantName")}
            />

            <TextInput
              label="Identificador único (slug)"
              placeholder="mi-restaurante"
              description="Solo minúsculas, números y guiones. No se puede cambiar después."
              error={errors.tenantSlug?.message}
              {...register("tenantSlug")}
            />

            <Divider label="Tu cuenta" labelPosition="left" />

            <TextInput
              label="Tu nombre"
              placeholder="Juan García"
              error={errors.ownerName?.message}
              {...register("ownerName")}
            />

            <TextInput
              label="Email"
              type="email"
              placeholder="hola@milocal.com"
              error={errors.email?.message}
              {...register("email")}
            />

            <PasswordInput
              label="Contraseña"
              placeholder="Mínimo 8 caracteres"
              error={errors.password?.message}
              {...register("password")}
            />

            <Button
              type="submit"
              fullWidth
              size="md"
              loading={isSubmitting}
              color="orange"
              mt="sm"
            >
              Crear mi cuenta
            </Button>
          </Stack>
        </form>
      </Paper>

      <Text className={styles.footer}>
        ¿Ya tenés cuenta?{" "}
        <a href="/login" className={styles.link}>
          Iniciá sesión
        </a>
      </Text>
    </div>
  );
}
