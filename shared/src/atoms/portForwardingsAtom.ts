import { atom, useAtom } from 'jotai';
import { useMemo, useRef, useEffect } from 'react';
import { SSHPortForwarding } from 'tauri-plugin-ssh';
import { type PortForwarding } from 'tauri-plugin-data';
import {
  resolveJumpHostChain,
  useHosts,
  useKeys,
  type JumpHostChainItem,
  closePortForwarding,
  establishPortForwarding,
} from 'shared';
import { useLatest, useMemoizedFn } from 'ahooks';

export type PortForwardingsAtom = {
  portForwarding: PortForwarding;
  jumpHostChain: JumpHostChainItem[];
  sshPortForwarding: SSHPortForwarding;
  status: 'pending' | 'success' | 'failed';
  error?: unknown;
  isReconnecting?: boolean; // 标记是否正在重连，防止重复重连
};

const portForwardingsAtom = atom<Map<string, PortForwardingsAtom>>(new Map());

export function usePortForwardingsAtomWithApi() {
  const [state, setState] = useAtom(portForwardingsAtom);
  const { data: hosts } = useHosts();
  const { data: keys } = useKeys();

  const stateRef = useLatest(state);

  const hostsMap = useMemo(
    () => new Map(hosts.map((item) => [item.id, item])),
    [hosts]
  );

  const keysMap = useMemo(
    () => new Map(keys.map((key) => [key.id, key])),
    [keys]
  );

  const getState = useMemoizedFn(() => stateRef.current);

  // 使用 ref 来存储重连函数，避免在函数内部引用自身的问题
  const handlePortForwardingReconnectRef = useRef<
    ((portForwardingId: string) => Promise<void>) | undefined
  >(undefined);

  const deletePortForwarding = useMemoizedFn(
    (
      portForwardingId: string
    ): [PortForwardingsAtom | undefined, Map<string, PortForwardingsAtom>] => {
      const newState = new Map(stateRef.current);

      const item = newState.get(portForwardingId);

      newState.delete(portForwardingId);

      setState(newState);
      return [item, newState];
    }
  );

  const updatePortForwarding = useMemoizedFn(
    (
      portForwarding: PortForwardingsAtom
    ): [PortForwardingsAtom | undefined, Map<string, PortForwardingsAtom>] => {
      const newState = new Map(stateRef.current);
      newState.set(portForwarding.portForwarding.id, portForwarding);

      setState(newState);
      return [portForwarding, newState];
    }
  );

  // 处理端口转发断开重连的函数
  const handlePortForwardingReconnect = useMemoizedFn(
    async (portForwardingId: string) => {
      const currentItem = stateRef.current.get(portForwardingId);
      if (!currentItem) {
        return;
      }

      // 如果正在重连，避免重复触发
      if (currentItem.isReconnecting) {
        // eslint-disable-next-line no-console
        console.log('端口转发正在重连中，跳过重复重连请求');
        return;
      }

      // 如果状态不是 success，说明可能正在连接或已经失败，不需要重连
      if (currentItem.status !== 'success') {
        // eslint-disable-next-line no-console
        console.log('端口转发状态不是 success，跳过重连');
        return;
      }

      // 标记正在重连
      const reconnectingItem: PortForwardingsAtom = {
        ...currentItem,
        isReconnecting: true,
        status: 'pending',
      };
      updatePortForwarding(reconnectingItem);

      try {
        // 释放占用的端口
        await closePortForwarding(currentItem);
      } catch (error) {
        // 忽略关闭时的错误，继续重连
        // eslint-disable-next-line no-console
        console.error('关闭端口转发失败:', error);
      }

      // 添加短暂延迟，避免过于频繁的重连
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 重新检查状态，可能在延迟期间被删除或状态改变
      const checkItem = stateRef.current.get(portForwardingId);
      if (!checkItem || checkItem.status !== 'pending' || !checkItem.isReconnecting) {
        // eslint-disable-next-line no-console
        console.log('端口转发状态已改变，取消重连');
        return;
      }

      // 重新创建 jump host chain 和 port forwarding
      const portForwarding = currentItem.portForwarding;
      const newHost = hostsMap.get(portForwarding.hostId);
      if (!newHost) {
        deletePortForwarding(portForwardingId);
        return;
      }

      const newJumpHostChain = resolveJumpHostChain(newHost, {
        hostsMap,
        onDisconnect: () => {
          // 使用 ref 来递归调用重连处理函数
          handlePortForwardingReconnectRef.current?.(portForwardingId);
        },
      });

      const newSshPortForwarding = new SSHPortForwarding({
        session: newJumpHostChain[newJumpHostChain.length - 1].session,
      });

      const updatedItem: PortForwardingsAtom = {
        ...currentItem,
        jumpHostChain: newJumpHostChain,
        sshPortForwarding: newSshPortForwarding,
        status: 'pending',
        error: undefined,
        isReconnecting: true,
      };

      updatePortForwarding(updatedItem);

      // 自动重连
      try {
        await establishPortForwarding(updatedItem, keysMap, (updated) => {
          // 更新状态时保持重连标志，直到成功
          updatePortForwarding(updated);
        });
        // 重连成功后清除重连标志
        const successItem = stateRef.current.get(portForwardingId);
        if (successItem) {
          updatePortForwarding({
            ...successItem,
            isReconnecting: false,
          });
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('自动重连失败:', error);
        const failedItem = stateRef.current.get(portForwardingId);
        if (failedItem) {
          updatePortForwarding({
            ...failedItem,
            status: 'failed',
            error,
            isReconnecting: false,
          });
        }
      }
    }
  );

  // 使用 useEffect 来更新 ref，避免在 render 期间更新
  useEffect(() => {
    handlePortForwardingReconnectRef.current = handlePortForwardingReconnect;
  }, [handlePortForwardingReconnect]);

  const addPortForwarding = useMemoizedFn(
    (
      portForwarding: PortForwarding
    ): [PortForwardingsAtom, Map<string, PortForwardingsAtom>] => {
      const newState = new Map(stateRef.current);

      const host = hostsMap.get(portForwarding.hostId);
      if (!host) {
        throw new Error(`Host ${portForwarding.hostId} not found`);
      }

      const jumpHostChain = resolveJumpHostChain(host, {
        hostsMap,
        onDisconnect: () => {
          // 当连接断开时，自动释放端口并重连
          handlePortForwardingReconnectRef.current?.(portForwarding.id);
        },
      });

      const sshPortForwarding = new SSHPortForwarding({
        session: jumpHostChain[jumpHostChain.length - 1].session,
      });

      const item: PortForwardingsAtom = {
        portForwarding,
        jumpHostChain,
        sshPortForwarding,
        status: 'pending',
        error: undefined,
        isReconnecting: false,
      };

      newState.set(portForwarding.id, item);

      setState(newState);
      return [item, newState];
    }
  );

  return {
    state,
    getState,
    add: addPortForwarding,
    update: updatePortForwarding,
    delete: deletePortForwarding,
  };
}
