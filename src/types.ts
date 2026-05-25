// ─── Entidade principal ───────────────────────────────────────────────────────
export interface UserEntry {
  id: string;
  month: number;
  year: number;
  discountValue: number;
  injectedkWh?: number;
  totalBill?: number;
  pdfBase64?: string;
  pdfName?: string;
  driveFileId?: string;
  driveLink?: string;
  createdAt: any;
  userId: string;
}

// ─── Configurações do usuário ─────────────────────────────────────────────────
export interface UserSettings {
  investmentValue: number;
  userId: string;
  cpf?: string;
  installationDate?: string;
}

// ─── Métricas calculadas (V2) ─────────────────────────────────────────────────
export interface SolarMetrics {
  totalRecovered: number;
  remaining: number;
  profit: number;
  progressPercent: number;
  avgMonthly: number;           // média histórica geral
  avgLast3: number;             // média dos últimos 3 meses
  avgLast12: number;            // média dos últimos 12 meses
  estimatedMonthsSimple: number;
  estimatedMonthsInflation: number; // com 15% a.a. de inflação energética
  payoffDateSimple: Date | null;
  payoffDateInflation: Date | null;
  paybackReached: boolean;
  paybackMonth: number;         // em quantos meses foi atingido (0 se não)
  bestEntry: UserEntry | null;
  worstEntry: UserEntry | null;
  byYear: Record<number, number>;
  monthlyGrowthRate: number;    // % de variação média MoM
  roiPostPayback: number;       // economia mensal estimada após quitação
  entriesWithBalance: EntryWithBalance[];
}

export interface EntryWithBalance extends UserEntry {
  balanceAtTime: number;
  cumulativeAtTime: number;
  vsAvg: "above" | "below" | "first";
}

// ─── Upload ───────────────────────────────────────────────────────────────────
export type UploadStep =
  | "idle"
  | "reading"
  | "sending"
  | "saving"
  | "done"
  | "error";

export interface UploadState {
  step: UploadStep;
  error: string | null;
  result: { month: number; year: number; discountValue: number } | null;
}

// ─── Firebase helpers ─────────────────────────────────────────────────────────
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}
