import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PDFDocument } from "pdf-lib";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ProcessPdfBody {
  base64Data: string;       // PDF em base64 puro (sem prefixo data:...)
  selectedModel?: string;   // ex: "gemini-2.5-flash"
}

interface ExtractedData {
  month: number;
  year: number;
  totalBill: number;
  discountValue: number;
  injectedkWh: number;
  isSolar: boolean;
}

// ─── Helper: otimizar PDF (extrair só 1ª página se > 750KB) ──────────────────

async function optimizePdf(base64Data: string): Promise<string> {
  const buffer = Buffer.from(base64Data, "base64");

  if (buffer.byteLength <= 750 * 1024) {
    return base64Data; // já pequeno o suficiente
  }

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

// ─── Handler principal ────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Só aceita POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Chave da API: NUNCA exposta no frontend ──────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.startsWith("AIzaSy")) {
    console.error("[SOLAI] GEMINI_API_KEY não configurada no ambiente Vercel.");
    return res.status(500).json({
      error: "Serviço de IA não configurado. Contate o administrador.",
    });
  }

  // ── Validação do body ────────────────────────────────────────────────────
  const { base64Data, selectedModel = "gemini-2.5-flash" } =
    req.body as ProcessPdfBody;

  if (!base64Data || typeof base64Data !== "string") {
    return res.status(400).json({ error: "base64Data é obrigatório." });
  }

  // Limite de tamanho: ~5MB em base64
  if (base64Data.length > 5 * 1024 * 1024 * 1.4) {
    return res
      .status(413)
      .json({ error: "Arquivo muito grande. Máximo: 5MB." });
  }

  try {
    // 1. Otimizar PDF (server-side, sem travar o browser)
    const optimizedBase64 = await optimizePdf(base64Data);

    // 2. Inicializar Gemini com a chave segura do servidor
    const ai = new GoogleGenerativeAI(apiKey);
    const modelId = selectedModel.includes("/")
      ? selectedModel.split("/").pop()!
      : selectedModel;
    const model = ai.getGenerativeModel({ model: modelId });

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
  "discountValue": soma de todos os créditos/compensações de energia injetada (itens negativos como "Energia Injetada" ou "Compensação GD") em número float positivo,
  "injectedkWh": quantidade de kWh injetados no mês (0 se não informado),
  "isSolar": true se identificar sistema de geração solar
}

IMPORTANTE:
- Se houver vários itens negativos de crédito, some-os para compor o discountValue.
- discountValue deve ser um número positivo (o valor do desconto, não negativo).
- Retorne APENAS o JSON puro, sem texto adicional, sem blocos de código.
    `.trim();

    // 3. Chamar a API com o PDF
    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: "application/pdf",
          data: optimizedBase64,
        },
      },
    ]);

    const responseText = result.response.text();
    console.log("[SOLAI] Gemini raw response:", responseText.slice(0, 300));

    // 4. Limpar e parsear JSON
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
        error:
          "A IA retornou um formato de dados inválido. Tente novamente com outro arquivo.",
      });
    }

    // 5. Verificar se a IA retornou erro de validação
    if (extracted.error) {
      return res.status(422).json({ error: extracted.error });
    }

    // 6. Validações básicas dos dados extraídos
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
        error:
          "Dados extraídos inválidos. Verifique se o PDF é uma fatura de energia válida.",
      });
    }

    // 7. Retornar dados extraídos (sem a chave, sem o base64 no response)
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
        error:
          "Limite temporário da IA atingido. Aguarde ~15 segundos e tente novamente.",
      });
    }
    if (msg.toLowerCase().includes("api key not valid")) {
      return res.status(401).json({
        error: "Chave de API inválida. Verifique as variáveis de ambiente no Vercel.",
      });
    }
    if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
      return res.status(404).json({
        error: `Modelo "${selectedModel}" não encontrado. Verifique se a API Generative Language está ativada no Google Cloud.`,
      });
    }

    return res.status(500).json({
      error: "Erro interno ao processar o PDF. Tente novamente.",
    });
  }
}
