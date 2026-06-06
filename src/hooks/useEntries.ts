import { useState, useEffect, useMemo } from "react";
import {
  collection, query, orderBy, onSnapshot,
  addDoc, deleteDoc, setDoc, doc, serverTimestamp,
  getDocs, limit,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { UserEntry } from "../types";
import { calculateMetrics, buildChartData, buildYearlyChartData } from "../utils/calculations";

const SEED_DATA: [number, number, number][] = [
  [2023,7,148.12],[2023,8,145.22],[2023,9,196.52],[2023,10,261.23],[2023,11,289.65],[2023,12,396.43],
  [2024,1,370.94],[2024,2,310.17],[2024,3,359.09],[2024,4,262.80],[2024,5,249.40],[2024,6,185.47],
  [2024,7,157.22],[2024,8,150.60],[2024,9,192.51],[2024,10,279.17],[2024,11,202.45],[2024,12,206.72],
  [2025,1,339.20],[2025,2,230.87],[2025,3,302.59],[2025,4,224.42],[2025,5,152.02],[2025,6,154.32],
  [2025,7,149.27],[2025,8,154.11],[2025,9,200.42],[2025,10,253.86],[2025,11,239.83],[2025,12,272.40],
  [2026,1,332.88],[2026,2,268.18],[2026,3,386.59],[2026,4,349.02],
];

export function useEntries(userId: string | null, investmentValue: number) {
  const [entries, setEntries] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Aguarda userId válido antes de qualquer query.
    // Removida a checagem de auth.currentUser — ela não é reativa e causava
    // saída prematura do effect quando o user chegava antes do currentUser.
    if (!userId) {
      setLoading(false);
      return;
    }

    const seedIfEmpty = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "users", userId, "entries"), limit(1))
        );
        if (!snap.empty) return;
        for (let i = 0; i < SEED_DATA.length; i += 5) {
          await Promise.all(
            SEED_DATA.slice(i, i + 5).map(([year, month, val]) =>
              addDoc(collection(db, "users", userId, "entries"), {
                year, month, discountValue: val, userId,
                createdAt: serverTimestamp(),
              })
            )
          );
        }
      } catch (e) {
        console.warn("Seed ignorado:", e);
      }
    };

    seedIfEmpty();

    const q = query(
      collection(db, "users", userId, "entries"),
      orderBy("year", "asc"),
      orderBy("month", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as UserEntry[]);
        setLoading(false);
      },
      (error) => {
        // Se der erro de permissão, aguarda e tenta novamente em 1s
        // (pode acontecer nos primeiros ms após o login)
        console.warn("onSnapshot erro, tentando novamente:", error.code);
        setTimeout(() => setLoading(false), 1000);
      }
    );

    return unsub;
  }, [userId]);

  const metrics = useMemo(
    () => calculateMetrics(entries, investmentValue),
    [entries, investmentValue]
  );
  const chartData = useMemo(
    () => buildChartData(entries, investmentValue),
    [entries, investmentValue]
  );
  const yearlyChartData = useMemo(
    () => buildYearlyChartData(metrics.byYear),
    [metrics.byYear]
  );

  const addEntry = (data: Omit<UserEntry, "id" | "createdAt">) =>
    addDoc(collection(db, "users", userId!, "entries"), {
      ...data, createdAt: serverTimestamp(),
    });

  const updateEntry = (id: string, data: Partial<UserEntry>) =>
    setDoc(doc(db, "users", userId!, "entries", id), data, { merge: true });

  const deleteEntry = (id: string) =>
    deleteDoc(doc(db, "users", userId!, "entries", id));

  return { entries, loading, metrics, chartData, yearlyChartData, addEntry, updateEntry, deleteEntry };
}
