const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Local-time YYYY-MM-DD, never shifted by UTC conversion. */
export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISODate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function isValidISODate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1000 || month < 1 || month > 12 || day < 1) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function addDaysISO(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** Calendar days from `fromISO` to `toISO`; positive when `toISO` is later. */
export function daysBetween(fromISO: string, toISO: string): number {
  const from = parseISODate(fromISO).getTime();
  const to = parseISODate(toISO).getTime();
  return Math.round((to - from) / MS_PER_DAY);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export function formatMonth(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

/** Ascending list of the last `days` dates ending at `endISO`, inclusive. */
export function lastNDays(endISO: string, days: number): string[] {
  const result: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    result.push(addDaysISO(endISO, -offset));
  }
  return result;
}

/** Ascending list of the last `months` month keys ending at the month of `endISO`, inclusive. */
export function lastNMonths(endISO: string, months: number): string[] {
  const [year, month] = endISO.split('-').map(Number);
  const endIndex = year * 12 + (month - 1);
  const result: string[] = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const index = endIndex - offset;
    result.push(`${Math.floor(index / 12)}-${pad((index % 12) + 1)}`);
  }
  return result;
}
