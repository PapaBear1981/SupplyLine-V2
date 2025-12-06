/* eslint-disable react-refresh/only-export-components */
/**
 * HotkeyContext - Global hotkey management for the application
 * Provides centralized keyboard shortcut handling and help modal display
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { HotkeyDefinition } from '../constants/hotkeys';
import type { HotkeyCallback } from '../hooks/useHotkeys';
import {
  GLOBAL_HOTKEYS as HOTKEY_DEFINITIONS,
  matchesHotkey,
} from '../constants/hotkeys';

// Types for registered hotkeys
interface RegisteredHotkey {
  hotkey: HotkeyDefinition;
  callback: HotkeyCallback;
  scope: string;
}

// Context value interface
interface HotkeyContextValue {
  /** Whether the help modal is visible */
  helpVisible: boolean;
  /** Show the help modal */
  showHelp: () => void;
  /** Hide the help modal */
  hideHelp: () => void;
  /** Toggle the help modal */
  toggleHelp: () => void;
  /** Register a hotkey for a specific scope */
  registerHotkey: (scope: string, hotkey: HotkeyDefinition, callback: HotkeyCallback) => void;
  /** Unregister a hotkey */
  unregisterHotkey: (scope: string, hotkeyId: string) => void;
  /** Unregister all hotkeys for a scope */
  unregisterScope: (scope: string) => void;
  /** Get all registered hotkeys (global + page-specific) */
  getAllHotkeys: () => HotkeyDefinition[];
  /** Whether hotkeys are enabled */
  enabled: boolean;
  /** Enable/disable all hotkeys */
  setEnabled: (enabled: boolean) => void;
  /** Current active scope */
  activeScope: string;
  /** Set the active scope */
  setActiveScope: (scope: string) => void;
}

const HotkeyContext = createContext<HotkeyContextValue | undefined>(undefined);

interface HotkeyProviderProps {
  children: ReactNode;
}

// Route mapping for navigation hotkeys
const ROUTE_MAP: Record<string, string> = {
  'go-to-dashboard': '/dashboard',
  'go-to-tools': '/tools',
  'go-to-tool-checkout': '/tool-checkout',
  'go-to-chemicals': '/chemicals',
  'go-to-kits': '/kits',
  'go-to-orders': '/orders',
  'go-to-requests': '/requests',
  'go-to-reports': '/reports',
  'go-to-settings': '/settings',
};

export function HotkeyProvider({ children }: HotkeyProviderProps) {
  const [helpVisible, setHelpVisible] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [activeScope, setActiveScope] = useState('global');
  const registeredHotkeys = useRef<Map<string, RegisteredHotkey>>(new Map());
  const navigate = useNavigate();
  const location = useLocation();

  // Help modal controls
  const showHelp = useCallback(() => setHelpVisible(true), []);
  const hideHelp = useCallback(() => setHelpVisible(false), []);
  const toggleHelp = useCallback(() => setHelpVisible((prev) => !prev), []);

  // Register a hotkey
  const registerHotkey = useCallback(
    (scope: string, hotkey: HotkeyDefinition, callback: HotkeyCallback) => {
      const key = `${scope}:${hotkey.id}`;
      registeredHotkeys.current.set(key, { hotkey, callback, scope });
    },
    []
  );

  // Unregister a specific hotkey
  const unregisterHotkey = useCallback((scope: string, hotkeyId: string) => {
    const key = `${scope}:${hotkeyId}`;
    registeredHotkeys.current.delete(key);
  }, []);

  // Unregister all hotkeys for a scope
  const unregisterScope = useCallback((scope: string) => {
    const keysToDelete: string[] = [];
    registeredHotkeys.current.forEach((_, key) => {
      if (key.startsWith(`${scope}:`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => registeredHotkeys.current.delete(key));
  }, []);

  // Get all registered hotkeys
  const getAllHotkeys = useCallback((): HotkeyDefinition[] => {
    const hotkeys: HotkeyDefinition[] = Object.values(HOTKEY_DEFINITIONS);

    registeredHotkeys.current.forEach(({ hotkey }) => {
      // Avoid duplicates
      if (!hotkeys.find((h) => h.id === hotkey.id)) {
        hotkeys.push(hotkey);
      }
    });

    return hotkeys;
  }, []);

  // Global keyboard event handler
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if we should ignore inputs (except for certain keys)
      const target = event.target as HTMLElement;
      const tagName = target.tagName?.toUpperCase();
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName) || target.isContentEditable;

      // Help modal hotkeys
      if (matchesHotkey(event, HOTKEY_DEFINITIONS.SHOW_HELP) ||
          matchesHotkey(event, HOTKEY_DEFINITIONS.SHOW_HELP_ALT)) {
        event.preventDefault();
        toggleHelp();
        return;
      }

      // Close modal with Escape
      if (helpVisible && matchesHotkey(event, HOTKEY_DEFINITIONS.CLOSE_MODAL)) {
        hideHelp();
        return;
      }

      // Don't process other hotkeys when help is visible
      if (helpVisible) return;

      // Skip global hotkeys in input fields (except Escape)
      if (isInput && event.key !== 'Escape') {
        return;
      }

      // Check navigation hotkeys
      for (const [hotkeyId, route] of Object.entries(ROUTE_MAP)) {
        const hotkey = Object.values(HOTKEY_DEFINITIONS).find((h) => h.id === hotkeyId);
        if (hotkey && matchesHotkey(event, hotkey)) {
          event.preventDefault();
          if (location.pathname !== route) {
            navigate(route);
          }
          return;
        }
      }

      // Check go back/forward
      if (matchesHotkey(event, HOTKEY_DEFINITIONS.GO_BACK)) {
        event.preventDefault();
        navigate(-1);
        return;
      }

      if (matchesHotkey(event, HOTKEY_DEFINITIONS.GO_FORWARD)) {
        event.preventDefault();
        navigate(1);
        return;
      }

      // Check page-specific hotkeys (registered ones)
      // Priority: active scope > global scope
      const scopes = activeScope !== 'global' ? [activeScope, 'global'] : ['global'];

      for (const scope of scopes) {
        for (const [key, { hotkey, callback }] of registeredHotkeys.current.entries()) {
          if (!key.startsWith(`${scope}:`)) continue;
          if (hotkey.enabled === false) continue;

          if (matchesHotkey(event, hotkey)) {
            if (hotkey.preventDefault !== false) {
              event.preventDefault();
            }
            if (hotkey.stopPropagation) {
              event.stopPropagation();
            }
            callback(event);
            return;
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, helpVisible, activeScope, navigate, location.pathname, toggleHelp, hideHelp]);

  const value: HotkeyContextValue = {
    helpVisible,
    showHelp,
    hideHelp,
    toggleHelp,
    registerHotkey,
    unregisterHotkey,
    unregisterScope,
    getAllHotkeys,
    enabled,
    setEnabled,
    activeScope,
    setActiveScope,
  };

  return (
    <HotkeyContext.Provider value={value}>
      {children}
    </HotkeyContext.Provider>
  );
}

/**
 * Hook to access the hotkey context
 */
export function useHotkeyContext(): HotkeyContextValue {
  const context = useContext(HotkeyContext);
  if (context === undefined) {
    throw new Error('useHotkeyContext must be used within a HotkeyProvider');
  }
  return context;
}

/**
 * Hook to register page-specific hotkeys
 * Automatically cleans up when the component unmounts
 */
export function usePageHotkeys(
  scope: string,
  hotkeys: Array<{ hotkey: HotkeyDefinition; callback: HotkeyCallback }>
): void {
  const { registerHotkey, unregisterScope, setActiveScope } = useHotkeyContext();

  useEffect(() => {
    // Set this as the active scope
    setActiveScope(scope);

    // Register all hotkeys
    hotkeys.forEach(({ hotkey, callback }) => {
      registerHotkey(scope, hotkey, callback);
    });

    // Cleanup on unmount
    return () => {
      unregisterScope(scope);
      setActiveScope('global');
    };
  }, [scope, hotkeys, registerHotkey, unregisterScope, setActiveScope]);
}

export { HotkeyContext };
export type { HotkeyContextValue };
