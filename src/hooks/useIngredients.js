import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  createCrudActions,
  createLoadIngredientsAction,
  createPullAction,
  createPushAction,
  createRepositoryCommandRunner
} from '../features/ingredients/ingredientsActions';
import { createEmptySyncSummary, getScopeState } from '../features/ingredients/ingredientsScopeState';
import { isBackendEnabled } from '../utils/backendConfig';
import { useAuth } from './useAuth';

const IngredientsContext = createContext(null);

export function IngredientsProvider({ children }) {
  const { isAuthenticated, storageScope } = useAuth();
  const backendSyncAvailable = isBackendEnabled() && isAuthenticated;
  const useApi = false;
  const initialScopeState = getScopeState(storageScope);
  const [ingredients, setIngredients] = useState(() => (initialScopeState.loaded ? initialScopeState.items : []));
  const [loading, setLoading] = useState(() => !initialScopeState.loaded);
  const [error, setError] = useState('');
  const [dataSource, setDataSource] = useState('indexeddb');
  const [syncSummary, setSyncSummary] = useState(() => initialScopeState.syncSummary || createEmptySyncSummary());
  const [syncStatus, setSyncStatus] = useState('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState(() => window.localStorage.getItem('fridgemate-last-synced-at'));
  const [syncError, setSyncError] = useState(null);
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);
  const isSyncing = syncStatus === 'syncing';
  const ingredientsRef = useRef(ingredients);
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
    setIngredients(nextScopeState.loaded ? nextScopeState.items : []);
    setLoading(!nextScopeState.loaded);
    setError('');
    setDataSource('indexeddb');
    setSyncSummary(nextScopeState.syncSummary || createEmptySyncSummary());
    setSyncStatus('idle');
    setSyncError(null);
    setHasUnsyncedChanges(false);
    setLastSyncedAt(window.localStorage.getItem('fridgemate-last-synced-at'));
  }, [storageScope]);

  useEffect(() => {
    ingredientsRef.current = ingredients;
  }, [ingredients]);

  const runRepositoryCommand = useMemo(
    () =>
      createRepositoryCommandRunner({
        useApi,
        setDataSource,
        setError
      }),
    [useApi]
  );

  const markDirty = useCallback(() => {
    setSyncStatus('dirty');
    setHasUnsyncedChanges(true);
    setSyncError(null);
  }, []);

  const loadIngredients = useMemo(
    () =>
      createLoadIngredientsAction({
        storageScope,
        useApi,
        syncEnabled: backendSyncAvailable,
        scopeRef,
        commitIngredients,
        commitSyncSummary,
        runRepositoryCommand,
        setLoading,
        setHasUnsyncedChanges,
        setSyncStatus
      }),
    [backendSyncAvailable, commitIngredients, commitSyncSummary, runRepositoryCommand, storageScope, useApi]
  );

  useEffect(() => {
    const scopeState = getScopeState(storageScope);

    if (scopeState.loaded) {
      setLoading(false);
      return;
    }

    loadIngredients().catch(() => {
      setLoading(false);
    });
  }, [loadIngredients, storageScope]);

  const { addIngredient, updateIngredient, addIngredients, removeIngredient, findIngredient } = useMemo(
    () =>
      createCrudActions({
        storageScope,
        syncEnabled: backendSyncAvailable,
        ingredientsRef,
        commitIngredients,
        commitSyncSummary,
        runRepositoryCommand,
        markDirty
      }),
    [backendSyncAvailable, commitIngredients, commitSyncSummary, markDirty, runRepositoryCommand, storageScope]
  );

  const pushIngredientsToServer = useMemo(
    () =>
      createPushAction({
        isAuthenticated: backendSyncAvailable,
        storageScope,
        commitIngredients,
        commitSyncSummary,
        setSyncStatus,
        setHasUnsyncedChanges,
        setLastSyncedAt,
        setSyncError,
        setError
      }),
    [backendSyncAvailable, commitIngredients, commitSyncSummary, storageScope]
  );

  const pullIngredientsFromServer = useMemo(
    () =>
      createPullAction({
        isAuthenticated: backendSyncAvailable,
        storageScope,
        commitIngredients,
        commitSyncSummary,
        setSyncStatus,
        setHasUnsyncedChanges,
        setSyncError,
        setError
      }),
    [backendSyncAvailable, commitIngredients, commitSyncSummary, storageScope]
  );

  const value = useMemo(
    () => ({
      ingredients,
      loading,
      isSyncing,
      error,
      dataSource,
      syncSummary,
      syncStatus,
      lastSyncedAt,
      syncError,
      hasUnsyncedChanges,
      clearError,
      markIngredientsDirty: markDirty,
      loadIngredients,
      syncIngredientsToServer: pushIngredientsToServer,
      pushIngredientsToServer,
      pullIngredientsFromServer,
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
      hasUnsyncedChanges,
      ingredients,
      isSyncing,
      lastSyncedAt,
      loadIngredients,
      loading,
      markDirty,
      pullIngredientsFromServer,
      pushIngredientsToServer,
      removeIngredient,
      syncError,
      syncSummary,
      syncStatus,
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
