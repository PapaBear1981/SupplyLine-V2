import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotifications } from './useNotifications';

// Minimal Notification mock reusable across tests.
interface MockNotification {
  title: string;
  options?: NotificationOptions;
  onclick: (() => void) | null;
  close: () => void;
}

describe('useNotifications', () => {
  const originalNotification = (window as unknown as { Notification?: unknown }).Notification;
  let mockInstances: MockNotification[];

  beforeEach(() => {
    mockInstances = [];
    const MockCtor = vi.fn(function (this: MockNotification, title: string, options?: NotificationOptions) {
      this.title = title;
      this.options = options;
      this.onclick = null;
      this.close = vi.fn();
      mockInstances.push(this);
    }) as unknown as typeof Notification;

    // Add the static permission property + requestPermission
    (MockCtor as unknown as { permission: NotificationPermission }).permission = 'default';
    (MockCtor as unknown as { requestPermission: () => Promise<NotificationPermission> })
      .requestPermission = vi.fn().mockResolvedValue('granted');

    (window as unknown as { Notification: typeof Notification }).Notification = MockCtor;
  });

  afterEach(() => {
    if (originalNotification === undefined) {
      delete (window as unknown as { Notification?: unknown }).Notification;
    } else {
      (window as unknown as { Notification: unknown }).Notification = originalNotification;
    }
  });

  it('reports unsupported when Notification API is absent', () => {
    delete (window as unknown as { Notification?: unknown }).Notification;
    const { result } = renderHook(() => useNotifications());
    expect(result.current.isSupported).toBe(false);
    expect(result.current.permission).toBe('unsupported');
  });

  it('starts with default permission when API is available', () => {
    const { result } = renderHook(() => useNotifications());
    expect(result.current.permission).toBe('default');
    expect(result.current.isSupported).toBe(true);
    expect(result.current.isGranted).toBe(false);
  });

  it('calls Notification.requestPermission on requestPermission()', async () => {
    const { result } = renderHook(() => useNotifications());
    let next: string | undefined;
    await act(async () => {
      next = await result.current.requestPermission();
    });
    expect(next).toBe('granted');
    expect(result.current.permission).toBe('granted');
  });

  it('silently no-ops show() when permission is not granted', () => {
    const { result } = renderHook(() => useNotifications());
    const ret = result.current.show({ title: 'Hi' });
    expect(ret).toBeNull();
    expect(mockInstances).toHaveLength(0);
  });

  it('creates a Notification instance when granted', async () => {
    const { result } = renderHook(() => useNotifications());
    await act(async () => {
      await result.current.requestPermission();
    });

    act(() => {
      result.current.show({ title: 'Test', body: 'Hello' });
    });

    expect(mockInstances).toHaveLength(1);
    expect(mockInstances[0].title).toBe('Test');
  });
});
