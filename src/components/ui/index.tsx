import React, { useEffect } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";

// ─── Button ───────────────────────────────────────────────────────────────────
type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline" | "emerald-outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const variants: Record<ButtonVariant, string> = {
      primary:
        "bg-emerald-600 text-white hover:bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)] border border-emerald-500/50",
      secondary:
        "bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700",
      danger:
        "bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/20",
      ghost: "hover:bg-slate-800 text-slate-400 hover:text-white",
      outline:
        "border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white backdrop-blur-sm",
      "emerald-outline":
        "border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10",
    };
    const sizes: Record<ButtonSize, string> = {
      sm: "px-3 py-1.5 text-[10px]",
      md: "px-6 py-2.5 text-xs",
      lg: "px-8 py-4 text-sm",
    };
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-2xl transition-all duration-300",
          "disabled:opacity-50 disabled:cursor-not-allowed italic active:scale-95",
          "uppercase font-black tracking-widest",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// ─── Card ─────────────────────────────────────────────────────────────────────
export const Card = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur-sm",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

// ─── Toast ────────────────────────────────────────────────────────────────────
interface ToastProps {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}

export const Toast = ({ message, type, onClose }: ToastProps) => {
  useEffect(() => {
    const t = setTimeout(onClose, type === "success" ? 5000 : 8000);
    return () => clearTimeout(t);
  }, [type, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      className={cn(
        "fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-4 rounded-2xl shadow-2xl",
        "flex items-center gap-4 min-w-[320px] max-w-[90vw] backdrop-blur-xl border",
        type === "success"
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          : "bg-rose-500/10 border-rose-500/20 text-rose-400"
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
          type === "success" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
        )}
      >
        {type === "success" ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest italic opacity-60 mb-0.5">
          {type === "success" ? "Sucesso" : "Erro de Processamento"}
        </p>
        <p className="text-sm font-bold leading-tight break-words">{message}</p>
      </div>
      <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors shrink-0">
        <X size={16} />
      </button>
    </motion.div>
  );
};

// ─── Badge ────────────────────────────────────────────────────────────────────
type BadgeColor = "emerald" | "yellow" | "rose" | "blue" | "slate";
interface BadgeProps { label: string; color?: BadgeColor; className?: string }

export const Badge = ({ label, color = "slate", className }: BadgeProps) => {
  const colors: Record<BadgeColor, string> = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    yellow:  "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    rose:    "bg-rose-500/10 text-rose-400 border-rose-500/20",
    blue:    "bg-blue-500/10 text-blue-400 border-blue-500/20",
    slate:   "bg-slate-800 text-slate-400 border-slate-700",
  };
  return (
    <span
      className={cn(
        "text-[9px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest italic leading-none",
        colors[color],
        className
      )}
    >
      {label}
    </span>
  );
};

// ─── AnimatePresence wrapper re-exportado ─────────────────────────────────────
export { AnimatePresence };
