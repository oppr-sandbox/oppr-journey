import { type ClassValue, clsx } from "clsx";

// Lightweight cn helper without tailwind-merge dependency
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getPlatformColor(platform?: string): string {
  switch (platform) {
    case "desktop":
      return "border-blue-500";
    case "mobile":
      return "border-green-500";
    case "admin":
      return "border-purple-500";
    default:
      return "border-zinc-300 dark:border-zinc-600";
  }
}
