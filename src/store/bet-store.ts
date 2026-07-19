import { create } from "zustand";

interface BetState {
  amount: number;
  setAmount: (amount: number) => void;
}

export const useBetStore = create<BetState>((set) => ({
  amount: 10,
  setAmount: (amount) => set({ amount }),
}));
