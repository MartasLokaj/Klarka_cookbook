"""Builds index.html from the files in src/.  Run:  python3 build.py   (needs Pillow for the app icon)
Add --artifact to also write cookbook.html, the version used for the Claude preview."""
import pathlib, base64, io, sys
from PIL import Image, ImageDraw
root = pathlib.Path(__file__).parent; src = root / 'src'
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Figtree:wght@400;500;600;700;800&display=swap">'
page = ('<title>Cookbook – What to cook?</title>\n' + FONTS + '\n<style>\n' + (src/'style.css').read_text() + '</style>\n\n'
        + (src/'shell.html').read_text() + '\n<script>\n(() => {\n\'use strict\';\n'
        + (src/'data.js').read_text() + '\n' + (src/'art.js').read_text() + '\n' + (src/'app.js').read_text() + '\n})();\n</script>\n')
if '--artifact' in sys.argv: (root/'cookbook.html').write_text(page)
def icon(size):
    im = Image.new('RGB', (size, size), (47, 93, 58)); d = ImageDraw.Draw(im); k = size / 180
    d.ellipse((34*k, 34*k, 146*k, 146*k), fill=(251, 250, 246))
    d.ellipse((58*k, 58*k, 122*k, 122*k), fill=(234, 223, 203))
    d.polygon([(70*k, 112*k), (84*k, 74*k), (118*k, 64*k), (106*k, 100*k)], fill=(78, 138, 56))
    b = io.BytesIO(); im.save(b, 'PNG'); return base64.b64encode(b.getvalue()).decode()
head = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<meta name="theme-color" content="#FBFAF6">\n<meta name="format-detection" content="telephone=no">\n'
        '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n'
        '<meta name="apple-mobile-web-app-title" content="Cookbook">\n<meta name="apple-mobile-web-app-status-bar-style" content="default">\n'
        f'<link rel="apple-touch-icon" href="data:image/png;base64,{icon(180)}">\n<link rel="icon" type="image/png" href="data:image/png;base64,{icon(64)}">\n'
        '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>\n')
i = page.index('</style>') + len('</style>')
full = head + page[:i] + '\n</head>\n<body>\n' + page[i:] + '</body>\n</html>\n'
(root/'index.html').write_text(full)
print('built', len(page), len(full))
