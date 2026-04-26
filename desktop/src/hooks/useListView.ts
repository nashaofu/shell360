import { useState } from "react";

export type ViewMode = "grid" | "list";

export function useListView(defaultMode: ViewMode = "grid") {
  const [keyword, setKeyword] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(defaultMode);

  return { keyword, setKeyword, viewMode, setViewMode };
}
