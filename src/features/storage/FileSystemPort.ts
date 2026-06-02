export type FileSystemBinaryContent = ArrayBuffer | Blob | File;

export interface FileSystemPort {
  exists(path: string): Promise<boolean>;
  readText(path: string): Promise<string>;
  writeText(path: string, content: string): Promise<void>;
  readBinary(path: string): Promise<ArrayBuffer>;
  writeBinary(path: string, content: FileSystemBinaryContent): Promise<void>;
  deleteFile(path: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
}

