"use client";

import { ReactNode } from "react";
import { ActionIcon } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import styles from "./Drawer.module.css";

interface DrawerProps {
  opened: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  position?: "left" | "right";
  size?: "sm" | "md" | "lg";
}

export default function Drawer({
  opened,
  onClose,
  title,
  children,
  position = "right",
  size = "md",
}: DrawerProps) {
  if (!opened) return null;

  const sizeClass = size === "sm" ? styles.drawerSm : size === "lg" ? styles.drawerLg : styles.drawerMd;
  const positionClass = position === "left" ? styles.drawerLeft : styles.drawerRight;

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={`${styles.drawer} ${positionClass} ${sizeClass}`}>
        {title && (
          <div className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            <ActionIcon variant="subtle" color="gray" onClick={onClose} aria-label="Cerrar">
              <IconX size={20} />
            </ActionIcon>
          </div>
        )}
        <div className={styles.content}>{children}</div>
      </div>
    </>
  );
}
