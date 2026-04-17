import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  createCrudActions,
  createLoadIngredientsAction,
  createRepositoryCommandRunner
} from '../features/ingredients/ingredientsActions';
import { createEmptySyncSummary, getScopeState } from '../features/ingredients/ingredientsScopeState';
import { getPreferredDataSource, isBackendEnabled } from '../utils/backendConfig';
import { useAuth } from './useAuth';

const IngredientsContext = createContext(null);

export function IngredientsProvider({ children }) {
  const { isAuthenticated, loading: authLoading, storageScope } = useAuth();
  const useApi = isBackendEnabled() && isAuthenticated;
  const initialScopeState = getScopeState(storageScope);
  const [ingredients, setIngredients] = useState(() => (initialScopeState.loaded ? initialScopeState.items : []));
  const [loading, setLoading] = useState(() => authLoading || !initialScopeState.loaded);
  const [error, setError] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [dataSource, setDataSource] = useState(() => (useApi ? getPreferredDataSource() : 'indexeddb'));
  const [syncSummary, setSyncSummary] = useState(() => initialScopeState.syncSummary || createEmptySyncSummary());
  const ingredientsRef = useRef(ingredients);
  const activeSyncCountRef = useRef(0);
  const scopeRef = useRef(storageScope);

  const clearError = useCallback(() => {
    setError('');
  }, []);

  const commitIngredients = useCallback((nextValue, targetScope = scopeRef.current) => {
    const scopeState = getScopeState(targetScope);
    const currentItems = targetScope === scopeRef.current ? ingredientsRef.current : scopeState.items;
    const nextIngredients = typeof nextValue === 'function' ? nextValue(currentItems) : nextValue;

    scopeState.items = nextIngredients;
    scopeState.loaded = true;

    if (targetScope === scopeRef.current) {
      ingredientsRef.current = nextIngredients;
      setIngredients(nextIngredients);
    }
  }, []);

  const commitSyncSummary = useCallback((nextSummary, targetScope = scopeRef.current) => {
    const scopeState = getScopeState(targetScope);
    scopeState.syncSummary = nextSummary;

    if (targetScope === scopeRef.current) {
      setSyncSummary(nextSummary);
    }
  }, []);

  useEffect(() => {
    const nextScopeState = getScopeState(storageScope);
    scopeRef.current = storageScope;
    ingredientsRef.current = nextScopeState.items;
    activeSyncCountRef.current = 0;
    setIngredients(nextScopeState.loaded ? nextScopeState.items : []);
    setLoading(authLoading || !nextScopeState.loaded);
    setError('');
    setIsSyncing(false);
    setDataSource(useApi ? 'api' : 'indexeddb');
    setSyncSummary(nextScopeState.syncSummary || createEmptySyncSummary());
  }, [authLoading, storageScope, useApi]);

  useEffect(() => {
    ingredientsRef.current = ingredients;
  }, [ingredients]);

  const startSync = useCallback(() => {
    activeSyncCountRef.current += 1;
    setIsSyncing(true);
  }, []);

  const finishSync = useCallback(() => {
    activeSyncCountRef.current = Math.max(0, activeSyncCountRef.current - 1);
    setIsSyncing(activeSyncCountRef.current > 0);
  }, []);

  const runRepositoryCommand = useMemo(
    () =>
      createRepositoryCommandRunner({
        useApi,
        setDataSource,
        setError
      }),
    [useApi]
  );

  const loadIngredients = useMemo(
    () =>
      createLoadIngredientsAction({
        authLoading,
        storageScope,
        useApi,
        scopeRef,
        commitIngredients,
        commitSyncSummary,
        runRepositoryCommand,
        setLoading
      }),
    [authLoading, commitIngredients, commitSyncSummary, runRepositoryCommand, storageScope, useApi]
  );

  useEffect(() => {
    if (authLoading) {
      return;
    }

    const scopeState = getScopeState(storageScope);

    if (scopeState.loaded) {
      setLoading(false);
      return;
    }

    loadIngredients().catch(() => {
      setLoading(false);
    });
  }, [authLoading, loadIngredients, storageScope]);

  const { addIngredient, updateIngredient, addIngredients, removeIngredient, findIngredient } = useMemo(
    () =>
      createCrudActions({
        storageScope,
        useApi,
        ingredientsRef,
        commitIngredients,
        commitSyncSummary,
        runRepositoryCommand,
        startSync,
        finishSync
      }),
    [commitIngredients, commitSyncSummary, finishSync, runRepositoryCommand, startSync, storageScope, useApi]
  );

  const value = useMemo(
    () => ({
      ingredients,
      loading,
      isSyncing,
      error,
      dataSource,
      syncSummary,
      clearError,
      loadIngredients,
      addIngredient,
      addIngredients,
      updateIngredient,
      removeIngredient,
      findIngredient
    }),
    [
      addIngredient,
      addIngredients,
      clearError,
      dataSource,
      error,
      findIngredient,
      ingredients,
      isSyncing,
      loadIngredients,
      loading,
      removeIngredient,
      syncSummary,
      updateIngredient
    ]
  );

  return createElement(IngredientsContext.Provider, { value }, children);
}

export function useIngredients() {
  const context = useContext(IngredientsContext);

  if (!context) {
    throw new Error('useIngredients must be used within IngredientsProvider.');
  }

  return context;
}
