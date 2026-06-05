import { useState, useCallback } from "react";
import { Sun, LogOut, Settings } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { signOut } from "firebase/auth";
import { auth, signInWithGoogle } from "./lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";

import { useEntries }  from "./hooks/useEntries";
import { useSettings } from "./hooks/useSettings";
import { useUpload }   from "./hooks/useUpload";

import { UploadCard }      from "./components/upload/UploadCard";
import { PaybackProgress } from "./components/dashboard/PaybackProgress";
import { StatsGrid }       from "./components/dashboard/StatsGrid";
import { ChartCard }       from "./components/dashboard/ChartCard";
import { InsightsPanel }   from "./components/dashboard/InsightsPanel";
import { HistoryTable }    from "./components/history/HistoryTable";
import { ManualAddModal }  from "./components/modals/ManualAddModal";
import { Toast, AnimatePresence as AP } from "./components/ui";

// ─── Login screen ─────────────────────────────────────────────────────────────
function LoginScreen() {
  const login = () => signInWithGoogle().catch(console.error);
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-8"
      >
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="w-20 h-20 bg-emerald-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/30"
          >
            <Sun size={40} className="text-white" />
          </motion.div>
          <div>
            <h1 className="text-5xl font-black italic tracking-tighter text-white">
              SOL<span className="text-emerald-400">AI</span>
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 italic mt-1">
              Solar Yield Dashboard
            </p>
          </div>
        </div>
        <button
          onClick={login}
          className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black italic uppercase tracking-widest text-sm rounded-2xl transition-all duration-300 shadow-xl shadow-emerald-500/20 hover:scale-105 active:scale-95"
        >
          Entrar com Google
        </button>
      </motion.div>
    </div>
  );
}

// ─── App principal ────────────────────────────────────────────────────────────
export default function App() {
  const [user, authLoading] = useAuthState(auth);

  // Settings
  const { settings, saveSettings } = useSettings(user?.uid ?? null);
  const investment = settings?.investmentValue ?? 14000;

  // Dados + métricas
  const {
    entries, loading, metrics, chartData, yearlyChartData,
    addEntry, deleteEntry,
  } = useEntries(user?.uid ?? null, investment);

  // Upload multi-step
  const { state: uploadState, processFile } = useUpload();

  // UI states
  const [selectedModel, setSelectedModel]   = useState("gemini-2.5-flash");
  const [manualOpen, setManualOpen]         = useState(false);
  const [toast, setToast]                   = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [editInvestment, setEditInvestment] = useState(false);
  const [newInvestment, setNewInvestment]   = useState("");

  // Handlers
  const handleFile = useCallback((file: File) => {
    processFile(file, selectedModel, async (data) => {
      const duplicate = entries.some(
        (e) => e.month === data.month && e.year === data.year
      );
      if (duplicate) throw new Error(`Já existe um lançamento para ${data.month}/${data.year}.`);

      await addEntry({
        month: data.month, year: data.year,
        discountValue: data.discountValue,
        totalBill: data.totalBill,
        injectedkWh: data.injectedkWh,
        pdfName: data.fileName,        
		pdfBase64: file.size < 750_000 ? `data:application/pdf;base64,${data.base64Data}` : null,	
        userId: user!.uid,
      });
    });
  }, [processFile, entries, addEntry, selectedModel, user]);

  const handleManualSubmit = async (data: any) => {
    await addEntry({ ...data, userId: user!.uid });
    setToast({ msg: `Lançamento ${data.month}/${data.year} adicionado.`, type: "success" });
  };

  const handleDelete = async (id: string) => {
    try { await deleteEntry(id); }
    catch { setToast({ msg: "Erro ao excluir.", type: "error" }); }
  };

  const handleOpenPdf = (base64: string, name: string) => {
    const w = window.open(); w?.document.write(`<iframe src="${base64}" width="100%" height="100%" />`);
  };

  const saveInvestment = async () => {
    const v = parseFloat(newInvestment.replace(",", "."));
    if (!isNaN(v) && v > 0) { await saveSettings({ investmentValue: v }); }
    setEditInvestment(false);
  };

  // Loading / auth
  if (authLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
        <Sun size={32} className="text-emerald-500" />
      </motion.div>
    </div>
  );
  if (!user) return <LoginScreen />;

  // ─── Dashboard ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AnimatePresence>{toast && (
        <Toast key="toast" message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}</AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20"
            >
              <Sun size={18} className="text-white" />
            </motion.div>
            <div>
              <span className="text-xl font-black italic tracking-tighter text-white">
                SOL<span className="text-emerald-400">AI</span>
              </span>
              <span className="hidden sm:block text-[9px] font-black uppercase tracking-[0.25em] text-slate-600 italic leading-none">
                Yield Dashboard
              </span>
            </div>
          </div>

          {/* Investimento */}
          <div className="flex items-center gap-2">
            {editInvestment ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus type="number" placeholder={String(investment)}
                  value={newInvestment} onChange={(e) => setNewInvestment(e.target.value)}
                  className="w-36 bg-slate-800 border border-emerald-500/50 rounded-xl px-3 py-1.5 text-sm font-black italic text-white focus:outline-none"
                  onKeyDown={(e) => { if (e.key === "Enter") saveInvestment(); if (e.key === "Escape") setEditInvestment(false); }}
                />
                <button onClick={saveInvestment} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-black italic rounded-xl">OK</button>
                <button onClick={() => setEditInvestment(false)} className="px-3 py-1.5 bg-slate-800 text-slate-400 text-xs font-black italic rounded-xl">✕</button>
              </div>
            ) : (
              <button
                onClick={() => { setNewInvestment(String(investment)); setEditInvestment(true); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 border border-slate-700 hover:border-emerald-500/30 rounded-xl transition-all"
              >
                <Settings size={13} className="text-slate-500" />
                <span className="text-sm font-black italic text-slate-300">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(investment)}
                </span>
              </button>
            )}
            <button
              onClick={() => signOut(auth)}
              className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-500 hover:text-white"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
              <Sun size={28} className="text-emerald-500" />
            </motion.div>
          </div>
        ) : (
          <>
            {/* Linha 1: Upload | Progress | Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-3">
                <UploadCard
                  uploadState={uploadState}
                  onFile={handleFile}
                  onManualAdd={() => setManualOpen(true)}
                  selectedModel={selectedModel}
                  onModelChange={setSelectedModel}
                />
              </div>
              <div className="lg:col-span-2">
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm h-full flex flex-col justify-center">
                  <PaybackProgress metrics={metrics} investmentValue={investment} />
                </div>
              </div>
              <div className="lg:col-span-7">
                <StatsGrid metrics={metrics} investmentValue={investment} />
              </div>
            </div>

            {/* Linha 2: Gráfico | Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8">
                <ChartCard
                  chartData={chartData}
                  yearlyData={yearlyChartData}
                  avgMonthly={metrics.avgMonthly}
                  investmentValue={investment}
                />
              </div>
              <div className="lg:col-span-4">
                <InsightsPanel metrics={metrics} investmentValue={investment} />
              </div>
            </div>

            {/* Linha 3: Tabela */}
            <HistoryTable
              entriesWithBalance={metrics.entriesWithBalance}
              bestId={metrics.bestEntry?.id}
              onDelete={handleDelete}
              onOpenPdf={handleOpenPdf}
            />
          </>
        )}
      </main>

      {/* Modal lançamento manual */}
      <ManualAddModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onSubmit={handleManualSubmit}
        existingEntries={entries.map((e) => ({ month: e.month, year: e.year }))}
      />
    </div>
  );
}
