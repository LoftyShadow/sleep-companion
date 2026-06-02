import type {
  FileSystemBinaryContent,
  FileSystemPort,
} from "../features/storage/FileSystemPort";

async function toArrayBuffer(content: FileSystemBinaryContent): Promise<ArrayBuffer> {
  if (content instanceof Blob) {
    return content.arrayBuffer();
  }

  return content;
}

export function createMemoryFileSystem(): FileSystemPort {
  const files = new Map<string, string | ArrayBuffer>();

  return {
    exists(path) {
      return Promise.resolve(files.has(path));
    },
    readText(path) {
      const content = files.get(path);
      if (content === undefined) {
        throw new Error(`文件不存在：${path}`);
      }

      return Promise.resolve(
        typeof content === "string"
          ? content
          : new TextDecoder().decode(content),
      );
    },
    writeText(path, content) {
      files.set(path, content);
      return Promise.resolve();
    },
    readBinary(path) {
      const content = files.get(path);
      if (content === undefined) {
        throw new Error(`文件不存在：${path}`);
      }

      return Promise.resolve(
        typeof content === "string"
          ? new TextEncoder().encode(content).buffer
          : content,
      );
    },
    async writeBinary(path, content) {
      files.set(path, await toArrayBuffer(content));
    },
    deleteFile(path) {
      files.delete(path);
      return Promise.resolve();
    },
    deletePrefix(prefix) {
      for (const path of files.keys()) {
        if (path.startsWith(prefix)) {
          files.delete(path);
        }
      }
      return Promise.resolve();
    },
  };
}
