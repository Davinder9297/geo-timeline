export function extractErrorMessage(err: unknown, defaultMsg: string) {
  if (!err) return defaultMsg;
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>;
    if (obj.error) {
      const e = obj.error;
      if (typeof e === 'string') return e;
      if (typeof e === 'object' && e !== null) {
        const eo = e as Record<string, unknown>;
        if ('message' in eo) {
          const m = eo['message'];
          return Array.isArray(m) ? m.join('; ') : String(m);
        }
      }
    }
    if ('message' in obj) {
      const m = obj.message;
      return Array.isArray(m) ? m.join('; ') : String(m);
    }
  }
  return defaultMsg;
}
