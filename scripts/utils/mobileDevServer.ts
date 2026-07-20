import { execa, type ResultPromise } from "execa";
import fkill from "fkill";

export async function startMobileDevServer({
  env,
  port,
  workspaceDir,
  signal,
}: {
  env?: NodeJS.ProcessEnv;
  port: number;
  workspaceDir: string;
  signal: AbortSignal;
}): Promise<{ subprocess: ResultPromise }> {
  signal.throwIfAborted();
  const subprocess = execa(
    "pnpm",
    ["--filter", "mobile", "run", "dev", "--port", String(port)],
    {
      cwd: workspaceDir,
      windowsHide: true,
      encoding: "utf8",
      cancelSignal: signal,
      cleanup: true,
      env,
      stdio: "inherit",
    },
  );
  const exitedBeforeReady = subprocess.then(() => {
    throw new Error(
      "Mobile dev server exited before the native app was started",
    );
  });
  const waitController = new AbortController();
  const waitProcess = execa(
    "pnpm",
    [
      "exec",
      "wait-on",
      `tcp:127.0.0.1:${port}`,
      "--interval",
      "250",
      "--tcpTimeout",
      "500",
      "--timeout",
      "120000",
    ],
    {
      cwd: workspaceDir,
      windowsHide: true,
      cancelSignal: AbortSignal.any([signal, waitController.signal]),
      cleanup: true,
      stdio: "inherit",
    },
  );
  try {
    await Promise.race([waitProcess, exitedBeforeReady]);
    if (subprocess.nodeChildProcess.exitCode !== null) await exitedBeforeReady;
    return { subprocess };
  } catch (error) {
    if (subprocess.pid)
      await fkill(subprocess.pid, {
        silent: true,
        force: true,
        tree: true,
      }).catch(() => undefined);
    throw error;
  } finally {
    waitController.abort();
    await Promise.allSettled([waitProcess]);
  }
}
