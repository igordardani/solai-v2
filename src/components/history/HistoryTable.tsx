import { useState } from "react";
import { FileText, Trash2, Trophy, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { EntryWithBalance } from "../../types";
import { formatBRL, monthLabel } from "../../utils/calculations";
import { Badge } from "../ui";

interface Props {
  entriesWithBalance: EntryWithBalance[];
  bestId: string | undefined;
  onDelete: (id: string) => void;
  onOpenPdf: (base64: string, name: string) => void;
}

type SortDir = "desc" | "asc";

function EntryBadge({ entry, bestId }: { entry: EntryWithBalance; bestId?: string }) {
  if (entry.id === bestId) return <Badge label="🏆 Top" color="yellow" />;
  if (entry.vsAvg === "above") return <Badge label="↑ Top" color="emerald" />;
  if (entry.vsAvg === "below") return <Badge label="↓ Abaixo" color="rose" />;
  return null;
}

export function HistoryTable({ entriesWithBalance, bestId, onDelete, onOpenPdf }: Props) {
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterYear, setFilterYear] = useState<number | "all">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const years = [...new Set(entriesWithBalance.map((e) => e.year))].sort((a, b) => b - a);

  const visible = [...entriesWithBalance]
    .filter((e) => filterYear === "all" || e.year === filterYear)
    .sort((a, b) => {
      const diff = a.year - b.year || a.month - b.month;
      return sortDir === "desc" ? -diff : diff;
    });

  const confirmDelete = (id: string) => {
    if (deletingId === id) {
      onDelete(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
      setTimeout(() => setDeletingId(null), 3000);
    }
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-black italic uppercase tracking-tighter text-white leading-none">
            Histórico de Lançamentos
          </h2>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic mt-0.5">
            {visible.length} de {entriesWithBalance.length} registros
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro por ano */}
          <div className="flex gap-1 bg-slate-950/60 rounded-xl p-1 border border-slate-800">
            <button
              onClick={() => setFilterYear("all")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest italic transition-all",
                filterYear === "all" ? "bg-emerald-600 text-white" : "text-slate-500 hover:text-slate-300"
              )}
            >Todos</button>
            {years.map((y) => (
              <button key={y}
                onClick={() => setFilterYear(y)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest italic transition-all",
                  filterYear === y ? "bg-emerald-600 text-white" : "text-slate-500 hover:text-slate-300"
                )}
              >{y}</button>
            ))}
          </div>

          {/* Ordenação */}
          <button
            onClick={() => setSortDir((d) => d === "desc" ? "asc" : "desc")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-[9px] font-black uppercase tracking-widest italic text-slate-400 hover:text-white transition-all border border-slate-700"
          >
            {sortDir === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            {sortDir === "desc" ? "Recentes" : "Antigos"}
          </button>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-950/40">
              {["Competência", "Valor Conta", "Desconto", "Saldo Restante", "Fatura", ""].map((h, i) => (
                <th key={i} className={cn(
                  "text-[9px] font-black uppercase tracking-[0.18em] text-slate-600 italic py-3",
                  i === 0 ? "pl-5 text-left" : i === 5 ? "pr-5 text-center" : "text-right px-4"
                )}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {visible.map((entry, idx) => (
                <motion.tr
                  key={entry.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ delay: idx * 0.02, duration: 0.25 }}
                  className="border-t border-slate-800/60 hover:bg-slate-800/20 transition-colors group"
                >
                  <td className="py-3.5 pl-5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black italic text-white tracking-tighter">
                        {monthLabel(entry.month, entry.year)}
                      </span>
                      <EntryBadge entry={entry} bestId={bestId} />
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right text-sm font-black italic text-slate-400">
                    {entry.totalBill ? formatBRL(entry.totalBill) : "—"}
                  </td>
                  <td className="py-3.5 px-4 text-right text-sm font-black italic text-emerald-400">
                    {formatBRL(entry.discountValue)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <span className={cn(
                      "text-sm font-black italic",
                      entry.balanceAtTime === 0 ? "text-emerald-400" : "text-slate-300"
                    )}>
                      {entry.balanceAtTime === 0 ? "✓ Pago" : formatBRL(entry.balanceAtTime)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {entry.pdfBase64 ? (
                      <button
                        onClick={() => onOpenPdf(entry.pdfBase64!, entry.pdfName || "fatura.pdf")}
                        className="p-1.5 hover:bg-emerald-500/10 rounded-lg transition-colors"
                        title="Ver fatura"
                      >
                        <FileText size={16} className="text-emerald-500 hover:text-emerald-400" />
                      </button>
                    ) : (
                      <span className="text-slate-700 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-3.5 pr-5 text-center">
                    <button
                      onClick={() => confirmDelete(entry.id)}
                      className={cn(
                        "p-1.5 rounded-lg transition-all text-[9px] font-black italic uppercase",
                        deletingId === entry.id
                          ? "bg-rose-500 text-white px-2.5"
                          : "opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 text-slate-600 hover:text-rose-400"
                      )}
                      title="Excluir"
                    >
                      {deletingId === entry.id ? "Confirmar?" : <Trash2 size={14} />}
                    </button>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-slate-800/60">
        <AnimatePresence>
          {visible.map((entry, idx) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black italic text-white">
                    {monthLabel(entry.month, entry.year)}
                  </span>
                  <EntryBadge entry={entry} bestId={bestId} />
                </div>
                <div className="flex items-center gap-2">
                  {entry.pdfBase64 && (
                    <button onClick={() => onOpenPdf(entry.pdfBase64!, entry.pdfName || "fatura.pdf")}
                      className="p-1 hover:bg-emerald-500/10 rounded-lg">
                      <FileText size={15} className="text-emerald-500" />
                    </button>
                  )}
                  <button
                    onClick={() => confirmDelete(entry.id)}
                    className={cn(
                      "p-1 rounded-lg transition-all text-[9px] font-black italic",
                      deletingId === entry.id ? "bg-rose-500 text-white px-2" : "text-slate-600"
                    )}
                  >
                    {deletingId === entry.id ? "OK?" : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-800/60 rounded-xl p-2">
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 italic">Conta</p>
                  <p className="text-xs font-black italic text-slate-300">
                    {entry.totalBill ? formatBRL(entry.totalBill) : "—"}
                  </p>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2">
                  <p className="text-[8px] font-black uppercase tracking-widest text-emerald-500/80 italic">Desconto</p>
                  <p className="text-xs font-black italic text-emerald-400">{formatBRL(entry.discountValue)}</p>
                </div>
                <div className="bg-slate-800/60 rounded-xl p-2">
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 italic">Saldo</p>
                  <p className={cn("text-xs font-black italic", entry.balanceAtTime === 0 ? "text-emerald-400" : "text-slate-300")}>
                    {entry.balanceAtTime === 0 ? "✓ Pago" : formatBRL(entry.balanceAtTime)}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {visible.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-slate-600 font-black italic uppercase tracking-widest text-xs">
            Nenhum registro neste filtro
          </p>
        </div>
      )}
    </div>
  );
}
