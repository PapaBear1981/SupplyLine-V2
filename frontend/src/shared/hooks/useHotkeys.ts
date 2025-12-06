/**
 * useHotkeys - Custom hook for handling keyboard shortcuts
 * Provides a simple API for registering and managing hotkeys
 */

import { useEffect, useCallback, useRef } from 'react';
import type { HotkeyDefinition, Modifier } from '../constants/hotkeys';
import { matchesHotkey } from '../constants/hotkeys';

// Callback type for hotkey handlers
export type HotkeyCallback = (event: KeyboardEvent) => void;

// Options for the useHotkeys hook
export interface UseHotkeysOptions {
  /** Whether the hotkey is enabled (default: true) */
  enabled?: boolean;
  /** Element to attach the listener to (default: document) */
  element?: HTMLElement | Document | null;
  /** Prevent default browser behavior (default: true) */
  preventDefault?: boolean;
  /** Stop event propagation (default: false) */
  stopPropagation?: boolean;
  /** Only trigger when specific element types are NOT focused */
  ignoreInputs?: boolean;
  /** List of element tag names to ignore */
  ignoredTags?: string[];
}

const DEFAULT_OPTIONS: UseHotkeysOptions = {
  enabled: true,
  element: null,
  preventDefault: true,
  stopPropagation: false,
  ignoreInputs: true,
  ignoredTags: ['INPUT', 'TEXTAREA', 'SELECT'],
};

/**
 * Hook to register a single hotkey with a callback
 */
export function useHotkey(
  hotkey: HotkeyDefinition,
  callback: HotkeyCallback,
  options: UseHotkeysOptions = {}
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!opts.enabled || hotkey.enabled === false) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if we should ignore inputs
      if (opts.ignoreInputs) {
        const target = event.target as HTMLElement;
        const tagName = target.tagName?.toUpperCase();

        if (opts.ignoredTags?.includes(tagName)) {
          // Allow Escape key even in inputs
          if (hotkey.key !== 'Escape') {
            return;
          }
        }

        // Check for contenteditable
        if (target.isContentEditable && hotkey.key !== 'Escape') {
          return;
        }
      }

      // Check if the event matches the hotkey
      if (matchesHotkey(event, hotkey)) {
        if (opts.preventDefault || hotkey.preventDefault) {
          event.preventDefault();
        }
        if (opts.stopPropagation || hotkey.stopPropagation) {
          event.stopPropagation();
        }
        callbackRef.current(event);
      }
    };

    const element = opts.element ?? document;
    element.addEventListener('keydown', handleKeyDown as EventListener);

    return () => {
      element.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [hotkey, opts.enabled, opts.preventDefault, opts.stopPropagation, opts.ignoreInputs, opts.ignoredTags, opts.element]);
}

/**
 * Hook to register multiple hotkeys with their callbacks
 */
export function useHotkeys(
  hotkeys: Array<{ hotkey: HotkeyDefinition; callback: HotkeyCallback }>,
  options: UseHotkeysOptions = {}
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const callbacksRef = useRef(hotkeys);

  // Keep callbacks ref up to date
  useEffect(() => {
    callbacksRef.current = hotkeys;
  }, [hotkeys]);

  useEffect(() => {
    if (!opts.enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if we should ignore inputs
      if (opts.ignoreInputs) {
        const target = event.target as HTMLElement;
        const tagName = target.tagName?.toUpperCase();

        if (opts.ignoredTags?.includes(tagName)) {
          // Allow Escape key even in inputs
          const isEscapeKey = callbacksRef.current.some(
            (h) => h.hotkey.key === 'Escape' && matchesHotkey(event, h.hotkey)
          );
          if (!isEscapeKey) {
            return;
          }
        }

        // Check for contenteditable
        if (target.isContentEditable) {
          const isEscapeKey = callbacksRef.current.some(
            (h) => h.hotkey.key === 'Escape' && matchesHotkey(event, h.hotkey)
          );
          if (!isEscapeKey) {
            return;
          }
        }
      }

      // Find matching hotkey
      for (const { hotkey, callback } of callbacksRef.current) {
        if (hotkey.enabled === false) continue;

        if (matchesHotkey(event, hotkey)) {
          if (opts.preventDefault || hotkey.preventDefault) {
            event.preventDefault();
          }
          if (opts.stopPropagation || hotkey.stopPropagation) {
            event.stopPropagation();
          }
          callback(event);
          return; // Only trigger the first matching hotkey
        }
      }
    };

    const element = opts.element ?? document;
    element.addEventListener('keydown', handleKeyDown as EventListener);

    return () => {
      element.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [opts.enabled, opts.preventDefault, opts.stopPropagation, opts.ignoreInputs, opts.ignoredTags, opts.element]);
}

/**
 * Hook for simple hotkey patterns using a string format
 * e.g., 'ctrl+k', 'shift+?', 'escape'
 */
export function useSimpleHotkey(
  keyPattern: string,
  callback: HotkeyCallback,
  options: UseHotkeysOptions = {}
): void {
  const hotkey = useCallback((): HotkeyDefinition => {
    const parts = keyPattern.toLowerCase().split('+');
    const modifiers: Modifier[] = [];
    let key = '';

    for (const part of parts) {
      if (part === 'ctrl' || part === 'control') {
        modifiers.push('ctrl');
      } else if (part === 'alt') {
        modifiers.push('alt');
      } else if (part === 'shift') {
        modifiers.push('shift');
      } else if (part === 'meta' || part === 'cmd' || part === 'command') {
        modifiers.push('meta');
      } else {
        key = part;
      }
    }

    return {
      id: `simple-${keyPattern}`,
      key,
      modifiers,
      description: '',
      category: 'actions',
      preventDefault: options.preventDefault ?? true,
    };
  }, [keyPattern, options.preventDefault])();

  useHotkey(hotkey, callback, options);
}

/**
 * Hook that provides information about whether specific modifier keys are pressed
 */
export function useModifierKeys(): {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
} {
  const modifiersRef = useRef({
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      modifiersRef.current = {
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
      };
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      modifiersRef.current = {
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
      };
    };

    const handleBlur = () => {
      // Reset all modifiers when window loses focus
      modifiersRef.current = {
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
      };
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return modifiersRef.current;
}

export type { HotkeyDefinition, Modifier };
