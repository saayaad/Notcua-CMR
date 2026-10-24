import { API_BASE } from '../config';
import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useApi, errorMessage } from '../context/ApiContext';
import type { Library, Session } from '../types';
import { usePreferences } from '../context/PreferencesContext';

export function useWorkspace() {
  const { request, token, notify } = useApi();
  const { preferences } = usePreferences();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [revision, setRevision] = useState(0);
  const [library, setLibrary] = useState<Library>({ assets: [], funnels: [], macros: [], pixKeys: [] });
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  const loadLibrary = useCallback(async () => {
    setLibrary(await request<Library>('/attendance/library'));
  }, [request]);
  const loadSessions = useCallback(async () => {
    const data = await request<{ items: Session[] }>('/whatsapp/sessions');
    setSessions(data.items);
    setSessionId((current) =>
      data.items.some((item) => item.id === current)
        ? current
        : (data.items.find((item) => item.status === 'CONNECTED')?.id ?? data.items[0]?.id ?? ''),
    );
  }, [request]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([loadSessions(), loadLibrary()])
      .catch((error) => {
        if (active) notify(errorMessage(error), true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadSessions, loadLibrary, notify]);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const socket = io(API_BASE || undefined, { auth: { token }, reconnectionAttempts: 8 });
    socket.on('whatsapp:state', (state: Session) =>
      setSessions((current) =>
        current.some((item) => item.id === state.id)
          ? current.map((item) => (item.id === state.id ? state : item))
          : [...current, state],
      ),
    );
    socket.on('whatsapp:sync', (event: { kind: string }) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(refresh, 300);
      if (
        preferences.desktopNotifications &&
        document.hidden &&
        event.kind === 'messages' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      )
        new Notification('Noctua', {
          body: 'Há atualizações no seu atendimento.',
          tag: 'noctua-atendimento',
        });
    });
    socket.on('whatsapp:error', (event: { message: string; sessionId: string }) => {
      if (event.sessionId === sessionId) notify(event.message, true);
    });
    socket.on('connect_error', () =>
      notify('Atualização em tempo real indisponível. Confira o servidor e o token de acesso.', true),
    );
    return () => {
      if (timeout) clearTimeout(timeout);
      socket.disconnect();
    };
  }, [token, sessionId, refresh, notify, preferences.desktopNotifications]);
  return {
    sessions,
    sessionId,
    setSessionId,
    session: sessions.find((s) => s.id === sessionId),
    revision,
    refresh,
    library,
    loadLibrary,
    loadSessions,
    loading,
  };
}
