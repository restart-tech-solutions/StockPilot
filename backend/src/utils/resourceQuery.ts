export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePagination(
  pageValue: unknown,
  limitValue: unknown
): PaginationOptions | null {
  if (
    (pageValue !== undefined && typeof pageValue !== "string") ||
    (limitValue !== undefined && typeof limitValue !== "string")
  ) {
    return null;
  }
  const page = pageValue === undefined ? 1 : Number(pageValue);
  const limit = limitValue === undefined ? 20 : Number(limitValue);

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    return null;
  }

  return { page, limit, skip: (page - 1) * limit };
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}
