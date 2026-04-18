import type { ScannerItemType } from '../services/scannerApi';

/**
 * Result of a locally-parsed QR/barcode scan.
 *
 * A `local` resolution means the client already knows the item type + id
 * from the scanned payload alone (QR code that encodes a URL) and can
 * skip the /api/scanner/lookup round-trip.
 *
 * A `remote` resolution means the client doesn't recognize the payload
 * format and should POST it to the backend for disambiguation.
 */
export type ParsedScan =
  | { kind: 'local'; itemType: ScannerItemType; itemId: number }
  | { kind: 'remote'; code: string };

const URL_PATTERNS: Array<{
  regex: RegExp;
  itemType: ScannerItemType;
}> = [
  { regex: /\/tool-view\/(\d+)(?:\?|#|$)/, itemType: 'tool' },
  { regex: /\/chemical-view\/(\d+)(?:\?|#|$)/, itemType: 'chemical' },
  { regex: /\/kits?\/(\d+)(?:\?|#|$)/, itemType: 'kit' },
];

/**
 * Decide how to resolve a scanned QR/barcode payload.
 *
 * Preferred path: the label was printed as a QR code pointing at
 *   {BASE_URL}/tool-view/{id}, {BASE_URL}/chemical-view/{id}, or
 *   {BASE_URL}/kits/{id}
 * — the client parses the URL and navigates directly.
 *
 * Fallback: the label was printed as a 1D CODE128 barcode (e.g.
 * "TN1234-SN5678" or "PN5555-LOT0001-20260130"), which the client
 * sends to /api/scanner/lookup for the backend to disambiguate.
 */
export function parseScannedCode(raw: string): ParsedScan {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { kind: 'remote', code: trimmed };
  }

  // Try each URL pattern — this works even if the QR embeds the full
  // origin (https://…) or just the path (/tool-view/123).
  for (const { regex, itemType } of URL_PATTERNS) {
    const match = trimmed.match(regex);
    if (match) {
      const id = Number(match[1]);
      if (Number.isFinite(id) && id > 0) {
        return { kind: 'local', itemType, itemId: id };
      }
    }
  }

  // Not a recognized URL — fall back to backend lookup using the raw code.
  return { kind: 'remote', code: trimmed };
}
