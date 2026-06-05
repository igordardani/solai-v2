import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PDFDocument } from "pdf-lib";
// @ts-ignore — pdf-parse não tem tipos oficiais
import pdfParse from "pdf-parse/lib/pdf-parse.js";

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
  error?: string;
}

// ─── Modelos Gemini (tentados em ordem) ──────────────────────────────────────

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

// ─── Modelos OpenRouter gratuitos (tentados em ordem) ────────────────────────
// Todos suportam texto; escolhidos pela capacidade de leitura/extração de dados

const OPENROUTER_MODELS = [
  "google/gemini-2.0-flash-exp:free",
  "meta-llama/llama-4-maverick:free",
  "deepseek/deepseek-r1-0528:free",
  "qwen/qwen3-235b-a22b:free",
];

// ─── Prompt compartilhado ─────────────────────────────────────────────────────

const PROMPT = `
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

// ─── Helper: otimizar PDF (mantém só 1ª página se muito grande) ──────────────

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
    console.log(
      `[SOLAI] PDF otimizado: ${(buffer.byteLength / 1024).toFixed(0)}KB → ${(optimizedBytes.length / 1024).toFixed(0)}KB`
    );
    return optimizedBase64;
  } catch (err) {
    console.warn("[SOLAI] Falha ao otimizar PDF, usando original:", err);
    return base64Data;
  }
}

// ─── Helper: extrair texto do PDF (para OpenRouter) ──────────────────────────

async function extractPdfText(base64Data: string): Promise<string> {
  const buffer = Buffer.from(base64Data, "base64");
  const data = await pdfParse(buffer);
  const text = data.text?.trim() ?? "";
  if (!text) throw new Error("PDF sem camada de texto extraível.");
  // Limita a ~12.000 chars para não estourar contexto dos modelos gratuitos
  return text.length > 12000 ? text.slice(0, 12000) + "\n[texto truncado]" : text;
}

// ─── Helper: chamar Gemini ────────────────────────────────────────────────────

async function callGemini(
  apiKey: string,
  modelId: string,
  optimizedBase64: string
): Promise<string> {
  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({ model: modelId });
  const result = await model.generateContent([
    { text: PROMPT },
    { inlineData: { mimeType: "application/pdf", data: optimizedBase64 } },
  ]);
  return result.response.text();
}

// ─── Helper: chamar OpenRouter (texto extraído do PDF) ───────────────────────

async function callOpenRouter(
  apiKey: string,
  modelId: string,
  pdfText: string
): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://solai.vercel.app", // identifica seu app no OpenRouter
      "X-Title": "SOLAI",
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `${PROMPT}\n\n---\nTEXTO EXTRAÍDO DA FATURA:\n${pdfText}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();

  // Modelos de raciocínio (DeepSeek R1 etc.) podem retornar reasoning separado
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("OpenRouter não retornou texto.");
  return text;
}

// ─── Helpers: classificar erros ───────────────────────────────────────────────

function isQuotaError(msg: string): boolean {
  return (
    msg.includes("429") ||
    msg.toLowerCase().includes("quota") ||
    msg.toLowerCase().includes("rate limit") ||
    msg.toLowerCase().includes("rate_limit") ||
    msg.toLowerCase().includes("too many requests")
  );
}

function isModelNotFoundError(msg: string): boolean {
  return msg.includes("404") || msg.toLowerCase().includes("not found");
}

function isSkippableError(msg: string): boolean {
  return isQuotaError(msg) || isModelNotFoundError(msg);
}

// ─── Handler principal ────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (!geminiKey || !geminiKey.startsWith("AIzaSy")) {
    console.error("[SOLAI] GEMINI_API_KEY não configurada.");
    return res
      .status(500)
      .json({ error: "Serviço de IA não configurado. Contate o administrador." });
  }

  const { base64Data, selectedModel = "gemini-2.5-flash" } =
    req.body as ProcessPdfBody;

  if (!base64Data || typeof base64Data !== "string") {
    return res.status(400).json({ error: "base64Data é obrigatório." });
  }

  if (base64Data.length > 5 * 1024 * 1024 * 1.4) {
    return res.status(413).json({ error: "Arquivo muito grande. Máximo: 5MB." });
  }

  try {
    const optimizedBase64 = await optimizePdf(base64Data);

    // ── 1. Tenta todos os modelos Gemini ──────────────────────────────────────
    const selectedModelId = selectedModel.includes("/")
      ? selectedModel.split("/").pop()!
      : selectedModel;

    const geminiQueue = [
      selectedModelId,
      ...GEMINI_MODELS.filter((m) => m !== selectedModelId),
    ];

    let responseText = "";
    let usedModel = "";

    for (const modelId of geminiQueue) {
      try {
        console.log(`[SOLAI] Tentando Gemini: ${modelId}`);
        responseText = await callGemini(geminiKey, modelId, optimizedBase64);
        usedModel = `gemini/${modelId}`;
        console.log(`[SOLAI] Sucesso com Gemini: ${modelId}`);
        break;
      } catch (err: any) {
        const msg = String(err?.message || err);
        if (isSkippableError(msg)) {
          console.warn(`[SOLAI] Gemini ${modelId} indisponível: ${msg.slice(0, 80)}`);
          continue;
        }
        throw err;
      }
    }

    // ── 2. Fallback OpenRouter se todos os Gemini falharam ────────────────────
    if (!responseText) {
      if (!openrouterKey) {
        console.warn("[SOLAI] Gemini esgotado e OPENROUTER_API_KEY não configurada.");
        return res.status(429).json({
          error:
            "Limite diário atingido no Gemini. Configure OPENROUTER_API_KEY no Vercel para usar modelos alternativos gratuitos.",
        });
      }

      // Extrai texto do PDF uma única vez para todos os modelos OpenRouter
      let pdfText = "";
      try {
        pdfText = await extractPdfText(optimizedBase64);
        console.log(`[SOLAI] Texto extraído do PDF: ${pdfText.length} chars`);
      } catch (err: any) {
        console.error("[SOLAI] Falha ao extrair texto do PDF:", err.message);
        return res.status(422).json({
          error:
            "Não foi possível ler o texto deste PDF. O arquivo pode ser uma imagem escaneada. Tente fazer upload de uma fatura digital.",
        });
      }

      for (const modelId of OPENROUTER_MODELS) {
        try {
          console.log(`[SOLAI] Tentando OpenRouter: ${modelId}`);
          responseText = await callOpenRouter(openrouterKey, modelId, pdfText);
          usedModel = `openrouter/${modelId}`;
          console.log(`[SOLAI] Sucesso com OpenRouter: ${modelId}`);
          break;
        } catch (err: any) {
          const msg = String(err?.message || err);
          if (isSkippableError(msg)) {
            console.warn(`[SOLAI] OpenRouter ${modelId} indisponível: ${msg.slice(0, 80)}`);
            continue;
          }
          throw err;
        }
      }
    }

    if (!responseText) {
      return res.status(429).json({
        error:
          "Limite diário atingido em todos os modelos de IA disponíveis. Tente novamente amanhã.",
      });
    }

    console.log(`[SOLAI] Resposta (${usedModel}):`, responseText.slice(0, 300));

    // ── Parsear JSON ──────────────────────────────────────────────────────────
    const cleanJson = responseText
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/gi, "")
      .trim();

    let extracted: ExtractedData;
    try {
      extracted = JSON.parse(cleanJson);
    } catch {
      console.error("[SOLAI] JSON inválido da IA:", cleanJson);
      return res.status(422).json({
        error:
          "A IA retornou um formato de dados inválido. Tente novamente com outro arquivo.",
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
      isNaN(month) ||
      month < 1 ||
      month > 12 ||
      isNaN(year) ||
      year < 2000 ||
      year > 2100 ||
      isNaN(discountValue) ||
      discountValue < 0
    ) {
      return res.status(422).json({
        error:
          "Dados extraídos inválidos. Verifique se o PDF é uma fatura de energia válida.",
      });
    }

    return res.status(200).json({
      month,
      year,
      totalBill: isNaN(totalBill) ? 0 : totalBill,
      discountValue,
      injectedkWh: Number(extracted.injectedkWh) || 0,
      isSolar: Boolean(extracted.isSolar),
      _usedModel: usedModel,
    });
  } catch (err: any) {
    console.error("[SOLAI] Erro no processamento:", err);
    const msg = String(err?.message || err);

    if (isQuotaError(msg)) {
      return res.status(429).json({
        error: "Limite diário atingido. Tente novamente amanhã.",
      });
    }
    if (
      msg.toLowerCase().includes("api key not valid") ||
      msg.includes("401")
    ) {
      return res.status(401).json({
        error:
          "Chave de API inválida. Verifique as variáveis de ambiente no Vercel.",
      });
    }

    return res.status(500).json({
      error: "Erro interno ao processar o PDF. Tente novamente.",
    });
  }
}
