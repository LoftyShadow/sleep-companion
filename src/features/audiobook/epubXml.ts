const XML_ENTITY_REPLACEMENTS: Record<string, string> = {
  bull: "&#8226;",
  copy: "&#169;",
  hellip: "&#8230;",
  laquo: "&#171;",
  ldquo: "&#8220;",
  lsquo: "&#8216;",
  mdash: "&#8212;",
  middot: "&#183;",
  nbsp: "&#160;",
  ndash: "&#8211;",
  raquo: "&#187;",
  reg: "&#174;",
  rdquo: "&#8221;",
  rsquo: "&#8217;",
  trade: "&#8482;",
};

function sanitizeXmlEntities(text: string): string {
  return text.replace(/&([a-z]+);/giu, (match, entityName: string) => {
    return XML_ENTITY_REPLACEMENTS[entityName.toLowerCase()] ?? match;
  });
}

export function normalizeZipPath(path: string): string {
  return path.replace(/\\/gu, "/").replace(/^\/+/u, "");
}

export function parseXmlDocument(text: string, label: string): Document {
  const document = new DOMParser().parseFromString(
    sanitizeXmlEntities(text),
    "application/xml",
  );
  const parserError = document.getElementsByTagName("parsererror")[0];

  if (parserError) {
    throw new Error(`EPUB 文件解析失败：${label}`);
  }

  return document;
}

export function parseContentDocument(text: string): Document {
  const parser = new DOMParser();
  const xmlDocument = parser.parseFromString(
    sanitizeXmlEntities(text),
    "application/xhtml+xml",
  );

  if (!xmlDocument.getElementsByTagName("parsererror")[0]) {
    return xmlDocument;
  }

  return parser.parseFromString(text, "text/html");
}

export function getElementsByLocalName(
  root: Document | Element,
  localName: string,
): Element[] {
  return Array.from(root.getElementsByTagName("*")).filter(
    (element) => element.localName.toLowerCase() === localName,
  );
}

export function getFirstElementByLocalName(
  root: Document | Element,
  localName: string,
): Element | null {
  return getElementsByLocalName(root, localName)[0] ?? null;
}

export function getRequiredAttribute(
  element: Element,
  attributeName: string,
): string | null {
  const value = element.getAttribute(attributeName)?.trim();

  return value && value.length > 0 ? value : null;
}

export function resolveZipHref(href: string, relativeTo: string): string {
  const cleanHref = href.split("#", 1)[0]?.trim() ?? "";
  const base = new URL(normalizeZipPath(relativeTo), "epub://book/");
  const resolved = new URL(cleanHref, base);

  return normalizeZipPath(decodeURI(resolved.pathname));
}
