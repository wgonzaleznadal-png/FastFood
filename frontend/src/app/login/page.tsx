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
} from "@mantine/core";
import { IconAlertCircle, IconChefHat } from "@tabler/icons-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, getApiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import styles from "./login.module.css";

const loginSchema = z.object({
  tenantSlug: z.string().min(1, "Ingresá el nombre de tu local"),
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    try {
      const res = await api.post("/api/auth/login", {
        tenantSlug: data.tenantSlug,
        email: data.email.trim(),
        password: data.password,
      });
      setAuth(res.data.token, res.data.user, res.data.tenant, res.data.refreshToken);
      router.push("/dashboard");
    } catch (err) {
      setError(getApiErrorMessage(err, "Error al iniciar sesión. Verificá tus datos."));
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
          Bienvenido de vuelta
        </Title>
        <Text className={styles.subtitle}>
          Ingresá a tu panel de gestión
        </Text>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack gap="md" mt="lg">
            {error && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md">
                {error}
              </Alert>
            )}

            <TextInput
              label="Nombre del local"
              placeholder="mi-restaurante"
              description="El identificador único de tu negocio"
              error={errors.tenantSlug?.message}
              {...register("tenantSlug")}
            />

            <TextInput
              label="Email"
              placeholder="tu@email.com"
              description="Opcional si sos el único usuario"
              error={errors.email?.message}
              {...register("email")}
            />

            <PasswordInput
              label="Contraseña"
              placeholder="••••••••"
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
              Ingresar
            </Button>
          </Stack>
        </form>
      </Paper>

      <Text className={styles.footer}>
        ¿No tenés cuenta?{" "}
        <a href="/register" className={styles.link}>
          Registrá tu local
        </a>
      </Text>
    </div>
  );
}
