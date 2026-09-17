import { create } from 'zustand';
import type { ModuleKey } from '@meera/shared';
import { resolveModules } from '@meera/module-registry';

type SetupState = {
  enabledModules: ModuleKey[];
  industryPacks: string[];
  toggleModule: (key: ModuleKey) => void;
  togglePack: (key: string) => void;
};

const defaults: ModuleKey[] = ['crm', 'projects', 'catalog', 'measurements', 'quotations', 'finance', 'reports'];

export const useSetupStore = create<SetupState>((set) => ({
  enabledModules: resolveModules(defaults),
  industryPacks: ['upvc'],
  toggleModule: (key) => set((state) => {
    const requested = state.enabledModules.includes(key)
      ? state.enabledModules.filter((item) => item !== key)
      : [...state.enabledModules, key];
    return { enabledModules: resolveModules(requested) };
  }),
  togglePack: (key) => set((state) => ({
    industryPacks: state.industryPacks.includes(key)
      ? state.industryPacks.filter((item) => item !== key)
      : [...state.industryPacks, key],
  })),
}));
