import { BlobWriter, TextReader, ZipWriter } from "@zip.js/zip.js";

export async function createMinimalEpubFile(): Promise<File> {
  const writer = new ZipWriter(new BlobWriter("application/epub+zip"));

  await writer.add("mimetype", new TextReader("application/epub+zip"), {
    level: 0,
  });
  await writer.add(
    "META-INF/container.xml",
    new TextReader(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`),
  );
  await writer.add(
    "OPS/content.opf",
    new TextReader(`<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" unique-identifier="bookid" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">test-epub</dc:identifier>
    <dc:title>测试 EPUB</dc:title>
    <dc:language>zh-CN</dc:language>
  </metadata>
  <manifest>
    <item id="cover" href="Text/cover.xhtml" media-type="application/xhtml+xml"/>
    <item id="cover-image" href="Images/cover.png" media-type="image/png" properties="cover-image"/>
    <item id="chapter1" href="Text/chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter2" href="Text/chapter2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="cover" linear="no"/>
    <itemref idref="chapter1"/>
    <itemref idref="chapter2"/>
  </spine>
</package>`),
  );
  await writer.add(
    "OPS/Text/cover.xhtml",
    new TextReader(`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <p>封面不应该被朗读。</p>
  </body>
</html>`),
  );
  await writer.add("OPS/Images/cover.png", new TextReader("fake-cover-image"));
  await writer.add(
    "OPS/Text/chapter1.xhtml",
    new TextReader(`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>章节一标题</title>
    <style>.hidden { color: red; }</style>
  </head>
  <body>
    <h1>第一章</h1>
    <p>第一段。</p>
    <p>第二段。</p>
    <script>window.evil = true;</script>
  </body>
</html>`),
  );
  await writer.add(
    "OPS/Text/chapter2.xhtml",
    new TextReader(`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h2>第二章</h2>
    <p>第三段。第四段。</p>
  </body>
</html>`),
  );

  const blob = await writer.close();
  const arrayBuffer = await blob.arrayBuffer();

  return new File([arrayBuffer], "测试 EPUB.epub", {
    type: "application/epub+zip",
  });
}
