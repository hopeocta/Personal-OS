/**
 * Wandelt ein Foto eines Papierdokuments in eine saubere PDF um:
 * - Ränder trimmen (Tisch/Hintergrund entfernen)
 * - Graustufen + Kontrast erhöhen (Text schärfer)
 * - Auf A4-ähnliche Auflösung skalieren
 * - Als JPEG in PDF einbetten
 *
 * Ergebnis: ~150–400 KB statt 2–5 MB Originalfoto
 */

import { PDFDocument } from 'pdf-lib'

export async function photoToDocumentPdf(imageBuffer: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default

  const processed = await sharp(imageBuffer)
    // Ränder mit einheitlicher Farbe entfernen (Tisch, Hand, dunkler Hintergrund)
    .trim({ background: { r: 255, g: 255, b: 255 }, threshold: 40 })
    // Graustufen — Dokumente brauchen keine Farbe
    .grayscale()
    // Kontrast und Schärfe erhöhen → Text lesbarer
    .linear(1.3, -30)
    .sharpen({ sigma: 0.8 })
    // Auf max. 1800px skalieren (reicht für A4 bei 200 DPI)
    .resize({ width: 1800, height: 2600, fit: 'inside', withoutEnlargement: true })
    // Als JPEG komprimieren
    .jpeg({ quality: 82, progressive: true })
    .toBuffer()

  // In PDF einbetten
  const pdfDoc = await PDFDocument.create()
  const jpgImage = await pdfDoc.embedJpg(processed)

  // A4-Seitenverhältnis — Bild füllt die Seite
  const { width: imgW, height: imgH } = jpgImage.scale(1)
  const page = pdfDoc.addPage([imgW, imgH])
  page.drawImage(jpgImage, { x: 0, y: 0, width: imgW, height: imgH })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

/** Gibt true zurück wenn der MIME-Type ein Foto (kein natives PDF/Dokument) ist. */
export function isPhotoMime(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}
