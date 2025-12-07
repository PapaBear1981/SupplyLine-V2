/**
 * Label Printing Types
 *
 * Types for the QR code and barcode label printing system.
 * Backend API: /api/barcode/*
 */

/**
 * Available label sizes
 */
export type LabelSize = '4x6' | '3x4' | '2x4' | '2x2';

/**
 * Code types supported for labels
 */
export type CodeType = 'barcode' | 'qrcode';

/**
 * Item types that can have labels printed
 */
export type LabelItemType = 'tool' | 'chemical' | 'expendable' | 'kit-item';

/**
 * Label size configuration from backend
 */
export interface LabelSizeConfig {
  id: LabelSize;
  name: string;
  dimensions: string;
  max_fields: number;
}

/**
 * Response from /api/barcode/label-sizes endpoint
 */
export interface LabelSizesResponse {
  [key: string]: LabelSizeConfig;
}

/**
 * Parameters for printing a label
 */
export interface PrintLabelParams {
  itemId: number;
  labelSize: LabelSize;
  codeType: CodeType;
  kitId?: number; // Required for kit-item type
}

/**
 * Extended parameters for chemical transfer labels
 */
export interface PrintChemicalLabelParams extends PrintLabelParams {
  isTransfer?: boolean;
  parentLotNumber?: string;
  destination?: string;
}

/**
 * Props for LabelPrintModal component
 */
export interface LabelPrintModalProps {
  open: boolean;
  onClose: () => void;
  itemType: LabelItemType;
  itemId: number;
  kitId?: number; // Required for 'kit-item' type
  itemDescription?: string; // Display in modal header
}

/**
 * Print settings stored in localStorage
 */
export interface LabelPrintSettings {
  tools: {
    size: LabelSize;
    codeType: CodeType;
  };
  chemicals: {
    size: LabelSize;
    codeType: CodeType;
  };
  expendables: {
    size: LabelSize;
    codeType: CodeType;
  };
  kitItems: {
    size: LabelSize;
    codeType: CodeType;
  };
}

/**
 * Default print settings
 */
export const DEFAULT_PRINT_SETTINGS: LabelPrintSettings = {
  tools: {
    size: '3x4',
    codeType: 'barcode',
  },
  chemicals: {
    size: '4x6',
    codeType: 'qrcode',
  },
  expendables: {
    size: '2x4',
    codeType: 'barcode',
  },
  kitItems: {
    size: '3x4',
    codeType: 'barcode',
  },
};

/**
 * Label size information with use cases
 */
export const LABEL_SIZE_INFO: Record<LabelSize, {
  dimensions: string;
  name: string;
  description: string;
  useCase: string;
  examples: string;
}> = {
  '4x6': {
    dimensions: '4" × 6"',
    name: 'Full Detail',
    description: 'Standard shipping label size with complete item information',
    useCase: 'Large items, shipping labels',
    examples: 'Tool cages, chemical drums, kit boxes',
  },
  '3x4': {
    dimensions: '3" × 4"',
    name: 'Standard',
    description: 'Most common size for typical inventory items',
    useCase: 'Standard items',
    examples: 'Most tools, standard chemical bottles',
  },
  '2x4': {
    dimensions: '2" × 4"',
    name: 'Compact',
    description: 'Smaller label for compact items',
    useCase: 'Small items',
    examples: 'Hand tools, small bottles, samples',
  },
  '2x2': {
    dimensions: '2" × 2"',
    name: 'Mini',
    description: 'Minimal label with essential identification only',
    useCase: 'Tiny items, quick labeling',
    examples: 'Fasteners, small parts, hardware',
  },
};
