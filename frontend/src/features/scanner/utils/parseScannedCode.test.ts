import { describe, it, expect } from 'vitest';
import { parseScannedCode } from './parseScannedCode';

describe('parseScannedCode', () => {
  it('returns local resolution for /tool-view/:id URL', () => {
    expect(parseScannedCode('https://supplyline.test/tool-view/42')).toEqual({
      kind: 'local',
      itemType: 'tool',
      itemId: 42,
    });
  });

  it('returns local resolution for /chemical-view/:id URL', () => {
    expect(parseScannedCode('https://supplyline.test/chemical-view/7')).toEqual({
      kind: 'local',
      itemType: 'chemical',
      itemId: 7,
    });
  });

  it('returns local resolution for /kits/:id URL', () => {
    expect(parseScannedCode('https://supplyline.test/kits/199')).toEqual({
      kind: 'local',
      itemType: 'kit',
      itemId: 199,
    });
  });

  it('accepts path-only URLs without origin', () => {
    expect(parseScannedCode('/tool-view/3')).toEqual({
      kind: 'local',
      itemType: 'tool',
      itemId: 3,
    });
  });

  it('ignores malformed id in URL and returns remote resolution', () => {
    expect(parseScannedCode('/tool-view/not-a-number')).toEqual({
      kind: 'remote',
      code: '/tool-view/not-a-number',
    });
  });

  it('returns remote resolution for CODE128 payloads like TN1234-SN5678', () => {
    expect(parseScannedCode('TN1234-SN5678')).toEqual({
      kind: 'remote',
      code: 'TN1234-SN5678',
    });
  });

  it('returns remote resolution for chemical CODE128 payload with expiration', () => {
    expect(parseScannedCode('PN5555-LOT0001-20260130')).toEqual({
      kind: 'remote',
      code: 'PN5555-LOT0001-20260130',
    });
  });

  it('handles empty input gracefully', () => {
    expect(parseScannedCode('   ')).toEqual({ kind: 'remote', code: '' });
  });

  it('ignores trailing query string in URL', () => {
    expect(parseScannedCode('/tool-view/55?ref=label')).toEqual({
      kind: 'local',
      itemType: 'tool',
      itemId: 55,
    });
  });

  it('handles URL fragments', () => {
    expect(parseScannedCode('/chemical-view/8#details')).toEqual({
      kind: 'local',
      itemType: 'chemical',
      itemId: 8,
    });
  });
});
