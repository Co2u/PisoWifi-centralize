import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseUtcSqliteTimestamp(value: string) {
  const normalizedValue = value.includes("T")
    ? value
    : value.replace(" ", "T");
  const utcValue = normalizedValue.endsWith("Z")
    ? normalizedValue
    : `${normalizedValue}Z`;
  const parsedDate = new Date(utcValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return new Date(value);
  }

  return parsedDate;
}

export function formatUtcSqliteTimestamp(value: string) {
  return parseUtcSqliteTimestamp(value).toLocaleString();
}
