"use client";

import { MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ModalsProvider } from "@mantine/modals";

const theme = createTheme({
  primaryColor: "orange",
  primaryShade: 5,
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontFamilyMonospace: "JetBrains Mono, Fira Code, monospace",
  defaultRadius: "md",
  colors: {
    orange: [
      "#fff7ed",
      "#ffedd5",
      "#fed7aa",
      "#fdba74",
      "#fb923c",
      "#f97316",
      "#ea580c",
      "#c2410c",
      "#9a3412",
      "#7c2d12",
    ],
  },
  components: {
    Button: {
      defaultProps: { radius: "md" },
    },
    Card: {
      defaultProps: { radius: "lg", shadow: "sm" },
    },
    TextInput: {
      defaultProps: { radius: "md" },
    },
    Select: {
      defaultProps: { radius: "md" },
    },
    Badge: {
      defaultProps: { radius: "xl" },
    },
    Paper: {
      defaultProps: { radius: "lg" },
    },
  },
  headings: {
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontWeight: "700",
  },
  spacing: {
    xs: "8px",
    sm: "12px",
    md: "16px",
    lg: "24px",
    xl: "32px",
  },
  breakpoints: {
    xs: "480px",
    sm: "768px",
    md: "1024px",
    lg: "1280px",
    xl: "1536px",
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="top-right" zIndex={1000} />
      <ModalsProvider>{children}</ModalsProvider>
    </MantineProvider>
  );
}
