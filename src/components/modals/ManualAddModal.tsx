import { useState } from "react";
import { X, FilePlus2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "../ui";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { month: number; year: number; discountValue: number; totalBill?: number; injectedkWh?: number }) => Promise<void>;
  existingEntries: { month: number; year: number }[];
}

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - i);

export function ManualAddModal({ open, onClose, onSubmit, existingEntries }: Props) {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear);
  const [discountValue, setDiscountValue] = useState("");
  const [totalBill, setTotalBill] = useState("");
  const [injectedkWh, setInjectedkWh] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyExists = existingEntries.some(
    (e) => e.month === month && e.year === year
  );

  const handleSubmit = async () => {
    setError(null);
    const discount = parseFloat(discountValue.replace(",", "."));
    if (isNaN(discount) || discount <= 0) {
      setError("Informe um valor de desconto válido.");
      return;
    }
    if (alreadyExists) {
      setError(`Já existe um lançamento para ${String(month).padStart(2, "0")}/${year}.`);
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        month, year,
        discountValue: discount,
        totalBill: totalBill ? parseFloat(totalBill.replace(",", ".")) : undefined,
        injectedkWh: injectedkWh ? parseFloat(injectedkWh.replace(",", ".")) : undefined,
      });
      // Resetar
      setDiscountValue("");
      setTotalBill("");
      setInjectedkWh("");
      onClose();
    } catch (e: any) {
      setError(e.message || "Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold italic text-white placeholder:text-slate-700 focus:outline-none focus:border-emerald-500/50 transition-colors";
  const labelCls =
    "block text-[9px] font-black uppercase tracking-widest text-slate-500 italic mb-1.5";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-xl">
                    <FilePlus2 size={16} className="text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black italic uppercase tracking-tighter text-white">
                      Lançamento Manual
                    </h2>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">
                      Sem PDF · Entrada direta
                    </p>
                  </div>
                </div>
                <button onClick={onClose}
                  className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                {/* Mês e Ano */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Mês</label>
                    <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={inputCls}>
                      {MONTHS.map((m, i) => (
                        <option key={i} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Ano</label>
                    <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputCls}>
                      {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>

                {/* Alerta de duplicata */}
                {alreadyExists && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2.5">
                    <p className="text-xs font-bold italic text-yellow-400">
                      ⚠ Já existe um lançamento para {String(month).padStart(2,"0")}/{year}.
                    </p>
                  </div>
                )}

                {/* Desconto (obrigatório) */}
                <div>
                  <label className={labelCls}>Desconto / Economia <span className="text-emerald-500">*</span></label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-black italic">R$</span>
                    <input
                      type="number" step="0.01" min="0"
                      placeholder="0,00"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className={`${inputCls} pl-10`}
                    />
                  </div>
                </div>

                {/* Opcionais */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Valor Total da Conta</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-black italic">R$</span>
                      <input type="number" step="0.01" min="0" placeholder="0,00"
                        value={totalBill} onChange={(e) => setTotalBill(e.target.value)}
                        className={`${inputCls} pl-10`} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>kWh Injetados</label>
                    <input type="number" step="0.01" min="0" placeholder="0"
                      value={injectedkWh} onChange={(e) => setInjectedkWh(e.target.value)}
                      className={inputCls} />
                  </div>
                </div>

                {/* Erro */}
                {error && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5">
                    <p className="text-xs font-bold italic text-rose-400">{error}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-3 p-6 pt-0">
                <Button variant="outline" size="md" onClick={onClose} className="flex-1">Cancelar</Button>
                <Button
                  variant="primary" size="md"
                  onClick={handleSubmit}
                  disabled={loading || !discountValue || alreadyExists}
                  className="flex-1"
                >
                  {loading ? "Salvando..." : "Efetivar"}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
