import { Sparkles, TrendingUp, TrendingDown, Trophy, Target, Zap } from "lucide-react";
import { motion } from "motion/react";
import { SolarMetrics } from "../../types";
import { formatBRL, formatPayoffDate } from "../../utils/calculations";

interface Props {
  metrics: SolarMetrics;
  investmentValue: number;
}

interface Insight {
  icon: React.ElementType;
  color: string;
  bg: string;
  text: string;
}

function generateInsights(metrics: SolarMetrics, investment: number): Insight[] {
  const insights: Insight[] = [];
  const {
    avgMonthly, avgLast3, avgLast12, bestEntry, payoffDateSimple,
    payoffDateInflation, progressPercent, totalRecovered,
    paybackReached, byYear, entriesWithBalance,
  } = metrics;

  const years = Object.keys(byYear).map(Number).sort();
  const lastYear = years[years.length - 1];
  const prevYear = years[years.length - 2];

  // 1. Tendência recente
  if (avgLast3 > 0 && avgMonthly > 0) {
    const diffPct = ((avgLast3 - avgMonthly) / avgMonthly) * 100;
    if (diffPct >= 5) {
      insights.push({
        icon: TrendingUp,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10 border-emerald-500/20",
        text: `A média dos últimos 3 meses (${formatBRL(avgLast3)}) está ${diffPct.toFixed(0)}% acima da média histórica (${formatBRL(avgMonthly)}). Sistema performando acima do esperado.`,
      });
    } else if (diffPct <= -10) {
      insights.push({
        icon: TrendingDown,
        color: "text-rose-400",
        bg: "bg-rose-500/10 border-rose-500/20",
        text: `A média dos últimos 3 meses (${formatBRL(avgLast3)}) está ${Math.abs(diffPct).toFixed(0)}% abaixo da média histórica. Pode ser sazonalidade de inverno — normal para geração solar.`,
      });
    }
  }

  // 2. Comparativo YoY
  if (lastYear && prevYear && byYear[lastYear] && byYear[prevYear]) {
    const yoyPct = ((byYear[lastYear] - byYear[prevYear]) / byYear[prevYear]) * 100;
    if (Math.abs(yoyPct) >= 5) {
      insights.push({
        icon: yoyPct > 0 ? TrendingUp : TrendingDown,
        color: yoyPct > 0 ? "text-emerald-400" : "text-yellow-500",
        bg: yoyPct > 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-yellow-500/10 border-yellow-500/20",
        text: `${lastYear} gerou ${formatBRL(byYear[lastYear])} — ${yoyPct > 0 ? "+" : ""}${yoyPct.toFixed(0)}% vs ${prevYear} (${formatBRL(byYear[prevYear])}). ${yoyPct > 0 ? "Crescimento consistente!" : "Queda parcialmente compensada pela inflação energética."}`,
      });
    }
  }

  // 3. Melhor mês
  if (bestEntry) {
    insights.push({
      icon: Trophy,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10 border-yellow-500/20",
      text: `Seu recorde histórico é ${formatBRL(bestEntry.discountValue)} em ${String(bestEntry.month).padStart(2, "0")}/${bestEntry.year}. Meses de verão e alta irradiação tendem a repetir esse desempenho.`,
    });
  }

  // 4. Projeção de payback
  if (!paybackReached && payoffDateSimple && payoffDateInflation) {
    const simpleStr = formatPayoffDate(payoffDateSimple);
    const inflStr = formatPayoffDate(payoffDateInflation);
    if (simpleStr !== inflStr) {
      insights.push({
        icon: Target,
        color: "text-blue-400",
        bg: "bg-blue-500/10 border-blue-500/20",
        text: `Projeção conservadora: quitação em ${simpleStr}. Com inflação energética de 15% a.a. (histórico ANEEL), o prazo cai para ${inflStr} — energia fica mais cara e sua economia cresce junto.`,
      });
    } else {
      insights.push({
        icon: Target,
        color: "text-blue-400",
        bg: "bg-blue-500/10 border-blue-500/20",
        text: `Quitação estimada: ${simpleStr}. Faltam ${formatBRL(metrics.remaining)} para atingir o payback total de ${formatBRL(investment)}.`,
      });
    }
  }

  // 5. Payback atingido
  if (paybackReached) {
    insights.push({
      icon: Zap,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
      text: `🎉 Investimento recuperado em ${metrics.paybackMonth} meses! Cada real que o sistema gera agora é lucro puro. Economia mensal estimada: ${formatBRL(metrics.roiPostPayback)}.`,
    });
  }

  // 6. Marco de % atingida
  const milestones = [25, 50, 75, 90];
  for (const m of milestones.reverse()) {
    if (progressPercent >= m && progressPercent < m + 10) {
      insights.push({
        icon: Target,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10 border-emerald-500/20",
        text: `Marco de ${m}% atingido! ${formatBRL(totalRecovered)} de ${formatBRL(investment)} recuperados. ${formatBRL(metrics.remaining)} restantes para o payback completo.`,
      });
      break;
    }
  }

  return insights.slice(0, 3); // máximo 3 insights em tela
}

export function InsightsPanel({ metrics, investmentValue }: Props) {
  const insights = generateInsights(metrics, investmentValue);
  if (insights.length === 0) return null;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="p-2 bg-emerald-500/10 rounded-xl">
          <Sparkles size={14} className="text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xs font-black italic uppercase tracking-tighter text-white leading-none">
            Insights do Sistema
          </h2>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">
            Análise automática dos seus dados
          </p>
        </div>
      </div>

      {insights.map((ins, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 + 0.2, duration: 0.35 }}
          className={`flex gap-3 p-3 rounded-xl border ${ins.bg}`}
        >
          <ins.icon size={15} className={`${ins.color} mt-0.5 shrink-0`} />
          <p className="text-[11px] text-slate-300 font-medium leading-relaxed">{ins.text}</p>
        </motion.div>
      ))}
    </div>
  );
}
