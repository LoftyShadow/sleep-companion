import type { FileSystemBinaryContent, FileSystemPort } from "./FileSystemPort";

const DATABASE_NAME = "sleep-companion-file-system";
const DATABASE_VERSION = 1;
const STORE_NAME = "files";

interface StoredFileRecord {
  path: string;
  content: string | ArrayBuffer | Blob;
  updatedAt: number;
}

function getIndexedDb(): IDBFactory | undefined {
  return typeof indexedDB === "undefined" ? undefined : indexedDB;
}

function createIndexedDbUnavailableError(): Error {
  return new Error("当前环境不支持 IndexedDB，本地书架不可用");
}

function createFileSystemError(fallbackMessage: string, error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(fallbackMessage);
}

async function normalizeBinaryContent(
  content: FileSystemBinaryContent,
): Promise<ArrayBuffer | Blob> {
  if (content instanceof File) {
    return content.arrayBuffer();
  }

  return content;
}

function openFileSystemDatabase(): Promise<IDBDatabase> {
  const factory = getIndexedDb();
  if (!factory) {
    return Promise.reject(createIndexedDbUnavailableError());
  }

  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "path" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(
        createFileSystemError("打开本地文件系统失败", request.error),
      );
    };
  });
}

function readRecord(path: string): Promise<StoredFileRecord | null> {
  return openFileSystemDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(path);
        let record: StoredFileRecord | null = null;
        let isSettled = false;

        function rejectOnce(error: Error) {
          if (isSettled) {
            return;
          }
          isSettled = true;
          database.close();
          reject(error);
        }

        request.onsuccess = () => {
          record = (request.result as StoredFileRecord | undefined) ?? null;
        };

        request.onerror = () => {
          rejectOnce(createFileSystemError("读取本地文件失败", request.error));
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
          rejectOnce(createFileSystemError("读取本地文件失败", transaction.error));
        };

        transaction.onabort = () => {
          rejectOnce(createFileSystemError("读取本地文件失败", transaction.error));
        };
      }),
  );
}

function writeRecord(
  path: string,
  content: StoredFileRecord["content"],
): Promise<void> {
  return openFileSystemDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        let isSettled = false;

        function rejectOnce(error: Error) {
          if (isSettled) {
            return;
          }
          isSettled = true;
          database.close();
          reject(error);
        }

        try {
          store.put({ content, path, updatedAt: Date.now() });
        } catch (error) {
          rejectOnce(createFileSystemError("写入本地文件失败", error));
          return;
        }

        transaction.oncomplete = () => {
          if (isSettled) {
            return;
          }
          isSettled = true;
          database.close();
          resolve();
        };

        transaction.onerror = () => {
          rejectOnce(createFileSystemError("写入本地文件失败", transaction.error));
        };

        transaction.onabort = () => {
          rejectOnce(createFileSystemError("写入本地文件失败", transaction.error));
        };
      }),
  );
}

export const indexedDbFileSystem: FileSystemPort = {
  async exists(path) {
    return (await readRecord(path)) !== null;
  },
  async readText(path) {
    const record = await readRecord(path);
    if (!record) {
      throw new Error(`本地文件不存在：${path}`);
    }
    if (typeof record.content === "string") {
      return record.content;
    }
    if (record.content instanceof Blob) {
      return record.content.text();
    }
    return new TextDecoder().decode(record.content);
  },
  async writeText(path, content) {
    await writeRecord(path, content);
  },
  async readBinary(path) {
    const record = await readRecord(path);
    if (!record) {
      throw new Error(`本地文件不存在：${path}`);
    }
    if (record.content instanceof Blob) {
      return record.content.arrayBuffer();
    }
    if (typeof record.content === "string") {
      return new TextEncoder().encode(record.content).buffer;
    }
    return record.content;
  },
  async writeBinary(path, content) {
    await writeRecord(path, await normalizeBinaryContent(content));
  },
  async deleteFile(path) {
    const database = await openFileSystemDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      let isSettled = false;

      function rejectOnce(error: Error) {
        if (isSettled) {
          return;
        }
        isSettled = true;
        database.close();
        reject(error);
      }

      store.delete(path);

      transaction.oncomplete = () => {
        if (isSettled) {
          return;
        }
        isSettled = true;
        database.close();
        resolve();
      };

      transaction.onerror = () => {
        rejectOnce(createFileSystemError("删除本地文件失败", transaction.error));
      };

      transaction.onabort = () => {
        rejectOnce(createFileSystemError("删除本地文件失败", transaction.error));
      };
    });
  },
  async deletePrefix(prefix) {
    const database = await openFileSystemDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();
      let isSettled = false;

      function rejectOnce(error: Error) {
        if (isSettled) {
          return;
        }
        isSettled = true;
        database.close();
        reject(error);
      }

      request.onsuccess = () => {
        for (const key of request.result) {
          if (typeof key === "string" && key.startsWith(prefix)) {
            store.delete(key);
          }
        }
      };

      request.onerror = () => {
        rejectOnce(createFileSystemError("删除本地目录失败", request.error));
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
        rejectOnce(createFileSystemError("删除本地目录失败", transaction.error));
      };

      transaction.onabort = () => {
        rejectOnce(createFileSystemError("删除本地目录失败", transaction.error));
      };
    });
  },
};
