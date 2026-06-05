import { useState, useCallback } from "react";
import { PDFDocument } from "pdf-lib";
import { UploadState, UploadStep } from "../types";

const MAX_STORE_BYTES = 750_000; // 750 KB

// Converte Uint8Array para base64 sem estourar o stack
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function useUpload() {
  const [state, setState] = useState<UploadState>({
    step: "idle",
    error: null,
    result: null,
  });

  const setStep = (step: UploadStep, error: string | null = null) =>
    setState((s) => ({ ...s, step, error }));

  const reset = () => setState({ step: "idle", error: null, result: null });

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Compacta para 1ª página se > 750KB
  const compressPdfForStorage = async (base64: string): Promise<string | null> => {
    try {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      if (bytes.byteLength <= MAX_STORE_BYTES) return base64;

      const src = await PDFDocument.load(bytes);
      const dst = await PDFDocument.create();
      const [first] = await dst.copyPages(src, [0]);
      dst.addPage(first);
      const compressed = await dst.save();

      if (compressed.byteLength > MAX_STORE_BYTES) {
        console.warn("[SOLAI] PDF ainda grande após compactar, não será armazenado.");
        return null;
      }

      console.log(`[SOLAI] PDF compactado: ${(bytes.byteLength / 1024).toFixed(0)}KB → ${(compressed.byteLength / 1024).toFixed(0)}KB`);
      return uint8ToBase64(compressed);
    } catch (e) {
      console.error("[SOLAI] Erro ao compactar PDF:", e);
      return null;
    }
  };

  const processFile = useCallback(
    async (
      file: File,
      selectedModel: string,
      onSuccess: (data: {
        month: number; year: number; totalBill: number;
        discountValue: number; injectedkWh: number;
        base64Data: string; storageBase64: string | null; fileName: string;
      }) => Promise<void>
    ) => {
      if (state.step !== "idle" && state.step !== "error" && state.step !== "done") return;

      setState({ step: "reading", error: null, result: null });

      try {
        // Etapa 1 — ler arquivo
        const base64Data = await readFileAsBase64(file);

        // Etapa 2 — enviar para serverless function
        setStep("sending");
        const res = await fetch("/api/process-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Data, selectedModel }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro no servidor.");

        // Etapa 3 — compactar PDF para armazenamento e salvar
        setStep("saving");
        const storageBase64 = await compressPdfForStorage(base64Data);
        await onSuccess({ ...data, base64Data, storageBase64, fileName: file.name });

        setState({
          step: "done",
          error: null,
          result: {
            month: data.month,
            year: data.year,
            discountValue: data.discountValue,
          },
        });

        setTimeout(reset, 4000);
      } catch (err: any) {
        const msg = cleanError(err?.message || String(err));
        setState({ step: "error", error: msg, result: null });
      }
    },
    [state.step]
  );

  return { state, processFile, reset };
}

function cleanError(raw: string): string {
  const s = raw
    .replace(/^\[GoogleGenerativeAI Error\]:\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim();
  if (s.includes("429") || s.toLowerCase().includes("quota"))
    return "Limite temporário da IA atingido. Aguarde ~15s e tente novamente.";
  if (s.toLowerCase().includes("api key not valid"))
    return "Chave de API inválida. Verifique as variáveis de ambiente no Vercel.";
  if (s.includes("Atenção:") || s.includes("Já existe") || s.includes("período"))
    return s;
  return s || "Erro inesperado no processamento.";
}
