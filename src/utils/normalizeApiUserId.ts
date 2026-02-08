export function normalizeApiUserId(input: unknown): string | null {
  if (!input) return null;
  if (typeof input === "string") {
    const v = input.trim();
    return v.length ? v : null;
  }

  // Common shapes we may accidentally pass around
  if (typeof input === "object") {
    const anyInput = input as any;
    const candidate =
      anyInput.api_user_id ??
      anyInput.apiUserId ??
      anyInput.api_user?.id ??
      anyInput.user_id;

    if (typeof candidate === "string") {
      const v = candidate.trim();
      return v.length ? v : null;
    }
  }

  return null;
}
