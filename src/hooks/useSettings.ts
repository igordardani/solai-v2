import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { UserSettings } from "../types";

const DEFAULT_SETTINGS: UserSettings = { investmentValue: 14000, userId: "" };

export function useSettings(userId: string | null) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "users", userId, "settings", "main"));
        if (snap.exists()) {
          setSettings(snap.data() as UserSettings);
        } else {
          const def = { ...DEFAULT_SETTINGS, userId };
          await setDoc(doc(db, "users", userId, "settings", "main"), def);
          setSettings(def);
        }
      } catch (e) {
        console.error("useSettings:", e);
        setSettings({ ...DEFAULT_SETTINGS, userId });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  const saveSettings = async (updates: Partial<UserSettings>) => {
    if (!userId) return;
    const next = { ...settings, ...updates, userId } as UserSettings;
    await setDoc(doc(db, "users", userId, "settings", "main"), next);
    setSettings(next);
  };

  return { settings, loading, saveSettings };
}
