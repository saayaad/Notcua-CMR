export interface SendWindow {
  timezone: string;
  days: number[];
  start: string;
  end: string;
}

const weekdayIndex: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};
const formatters = new Map<string, Intl.DateTimeFormat>();

export function validTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

function formatter(timezone: string) {
  let value = formatters.get(timezone);
  if (!value) {
    value = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    formatters.set(timezone, value);
  }
  return value;
}

export function isInsideSendWindow(window: SendWindow, at: Date) {
  const parts = Object.fromEntries(formatter(window.timezone).formatToParts(at)
    .map((part) => [part.type, part.value]));
  const day = weekdayIndex[parts.weekday ?? ''];
  if (day === undefined || !window.days.includes(day)) return false;
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  const [startHour, startMinute] = window.start.split(':').map(Number);
  const [endHour, endMinute] = window.end.split(':').map(Number);
  return minute >= startHour! * 60 + startMinute! && minute < endHour! * 60 + endMinute!;
}

export function nextSendWindowAt(window: SendWindow, at: Date) {
  if (isInsideSendWindow(window, at)) return at;
  const minute = 60_000;
  let candidate = new Date(Math.ceil(at.getTime() / minute) * minute);
  for (let i = 0; i < 8 * 24 * 60; i++) {
    if (isInsideSendWindow(window, candidate)) return candidate;
    candidate = new Date(candidate.getTime() + minute);
  }
  throw new Error('Nenhum horário permitido encontrado nos próximos oito dias.');
}
