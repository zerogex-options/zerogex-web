// A failed API response, as a sentence a member can read.
//
// Shared by the data hooks so they all show the same thing for the same
// failure. Moved here from hooks/useApiData.ts; several hooks were building
// `API error: <status>` themselves, so during the Sunday maintenance
// (core/maintenanceWindow.ts) their panels said "API error: 503" while the
// panels beside them explained the outage.

/**
 * Turn a failed response into a sentence, not a status code.
 *
 * FastAPI's `detail` is where our endpoints put the reason a request could
 * not be served, and several of them are deliberately specific — "there is
 * nothing to compare yet this session" tells a reader what to do, where
 * "API error: 409" tells them only that something broke and invites a
 * support ticket. Falling back to the bare status keeps the old behavior
 * for responses that carry no body.
 */
export async function describeHttpError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    const detail = (body as { detail?: unknown })?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    // 422s from FastAPI's validator carry an array of field errors.
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: unknown };
      if (typeof first?.msg === 'string' && first.msg.trim()) return first.msg;
    }
  } catch {
    // No body, or not JSON — the status is all we have.
  }
  return `API error: ${response.status}`;
}
