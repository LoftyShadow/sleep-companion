import type {
  AudioMimeType,
  CustomSoundId,
  SoundDefinition,
} from "../sounds/soundCatalog";

const DATABASE_NAME = "sleep-companion-custom-sounds";
const DATABASE_VERSION = 1;
const STORE_NAME = "custom-sounds";
const CUSTOM_SOUND_IMAGE_SRC = "/images/sounds/typewriter.webp";
export const CUSTOM_SOUND_MAX_FILE_BYTES = 100 * 1024 * 1024;
export const CUSTOM_SOUND_MAX_BATCH_BYTES = 300 * 1024 * 1024;
const CUSTOM_SOUND_STORAGE_HEADROOM_BYTES = 16 * 1024 * 1024;
const STORAGE_SPACE_ERROR_MESSAGE =
  "本地存储空间不足，请移除一些自定义音频后再添加";

const SUPPORTED_EXTENSIONS = new Set([
  ".aac",
  ".flac",
  ".m4a",
  ".mp3",
  ".ogg",
  ".wav",
  ".webm",
]);

const SUPPORTED_MIME_TYPES = new Set<AudioMimeType>([
  "audio/aac",
  "audio/flac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-wav",
]);

const EXTENSION_MIME_TYPES = new Map<string, AudioMimeType>([
  [".aac", "audio/aac"],
  [".flac", "audio/flac"],
  [".m4a", "audio/mp4"],
  [".mp3", "audio/mpeg"],
  [".ogg", "audio/ogg"],
  [".wav", "audio/wav"],
  [".webm", "audio/webm"],
]);

export interface StoredCustomSound {
  id: CustomSoundId;
  name: string;
  type: AudioMimeType;
  blob: Blob;
  createdAt: number;
}

function getIndexedDb(): IDBFactory | undefined {
  return typeof indexedDB === "undefined" ? undefined : indexedDB;
}

function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

function createTransactionError(
  fallbackMessage: string,
  transaction: IDBTransaction,
  request?: IDBRequest,
): Error {
  const error = request?.error ?? transaction.error;
  if (isQuotaExceededError(error)) {
    return new Error(STORAGE_SPACE_ERROR_MESSAGE);
  }

  return error instanceof Error ? error : new Error(fallbackMessage);
}

function createPersistenceError(fallbackMessage: string, error: unknown): Error {
  if (isQuotaExceededError(error)) {
    return new Error(STORAGE_SPACE_ERROR_MESSAGE);
  }

  return error instanceof Error ? error : new Error(fallbackMessage);
}

function isQuotaExceededError(error: unknown): boolean {
  const errorLike = error as { code?: unknown; name?: unknown };
  return (
    errorLike.name === "QuotaExceededError" ||
    errorLike.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    errorLike.code === 22 ||
    errorLike.code === 1014
  );
}

function formatFileSize(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

async function estimateAvailableStorageBytes(): Promise<number | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    if (
      typeof estimate.quota !== "number" ||
      typeof estimate.usage !== "number"
    ) {
      return null;
    }

    return Math.max(estimate.quota - estimate.usage, 0);
  } catch {
    return null;
  }
}

function createCustomSoundId(): CustomSoundId {
  const token =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `custom:${token}`;
}

function openCustomSoundDatabase(): Promise<IDBDatabase | null> {
  const factory = getIndexedDb();
  if (!factory) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("打开自定义音频数据库失败"));
    };
  });
}

export function isSupportedCustomAudioFile(file: File): boolean {
  if (
    file.type &&
    SUPPORTED_MIME_TYPES.has(file.type.toLowerCase())
  ) {
    return true;
  }

  return SUPPORTED_EXTENSIONS.has(getFileExtension(file.name));
}

export async function validateCustomSoundFilesForImport(
  files: readonly File[],
): Promise<void> {
  const oversizedFile = files.find(
    (file) => file.size > CUSTOM_SOUND_MAX_FILE_BYTES,
  );
  if (oversizedFile) {
    throw new Error(
      `单个音频不能超过 ${formatFileSize(CUSTOM_SOUND_MAX_FILE_BYTES)}：${oversizedFile.name}`,
    );
  }

  const batchSize = files.reduce((totalBytes, file) => totalBytes + file.size, 0);
  if (batchSize > CUSTOM_SOUND_MAX_BATCH_BYTES) {
    throw new Error(
      `批量添加音频不能超过 ${formatFileSize(CUSTOM_SOUND_MAX_BATCH_BYTES)}`,
    );
  }

  const availableBytes = await estimateAvailableStorageBytes();
  if (
    availableBytes !== null &&
    batchSize + CUSTOM_SOUND_STORAGE_HEADROOM_BYTES > availableBytes
  ) {
    throw new Error(STORAGE_SPACE_ERROR_MESSAGE);
  }
}

export function getCustomSoundName(fileName: string): string {
  const extension = getFileExtension(fileName);
  const nameWithoutExtension = extension
    ? fileName.slice(0, -extension.length)
    : fileName;
  const normalizedName = nameWithoutExtension.trim();

  return normalizedName.length > 0 ? normalizedName : "自定义音频";
}

export function inferCustomAudioType(file: File): AudioMimeType {
  const normalizedType = file.type.toLowerCase();
  if (SUPPORTED_MIME_TYPES.has(normalizedType)) {
    return normalizedType;
  }

  return EXTENSION_MIME_TYPES.get(getFileExtension(file.name)) ?? "audio/mpeg";
}

export function createCustomSoundDefinition(
  record: StoredCustomSound,
  objectUrl: string,
): SoundDefinition {
  return {
    id: record.id,
    name: record.name,
    sourceKind: "custom",
    imageSrc: CUSTOM_SOUND_IMAGE_SRC,
    sources: [{ src: objectUrl, type: record.type }],
  };
}

export async function listStoredCustomSounds(): Promise<StoredCustomSound[]> {
  const database = await openCustomSoundDatabase();
  if (!database) {
    return [];
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    let records: StoredCustomSound[] = [];
    let isSettled = false;

    request.onsuccess = () => {
      records = (request.result as StoredCustomSound[]).sort(
        (left, right) => left.createdAt - right.createdAt,
      );
    };

    const rejectOnce = (error: Error) => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      database.close();
      reject(error);
    };

    request.onerror = () => {
      rejectOnce(createTransactionError("读取自定义音频失败", transaction, request));
    };

    transaction.oncomplete = () => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      database.close();
      resolve(records);
    };

    transaction.onerror = () => {
      rejectOnce(createTransactionError("读取自定义音频失败", transaction));
    };

    transaction.onabort = () => {
      rejectOnce(createTransactionError("读取自定义音频失败", transaction));
    };
  });
}

export async function saveCustomSoundFile(
  file: File,
): Promise<StoredCustomSound> {
  if (!isSupportedCustomAudioFile(file)) {
    throw new Error("仅支持本地音频文件");
  }

  const database = await openCustomSoundDatabase();
  if (!database) {
    throw new Error("当前环境不支持本地持久化，无法添加自定义音频");
  }

  const record: StoredCustomSound = {
    id: createCustomSoundId(),
    name: getCustomSoundName(file.name),
    type: inferCustomAudioType(file),
    blob: file,
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    let request: IDBRequest<IDBValidKey>;
    let isSettled = false;

    const rejectOnce = (error: Error) => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      database.close();
      reject(error);
    };

    try {
      request = store.put(record);
    } catch (error) {
      rejectOnce(createPersistenceError("保存自定义音频失败", error));
      return;
    }

    request.onsuccess = () => undefined;

    request.onerror = () => {
      rejectOnce(createTransactionError("保存自定义音频失败", transaction, request));
    };

    transaction.oncomplete = () => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      database.close();
      resolve(record);
    };

    transaction.onerror = () => {
      rejectOnce(createTransactionError("保存自定义音频失败", transaction));
    };

    transaction.onabort = () => {
      rejectOnce(createTransactionError("保存自定义音频失败", transaction));
    };
  });
}

export async function deleteStoredCustomSound(
  soundId: CustomSoundId,
): Promise<void> {
  const database = await openCustomSoundDatabase();
  if (!database) {
    return;
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(soundId);
    let isSettled = false;

    const rejectOnce = (error: Error) => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      database.close();
      reject(error);
    };

    request.onsuccess = () => undefined;

    request.onerror = () => {
      rejectOnce(createTransactionError("删除自定义音频失败", transaction, request));
    };

    transaction.oncomplete = () => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      database.close();
      resolve();
    };

    transaction.onerror = () => {
      rejectOnce(createTransactionError("删除自定义音频失败", transaction));
    };

    transaction.onabort = () => {
      rejectOnce(createTransactionError("删除自定义音频失败", transaction));
    };
  });
}
