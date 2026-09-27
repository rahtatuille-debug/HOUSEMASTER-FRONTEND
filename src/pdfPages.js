// Draws a PDF's pages as images, so a PDF shows inside the page on every
// device (phones' browsers can't show a PDF in a frame). PDF.js is loaded
// only when it's needed, to keep the rest of the app quick to load.
let loading = null

async function pdfjs() {
  if (!loading) {
    loading = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default
      return lib
    })
  }
  return loading
}

// Returns a list of PNG data URLs, one per page, at `width` CSS pixels (sharp on high-density screens).
export async function renderPdfPages(blob, width = 800) {
  const lib = await pdfjs()
  const pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false }).promise
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  const pages = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const viewport = page.getViewport({ scale: (width * ratio) / page.getViewport({ scale: 1 }).width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    pages.push(canvas.toDataURL('image/png'))
  }
  await pdf.destroy()
  return pages
}
