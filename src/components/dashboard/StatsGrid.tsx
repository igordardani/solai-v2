import React from "react";
import {
  CheckCircle2, TrendingUp, Calendar, Award, Zap, DollarSign,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";
import { SolarMetrics } from "../../types";
import { formatBRL, formatMonths, formatPayoffDate } from "../../utils/calculations";
import { Badge } from "../ui";

interface MetricCardProps {
  title: string;
  value: string;
  sub?: React.ReactNode;
  icon: React.ElementType;
  variant?: "default" | "highlight";
  tooltip?: string;
  delay?: number;
}

const MetricCard = ({
  title, value, sub, icon: Icon, variant = "default", delay = 0,
}: MetricCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay, ease: "easeOut" }}
    className={cn(
      "rounded-2xl p-5 flex flex-col justify-between min-h-[140px] border transition-all duration-500",
      "hover:scale-[1.02] active:scale-[0.98] cursor-default group",
      "hover:shadow-2xl hover:shadow-emerald-500/10",
      variant === "highlight"
        ? "bg-emerald-500/10 border-emerald-500/20"
        : "bg-slate-900/40 border-slate-800"
    )}
  >
    <div className="flex justify-between items-start mb-3">
      <div
        className={cn(
          "p-2.5 rounded-xl transition-all duration-500",
          variant === "highlight"
            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
            : "bg-slate-800 text-slate-400 group-hover:bg-emerald-500/10 group-hover:text-emerald-400"
        )}
      >
        <Icon size={18} />
      </div>
      {sub && <div className="mt-0.5">{sub}</div>}
    </div>
    <div className="space-y-1">
      <span
        className={cn(
          "text-[9px] font-black uppercase tracking-[0.2em] italic block",
          variant === "highlight" ? "text-emerald-400/80" : "text-slate-500"
        )}
      >
        {title}
      </span>
      <h3
        className={cn(
          "text-lg sm:text-xl font-black italic tracking-tighter leading-[1.1] break-words",
          variant === "highlight" ? "text-white" : "text-slate-100"
        )}
      >
        {value}
      </h3>
    </div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
interface StatsGridProps {
  metrics: SolarMetrics;
  investmentValue: number;
}

export function StatsGrid({ metrics, investmentValue }: StatsGridProps) {
  const {
    totalRecovered, avgMonthly, avgLast3, remaining,
    payoffDateSimple, payoffDateInflation, estimatedMonthsSimple,
    bestEntry, roiPostPayback, paybackReached,
  } = metrics;

  const trendColor = avgLast3 > avgMonthly ? "text-emerald-400" : "text-rose-400";
  const trendLabel = avgLast3 > avgMonthly
    ? `↑ ${(((avgLast3 - avgMonthly) / avgMonthly) * 100).toFixed(0)}% vs média`
    : `↓ ${(((avgMonthly - avgLast3) / avgMonthly) * 100).toFixed(0)}% vs média`;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* 1 — Total Recuperado */}
      <MetricCard
        title="Total Recuperado"
        value={formatBRL(totalRecovered)}
        icon={CheckCircle2}
        variant="highlight"
        sub={<Badge label={`${metrics.progressPercent.toFixed(0)}%`} color="emerald" />}
        delay={0}
      />

      {/* 2 — Média Mensal */}
      <MetricCard
        title="Média Mensal"
        value={formatBRL(avgMonthly)}
        icon={TrendingUp}
        sub={
          <span className={cn("text-[9px] font-black italic uppercase tracking-wider", trendColor)}>
            {trendLabel}
          </span>
        }
        delay={0.05}
      />

      {/* 3 — Data de Quitação */}
      <MetricCard
        title="Quitação Estimada"
        value={
          paybackReached
            ? "Atingido! 🎉"
            : formatPayoffDate(payoffDateSimple) || `~${formatMonths(Math.ceil(estimatedMonthsSimple))}`
        }
        icon={Calendar}
        sub={<Badge label={remaining > 0 ? "Em curso" : "Concluído"} color={remaining > 0 ? "yellow" : "emerald"} />}
        delay={0.1}
      />

      {/* 4 — Payback c/ Inflação */}
      <MetricCard
        title="Payback c/ Inflação"
        value={formatPayoffDate(payoffDateInflation) || "—"}
        icon={Zap}
        sub={
          <span className="text-[9px] font-black italic uppercase tracking-wider text-slate-500">
            15% a.a. ANEEL
          </span>
        }
        delay={0.15}
      />

      {/* 5 — Melhor Mês */}
      <MetricCard
        title="Melhor Mês"
        value={bestEntry ? formatBRL(bestEntry.discountValue) : "—"}
        icon={Award}
        sub={
          bestEntry ? (
            <span className="text-[9px] font-black italic uppercase tracking-wider text-yellow-500">
              {String(bestEntry.month).padStart(2, "0")}/{bestEntry.year}
            </span>
          ) : undefined
        }
        delay={0.2}
      />

      {/* 6 — ROI Pós-Payback */}
      <MetricCard
        title="ROI Pós-Payback"
        value={`~${formatBRL(roiPostPayback)}/mês`}
        icon={DollarSign}
        sub={<Badge label="Puro lucro" color="emerald" />}
        delay={0.25}
      />
    </div>
  );
}
