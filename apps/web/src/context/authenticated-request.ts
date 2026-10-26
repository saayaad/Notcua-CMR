export interface SessionTokenProvider {
  getIdToken(forceRefresh?: boolean): Promise<string>;
}

export async function authenticatedFetch(
  url: string,
  init: RequestInit,
  session: { token: string; user?: SessionTokenProvider | null },
): Promise<Response> {
  const send = (token: string) => {
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  };
  const token = session.user ? await session.user.getIdToken() : session.token;
  const response = await send(token);
  // The server rejects authentication before running a route. Retry only that rejection,
  // preserving the original body and request ID; uncertain/network failures are never retried.
  if (response.status === 401 && session.user && !init.signal?.aborted) {
    const renewed = await session.user.getIdToken(true);
    return send(renewed);
  }
  return response;
}
