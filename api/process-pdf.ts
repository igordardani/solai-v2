import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PDFDocument } from "pdf-lib";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ProcessPdfBody {
  base64Data: string;
  selectedModel?: string;
}

interface ExtractedData {
  month: number;
  year: number;
  totalBill: number;
  discountValue: number;
  injectedkWh: number;
  isSolar: boolean;
}

// ─── Modelos de fallback (tentados em ordem quando há erro 429) ───────────────

const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

// ─── Helper: otimizar PDF ─────────────────────────────────────────────────────

async function optimizePdf(base64Data: string): Promise<string> {
  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.byteLength <= 750 * 1024) return base64Data;

  try {
    const pdfDoc = await PDFDocument.load(buffer);
    if (pdfDoc.getPageCount() <= 1) return base64Data;

    const newDoc = await PDFDocument.create();
    const [firstPage] = await newDoc.copyPages(pdfDoc, [0]);
    newDoc.addPage(firstPage);

    const optimizedBytes = await newDoc.save();
    const optimizedBase64 = Buffer.from(optimizedBytes).toString("base64");
    console.log(`[SOLAI] PDF otimizado: ${(buffer.byteLength / 1024).toFixed(0)}KB → ${(optimizedBytes.length / 1024).toFixed(0)}KB`);
    return optimizedBase64;
  } catch (err) {
    console.warn("[SOLAI] Falha ao otimizar PDF, usando original:", err);
    return base64Data;
  }
}

// ─── Helper: chamar Gemini com um modelo específico ───────────────────────────

async function callGemini(
  apiKey: string,
  modelId: string,
  prompt: string,
  optimizedBase64: string
): Promise<string> {
  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({ model: modelId });
  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType: "application/pdf", data: optimizedBase64 } },
  ]);
  return result.response.text();
}

// ─── Handler principal ────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.startsWith("AIzaSy")) {
    console.error("[SOLAI] GEMINI_API_KEY não configurada no ambiente Vercel.");
    return res.status(500).json({ error: "Serviço de IA não configurado. Contate o administrador." });
  }

  const { base64Data, selectedModel = "gemini-2.5-flash" } = req.body as ProcessPdfBody;

  if (!base64Data || typeof base64Data !== "string") {
    return res.status(400).json({ error: "base64Data é obrigatório." });
  }

  if (base64Data.length > 5 * 1024 * 1024 * 1.4) {
    return res.status(413).json({ error: "Arquivo muito grande. Máximo: 5MB." });
  }

  try {
    const optimizedBase64 = await optimizePdf(base64Data);

    const prompt = `
Você é um especialista em faturas de energia solar da Energisa Brasil.

Primeiro, verifique se este documento é genuinamente uma fatura/conta de energia elétrica.
Se NÃO for uma conta de energia, retorne EXATAMENTE este JSON:
{ "error": "Esse arquivo não é uma conta de energia." }

Se for uma conta de energia, analise-a e extraia os dados abaixo em JSON puro (sem blocos markdown):

{
  "month": número do mês de referência (1-12),
  "year": número do ano de referência (ex: 2026),
  "totalBill": valor total a pagar da fatura em número float (R$),
  "discountValue": soma de TODOS os valores negativos da coluna "Valor Total (R$)" do demonstrativo, convertidos para número positivo,
  "injectedkWh": quantidade de kWh injetados no mês (0 se não informado),
  "isSolar": true se identificar sistema de geração solar
}

REGRAS PARA discountValue — leia com atenção:
1. Identifique a tabela de itens da fatura (pode se chamar "Demonstrativo", "Itens da Fatura" ou similar).
2. Essa tabela tem várias colunas: a primeira coluna de valor é o valor principal do item (pode se chamar "Valor (R$)", "Valor Total (R$)" ou similar). As colunas seguintes são impostos discriminados (PIS, COFINS, ICMS, etc.) — IGNORE essas colunas de impostos.
3. Some APENAS os valores negativos da coluna PRINCIPAL de valor dos itens, independentemente da descrição (ex: "Energia Injetada", "Compensação GD", "Bônus ITAIPU", "Crédito", etc.).
4. NÃO some valores de colunas de impostos como PIS, COFINS, ICMS mesmo que sejam negativos.
5. O resultado deve ser um número POSITIVO (ex: se os negativos da coluna principal somam -154,11, retorne 154.11).

OUTRAS REGRAS:
- totalBill é o valor efetivamente a pagar (após todos os descontos), geralmente destacado como "Total a Pagar" ou "Valor a Pagar".
- Retorne APENAS o JSON puro, sem texto adicional, sem blocos de código.
    `.trim();

    // ── Fallback automático: tenta selectedModel primeiro, depois os demais ──
    const selectedModelId = selectedModel.includes("/")
      ? selectedModel.split("/").pop()!
      : selectedModel;

    // Monta a fila: modelo escolhido + fallbacks sem repetir
    const queue = [
      selectedModelId,
      ...FALLBACK_MODELS.filter((m) => m !== selectedModelId),
    ];

    let responseText = "";
    let usedModel = "";
    let lastError = "";

    for (const modelId of queue) {
      try {
        console.log(`[SOLAI] Tentando modelo: ${modelId}`);
        responseText = await callGemini(apiKey, modelId, prompt, optimizedBase64);
        usedModel = modelId;
        console.log(`[SOLAI] Sucesso com: ${modelId}`);
        break;
      } catch (err: any) {
        const msg = String(err?.message || err);
        lastError = msg;
        if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
          console.warn(`[SOLAI] Cota esgotada para ${modelId}, tentando próximo...`);
          continue; // tenta o próximo
        }
        if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
          console.warn(`[SOLAI] Modelo não encontrado: ${modelId}, tentando próximo...`);
          continue; // modelo deprecado — tenta o próximo
        }
        throw err; // outro erro — propaga imediatamente
      }
    }

    if (!responseText) {
      return res.status(429).json({
        error: "Limite diário atingido em todos os modelos de IA. Tente novamente amanhã ou ative o faturamento no Google Cloud.",
      });
    }

    console.log(`[SOLAI] Resposta (${usedModel}):`, responseText.slice(0, 300));

    // ── Parsear JSON ─────────────────────────────────────────────────────────
    const cleanJson = responseText
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/gi, "")
      .trim();

    let extracted: ExtractedData & { error?: string };
    try {
      extracted = JSON.parse(cleanJson);
    } catch {
      console.error("[SOLAI] JSON inválido da IA:", cleanJson);
      return res.status(422).json({
        error: "A IA retornou um formato de dados inválido. Tente novamente com outro arquivo.",
      });
    }

    if (extracted.error) {
      return res.status(422).json({ error: extracted.error });
    }

    const month = Number(extracted.month);
    const year = Number(extracted.year);
    const totalBill = Number(extracted.totalBill);
    const discountValue = Number(extracted.discountValue);

    if (
      isNaN(month) || month < 1 || month > 12 ||
      isNaN(year) || year < 2000 || year > 2100 ||
      isNaN(discountValue) || discountValue < 0
    ) {
      return res.status(422).json({
        error: "Dados extraídos inválidos. Verifique se o PDF é uma fatura de energia válida.",
      });
    }

    return res.status(200).json({
      month,
      year,
      totalBill: isNaN(totalBill) ? 0 : totalBill,
      discountValue,
      injectedkWh: Number(extracted.injectedkWh) || 0,
      isSolar: Boolean(extracted.isSolar),
    });

  } catch (err: any) {
    console.error("[SOLAI] Erro no processamento:", err);
    const msg = String(err?.message || err);

    if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
      return res.status(429).json({
        error: "Limite diário atingido em todos os modelos de IA. Tente novamente amanhã ou ative o faturamento no Google Cloud.",
      });
    }
    if (msg.toLowerCase().includes("api key not valid")) {
      return res.status(401).json({
        error: "Chave de API inválida. Verifique as variáveis de ambiente no Vercel.",
      });
    }
    if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
      return res.status(404).json({
        error: `Modelo "${selectedModel}" não encontrado.`,
      });
    }

    return res.status(500).json({
      error: "Erro interno ao processar o PDF. Tente novamente.",
    });
  }
}
