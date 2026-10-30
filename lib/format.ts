export const money = (n: number) => '₦' + Number(n).toLocaleString('en-NG');

export function rentalDays(start: string, end: string) {
  const ms = new Date(end + 'T12:00:00').getTime() - new Date(start + 'T12:00:00').getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

export function todayISO() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
