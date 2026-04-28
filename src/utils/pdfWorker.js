import workerSrc from 'pdfjs-dist/build/pdf.worker.min.js';

export function configurePdfWorker(pdfjsLib) {
  if (typeof window === 'undefined' || !pdfjsLib?.GlobalWorkerOptions) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
}
