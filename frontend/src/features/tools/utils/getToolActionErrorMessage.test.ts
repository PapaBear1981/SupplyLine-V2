import { describe, it, expect } from 'vitest';
import { getToolActionErrorMessage } from './getToolActionErrorMessage';

describe('getToolActionErrorMessage', () => {
  it('returns the API error message when the backend provides one', () => {
    const err = { status: 400, data: { error: 'Missing required field: warehouse_id' } };
    expect(getToolActionErrorMessage(err, 'create')).toBe(
      'Missing required field: warehouse_id'
    );
  });

  it('falls back to a generic create message when there is no payload', () => {
    expect(getToolActionErrorMessage(new Error('network'), 'create')).toBe(
      'Failed to create tool'
    );
  });

  it('falls back to a generic update message when there is no payload', () => {
    expect(getToolActionErrorMessage(undefined, 'update')).toBe(
      'Failed to update tool'
    );
  });

  it('ignores a non-string error payload', () => {
    const err = { data: { error: 500 } };
    expect(getToolActionErrorMessage(err, 'create')).toBe('Failed to create tool');
  });

  it('ignores an empty string payload', () => {
    const err = { data: { error: '' } };
    expect(getToolActionErrorMessage(err, 'update')).toBe('Failed to update tool');
  });
});
