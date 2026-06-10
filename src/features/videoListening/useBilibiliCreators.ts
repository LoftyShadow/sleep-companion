import { useCallback, useEffect, useRef, useState } from "react";
import type { FileSystemPort } from "../storage/FileSystemPort";
import {
  DEFAULT_BILIBILI_CREATOR_VIDEO_PAGE_SIZE,
  type BilibiliCreator,
  type BilibiliCreatorVideo,
  type BilibiliCreatorVideosLoader,
  loadBilibiliCreatorVideos,
  parseBilibiliCreatorInput,
} from "./bilibiliCreator";
import {
  deleteBilibiliCreator,
  listBilibiliCreators,
  markBilibiliCreatorFetched,
  upsertBilibiliCreator,
} from "./bilibiliCreatorStore";

export const DEFAULT_CREATOR_VIDEO_PAGE_SIZE =
  DEFAULT_BILIBILI_CREATOR_VIDEO_PAGE_SIZE;

interface CreatorVideoCache {
  fetchedAt: number;
  hasMore?: boolean;
  page: number;
  pageSize: number;
  totalCount?: number;
  totalPages?: number;
  videos: BilibiliCreatorVideo[];
}

export interface UseBilibiliCreatorsState {
  activeCreator: BilibiliCreator | null;
  creators: BilibiliCreator[];
  errorMessage: string | null;
  isAddingCreator: boolean;
  isLoadingCreators: boolean;
  isRefreshingVideos: boolean;
  selectedMid: string | null;
  statusMessage: string;
  videoHasMore: boolean;
  videoPage: number;
  videoPageSize: number;
  videoTotalCount?: number;
  videoTotalPages: number;
  videos: BilibiliCreatorVideo[];
  addCreator: (input: string) => Promise<void>;
  deleteCreator: (mid: string) => Promise<void>;
  refreshCreatorVideos: (mid?: string, page?: number) => Promise<void>;
  selectCreator: (mid: string) => void;
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return fallbackMessage;
}

function createPendingCreator(mid: string, now = Date.now()): BilibiliCreator {
  return {
    addedAt: now,
    mid,
    name: `UP ${mid}`,
    updatedAt: now,
  };
}

function replaceCreator(
  creators: readonly BilibiliCreator[],
  nextCreator: BilibiliCreator,
): BilibiliCreator[] {
  const hasCreator = creators.some((creator) => creator.mid === nextCreator.mid);
  const nextCreators = hasCreator
    ? creators.map((creator) =>
        creator.mid === nextCreator.mid ? nextCreator : creator,
      )
    : [nextCreator, ...creators];

  return [...nextCreators].sort((left, right) => right.updatedAt - left.updatedAt);
}

export function useBilibiliCreators({
  fileSystem,
  videosLoader = loadBilibiliCreatorVideos,
}: {
  fileSystem?: FileSystemPort;
  videosLoader?: BilibiliCreatorVideosLoader;
} = {}): UseBilibiliCreatorsState {
  const [creators, setCreators] = useState<BilibiliCreator[]>([]);
  const [selectedMid, setSelectedMid] = useState<string | null>(null);
  const [videoCacheByMid, setVideoCacheByMid] = useState<
    Record<string, CreatorVideoCache>
  >({});
  const [isLoadingCreators, setIsLoadingCreators] = useState(true);
  const [isAddingCreator, setIsAddingCreator] = useState(false);
  const [isRefreshingVideos, setIsRefreshingVideos] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("正在读取本地 UP 主列表");
  const requestIdRef = useRef(0);
  const autoRefreshTriedMidsRef = useRef<Set<string>>(new Set());

  const activeCreator =
    creators.find((creator) => creator.mid === selectedMid) ?? null;
  const selectedVideoCache = selectedMid ? videoCacheByMid[selectedMid] : undefined;
  const videos = selectedVideoCache?.videos ?? [];
  const videoPage = selectedVideoCache?.page ?? 1;
  const videoPageSize =
    selectedVideoCache?.pageSize ?? DEFAULT_CREATOR_VIDEO_PAGE_SIZE;
  const videoTotalPages = Math.max(
    1,
    selectedVideoCache?.totalPages ??
      (selectedVideoCache?.hasMore ? selectedVideoCache.page + 1 : videoPage),
  );
  const videoHasMore =
    selectedVideoCache?.hasMore ?? videoPage < videoTotalPages;
  const videoTotalCount = selectedVideoCache?.totalCount;

  useEffect(() => {
    let isMounted = true;

    async function loadCreators() {
      setIsLoadingCreators(true);
      setErrorMessage(null);
      try {
        const loadedCreators = await listBilibiliCreators(fileSystem);
        if (!isMounted) {
          return;
        }

        setCreators(loadedCreators);
        setSelectedMid((currentMid) => currentMid ?? loadedCreators[0]?.mid ?? null);
        setStatusMessage(
          loadedCreators.length > 0
            ? `已保存 ${loadedCreators.length} 位 UP 主`
            : "还没有保存 UP 主",
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(getErrorMessage(error, "本地 UP 主列表不可用"));
        setStatusMessage("本地 UP 主列表不可用");
      } finally {
        if (isMounted) {
          setIsLoadingCreators(false);
        }
      }
    }

    void loadCreators();

    return () => {
      isMounted = false;
    };
  }, [fileSystem]);

  const refreshCreatorVideos = useCallback(
    async (mid = selectedMid ?? undefined, page = 1) => {
      if (!mid) {
        setErrorMessage("请先选择或添加 UP 主");
        return;
      }
      const normalizedPage = Math.max(1, Math.floor(page));

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setIsRefreshingVideos(true);
      setErrorMessage(null);
      setStatusMessage(`正在刷新第 ${normalizedPage} 页视频`);

      try {
        const response = await videosLoader(mid, {
          page: normalizedPage,
          pageSize: DEFAULT_CREATOR_VIDEO_PAGE_SIZE,
        });
        if (requestIdRef.current !== requestId) {
          return;
        }

        const now = Date.now();
        const nextCreator = await markBilibiliCreatorFetched(
          response.creator.mid,
          response.creator,
          fileSystem,
          now,
        );
        if (requestIdRef.current !== requestId) {
          return;
        }

        setCreators((currentCreators) =>
          replaceCreator(currentCreators, nextCreator),
        );
        setSelectedMid(nextCreator.mid);
        setVideoCacheByMid((currentCache) => ({
          ...currentCache,
          [nextCreator.mid]: {
            fetchedAt: now,
            hasMore: response.hasMore,
            page: response.page,
            pageSize: response.pageSize,
            totalCount: response.totalCount,
            totalPages: response.totalPages,
            videos: response.videos,
          },
        }));
        setStatusMessage(
          response.videos.length > 0 ? "" : "这个 UP 主暂时没有公开投稿",
        );
      } catch (error) {
        if (requestIdRef.current !== requestId) {
          return;
        }

        setErrorMessage(getErrorMessage(error, "刷新 UP 主视频失败"));
        setStatusMessage("刷新 UP 主视频失败");
      } finally {
        if (requestIdRef.current === requestId) {
          setIsRefreshingVideos(false);
        }
      }
    },
    [fileSystem, selectedMid, videosLoader],
  );

  useEffect(() => {
    if (
      !selectedMid ||
      isLoadingCreators ||
      isAddingCreator ||
      isRefreshingVideos ||
      videoCacheByMid[selectedMid] ||
      autoRefreshTriedMidsRef.current.has(selectedMid)
    ) {
      return;
    }

    autoRefreshTriedMidsRef.current.add(selectedMid);
    void refreshCreatorVideos(selectedMid, 1);
  }, [
    isAddingCreator,
    isLoadingCreators,
    isRefreshingVideos,
    refreshCreatorVideos,
    selectedMid,
    videoCacheByMid,
  ]);

  const addCreator = useCallback(
    async (input: string) => {
      const mid = parseBilibiliCreatorInput(input);
      if (!mid) {
        setErrorMessage("请输入 B 站 UP 主主页链接或数字 mid");
        return;
      }

      setIsAddingCreator(true);
      setErrorMessage(null);
      setStatusMessage("正在保存 UP 主");

      try {
        const existingCreator = creators.find((creator) => creator.mid === mid);
        const creator = await upsertBilibiliCreator(
          existingCreator ?? createPendingCreator(mid),
          fileSystem,
        );

        setCreators((currentCreators) => replaceCreator(currentCreators, creator));
        setSelectedMid(creator.mid);
        setStatusMessage(
          existingCreator ? "这个 UP 主已在列表中" : "已保存 UP 主",
        );
        await refreshCreatorVideos(creator.mid, 1);
      } catch (error) {
        setErrorMessage(getErrorMessage(error, "保存 UP 主失败"));
        setStatusMessage("保存 UP 主失败");
      } finally {
        setIsAddingCreator(false);
      }
    },
    [creators, fileSystem, refreshCreatorVideos],
  );

  const handleDeleteCreator = useCallback(
    async (mid: string) => {
      setErrorMessage(null);
      try {
        const nextCreators = await deleteBilibiliCreator(mid, fileSystem);
        setCreators(nextCreators);
        setVideoCacheByMid((currentCache) => {
          const nextCache = { ...currentCache };
          delete nextCache[mid];

          return nextCache;
        });
        setSelectedMid((currentMid) => {
          if (currentMid !== mid) {
            return currentMid;
          }

          return nextCreators[0]?.mid ?? null;
        });
        setStatusMessage(
          nextCreators.length > 0
            ? `已保存 ${nextCreators.length} 位 UP 主`
            : "还没有保存 UP 主",
        );
      } catch (error) {
        setErrorMessage(getErrorMessage(error, "删除 UP 主失败"));
        setStatusMessage("删除 UP 主失败");
      }
    },
    [fileSystem],
  );

  const selectCreator = useCallback((mid: string) => {
    setSelectedMid(mid);
    setErrorMessage(null);
  }, []);

  return {
    activeCreator,
    addCreator,
    creators,
    deleteCreator: handleDeleteCreator,
    errorMessage,
    isAddingCreator,
    isLoadingCreators,
    isRefreshingVideos,
    refreshCreatorVideos,
    selectCreator,
    selectedMid,
    statusMessage,
    videoHasMore,
    videoPage,
    videoPageSize,
    videoTotalCount,
    videoTotalPages,
    videos,
  };
}
