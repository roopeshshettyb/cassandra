export function ensureWithinStayWindow(
  client: any,
  isWithinStay: unknown,
  errorMessage: string,
): boolean {
  if (!isWithinStay) {
    client.emit('error', { code: 'OUTSIDE_STAY', message: errorMessage });
    client.disconnect(true);
    return false;
  }
  return true;
}
