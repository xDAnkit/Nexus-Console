import { useDispatch, useSelector } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import type { RootState } from './rootReducer';

// Structural dispatch type (default thunk middleware) — avoids importing the
// store instance from app/, keeping the one-way boundary intact.
export type AppDispatch = ThunkDispatch<RootState, unknown, UnknownAction>;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
