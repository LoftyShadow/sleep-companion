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

export interface BilibiliVideoSource {
  embedUrl: string;
  label: string;
  reference: BilibiliVideoReference;
}

const BILIBILI_HOST_PATTERN = /(^|\.)bilibili\.com$/iu;
const BV_PATTERN = /BV[0-9A-Za-z]{10}/u;
const AV_PATTERN = /(?:^|\/)av(\d+)(?:\b|[/?#])/iu;
const EP_PATTERN = /(?:^|\/)ep(\d+)(?:\b|[/?#])/iu;

function isSupportedBilibiliHost(hostname: string) {
  const normalizedHost = hostname.toLowerCase();

  return normalizedHost === "b23.tv" || BILIBILI_HOST_PATTERN.test(normalizedHost);
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

export function parseBilibiliVideoInput(
  input: string,
): BilibiliVideoReference | null {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return null;
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

    return parseReferenceFromText(`${url.pathname}${url.search}${url.hash}`);
  } catch {
    return directReference;
  }
}

export function buildBilibiliPlayerUrl(
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

export function createBilibiliVideoSource(
  input: string,
): BilibiliVideoSource | null {
  const reference = parseBilibiliVideoInput(input);
  if (!reference) {
    return null;
  }

  const prefix =
    reference.kind === "bvid" ? "BV" : reference.kind === "aid" ? "av" : "ep";

  return {
    embedUrl: buildBilibiliPlayerUrl(reference),
    label: `${prefix} ${reference.value}`,
    reference,
  };
}
