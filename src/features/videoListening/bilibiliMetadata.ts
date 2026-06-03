import type { BilibiliReference } from "./bilibiliVideo";
import { createSafeTauriInvoke, type InvokeFn } from "./tauriInvoke";

export interface BilibiliMetadata {
  imageUrl?: string;
  title: string;
}

export type BilibiliMetadataLoader = (
  reference: BilibiliReference,
) => Promise<BilibiliMetadata>;

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
  invoke: InvokeFn = createSafeTauriInvoke("当前环境不能读取 B 站元信息"),
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
