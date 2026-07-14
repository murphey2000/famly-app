export const GERMAN_MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export function getGermanMonth(month: number): string {
  return GERMAN_MONTHS[month - 1] || `Monat ${month}`;
}
