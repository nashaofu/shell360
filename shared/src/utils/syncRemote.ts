export interface SyncRecordCounts {
  hostCount: number;
  keyCount: number;
  portForwardingCount: number;
}

export interface SyncKdfParams {
  algorithm: string;
  salt: string;
  memoryCost: number;
  timeCost: number;
  parallelism: number;
}

export interface RemoteSnapshotMeta {
  snapshotVersion: string;
  baseSnapshotVersion?: string;
  schemaVersion: string;
  createdAt: string;
  createdByDeviceId: string;
  cipherSuite: string;
  payloadSize: number;
  payloadSha256: string;
  recordCounts: SyncRecordCounts;
}

export interface EncryptedSyncEnvelope {
  snapshotVersion: string;
  schemaVersion: string;
  cipherSuite: string;
  kdf: SyncKdfParams;
  nonce: string;
  ciphertext: string;
  payloadSha256: string;
}

export interface SyncApiErrorBody {
  code?: string;
  message: string;
  retryable?: boolean;
  requestId?: string;
  latest?: Partial<RemoteSnapshotMeta>;
}

export interface SyncApiConfig {
  baseUrl: string;
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
  getRefreshToken?: () => string | undefined | Promise<string | undefined>;
  getDeviceId?: () => string | undefined | Promise<string | undefined>;
  onAuthRefresh?: (response: SyncRefreshResponse) => void | Promise<void>;
  onAuthExpired?: (error: SyncRemoteApiError) => void | Promise<void>;
  fetchImpl?: typeof fetch;
}

export interface SyncLoginRequest {
  loginId: string;
  credential: string;
  deviceName: string;
  platform: string;
  appVersion: string;
}

export interface SyncLoginResponse {
  accountId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface SyncRefreshRequest {
  refreshToken: string;
}

export interface SyncRefreshResponse {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
}

export interface SyncRegisterDeviceRequest {
  deviceId: string;
  deviceName: string;
  platform: string;
  appVersion: string;
  deviceFingerprint?: string;
}

export interface SyncRegisterDeviceResponse {
  deviceId: string;
  registeredAt?: string;
}

export interface SyncSnapshotHeadResponse {
  head?: RemoteSnapshotMeta;
}

export interface SyncSnapshotResponse {
  meta: RemoteSnapshotMeta;
  envelope: EncryptedSyncEnvelope;
}

export interface SyncSnapshotHistoryResponse {
  items: RemoteSnapshotMeta[];
  page?: number;
  pageSize?: number;
  total?: number;
  hasMore?: boolean;
}

export interface SyncSnapshotUploadRequest {
  requestId: string;
  baseSnapshotVersion?: string;
  meta: RemoteSnapshotMeta;
  envelope: EncryptedSyncEnvelope;
}

export interface SyncSnapshotUploadResponse {
  accepted: boolean;
  head: {
    snapshotVersion: string;
  };
}

export interface SyncSnapshotRestoreRequest {
  requestId: string;
  snapshotVersion: string;
  restoredAt: string;
}

export interface SyncSnapshotRestoreResponse {
  accepted: boolean;
}

export class SyncRemoteApiError extends Error {
  code?: string;
  retryable?: boolean;
  requestId?: string;
  status: number;
  latest?: Partial<RemoteSnapshotMeta>;

  constructor(status: number, body: SyncApiErrorBody) {
    super(body.message);
    this.name = "SyncRemoteApiError";
    this.status = status;
    this.code = body.code;
    this.retryable = body.retryable;
    this.requestId = body.requestId;
    this.latest = body.latest;
  }
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

async function resolveOptional(
  value?: () => string | undefined | Promise<string | undefined>,
) {
  if (!value) {
    return undefined;
  }

  return value();
}

async function parseError(response: Response): Promise<SyncRemoteApiError> {
  try {
    const body = (await response.json()) as SyncApiErrorBody;
    return new SyncRemoteApiError(response.status, body);
  } catch {
    return new SyncRemoteApiError(response.status, {
      message: response.statusText || "Sync remote request failed",
    });
  }
}

export function createSyncRemoteClient(config: SyncApiConfig) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const fetchImpl = config.fetchImpl ?? fetch;
  let refreshPromise: Promise<SyncRefreshResponse | undefined> | undefined;

  async function performRefresh() {
    const refreshToken = await resolveOptional(config.getRefreshToken);

    if (!refreshToken) {
      return undefined;
    }

    return request<SyncRefreshResponse>(
      "/v1/sync/auth/refresh",
      {
        method: "POST",
        body: JSON.stringify({
          refreshToken,
        } satisfies SyncRefreshRequest),
      },
      {
        includeAuth: false,
        includeDeviceId: false,
        skipAutoRefresh: true,
      },
    );
  }

  async function refreshAccessToken() {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        const response = await performRefresh();

        if (response) {
          await config.onAuthRefresh?.(response);
        }

        return response;
      })().finally(() => {
        refreshPromise = undefined;
      });
    }

    return refreshPromise;
  }

  async function request<T>(
    path: string,
    init?: RequestInit,
    options?: {
      includeAuth?: boolean;
      includeDeviceId?: boolean;
      accessTokenOverride?: string;
      skipAutoRefresh?: boolean;
    },
  ): Promise<T> {
    const headers = new Headers(init?.headers);

    if (!headers.has("Content-Type") && init?.body) {
      headers.set("Content-Type", "application/json");
    }

    if (options?.includeAuth !== false) {
      const accessToken =
        options?.accessTokenOverride ??
        (await resolveOptional(config.getAccessToken));
      if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`);
      }
    }

    if (options?.includeDeviceId !== false) {
      const deviceId = await resolveOptional(config.getDeviceId);
      if (deviceId) {
        headers.set("X-Device-Id", deviceId);
      }
    }

    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const error = await parseError(response);

      if (
        !options?.skipAutoRefresh &&
        options?.includeAuth !== false &&
        error.status === 401
      ) {
        try {
          const refreshResponse = await refreshAccessToken();

          if (refreshResponse?.accessToken) {
            return request<T>(path, init, {
              ...options,
              accessTokenOverride: refreshResponse.accessToken,
              skipAutoRefresh: true,
            });
          }
        } catch (refreshError) {
          const authError =
            refreshError instanceof SyncRemoteApiError ? refreshError : error;
          await config.onAuthExpired?.(authError);
          throw authError;
        }

        await config.onAuthExpired?.(error);
      }

      throw error;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  return {
    login(requestBody: SyncLoginRequest) {
      return request<SyncLoginResponse>(
        "/v1/sync/auth/login",
        {
          method: "POST",
          body: JSON.stringify(requestBody),
        },
        {
          includeAuth: false,
        },
      );
    },
    refresh(requestBody: SyncRefreshRequest) {
      return request<SyncRefreshResponse>(
        "/v1/sync/auth/refresh",
        {
          method: "POST",
          body: JSON.stringify(requestBody),
        },
        {
          includeAuth: false,
          includeDeviceId: false,
          skipAutoRefresh: true,
        },
      );
    },
    registerDevice(requestBody: SyncRegisterDeviceRequest) {
      return request<SyncRegisterDeviceResponse>("/v1/sync/devices", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });
    },
    getSnapshotHead() {
      return request<SyncSnapshotHeadResponse>("/v1/sync/snapshots/head", {
        method: "GET",
      });
    },
    getSnapshot(snapshotVersion: string) {
      return request<SyncSnapshotResponse>(
        `/v1/sync/snapshots/${encodeURIComponent(snapshotVersion)}`,
        {
          method: "GET",
        },
      );
    },
    listSnapshots(page = 1, pageSize = 20) {
      const query = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });

      return request<SyncSnapshotHistoryResponse>(
        `/v1/sync/snapshots?${query.toString()}`,
        {
          method: "GET",
        },
      );
    },
    uploadSnapshot(requestBody: SyncSnapshotUploadRequest) {
      return request<SyncSnapshotUploadResponse>("/v1/sync/snapshots", {
        method: "POST",
        headers: {
          "Idempotency-Key": requestBody.requestId,
        },
        body: JSON.stringify(requestBody),
      });
    },
    recordRestore(requestBody: SyncSnapshotRestoreRequest) {
      return request<SyncSnapshotRestoreResponse>(
        "/v1/sync/snapshots/restore",
        {
          method: "POST",
          headers: {
            "Idempotency-Key": requestBody.requestId,
          },
          body: JSON.stringify(requestBody),
        },
      );
    },
  };
}

export type SyncRemoteClient = ReturnType<typeof createSyncRemoteClient>;
