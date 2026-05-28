import type { CSSProperties } from "react";
import toast, { type ToastOptions } from "react-hot-toast";

const position: ToastOptions["position"] = "top-center";

const shell: CSSProperties = {
  borderRadius: 14,
  padding: "14px 18px",
  fontSize: "0.92rem",
  lineHeight: 1.45,
  maxWidth: "min(440px, calc(100vw - 24px))",
  boxShadow: "0 16px 48px rgba(15, 23, 42, 0.12)",
};

export function notifyError(message: string, opts?: { id?: string }) {
  return toast.error(message, {
    id: opts?.id,
    position,
    duration: 5500,
    style: {
      ...shell,
      background: "rgba(254, 242, 242, 0.98)",
      color: "#8d1f1f",
      border: "1px solid rgba(239, 68, 68, 0.3)",
    },
  });
}

export function notifyWarning(message: string, opts?: { id?: string }) {
  return toast(message, {
    id: opts?.id,
    position,
    duration: 5000,
    icon: "⚠️",
    style: {
      ...shell,
      background: "rgba(255, 251, 235, 0.98)",
      color: "#8a5800",
      border: "1px solid rgba(245, 158, 11, 0.35)",
    },
  });
}

export function notifySuccess(message: string, opts?: { id?: string }) {
  return toast.success(message, {
    id: opts?.id,
    position,
    duration: 4500,
    style: {
      ...shell,
      background: "rgba(240, 253, 244, 0.98)",
      color: "#325500",
      border: "1px solid rgba(143, 184, 32, 0.35)",
    },
  });
}

export function notifyInfo(message: string, opts?: { id?: string }) {
  return toast(message, {
    id: opts?.id,
    position,
    duration: 5000,
    style: {
      ...shell,
      background: "rgba(239, 246, 255, 0.98)",
      color: "#0b4a82",
      border: "1px solid rgba(0, 122, 255, 0.25)",
    },
  });
}
