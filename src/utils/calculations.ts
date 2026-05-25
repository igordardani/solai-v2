import { UserEntry, SolarMetrics, EntryWithBalance } from "../types";

// Taxa de inflação energética anual (~15% a.a. histórico ANEEL)
const ENERGY_INFLATION_ANNUAL = 0.15;
const ENERGY_INFLATION_MONTHLY = Math.pow(1 + ENERGY_INFLATION_ANNUAL, 1 / 12) - 1;

// ─── Utilitários ──────────────────────────────────────────────────────────────

export const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export const formatMonths = (totalMonths: number): string => {
  if (isNaN(totalMonths) || totalMonths <= 0) return "—";
  const years = Math.floor(totalMonths / 12);
  const months = Math.floor(totalMonths % 12);
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? "Ano" : "Anos"}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? "Mês" : "Meses"}`);
  return parts.join(" e ") || "0 Meses";
};

export const monthLabel = (month: number, year: number) =>
  `${String(month).padStart(2, "0")}/${year}`;

// Adiciona N meses a uma data
function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + Math.ceil(months));
  return d;
}

// Formata Date como "Mês/Ano" em pt-BR
export function formatPayoffDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

// ─── Função principal ─────────────────────────────────────────────────────────

export function calculateMetrics(
  rawEntries: UserEntry[],
  investmentValue: number
): SolarMetrics {
  // Ordenar cronologicamente (mais antigo primeiro)
  const entries = [...rawEntries].sort(
    (a, b) => a.year - b.year || a.month - b.month
  );

  const n = entries.length;

  // ── Totais básicos ──────────────────────────────────────────────────────
  const totalRecovered = entries.reduce((s, e) => s + (e.discountValue || 0), 0);
  const remaining = Math.max(0, investmentValue - totalRecovered);
  const profit = Math.max(0, totalRecovered - investmentValue);
  const progressPercent =
    investmentValue > 0 ? Math.min(100, (totalRecovered / investmentValue) * 100) : 0;

  // ── Médias ──────────────────────────────────────────────────────────────
  const avgMonthly = n > 0 ? totalRecovered / n : 0;
  const last3 = entries.slice(-3);
  const last12 = entries.slice(-12);
  const avgLast3 = last3.length > 0
    ? last3.reduce((s, e) => s + e.discountValue, 0) / last3.length
    : 0;
  const avgLast12 = last12.length > 0
    ? last12.reduce((s, e) => s + e.discountValue, 0) / last12.length
    : 0;

  // ── Estimativa simples de payback ───────────────────────────────────────
  const estimatedMonthsSimple = avgMonthly > 0 ? remaining / avgMonthly : 0;
  const payoffDateSimple =
    estimatedMonthsSimple > 0
      ? addMonths(new Date(), estimatedMonthsSimple)
      : null;

  // ── Estimativa com inflação energética (projeção mais realista) ─────────
  // Usa a média dos últimos 3 meses como base de crescimento
  let projAvg = avgLast3 > 0 ? avgLast3 : avgMonthly;
  let projRemaining = remaining;
  let projMonths = 0;
  while (projRemaining > 0 && projMonths < 600) {
    projAvg *= 1 + ENERGY_INFLATION_MONTHLY;
    projRemaining -= projAvg;
    projMonths++;
  }
  const estimatedMonthsInflation = projMonths;
  const payoffDateInflation =
    projMonths > 0 && projMonths < 600
      ? addMonths(new Date(), projMonths)
      : null;

  // ── Payback histórico (se já atingido) ─────────────────────────────────
  let paybackReached = false;
  let paybackMonth = 0;
  let cumCheck = 0;
  for (let i = 0; i < entries.length; i++) {
    cumCheck += entries[i].discountValue;
    if (cumCheck >= investmentValue) {
      paybackReached = true;
      paybackMonth = i + 1;
      break;
    }
  }

  // ── Melhor e pior mês ───────────────────────────────────────────────────
  const bestEntry =
    n > 0
      ? entries.reduce((a, b) => (a.discountValue >= b.discountValue ? a : b))
      : null;
  const worstEntry =
    n > 0
      ? entries.reduce((a, b) => (a.discountValue <= b.discountValue ? a : b))
      : null;

  // ── Por ano ─────────────────────────────────────────────────────────────
  const byYear = entries.reduce<Record<number, number>>((acc, e) => {
    acc[e.year] = (acc[e.year] || 0) + e.discountValue;
    return acc;
  }, {});

  // ── Taxa de crescimento médio MoM ───────────────────────────────────────
  let monthlyGrowthRate = 0;
  if (n >= 3) {
    const rates: number[] = [];
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1].discountValue;
      if (prev > 0) rates.push((entries[i].discountValue - prev) / prev);
    }
    monthlyGrowthRate = rates.length > 0
      ? rates.reduce((s, r) => s + r, 0) / rates.length
      : 0;
  }

  // ── ROI pós-payback ─────────────────────────────────────────────────────
  // Após quitação, a economia mensal vira lucro puro
  const roiPostPayback = avgLast3 > 0 ? avgLast3 : avgMonthly;

  // ── Entradas com saldo e contexto para a tabela ─────────────────────────
  let running = investmentValue;
  let cumulative = 0;
  const entriesWithBalance: EntryWithBalance[] = entries.map((entry, i) => {
    running = Math.max(0, running - entry.discountValue);
    cumulative += entry.discountValue;
    return {
      ...entry,
      balanceAtTime: running,
      cumulativeAtTime: cumulative,
      vsAvg: i === 0
        ? "first"
        : entry.discountValue >= avgMonthly
        ? "above"
        : "below",
    };
  });

  return {
    totalRecovered,
    remaining,
    profit,
    progressPercent,
    avgMonthly,
    avgLast3,
    avgLast12,
    estimatedMonthsSimple,
    estimatedMonthsInflation,
    payoffDateSimple,
    payoffDateInflation,
    paybackReached,
    paybackMonth,
    bestEntry,
    worstEntry,
    byYear,
    monthlyGrowthRate,
    roiPostPayback,
    entriesWithBalance,
  };
}

// ─── Dados para gráficos ──────────────────────────────────────────────────────

export function buildChartData(
  entries: UserEntry[],
  investmentValue: number
) {
  const sorted = [...entries].sort((a, b) => a.year - b.year || a.month - b.month);
  let cumulative = 0;
  return sorted.map((e) => {
    cumulative += e.discountValue;
    return {
      name: monthLabel(e.month, e.year),
      recovered: Math.round(cumulative * 100) / 100,
      monthly: Math.round(e.discountValue * 100) / 100,
      payback: investmentValue,
    };
  });
}

export function buildYearlyChartData(byYear: Record<number, number>) {
  return Object.entries(byYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, total]) => ({
      year,
      total: Math.round(total * 100) / 100,
    }));
}
