'use client';

import { create } from 'zustand';

export type TaskViewMode = 'list' | 'kanban' | 'calendar';

interface TaskStoreState {
  viewMode: TaskViewMode;
  searchQuery: string;
  selectedTaskIds: string[];
  filterStatus: string;
  filterPriority: string;
  filterCategory: string;
  filterPreset: string; // 'today' | 'thisWeek' | 'overdue' | 'noDate' | ''
}

interface TaskStoreActions {
  setViewMode: (mode: TaskViewMode) => void;
  setSearchQuery: (query: string) => void;
  setSelectedTaskIds: (ids: string[]) => void;
  toggleTaskSelection: (id: string) => void;
  clearSelection: () => void;
  setFilterStatus: (status: string) => void;
  setFilterPriority: (priority: string) => void;
  setFilterCategory: (category: string) => void;
  setFilterPreset: (preset: string) => void;
  clearFilters: () => void;
}

// Load persisted view mode
const getPersistedViewMode = (): TaskViewMode => {
  if (typeof window === 'undefined') return 'list';
  try {
    return (localStorage.getItem('taskViewMode') as TaskViewMode) || 'list';
  } catch {
    return 'list';
  }
};

export const useTaskStore = create<TaskStoreState & TaskStoreActions>((set) => ({
  viewMode: getPersistedViewMode(),
  searchQuery: '',
  selectedTaskIds: [],
  filterStatus: '',
  filterPriority: '',
  filterCategory: '',
  filterPreset: '',

  setViewMode: (mode) => {
    try { localStorage.setItem('taskViewMode', mode); } catch {}
    set({ viewMode: mode });
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  setSelectedTaskIds: (ids) => set({ selectedTaskIds: ids }),

  toggleTaskSelection: (id) =>
    set((state) => ({
      selectedTaskIds: state.selectedTaskIds.includes(id)
        ? state.selectedTaskIds.filter((i) => i !== id)
        : [...state.selectedTaskIds, id],
    })),

  clearSelection: () => set({ selectedTaskIds: [] }),

  setFilterStatus: (status) => set({ filterStatus: status, filterPreset: '' }),
  setFilterPriority: (priority) => set({ filterPriority: priority }),
  setFilterCategory: (category) => set({ filterCategory: category }),
  setFilterPreset: (preset) => set({ filterPreset: preset, filterStatus: '', filterPriority: '', filterCategory: '' }),

  clearFilters: () =>
    set({
      filterStatus: '',
      filterPriority: '',
      filterCategory: '',
      filterPreset: '',
      searchQuery: '',
    }),
}));
