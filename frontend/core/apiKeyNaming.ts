// Pure, environment-agnostic helper for deriving an API key's base label.
// Kept out of core/apiKeys.ts (which is `server-only`) so the derivation can be
// unit-tested and reused without pulling in the server-only key client.

/**
 * The base label for a user's key: the local-part of their email (everything
 * before the first `@`), lower-cased and trimmed. The backend appends an
 * incrementing suffix on collision (`alice` → `alice1` → …), so this only
 * needs to be a stable, human-recognisable base. Falls back to `key` for a
 * pathological empty local-part.
 */
export function emailLocalPart(email: string): string {
  const local = (email.split('@')[0] ?? '').trim().toLowerCase();
  return local || 'key';
}
