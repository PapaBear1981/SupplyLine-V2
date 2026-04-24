type ToolAction = 'create' | 'update';

export const getToolActionErrorMessage = (
  err: unknown,
  action: ToolAction
): string => {
  const maybeApiError = err as { data?: { error?: unknown } } | null;
  const apiMessage = maybeApiError?.data?.error;
  if (typeof apiMessage === 'string' && apiMessage.length > 0) {
    return apiMessage;
  }
  return `Failed to ${action} tool`;
};
