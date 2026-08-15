/**
 * File sizes for receipts and product photos. Rounds up below 1 KB so a small
 * but perfectly valid upload never reads as "0 KB".
 */
export function fileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024) return `${Math.max(1, Math.round(bytes / 1024 || 1))} KB`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
