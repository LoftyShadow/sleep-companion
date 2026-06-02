import {
  getElementsByLocalName,
  getFirstElementByLocalName,
  getRequiredAttribute,
  normalizeZipPath,
} from "./epubXml";

const PACKAGE_MEDIA_TYPE = "application/oebps-package+xml";

export const XHTML_MEDIA_TYPES = new Set([
  "application/xhtml+xml",
  "application/x-dtbook+xml",
  "text/html",
]);

export interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties: string[];
}

export interface SpineItem {
  idref: string;
  linear: string | null;
}

export interface EpubCoverItem {
  href: string;
  mediaType: string;
}

export function readContainerOpfPath(containerDocument: Document): string {
  const rootFiles = getElementsByLocalName(containerDocument, "rootfile");
  const packageRootFile =
    rootFiles.find(
      (element) =>
        element.getAttribute("media-type")?.trim() === PACKAGE_MEDIA_TYPE,
    ) ?? rootFiles[0];
  const opfPath = packageRootFile
    ? getRequiredAttribute(packageRootFile, "full-path")
    : null;

  if (!opfPath) {
    throw new Error("EPUB 缺少 OPF package 文档");
  }

  return normalizeZipPath(opfPath);
}

export function readBookTitle(
  opfDocument: Document,
  fallbackTitle: string,
): string {
  const metadata = getFirstElementByLocalName(opfDocument, "metadata");
  const title = metadata
    ? getFirstElementByLocalName(metadata, "title")?.textContent?.trim()
    : null;

  return title && title.length > 0 ? title : fallbackTitle;
}

export function readBookAuthor(opfDocument: Document): string | undefined {
  const metadata = getFirstElementByLocalName(opfDocument, "metadata");
  const creator = metadata
    ? getFirstElementByLocalName(metadata, "creator")?.textContent?.trim()
    : null;

  return creator && creator.length > 0 ? creator : undefined;
}

export function readManifest(opfDocument: Document): Map<string, ManifestItem> {
  const manifest = getFirstElementByLocalName(opfDocument, "manifest");
  const items = manifest ? getElementsByLocalName(manifest, "item") : [];
  const manifestItems = new Map<string, ManifestItem>();

  for (const item of items) {
    const id = getRequiredAttribute(item, "id");
    const href = getRequiredAttribute(item, "href");
    const mediaType = getRequiredAttribute(item, "media-type");

    if (!id || !href || !mediaType) {
      continue;
    }

    manifestItems.set(id, {
      href,
      id,
      mediaType: mediaType.toLowerCase(),
      properties: (item.getAttribute("properties") ?? "")
        .split(/\s+/u)
        .map((property) => property.trim())
        .filter((property) => property.length > 0),
    });
  }

  if (manifestItems.size === 0) {
    throw new Error("EPUB 缺少 manifest 资源列表");
  }

  return manifestItems;
}

function readEpub2CoverId(opfDocument: Document): string | null {
  const metadata = getFirstElementByLocalName(opfDocument, "metadata");
  const metaElements = metadata ? getElementsByLocalName(metadata, "meta") : [];
  const coverMeta = metaElements.find(
    (element) => element.getAttribute("name")?.trim().toLowerCase() === "cover",
  );

  return coverMeta?.getAttribute("content")?.trim() ?? null;
}

export function readCoverItem(
  opfDocument: Document,
  manifestItems: Map<string, ManifestItem>,
): EpubCoverItem | null {
  const coverImageItem = Array.from(manifestItems.values()).find((item) =>
    item.properties.includes("cover-image"),
  );
  const coverId = readEpub2CoverId(opfDocument);
  const legacyCoverItem = coverId ? manifestItems.get(coverId) : null;
  const item = coverImageItem ?? legacyCoverItem ?? null;

  if (!item || !item.mediaType.startsWith("image/")) {
    return null;
  }

  return {
    href: item.href,
    mediaType: item.mediaType,
  };
}

export function readSpine(opfDocument: Document): SpineItem[] {
  const spine = getFirstElementByLocalName(opfDocument, "spine");
  const itemRefs = spine ? getElementsByLocalName(spine, "itemref") : [];
  const spineItems = itemRefs.flatMap((itemRef): SpineItem[] => {
    const idref = getRequiredAttribute(itemRef, "idref");

    return idref
      ? [
          {
            idref,
            linear: itemRef.getAttribute("linear")?.trim() ?? null,
          },
        ]
      : [];
  });

  if (spineItems.length === 0) {
    throw new Error("EPUB 缺少 spine 阅读顺序");
  }

  return spineItems;
}

export function selectReadableSpineItems(spineItems: SpineItem[]): SpineItem[] {
  const linearItems = spineItems.filter((item) => item.linear !== "no");

  return linearItems.length > 0 ? linearItems : spineItems;
}
