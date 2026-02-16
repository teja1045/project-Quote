# Local PDF.js assets

For stable deployment, copy these files into this folder:

- `pdf.min.js`
- `pdf.worker.min.js`

The app loads local files first (`./vendor/pdfjs/`) and only falls back to CDN if local files are missing.
