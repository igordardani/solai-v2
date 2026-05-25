import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";
import { Maximize2, Minimize2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { formatBRL } from "../../utils/calculations";

type Tab = "acumulado" | "mensal" | "anual";

interface Props {
  chartData: { name: string; recovered: number; monthly: number; payback: number }[];
  yearlyData: { year: string; total: number }[];
  avgMonthly: number;
  investmentValue: number;
}

const CustomTooltip = ({ active, payload, label, tab }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-sm font-black italic" style={{ color: p.color }}>
          {formatBRL(p.value)}
        </p>
      ))}
    </div>
  );
};

export function ChartCard({ chartData, yearlyData, avgMonthly, investmentValue }: Props) {
  const [tab, setTab] = useState<Tab>("acumulado");
  const [fullscreen, setFullscreen] = useState(false);

  const tabs: { key: Tab; label: string }[] = [
    { key: "acumulado", label: "Acumulado" },
    { key: "mensal", label: "Mensal" },
    { key: "anual", label: "Por Ano" },
  ];

  const inner = (
    <div className={cn("flex flex-col h-full", fullscreen ? "gap-6" : "gap-4")}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black italic uppercase tracking-tighter text-white">
            Evolução do Ativo Solar
          </h2>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">
            {chartData.length} meses de histórico
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="flex gap-1 bg-slate-950/60 rounded-xl p-1 border border-slate-800">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest italic transition-all duration-200",
                  tab === t.key
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {/* Fullscreen */}
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
            title={fullscreen ? "Minimizar" : "Expandir gráfico"}
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Chart area */}
      <div className={cn("w-full", fullscreen ? "h-[60vh]" : "h-48 sm:h-56")}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              {tab === "anual" ? (
                <BarChart data={yearlyData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="year" tick={{ fill: "#334155", fontSize: 9, fontWeight: 700, fontStyle: "italic" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#334155", fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip tab={tab} />} />
                  <Bar dataKey="total" fill="#059669" radius={[6, 6, 0, 0]} label={false} />
                </BarChart>
              ) : (
                <AreaChart
                  data={chartData}
                  margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradRecovered" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradMonthly" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill: "#334155", fontSize: 9, fontWeight: 700, fontStyle: "italic" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: "#334155", fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip tab={tab} />} />
                  {tab === "acumulado" && (
                    <ReferenceLine y={investmentValue} stroke="#f43f5e" strokeDasharray="6 4" strokeWidth={1.5}
                      label={{ value: "Meta", fill: "#f43f5e", fontSize: 9, fontWeight: 700 }} />
                  )}
                  {tab === "mensal" && (
                    <ReferenceLine y={avgMonthly} stroke="#f59e0b" strokeDasharray="6 4" strokeWidth={1}
                      label={{ value: "Média", fill: "#f59e0b", fontSize: 9, fontWeight: 700 }} />
                  )}
                  <Area
                    type="monotone"
                    dataKey={tab === "acumulado" ? "recovered" : "monthly"}
                    stroke={tab === "acumulado" ? "#10b981" : "#059669"}
                    strokeWidth={2}
                    fill={tab === "acumulado" ? "url(#gradRecovered)" : "url(#gradMonthly)"}
                    dot={false}
                    activeDot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-emerald-500 rounded" />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">
            {tab === "anual" ? "Total Anual" : tab === "acumulado" ? "Acumulado" : "Mensal"}
          </span>
        </div>
        {tab === "acumulado" && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-px border-t-2 border-dashed border-rose-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">Meta Payback</span>
          </div>
        )}
        {tab === "mensal" && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-px border-t-2 border-dashed border-yellow-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">Média Mensal</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Card normal */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
        {inner}
      </div>

      {/* Fullscreen overlay */}
      <AnimatePresence>
        {fullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl p-8 flex flex-col"
            onClick={(e) => { if (e.target === e.currentTarget) setFullscreen(false); }}
          >
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-full shadow-2xl">
              {inner}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
