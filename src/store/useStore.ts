import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ChatMsg,
  Connectors,
  MealPlan,
  RecoveryEntry,
  SubscriptionTier,
  TrainingPlan,
  UserAccount,
  UserProfile,
  WorkoutLog,
} from '../types';

export type Tab = 'home' | 'workout' | 'coach' | 'plan' | 'meals' | 'recovery' | 'profile';

const uid = () => Math.random().toString(36).slice(2, 12);

export async function hashPassword(pw: string): Promise<string> {
  const subtle = (globalThis as any).crypto?.subtle;
  if (subtle) {
    const buf = await subtle.digest('SHA-256', new TextEncoder().encode(`ypt-salt::${pw}`));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // fallback (non-cryptographic) for environments without WebCrypto
  let h = 5381;
  for (const c of `ypt-salt::${pw}`) h = (h * 33) ^ c.charCodeAt(0);
  return `djb2_${(h >>> 0).toString(16)}`;
}

interface PerUserData {
  logs: WorkoutLog[];
  plan: TrainingPlan | null;
  mealPlan: MealPlan | null;
  recovery: RecoveryEntry[];
  chat: ChatMsg[];
  connectors: Connectors;
}

const emptyUserData = (): PerUserData => ({
  logs: [],
  plan: null,
  mealPlan: null,
  recovery: [],
  chat: [],
  connectors: { appleHealth: false, googleFit: false, fitbit: false, garmin: false, lastSync: null },
});

interface AppState {
  accounts: UserAccount[];
  currentEmail: string | null;
  userData: Record<string, PerUserData>;
  tab: Tab;
  settings: { voiceEnabled: boolean; claudeApiKey: string; demoMode: boolean };
  hydrated: boolean;

  // derived helpers
  currentUser: () => UserAccount | null;
  data: () => PerUserData;

  // actions
  setTab: (t: Tab) => void;
  signUp: (name: string, email: string, password: string, profile: UserProfile) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => void;
  updateProfile: (p: Partial<UserProfile>) => void;
  setSubscription: (tier: SubscriptionTier) => void;
  setSettings: (s: Partial<AppState['settings']>) => void;

  addWorkoutLog: (log: WorkoutLog) => void;
  setPlan: (p: TrainingPlan) => void;
  setMealPlan: (m: MealPlan) => void;
  addRecovery: (entries: RecoveryEntry[]) => void;
  addChat: (msg: ChatMsg) => void;
  setConnector: (key: keyof Connectors, on: boolean) => void;
  markSynced: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      accounts: [],
      currentEmail: null,
      userData: {},
      tab: 'home',
      settings: { voiceEnabled: true, claudeApiKey: '', demoMode: true },
      hydrated: false,

      currentUser: () => {
        const { accounts, currentEmail } = get();
        return accounts.find((a) => a.email === currentEmail) ?? null;
      },
      data: () => {
        const { userData, currentEmail } = get();
        return (currentEmail && userData[currentEmail]) || emptyUserData();
      },

      setTab: (t) => set({ tab: t }),

      signUp: async (name, email, password, profile) => {
        const e = email.trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return 'Please enter a valid email address.';
        if (password.length < 6) return 'Password must be at least 6 characters.';
        if (get().accounts.some((a) => a.email === e)) return 'An account with this email already exists.';
        const passwordHash = await hashPassword(password);
        const account: UserAccount = {
          id: uid(),
          name: name.trim() || 'Athlete',
          email: e,
          passwordHash,
          createdAt: new Date().toISOString(),
          profile,
          subscription: { tier: 'free', renewsAt: null },
        };
        set((s) => ({
          accounts: [...s.accounts, account],
          currentEmail: e,
          userData: { ...s.userData, [e]: emptyUserData() },
        }));
        return null;
      },

      signIn: async (email, password) => {
        const e = email.trim().toLowerCase();
        const acc = get().accounts.find((a) => a.email === e);
        if (!acc) return 'No account found with this email.';
        const hash = await hashPassword(password);
        if (hash !== acc.passwordHash) return 'Incorrect password.';
        set({ currentEmail: e });
        return null;
      },

      signOut: () => set({ currentEmail: null, tab: 'home' }),

      updateProfile: (p) =>
        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.email === s.currentEmail ? { ...a, profile: { ...a.profile, ...p } } : a,
          ),
        })),

      setSubscription: (tier) =>
        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.email === s.currentEmail
              ? {
                  ...a,
                  subscription: {
                    tier,
                    renewsAt: tier === 'free' ? null : new Date(Date.now() + 30 * 864e5).toISOString(),
                  },
                }
              : a,
          ),
        })),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      addWorkoutLog: (log) =>
        set((s) => {
          const e = s.currentEmail!;
          const d = s.userData[e] ?? emptyUserData();
          return { userData: { ...s.userData, [e]: { ...d, logs: [...d.logs, log] } } };
        }),

      setPlan: (plan) =>
        set((s) => {
          const e = s.currentEmail!;
          const d = s.userData[e] ?? emptyUserData();
          return { userData: { ...s.userData, [e]: { ...d, plan } } };
        }),

      setMealPlan: (mealPlan) =>
        set((s) => {
          const e = s.currentEmail!;
          const d = s.userData[e] ?? emptyUserData();
          return { userData: { ...s.userData, [e]: { ...d, mealPlan } } };
        }),

      addRecovery: (entries) =>
        set((s) => {
          const e = s.currentEmail!;
          const d = s.userData[e] ?? emptyUserData();
          const byDate = new Map(d.recovery.map((r) => [r.date, r]));
          for (const en of entries) byDate.set(en.date, en);
          const merged = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
          return { userData: { ...s.userData, [e]: { ...d, recovery: merged } } };
        }),

      addChat: (msg) =>
        set((s) => {
          const e = s.currentEmail!;
          const d = s.userData[e] ?? emptyUserData();
          return { userData: { ...s.userData, [e]: { ...d, chat: [...d.chat, msg].slice(-200) } } };
        }),

      setConnector: (key, on) =>
        set((s) => {
          const e = s.currentEmail!;
          const d = s.userData[e] ?? emptyUserData();
          return {
            userData: {
              ...s.userData,
              [e]: {
                ...d,
                connectors: { ...d.connectors, [key]: on, lastSync: on ? new Date().toISOString() : d.connectors.lastSync },
              },
            },
          };
        }),

      markSynced: () =>
        set((s) => {
          const e = s.currentEmail!;
          const d = s.userData[e] ?? emptyUserData();
          return {
            userData: {
              ...s.userData,
              [e]: {
                ...d,
                logs: d.logs.map((l) => ({ ...l, synced: true })),
                connectors: { ...d.connectors, lastSync: new Date().toISOString() },
              },
            },
          };
        }),
    }),
    {
      name: 'your-personal-trainer',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state && useStore.setState({ hydrated: true });
      },
    },
  ),
);

// mark hydrated even if nothing was stored yet
setTimeout(() => {
  if (!useStore.getState().hydrated) useStore.setState({ hydrated: true });
}, 800);
