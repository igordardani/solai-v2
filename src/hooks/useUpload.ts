import { useState, useCallback } from "react";
import { UploadState, UploadStep } from "../types";

export function useUpload() {
  const [state, setState] = useState<UploadState>({
    step: "idle",
    error: null,
    result: null,
  });

  const setStep = (step: UploadStep, error: string | null = null) =>
    setState((s) => ({ ...s, step, error }));

  const reset = () => setState({ step: "idle", error: null, result: null });

  // Lê o arquivo e retorna base64 puro
  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const processFile = useCallback(
    async (
      file: File,
      selectedModel: string,
      onSuccess: (data: {
        month: number; year: number; totalBill: number;
        discountValue: number; injectedkWh: number;
        base64Data: string; fileName: string;
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

        // Etapa 3 — salvar no Firestore (delegado ao callback)
        setStep("saving");
        await onSuccess({ ...data, base64Data, fileName: file.name });

        // Concluído
        setState({
          step: "done",
          error: null,
          result: {
            month: data.month,
            year: data.year,
            discountValue: data.discountValue,
          },
        });

        // Volta para idle após 4s
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
