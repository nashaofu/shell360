export function filterByKeyword<T>(
  items: T[],
  keyword: string,
  selectors: Array<(item: T) => string | number | null | undefined>,
) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return items;
  }

  return items.filter((item) =>
    selectors.some((selector) =>
      String(selector(item) ?? "")
        .toLowerCase()
        .includes(normalizedKeyword),
    ),
  );
}
