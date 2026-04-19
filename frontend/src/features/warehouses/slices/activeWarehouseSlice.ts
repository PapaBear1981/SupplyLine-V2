import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface ActiveWarehouseState {
  id: number | null;
  name: string | null;
}

const STORAGE_KEY = 'active_warehouse';

function readPersisted(): ActiveWarehouseState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { id: null, name: null };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'id' in parsed) {
      return {
        id: typeof parsed.id === 'number' ? parsed.id : null,
        name: typeof parsed.name === 'string' ? parsed.name : null,
      };
    }
  } catch {
    // ignore — fall through to default
  }
  return { id: null, name: null };
}

function writePersisted(state: ActiveWarehouseState) {
  try {
    if (state.id == null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // ignore
  }
}

const initialState: ActiveWarehouseState = readPersisted();

const activeWarehouseSlice = createSlice({
  name: 'activeWarehouse',
  initialState,
  reducers: {
    setActiveWarehouse: (
      state,
      action: PayloadAction<{ id: number | null; name?: string | null }>
    ) => {
      state.id = action.payload.id ?? null;
      state.name = action.payload.name ?? null;
      writePersisted(state);
    },
    clearActiveWarehouse: (state) => {
      state.id = null;
      state.name = null;
      writePersisted(state);
    },
  },
});

export const { setActiveWarehouse, clearActiveWarehouse } =
  activeWarehouseSlice.actions;
export default activeWarehouseSlice.reducer;
