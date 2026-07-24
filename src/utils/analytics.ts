const SESSION_ID = crypto.randomUUID();

export async function track(
  eventName: string,
  payload: {
    simId?: string;
    course?: string;
    metadata?: Record<string, unknown>;
  } = {}
) {
  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: eventName,
        sim_id: payload.simId,
        course: payload.course,
        session_id: SESSION_ID,
        metadata: payload.metadata,
      }),
    });
  } catch {
    // fire and forget — never throw
  }
}