/**
 * Hotkey system constants and type definitions
 * Provides keyboard shortcuts for power users
 */

// Modifier key constants
export const MODIFIERS = {
  CTRL: 'ctrl',
  ALT: 'alt',
  SHIFT: 'shift',
  META: 'meta', // Command on Mac, Windows key on Windows
} as const;

export type Modifier = (typeof MODIFIERS)[keyof typeof MODIFIERS];

// Hotkey definition interface
export interface HotkeyDefinition {
  /** Unique identifier for the hotkey */
  id: string;
  /** Key code (e.g., 'k', 'n', 'escape', 'enter') */
  key: string;
  /** Modifier keys required */
  modifiers: Modifier[];
  /** Human-readable description */
  description: string;
  /** Category for grouping in help modal */
  category: HotkeyCategory;
  /** Whether the hotkey is enabled */
  enabled?: boolean;
  /** Whether to prevent default browser behavior */
  preventDefault?: boolean;
  /** Whether to stop event propagation */
  stopPropagation?: boolean;
}

// Hotkey categories for organization
export type HotkeyCategory =
  | 'navigation'
  | 'actions'
  | 'modal'
  | 'search'
  | 'editing'
  | 'help';

export const HOTKEY_CATEGORIES: Record<HotkeyCategory, { label: string; order: number }> = {
  navigation: { label: 'Navigation', order: 1 },
  actions: { label: 'Actions', order: 2 },
  search: { label: 'Search', order: 3 },
  editing: { label: 'Editing', order: 4 },
  modal: { label: 'Modals & Dialogs', order: 5 },
  help: { label: 'Help', order: 6 },
};

// Global hotkeys available throughout the application
export const GLOBAL_HOTKEYS: Record<string, HotkeyDefinition> = {
  // Navigation shortcuts
  GO_TO_DASHBOARD: {
    id: 'go-to-dashboard',
    key: 'd',
    modifiers: ['ctrl', 'shift'],
    description: 'Go to Dashboard',
    category: 'navigation',
    preventDefault: true,
  },
  GO_TO_TOOLS: {
    id: 'go-to-tools',
    key: 't',
    modifiers: ['ctrl', 'shift'],
    description: 'Go to Tools',
    category: 'navigation',
    preventDefault: true,
  },
  GO_TO_TOOL_CHECKOUT: {
    id: 'go-to-tool-checkout',
    key: 'o',
    modifiers: ['ctrl', 'shift'],
    description: 'Go to Tool Checkout',
    category: 'navigation',
    preventDefault: true,
  },
  GO_TO_CHEMICALS: {
    id: 'go-to-chemicals',
    key: 'c',
    modifiers: ['ctrl', 'shift'],
    description: 'Go to Chemicals',
    category: 'navigation',
    preventDefault: true,
  },
  GO_TO_KITS: {
    id: 'go-to-kits',
    key: 'k',
    modifiers: ['ctrl', 'shift'],
    description: 'Go to Kits',
    category: 'navigation',
    preventDefault: true,
  },
  GO_TO_ORDERS: {
    id: 'go-to-orders',
    key: 'p',
    modifiers: ['ctrl', 'shift'],
    description: 'Go to Orders',
    category: 'navigation',
    preventDefault: true,
  },
  GO_TO_REQUESTS: {
    id: 'go-to-requests',
    key: 'r',
    modifiers: ['ctrl', 'shift'],
    description: 'Go to Requests',
    category: 'navigation',
    preventDefault: true,
  },
  GO_TO_REPORTS: {
    id: 'go-to-reports',
    key: 'e',
    modifiers: ['ctrl', 'shift'],
    description: 'Go to Reports',
    category: 'navigation',
    preventDefault: true,
  },
  GO_TO_SETTINGS: {
    id: 'go-to-settings',
    key: ',',
    modifiers: ['ctrl'],
    description: 'Go to Settings',
    category: 'navigation',
    preventDefault: true,
  },
  GO_BACK: {
    id: 'go-back',
    key: '[',
    modifiers: ['ctrl'],
    description: 'Go back',
    category: 'navigation',
    preventDefault: true,
  },
  GO_FORWARD: {
    id: 'go-forward',
    key: ']',
    modifiers: ['ctrl'],
    description: 'Go forward',
    category: 'navigation',
    preventDefault: true,
  },

  // Search shortcuts
  GLOBAL_SEARCH: {
    id: 'global-search',
    key: 'k',
    modifiers: ['ctrl'],
    description: 'Open quick search',
    category: 'search',
    preventDefault: true,
  },
  FOCUS_SEARCH: {
    id: 'focus-search',
    key: '/',
    modifiers: [],
    description: 'Focus search field',
    category: 'search',
    preventDefault: true,
  },

  // Action shortcuts
  CREATE_NEW: {
    id: 'create-new',
    key: 'n',
    modifiers: ['ctrl'],
    description: 'Create new item (context-aware)',
    category: 'actions',
    preventDefault: true,
  },
  REFRESH: {
    id: 'refresh',
    key: 'r',
    modifiers: ['ctrl'],
    description: 'Refresh current page data',
    category: 'actions',
    preventDefault: true,
  },
  SAVE: {
    id: 'save',
    key: 's',
    modifiers: ['ctrl'],
    description: 'Save current item',
    category: 'actions',
    preventDefault: true,
  },

  // Modal shortcuts
  CLOSE_MODAL: {
    id: 'close-modal',
    key: 'Escape',
    modifiers: [],
    description: 'Close modal or cancel',
    category: 'modal',
    preventDefault: false,
  },
  CONFIRM_DIALOG: {
    id: 'confirm-dialog',
    key: 'Enter',
    modifiers: ['ctrl'],
    description: 'Confirm dialog',
    category: 'modal',
    preventDefault: true,
  },

  // Help shortcuts
  SHOW_HELP: {
    id: 'show-help',
    key: '?',
    modifiers: ['shift'],
    description: 'Show keyboard shortcuts',
    category: 'help',
    preventDefault: true,
  },
  SHOW_HELP_ALT: {
    id: 'show-help-alt',
    key: 'F1',
    modifiers: [],
    description: 'Show keyboard shortcuts',
    category: 'help',
    preventDefault: true,
  },
};

// Feature-specific hotkey definitions
export const TOOL_CHECKOUT_HOTKEYS: Record<string, HotkeyDefinition> = {
  CHECKOUT_TOOL: {
    id: 'checkout-tool',
    key: 'c',
    modifiers: ['ctrl'],
    description: 'Quick checkout tool',
    category: 'actions',
    preventDefault: true,
  },
  CHECKIN_TOOL: {
    id: 'checkin-tool',
    key: 'i',
    modifiers: ['ctrl'],
    description: 'Quick check-in tool',
    category: 'actions',
    preventDefault: true,
  },
  EMERGENCY_CHECKIN: {
    id: 'emergency-checkin',
    key: 'e',
    modifiers: ['ctrl', 'shift'],
    description: 'Emergency check-in',
    category: 'actions',
    preventDefault: true,
  },
  VIEW_HISTORY: {
    id: 'view-history',
    key: 'h',
    modifiers: ['ctrl'],
    description: 'View checkout history',
    category: 'actions',
    preventDefault: true,
  },
};

export const TOOLS_HOTKEYS: Record<string, HotkeyDefinition> = {
  ADD_TOOL: {
    id: 'add-tool',
    key: 'a',
    modifiers: ['ctrl'],
    description: 'Add new tool',
    category: 'actions',
    preventDefault: true,
  },
  EDIT_TOOL: {
    id: 'edit-tool',
    key: 'e',
    modifiers: [],
    description: 'Edit selected tool',
    category: 'editing',
    preventDefault: true,
  },
  DELETE_TOOL: {
    id: 'delete-tool',
    key: 'Delete',
    modifiers: [],
    description: 'Delete selected tool',
    category: 'editing',
    preventDefault: true,
  },
};

export const CHEMICALS_HOTKEYS: Record<string, HotkeyDefinition> = {
  ADD_CHEMICAL: {
    id: 'add-chemical',
    key: 'a',
    modifiers: ['ctrl'],
    description: 'Add new chemical',
    category: 'actions',
    preventDefault: true,
  },
  ISSUE_CHEMICAL: {
    id: 'issue-chemical',
    key: 'i',
    modifiers: ['ctrl'],
    description: 'Issue chemical',
    category: 'actions',
    preventDefault: true,
  },
  VIEW_ANALYTICS: {
    id: 'view-analytics',
    key: 'g',
    modifiers: ['ctrl'],
    description: 'View analytics',
    category: 'actions',
    preventDefault: true,
  },
};

export const KITS_HOTKEYS: Record<string, HotkeyDefinition> = {
  CREATE_KIT: {
    id: 'create-kit',
    key: 'n',
    modifiers: ['ctrl'],
    description: 'Create new kit',
    category: 'actions',
    preventDefault: true,
  },
  REORDER_KIT: {
    id: 'reorder-kit',
    key: 'r',
    modifiers: ['alt'],
    description: 'Reorder selected kit',
    category: 'actions',
    preventDefault: true,
  },
  TRANSFER_KIT: {
    id: 'transfer-kit',
    key: 't',
    modifiers: ['alt'],
    description: 'Transfer selected kit',
    category: 'actions',
    preventDefault: true,
  },
};

export const ORDERS_HOTKEYS: Record<string, HotkeyDefinition> = {
  CREATE_ORDER: {
    id: 'create-order',
    key: 'n',
    modifiers: ['ctrl'],
    description: 'Create new order',
    category: 'actions',
    preventDefault: true,
  },
  APPROVE_ORDER: {
    id: 'approve-order',
    key: 'a',
    modifiers: ['alt'],
    description: 'Approve selected order',
    category: 'actions',
    preventDefault: true,
  },
};

// Helper function to format hotkey for display
export function formatHotkey(hotkey: HotkeyDefinition): string {
  const parts: string[] = [];

  if (hotkey.modifiers.includes('ctrl')) {
    parts.push('Ctrl');
  }
  if (hotkey.modifiers.includes('alt')) {
    parts.push('Alt');
  }
  if (hotkey.modifiers.includes('shift')) {
    parts.push('Shift');
  }
  if (hotkey.modifiers.includes('meta')) {
    parts.push('⌘');
  }

  // Format the key nicely
  let keyDisplay = hotkey.key;
  if (keyDisplay.length === 1) {
    keyDisplay = keyDisplay.toUpperCase();
  } else if (keyDisplay === 'Escape') {
    keyDisplay = 'Esc';
  }

  parts.push(keyDisplay);

  return parts.join('+');
}

// Helper function to check if a keyboard event matches a hotkey
export function matchesHotkey(event: KeyboardEvent, hotkey: HotkeyDefinition): boolean {
  // Normalize the key for comparison
  const eventKey = event.key.toLowerCase();
  const hotkeyKey = hotkey.key.toLowerCase();

  // Check if key matches
  // Handle special case for '?' which requires shift
  if (hotkeyKey === '?') {
    if (eventKey !== '?' && eventKey !== '/') return false;
  } else if (eventKey !== hotkeyKey) {
    return false;
  }

  // Check modifiers
  const ctrlRequired = hotkey.modifiers.includes('ctrl');
  const altRequired = hotkey.modifiers.includes('alt');
  const shiftRequired = hotkey.modifiers.includes('shift');
  const metaRequired = hotkey.modifiers.includes('meta');

  // Handle '?' key special case - shift is implicit
  const isQuestionMark = hotkeyKey === '?';
  const shiftMatch = isQuestionMark ? true : event.shiftKey === shiftRequired;

  const ctrlMatch = event.ctrlKey === ctrlRequired || event.metaKey === ctrlRequired;
  const altMatch = event.altKey === altRequired;
  const metaMatch = event.metaKey === metaRequired;

  return ctrlMatch && altMatch && shiftMatch && (metaRequired ? metaMatch : true);
}

// Get all hotkeys grouped by category
export function getHotkeysByCategory(
  hotkeys: Record<string, HotkeyDefinition>
): Record<HotkeyCategory, HotkeyDefinition[]> {
  const grouped: Record<HotkeyCategory, HotkeyDefinition[]> = {
    navigation: [],
    actions: [],
    search: [],
    editing: [],
    modal: [],
    help: [],
  };

  Object.values(hotkeys).forEach((hotkey) => {
    if (hotkey.enabled !== false) {
      grouped[hotkey.category].push(hotkey);
    }
  });

  return grouped;
}
