import { useCallback, useEffect, useState } from "react";
import {
  type KnownHost,
  parseKnownHosts,
  removeKnownHostLine,
} from "@/utils/knownHosts";

type UseKnownHostsStoreOptions = {
  readText: () => Promise<string>;
  writeText: (data: string) => Promise<void>;
};

export function useKnownHostsStore({
  readText,
  writeText,
}: UseKnownHostsStoreOptions) {
  const [items, setItems] = useState<KnownHost[]>([]);
  const [error, setError] = useState<unknown>();

  const refresh = useCallback(async () => {
    try {
      const data = await readText();
      const knownHosts = parseKnownHosts(data);
      setItems(knownHosts);
      setError(undefined);
      return knownHosts;
    } catch (err) {
      setError(err);
      setItems([]);
      return [];
    }
  }, [readText]);

  const remove = useCallback(
    async (knownHost: KnownHost) => {
      const data = await readText();
      const nextData = removeKnownHostLine(data, knownHost);
      await writeText(nextData);

      const nextItems = parseKnownHosts(nextData);
      setItems(nextItems);
      return nextItems;
    },
    [readText, writeText],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    error,
    items,
    refresh,
    remove,
  };
}
