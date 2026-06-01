import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import type { BilibiliReference } from "./bilibiliVideo";

export interface BilibiliMetadata {
  imageUrl?: string;
  title: string;
}

export type BilibiliMetadataLoader = (
  reference: BilibiliReference,
) => Promise<BilibiliMetadata>;

type InvokeFn = (
  cmd: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

function isBilibiliMetadata(value: unknown): value is BilibiliMetadata {
  if (!value || typeof value !== "object") {
    return false;
  }

  const metadata = value as Partial<BilibiliMetadata>;

  return (
    typeof metadata.title === "string" &&
    metadata.title.trim().length > 0 &&
    (metadata.imageUrl === undefined || typeof metadata.imageUrl === "string")
  );
}

export function createBilibiliMetadataLoader(
  invoke: InvokeFn = tauriInvoke,
): BilibiliMetadataLoader {
  return async (reference) => {
    const metadata = await invoke("fetch_bilibili_metadata", { reference });
    if (!isBilibiliMetadata(metadata)) {
      throw new Error("B 站元信息响应格式不正确");
    }

    return {
      imageUrl: metadata.imageUrl,
      title: metadata.title.trim(),
    };
  };
}

export const loadBilibiliMetadata = createBilibiliMetadataLoader();
