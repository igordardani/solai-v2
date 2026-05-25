import { motion } from "motion/react";
import { SolarMetrics } from "../../types";
import { formatBRL } from "../../utils/calculations";

interface Props {
  metrics: SolarMetrics;
  investmentValue: number;
}

export function PaybackProgress({ metrics, investmentValue }: Props) {
  const { progressPercent, totalRecovered, remaining, paybackReached } = metrics;
  const pct = Math.min(100, progressPercent);
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Círculo SVG */}
      <div className="relative w-40 h-40">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          <motion.circle
            cx="60" cy="60" r={radius} fill="none"
            stroke={paybackReached ? "#10b981" : "#059669"}
            strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.8, ease: "easeOut", delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-3xl font-black italic text-white tracking-tighter leading-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            {pct.toFixed(0)}<span className="text-emerald-400 text-xl">%</span>
          </motion.span>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic mt-0.5">
            Recuperado
          </span>
        </div>
      </div>

      {/* Valores */}
      <div className="w-full space-y-2 text-center">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">Recuperado</p>
          <p className="text-lg font-black italic text-white tracking-tighter">{formatBRL(totalRecovered)}</p>
        </div>

        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.4 }}
          />
        </div>

        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">
            {paybackReached ? "Lucro Gerado" : "Saldo Restante"}
          </p>
          <p className={`text-lg font-black italic tracking-tighter ${paybackReached ? "text-emerald-400" : "text-slate-100"}`}>
            {formatBRL(paybackReached ? metrics.profit : remaining)}
          </p>
        </div>

        <div className="pt-1 border-t border-slate-800">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">Investimento Total</p>
          <p className="text-sm font-black italic text-slate-400">{formatBRL(investmentValue)}</p>
        </div>
      </div>
    </div>
  );
}
