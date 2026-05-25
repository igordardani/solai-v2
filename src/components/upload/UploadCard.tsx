import { useRef, useState, useCallback } from "react";
import { Upload, FilePlus2, CheckCircle2, AlertCircle, Loader2, FileText } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { Button } from "../ui";
import { UploadStep } from "../../types";
import { formatBRL } from "../../utils/calculations";

const STEPS: { key: UploadStep; label: string }[] = [
  { key: "reading",  label: "Lendo arquivo..." },
  { key: "sending",  label: "Analisando com IA..." },
  { key: "saving",   label: "Salvando no Firebase..." },
];

interface Props {
  uploadState: { step: UploadStep; error: string | null; result: { month: number; year: number; discountValue: number } | null };
  onFile: (file: File) => void;
  onManualAdd: () => void;
  selectedModel: string;
  onModelChange: (m: string) => void;
}

const MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (recomendado)" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { id: "gemini-1.5-pro",   label: "Gemini 1.5 Pro" },
];

export function UploadCard({ uploadState, onFile, onManualAdd, selectedModel, onModelChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { step, error, result } = uploadState;
  const busy = step !== "idle" && step !== "done" && step !== "error";

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === "application/pdf") onFile(file);
  }, [onFile]);

  const currentStepIdx = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-sm font-black italic uppercase tracking-tighter text-white leading-none">
          Arquivar Conta
        </h2>
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic mt-0.5">
          PDF da fatura de energia
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !busy && inputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-3",
          "transition-all duration-300 cursor-pointer min-h-[130px]",
          busy ? "cursor-not-allowed opacity-70" : "hover:border-emerald-500/60 hover:bg-emerald-500/5",
          dragging
            ? "border-emerald-400 bg-emerald-500/10 scale-[1.01]"
            : step === "done"
            ? "border-emerald-500/40 bg-emerald-500/5"
            : step === "error"
            ? "border-rose-500/40 bg-rose-500/5"
            : "border-slate-700"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
          disabled={busy}
        />

        <AnimatePresence mode="wait">
          {/* Idle */}
          {step === "idle" && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 text-center">
              <div className="p-3.5 bg-slate-800 rounded-2xl group-hover:bg-emerald-500/10 transition-colors">
                <Upload size={22} className="text-slate-400" />
              </div>
              <div>
                <p className="text-xs font-black italic text-slate-300">Arraste o PDF aqui</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 italic mt-0.5">
                  ou clique para selecionar
                </p>
              </div>
            </motion.div>
          )}

          {/* Processing — multi-step */}
          {busy && (
            <motion.div key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="w-full space-y-2">
              {STEPS.map((s, i) => {
                const isDone = i < currentStepIdx;
                const isActive = i === currentStepIdx;
                return (
                  <motion.div
                    key={s.key}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: isDone || isActive ? 1 : 0.3, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-2.5"
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all",
                      isDone   ? "bg-emerald-500" :
                      isActive ? "bg-emerald-500/20 border border-emerald-500" :
                                 "bg-slate-800 border border-slate-700"
                    )}>
                      {isDone
                        ? <CheckCircle2 size={12} className="text-white" />
                        : isActive
                        ? <Loader2 size={10} className="text-emerald-400 animate-spin" />
                        : <span className="text-[8px] font-black text-slate-600">{i + 1}</span>
                      }
                    </div>
                    <span className={cn(
                      "text-xs font-bold italic",
                      isDone   ? "text-emerald-400" :
                      isActive ? "text-white" :
                                 "text-slate-600"
                    )}>
                      {s.label}
                    </span>
                  </motion.div>
                );
              })}
              {/* Barra de progresso estimada */}
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden mt-3">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
                  animate={{ width: `${((currentStepIdx + 1) / STEPS.length) * 100}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          )}

          {/* Done */}
          {step === "done" && result && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }} className="flex flex-col items-center gap-2 text-center">
              <div className="p-3 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/30">
                <CheckCircle2 size={22} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-black italic text-emerald-400">
                  {String(result.month).padStart(2, "0")}/{result.year} importado!
                </p>
                <p className="text-[10px] text-slate-400 font-bold italic">
                  Economia: <span className="text-emerald-400">{formatBRL(result.discountValue)}</span>
                </p>
              </div>
            </motion.div>
          )}

          {/* Error */}
          {step === "error" && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0 }} className="flex flex-col items-center gap-2 text-center">
              <div className="p-3 bg-rose-500/20 rounded-2xl border border-rose-500/20">
                <AlertCircle size={22} className="text-rose-400" />
              </div>
              <p className="text-[11px] text-rose-300 font-bold leading-snug max-w-[180px]">{error}</p>
              <p className="text-[9px] text-slate-600 italic">Clique para tentar novamente</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Botão manual */}
      <Button variant="emerald-outline" size="sm" className="w-full" onClick={onManualAdd} disabled={busy}>
        <FilePlus2 size={13} className="mr-1.5" />
        Lançamento Manual
      </Button>

      {/* Seletor de modelo */}
      <div className="space-y-1.5">
        <label className="text-[9px] font-black uppercase tracking-widest text-slate-600 italic">
          Modelo de IA
        </label>
        <select
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={busy}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[10px] font-bold italic text-slate-400 focus:outline-none focus:border-emerald-500/50 transition-colors disabled:opacity-50"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
