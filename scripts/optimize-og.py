#!/usr/bin/env python3
"""
optimize-og.py

Kompresi ulang `public/og-image.png` (1200x630) secara terukur: palet 256 warna
lewat median cut. Hasilnya ~110 KB dari ~304 KB dengan PSNR ~49 dB - perbedaan
yang tidak kasat mata untuk kartu dekoratif, tetapi menghemat ~2/3 byte pada
setiap permintaan gambar sosial.

PNG tetap dipakai (bukan WebP) supaya semua crawler mendukungnya; WebP q92
memang lebih kecil (~48 KB) tetapi tidak sepadan dengan risiko crawler yang
tidak memuatnya.

Prasyarat: Python 3 + Pillow (`python3 -m pip install --user Pillow`).
Jalankan setelah membuat ulang kartu dari `scripts/og-card.html`:

    python3 scripts/optimize-og.py            # tulis di tempat (exit 0)
    python3 scripts/optimize-og.py --check     # tidak menulis; exit 1 bila masih bisa diperkecil
"""

from __future__ import annotations

import argparse
import io
import math
import os
import sys

try:
    from PIL import Image, ImageChops
except ImportError:  # pragma: no cover - pesan yang jelas lebih berguna dari traceback
    sys.exit('Pillow belum terpasang: python3 -m pip install --user Pillow')

SRC = os.path.join('public', 'og-image.png')
EXPECTED_SIZE = (1200, 630)
# Di bawah ~40 dB artefak palet mulai terlihat pada gradien halus.
MIN_PSNR_DB = 42.0
# Encode ulang berkas yang sudah dioptimalkan bisa berbeda beberapa byte antar
# versi Pillow. Selisih sekecil itu bukan alasan menggagalkan --check.
SAVINGS_TOLERANCE_BYTES = 4096


def psnr(a: Image.Image, b: Image.Image) -> float:
    diff = ImageChops.difference(a.convert('RGB'), b.convert('RGB'))
    hist = diff.histogram()
    total = a.size[0] * a.size[1] * 3
    squared = 0
    for band in range(3):
        for value in range(256):
            squared += value * value * hist[band * 256 + value]
    mse = squared / total
    return math.inf if mse == 0 else 10 * math.log10((255 ** 2) / mse)


def encode(img: Image.Image, **kwargs: object) -> bytes:
    buf = io.BytesIO()
    img.save(buf, 'PNG', **kwargs)
    return buf.getvalue()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true', help='hanya lapor, tidak menulis')
    args = parser.parse_args()

    src = Image.open(SRC)
    src.load()
    if src.size != EXPECTED_SIZE:
        sys.exit(f'ukuran {src.size} != {EXPECTED_SIZE}; kartu OG harus 1200x630')
    if src.mode != 'RGB':
        src = src.convert('RGB')

    before = os.path.getsize(SRC)
    quantized = src.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
    data = encode(quantized, optimize=True, compress_level=9)

    quality = psnr(src, Image.open(io.BytesIO(data)))
    print(f'{SRC}: {before/1024:.0f} KB -> {len(data)/1024:.0f} KB (PSNR {quality:.2f} dB)')

    if quality < MIN_PSNR_DB:
        sys.exit(f'kualitas turun di bawah {MIN_PSNR_DB} dB - kartu terlalu detail untuk palet 256 warna')
    saved = before - len(data)
    if saved < SAVINGS_TOLERANCE_BYTES:
        print('tidak ada penghematan berarti; berkas dibiarkan apa adanya')
        return 0
    # --check dipakai sebagai penjaga: berkas di repo yang masih bisa diperkecil
    # secara berarti adalah kegagalan (exit 1), bukan sekadar laporan. Dua nilai
    # kembalian ini juga yang membuat main() tidak lagi "selalu mengembalikan
    # nilai yang sama" (Sonar S3516).
    if args.check:
        print(f'--check: {SRC} masih bisa diperkecil ke {len(data)/1024:.0f} KB (hemat {saved/1024:.0f} KB); jalankan tanpa --check')
        return 1
    with open(SRC, 'wb') as f:
        f.write(data)
    print(f'tertulis: {SRC}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
