import { create } from 'zustand';

type AuthState = {
  activeBranchId: string | null;
  setActiveBranchId: (id: string | null) => void;
};

const getInitialBranch = () => {
  return localStorage.getItem('avin_active_branch');
};

export const useAuthStore = create<AuthState>((set) => ({
  activeBranchId: getInitialBranch(),
  setActiveBranchId: (id) => set(() => {
    if (id) {
      localStorage.setItem('avin_active_branch', id);
    } else {
      localStorage.removeItem('avin_active_branch');
    }
    return { activeBranchId: id };
  }),
}));
