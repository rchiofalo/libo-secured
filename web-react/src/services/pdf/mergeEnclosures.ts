import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface EnclosurePdf {
  number: number;
  title: string;
  data: ArrayBuffer;
  pageStyle?: 'border' | 'fullpage' | 'fit';
}

/**
 * Merges enclosure PDFs into the main document.
 * Each enclosure page gets a header marking: "Enclosure (N)"
 */
export async function mergeEnclosures(
  mainPdfBytes: Uint8Array,
  enclosures: EnclosurePdf[]
): Promise<Uint8Array> {
  if (enclosures.length === 0) {
    return mainPdfBytes;
  }

  // Load the main document
  const mainPdf = await PDFDocument.load(mainPdfBytes);
  const helveticaBold = await mainPdf.embedFont(StandardFonts.HelveticaBold);

  // Process each enclosure
  for (const enclosure of enclosures) {
    try {
      // Load the enclosure PDF
      const enclosurePdf = await PDFDocument.load(enclosure.data);
      const pageCount = enclosurePdf.getPageCount();

      // Copy all pages from the enclosure
      const copiedPages = await mainPdf.copyPages(
        enclosurePdf,
        Array.from({ length: pageCount }, (_, i) => i)
      );

      // Add each page with enclosure marking
      for (let i = 0; i < copiedPages.length; i++) {
        const page = copiedPages[i];
        const { width, height } = page.getSize();

        // Add enclosure header at top center
        const headerText = `Enclosure (${enclosure.number})`;
        const fontSize = 10;
        const textWidth = helveticaBold.widthOfTextAtSize(headerText, fontSize);

        page.drawText(headerText, {
          x: (width - textWidth) / 2,
          y: height - 36, // 0.5 inch from top
          size: fontSize,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        });

        // Add page number for multi-page enclosures
        if (pageCount > 1) {
          const pageNumText = `${i + 1}`;
          const pageNumWidth = helveticaBold.widthOfTextAtSize(pageNumText, fontSize);

          page.drawText(pageNumText, {
            x: (width - pageNumWidth) / 2,
            y: 36, // 0.5 inch from bottom
            size: fontSize,
            font: helveticaBold,
            color: rgb(0, 0, 0),
          });
        }

        // Add the page to main document
        mainPdf.addPage(page);
      }
    } catch (err) {
      console.error(`Failed to merge enclosure ${enclosure.number}:`, err);
      // Continue with other enclosures even if one fails
    }
  }

  return mainPdf.save();
}
