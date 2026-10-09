#!/usr/bin/env python3
"""Build self-contained, one-abstract PDF files from the forum's public PDF.

Examples:
  python scripts/build_abstracts.py --output _site/abstracts
  python scripts/build_abstracts.py --source 2026_abstract.pdf --output abstracts
"""
from __future__ import annotations

import argparse
from bisect import bisect_right
import io
import json
from pathlib import Path
import time
from urllib.request import Request, urlopen

from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = 'https://www.wakate-forum.org/data/2026/2026_abstract.pdf'
# The published PDF's printed page numbers coincide with physical PDF pages.
# These boundaries are section-title / explicitly unpublished pages, not abstracts.
BREAKS = (7, 12, 19, 47, 105, 110, 136)


def abstracts_from_data(path: Path) -> dict[int, str]:
    """Return {1-based source page: presentation title}, excluding unpublished talks."""
    records = json.loads(path.read_text(encoding='utf-8'))
    starts = {}
    for record in records:
        if record.get('unpublished'):
            continue
        talks = record.get('talks') or [record]
        for talk in talks:
            page = int(talk['page'])
            if page in starts:
                raise ValueError(f'Duplicate abstract start page: {page}')
            starts[page] = talk['title']
    if len(starts) != 114:
        raise ValueError(f'Expected 114 linked abstracts, got {len(starts)}')
    if 110 in starts:
        raise ValueError('Page 110 was marked unpublished and must not be served')
    return starts


def fetch_pdf() -> bytes:
    req = Request(SOURCE_URL, headers={'User-Agent': 'Mozilla/5.0 (compatible; WakateSchedule/1.0)', 'Accept': 'application/pdf'})
    for attempt in range(1, 4):
        try:
            with urlopen(req, timeout=60) as response:
                content = response.read()
            if not content.startswith(b'%PDF-'):
                raise ValueError('The downloaded file is not a PDF')
            return content
        except Exception as exc:
            if attempt == 3:
                raise RuntimeError('Failed to fetch the source PDF. Download it manually and use --source PATH.') from exc
            print(f'Download attempt {attempt} failed: {exc}; retrying…', flush=True)
            time.sleep(2 * attempt)
    raise AssertionError('unreachable')


def ranges(starts: dict[int, str], page_count: int):
    """Yield (start, exclusive_end) in 1-based page numbers."""
    boundaries = sorted(set(starts) | set(BREAKS))
    for page in sorted(starts):
        next_page = boundaries[bisect_right(boundaries, page)] if bisect_right(boundaries, page) < len(boundaries) else page_count + 1
        if page > page_count or next_page > page_count + 1 or next_page <= page:
            raise ValueError(f'Invalid source page range: {page}..{next_page-1} / total {page_count}')
        yield page, next_page


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, help='Local source PDF (otherwise downloads the official PDF)')
    parser.add_argument('--data', type=Path, default=ROOT/'data.json')
    parser.add_argument('--output', type=Path, default=ROOT/'abstracts')
    args = parser.parse_args()

    starts = abstracts_from_data(args.data)
    content = args.source.read_bytes() if args.source else fetch_pdf()
    if not content.startswith(b'%PDF-'):
        raise ValueError('Source data is not a PDF')
    pdf = PdfReader(io.BytesIO(content), strict=False)
    count = len(pdf.pages)
    if count < 135:
        raise ValueError(f'Expected >=135 pages in official PDF, found {count}. Is this the right edition?')
    output = args.output
    output.mkdir(parents=True, exist_ok=True)
    written = 0
    for begin, stop in ranges(starts, count):
        writer = PdfWriter()
        for page_idx in range(begin - 1, stop - 1):
            writer.add_page(pdf.pages[page_idx])
        writer.add_metadata({'/Title': starts[begin], '/Subject': '2026年度 哲学若手研究者フォーラム 発表要旨'})
        with (output/f'p{begin:03d}.pdf').open('wb') as f:
            writer.write(f)
        written += 1
    assert written == 114
    assert not (output/'p110.pdf').exists(), 'Do not publish the unpublished presentation'
    print(f'Built {written} abstract PDFs into {output} from {count}-page source.')
    print(f'Examples: p008.pdf ({len(PdfReader(output/"p008.pdf").pages)} pages), p020.pdf ({len(PdfReader(output/"p020.pdf").pages)} pages).')


if __name__ == '__main__':
    main()
