import { useCallback, useEffect, useState } from "react";
import type { FileSystemPort } from "../storage/FileSystemPort";
import type {
  BilibiliFavoriteVideo,
  BilibiliFavoriteVideoInput,
} from "./bilibiliFavoriteVideo";
import {
  deleteBilibiliFavoriteVideo,
  listBilibiliFavoriteVideos,
  upsertBilibiliFavoriteVideo,
} from "./bilibiliFavoriteVideoStore";

export interface UseBilibiliFavoriteVideosState {
  errorMessage: string | null;
  favoriteVideos: BilibiliFavoriteVideo[];
  isFavorite: (bvid?: string | null) => boolean;
  isLoadingFavorites: boolean;
  saveFavorite: (
    input: BilibiliFavoriteVideoInput,
  ) => Promise<BilibiliFavoriteVideo | null>;
  deleteFavorite: (bvid: string) => Promise<void>;
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

function replaceFavoriteVideo(
  favoriteVideos: readonly BilibiliFavoriteVideo[],
  nextVideo: BilibiliFavoriteVideo,
): BilibiliFavoriteVideo[] {
  const hasVideo = favoriteVideos.some((video) => video.bvid === nextVideo.bvid);
  const nextVideos = hasVideo
    ? favoriteVideos.map((video) =>
        video.bvid === nextVideo.bvid ? nextVideo : video,
      )
    : [nextVideo, ...favoriteVideos];

  return [...nextVideos].sort((left, right) => right.updatedAt - left.updatedAt);
}

export function useBilibiliFavoriteVideos({
  fileSystem,
}: {
  fileSystem?: FileSystemPort;
} = {}): UseBilibiliFavoriteVideosState {
  const [favoriteVideos, setFavoriteVideos] = useState<BilibiliFavoriteVideo[]>(
    [],
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadFavoriteVideos() {
      setIsLoadingFavorites(true);
      setErrorMessage(null);

      try {
        const loadedVideos = await listBilibiliFavoriteVideos(fileSystem);
        if (!isMounted) {
          return;
        }

        setFavoriteVideos(loadedVideos);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(getErrorMessage(error, "本地视频收藏不可用"));
      } finally {
        if (isMounted) {
          setIsLoadingFavorites(false);
        }
      }
    }

    void loadFavoriteVideos();

    return () => {
      isMounted = false;
    };
  }, [fileSystem]);

  const isFavorite = useCallback(
    (bvid?: string | null) =>
      Boolean(bvid && favoriteVideos.some((video) => video.bvid === bvid)),
    [favoriteVideos],
  );

  const saveFavorite = useCallback(
    async (input: BilibiliFavoriteVideoInput) => {
      setErrorMessage(null);

      try {
        const nextVideo = await upsertBilibiliFavoriteVideo(input, fileSystem);
        setFavoriteVideos((currentVideos) =>
          replaceFavoriteVideo(currentVideos, nextVideo),
        );

        return nextVideo;
      } catch (error) {
        setErrorMessage(getErrorMessage(error, "保存视频收藏失败"));

        return null;
      }
    },
    [fileSystem],
  );

  const deleteFavorite = useCallback(
    async (bvid: string) => {
      setErrorMessage(null);

      try {
        const nextVideos = await deleteBilibiliFavoriteVideo(bvid, fileSystem);
        setFavoriteVideos(nextVideos);
      } catch (error) {
        setErrorMessage(getErrorMessage(error, "删除视频收藏失败"));
      }
    },
    [fileSystem],
  );

  return {
    deleteFavorite,
    errorMessage,
    favoriteVideos,
    isFavorite,
    isLoadingFavorites,
    saveFavorite,
  };
}
