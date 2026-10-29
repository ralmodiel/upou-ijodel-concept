"""Render page 1 of each PDF as a 420px-wide JPEG cover -> web/public/covers/<id>.jpg"""
import os, pymupdf
os.makedirs("web/public/covers", exist_ok=True)
n = 0
for f in sorted(os.listdir("data/pdf")):
    aid = f[:-4]
    pg = pymupdf.open(f"data/pdf/{f}")[0]
    pg.get_pixmap(matrix=pymupdf.Matrix(420 / pg.rect.width, 420 / pg.rect.width)).save(f"web/public/covers/{aid}.jpg", jpg_quality=72); n += 1
print(n, "covers,", round(sum(os.path.getsize("web/public/covers/" + x) for x in os.listdir("web/public/covers")) / 1e6, 1), "MB")
