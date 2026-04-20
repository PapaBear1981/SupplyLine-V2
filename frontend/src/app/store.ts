import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '@services/baseApi';
import authReducer from '@features/auth/slices/authSlice';
import activeWarehouseReducer from '@features/warehouses/slices/activeWarehouseSlice';

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
    activeWarehouse: activeWarehouseReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
