export enum BilibiliSourceKind {
  Video = "video",
  Live = "live",
}

export type BilibiliVideoReference =
  | {
      kind: "bvid";
      value: string;
    }
  | {
      kind: "aid";
      value: string;
    }
  | {
      kind: "ep";
      value: string;
    };

export interface BilibiliLiveReference {
  kind: "live";
  value: string;
}

export type BilibiliReference =
  | BilibiliVideoReference
  | BilibiliLiveReference;

export interface BilibiliPlaybackSource {
  embedUrl: string;
  label: string;
  playerLabel: string;
  reference: BilibiliReference;
  sourceKind: BilibiliSourceKind;
}

const BILIBILI_HOST_PATTERN = /(^|\.)bilibili\.com$/iu;
const BV_PATTERN = /BV[0-9A-Za-z]{10}/u;
const AV_PATTERN = /(?:^|\/)av(\d+)(?:\b|[/?#])/iu;
const EP_PATTERN = /(?:^|\/)ep(\d+)(?:\b|[/?#])/iu;
const LIVE_DIRECT_PATTERN = /^live(\d+)$/iu;
const LIVE_ROOM_PATH_PATTERN = /^\/(?:blanc\/|h5\/|)?(\d+)(?:\/|$)/iu;

interface BilibiliSourceStrategy {
  createSource(reference: BilibiliReference): BilibiliPlaybackSource | null;
}

function isSupportedBilibiliHost(hostname: string) {
  const normalizedHost = hostname.toLowerCase();

  return normalizedHost === "b23.tv" || BILIBILI_HOST_PATTERN.test(normalizedHost);
}

function isLiveBilibiliHost(hostname: string) {
  return hostname.toLowerCase() === "live.bilibili.com";
}

function parseReferenceFromText(value: string): BilibiliVideoReference | null {
  const trimmedValue = value.trim();
  const bvid = trimmedValue.match(BV_PATTERN)?.[0];
  if (bvid) {
    return { kind: "bvid", value: bvid };
  }

  const aid = trimmedValue.match(AV_PATTERN)?.[1];
  if (aid) {
    return { kind: "aid", value: aid };
  }

  const ep = trimmedValue.match(EP_PATTERN)?.[1];
  if (ep) {
    return { kind: "ep", value: ep };
  }

  return null;
}

function parseLiveReferenceFromText(value: string): BilibiliLiveReference | null {
  const liveRoomId = value.trim().match(LIVE_DIRECT_PATTERN)?.[1];

  return liveRoomId ? { kind: "live", value: liveRoomId } : null;
}

function parseLiveReferenceFromUrl(url: URL): BilibiliLiveReference | null {
  if (!isLiveBilibiliHost(url.hostname)) {
    return null;
  }

  const roomId = url.pathname.match(LIVE_ROOM_PATH_PATTERN)?.[1];

  return roomId ? { kind: "live", value: roomId } : null;
}

export function parseBilibiliInput(input: string): BilibiliReference | null {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return null;
  }

  const directLiveReference = parseLiveReferenceFromText(trimmedInput);
  if (directLiveReference && !trimmedInput.includes("://")) {
    return directLiveReference;
  }

  const directReference = parseReferenceFromText(trimmedInput);
  if (directReference && !trimmedInput.includes("://")) {
    return directReference;
  }

  try {
    const url = new URL(trimmedInput);
    if (!isSupportedBilibiliHost(url.hostname)) {
      return null;
    }

    return (
      parseLiveReferenceFromUrl(url) ??
      parseReferenceFromText(`${url.pathname}${url.search}${url.hash}`)
    );
  } catch {
    return directLiveReference ?? directReference;
  }
}

function buildBilibiliPlayerUrl(
  reference: BilibiliVideoReference,
): string {
  const params = new URLSearchParams({
    autoplay: "1",
  });

  if (reference.kind === "bvid") {
    params.set("bvid", reference.value);
  }

  if (reference.kind === "aid") {
    params.set("aid", reference.value);
  }

  if (reference.kind === "ep") {
    params.set("episodeId", reference.value);
  }

  return `https://player.bilibili.com/player.html?${params.toString()}`;
}

function buildBilibiliLivePlayerUrl(
  reference: BilibiliLiveReference,
): string {
  const params = new URLSearchParams({
    cid: reference.value,
    mute: "0",
  });

  return `https://www.bilibili.com/blackboard/live/live-activity-player.html?${params.toString()}`;
}

function getBilibiliSourceKind(reference: BilibiliReference): BilibiliSourceKind {
  return reference.kind === "live"
    ? BilibiliSourceKind.Live
    : BilibiliSourceKind.Video;
}

const videoStrategy: BilibiliSourceStrategy = {
  createSource(reference) {
    if (reference.kind === "live") {
      return null;
    }

    const prefix =
      reference.kind === "bvid" ? "BV" : reference.kind === "aid" ? "av" : "ep";

    return {
      embedUrl: buildBilibiliPlayerUrl(reference),
      label: `${prefix} ${reference.value}`,
      playerLabel: "B 站视频播放器",
      reference,
      sourceKind: BilibiliSourceKind.Video,
    };
  },
};

const liveStrategy: BilibiliSourceStrategy = {
  createSource(reference) {
    if (reference.kind !== "live") {
      return null;
    }

    return {
      embedUrl: buildBilibiliLivePlayerUrl(reference),
      label: `直播间 ${reference.value}`,
      playerLabel: "B 站直播播放器",
      reference,
      sourceKind: BilibiliSourceKind.Live,
    };
  },
};

export function getBilibiliSourceStrategy(
  sourceKind: BilibiliSourceKind,
): BilibiliSourceStrategy {
  return sourceKind === BilibiliSourceKind.Live ? liveStrategy : videoStrategy;
}

export function createBilibiliPlaybackSource(
  input: string,
): BilibiliPlaybackSource | null {
  const reference = parseBilibiliInput(input);
  if (!reference) {
    return null;
  }

  const sourceKind = getBilibiliSourceKind(reference);
  const strategy = getBilibiliSourceStrategy(sourceKind);

  return strategy.createSource(reference);
}
