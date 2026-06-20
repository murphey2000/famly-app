import { formatDistanceToNow, format, isToday, isYesterday, parseISO } from "date-fns";
import { de } from "date-fns/locale";

export function formatRelativeDate(dateString: string): string {
  try {
    const date = parseISO(dateString);
    if (isToday(date)) {
      return formatDistanceToNow(date, { addSuffix: true, locale: de });
    }
    if (isYesterday(date)) {
      return "Gestern";
    }
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      return formatDistanceToNow(date, { addSuffix: true, locale: de });
    }
    return format(date, "d. MMMM yyyy", { locale: de });
  } catch {
    return dateString;
  }
}

export function formatMonthYear(dateString: string): string {
  try {
    const date = parseISO(dateString);
    return format(date, "MMMM yyyy", { locale: de });
  } catch {
    return dateString;
  }
}

export function formatFullDate(dateString: string): string {
  try {
    const date = parseISO(dateString);
    return format(date, "d. MMMM yyyy", { locale: de });
  } catch {
    return dateString;
  }
}

export function getYear(dateString: string): number {
  try {
    return parseISO(dateString).getFullYear();
  } catch {
    return new Date().getFullYear();
  }
}

export function getMonthName(dateString: string): string {
  try {
    return format(parseISO(dateString), "MMMM", { locale: de });
  } catch {
    return "";
  }
}
