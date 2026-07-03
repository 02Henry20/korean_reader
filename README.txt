KOREAN READER ICON PACK

Copy the entire icons/ directory plus site.webmanifest and browserconfig.xml
to the root of the website.

Add the contents of head-icons.html inside the <head> element of index.html.

Important files:
- icon-192.png / icon-512.png:
  Standard rounded-square icons for platforms that preserve the source shape.
- icon-maskable-192.png / icon-maskable-512.png:
  Full-bleed PWA icons. Android may crop these into a circle, squircle,
  rounded square, or another launcher shape without cutting off the text/book.
- icon-circle-*.png:
  Optional ready-made transparent circular versions. They are not referenced
  by the manifest because Android should apply its own platform mask.
- apple-touch-icon.png:
  Used when the site is added to the iPhone/iPad home screen.
- favicon files:
  Used by desktop browsers and browser tabs.

Keep the paths unchanged unless you also update site.webmanifest and the
<link> elements in index.html.
