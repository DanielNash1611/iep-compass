import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const DEFAULT_MAX_PDF_PAGES = 3
const DEFAULT_VIEWPORT_SCALE = 1.5

export interface PdfPageImagesResult {
  imageDataUrls: string[]
  pageCount: number
  processedPageCount: number
}

export async function renderPdfPagesToImageDataUrls(
  file: File,
  maxPages = DEFAULT_MAX_PDF_PAGES,
): Promise<PdfPageImagesResult> {
  const buffer = await file.arrayBuffer()
  const loadingTask = getDocument({
    data: buffer,
    useWorkerFetch: false,
  })
  const pdf = await loadingTask.promise

  try {
    const processedPageCount = Math.min(pdf.numPages, maxPages)
    const imageDataUrls: string[] = []

    for (let index = 1; index <= processedPageCount; index += 1) {
      const page = await pdf.getPage(index)
      const viewport = page.getViewport({ scale: DEFAULT_VIEWPORT_SCALE })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('Canvas rendering is unavailable in this browser.')
      }

      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)

      await page.render({
        canvas,
        canvasContext: context,
        viewport,
      }).promise

      imageDataUrls.push(canvas.toDataURL('image/jpeg', 0.92))

      await new Promise((resolve) => {
        window.setTimeout(resolve, 0)
      })
    }

    return {
      imageDataUrls,
      pageCount: pdf.numPages,
      processedPageCount,
    }
  } finally {
    await pdf.destroy()
    loadingTask.destroy()
  }
}
