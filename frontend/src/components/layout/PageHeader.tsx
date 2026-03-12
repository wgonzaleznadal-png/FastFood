"use client";

import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

interface PageHeaderProps {
  children?: ReactNode;
  actions?: ReactNode;
}

export default function PageHeader({ children, actions }: PageHeaderProps) {
  useEffect(() => {
    const center = document.getElementById("page-header-center");
    const actionsEl = document.getElementById("page-header-actions");
    if (center) center.style.display = "flex";
    if (actionsEl) actionsEl.style.display = "flex";
    return () => {
      if (center) center.style.display = "flex";
      if (actionsEl) actionsEl.style.display = "flex";
    };
  }, []);

  const centerEl = typeof window !== "undefined" ? document.getElementById("page-header-center") : null;
  const actionsEl = typeof window !== "undefined" ? document.getElementById("page-header-actions") : null;

  return (
    <>
      {children && centerEl && createPortal(children, centerEl)}
      {actions && actionsEl && createPortal(actions, actionsEl)}
    </>
  );
}
