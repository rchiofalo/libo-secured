import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';

export interface EnclosureData {
  number: number;
  title: string;
  data?: ArrayBuffer; // undefined = text-only enclosure (no PDF)
  pageStyle?: 'border' | 'fullpage' | 'fit';
}

// Standard letter page dimensions (8.5" x 11" at 72 DPI)
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 72; // 1 inch margins

/**
 * Merges enclosure pages into the main document.
 * Handles both PDF enclosures and text-only placeholder pages.
 * Maintains correct enclosure ordering.
 */
export async function mergeEnclosures(
  mainPdfBytes: Uint8Array,
  enclosures: EnclosureData[]
): Promise<Uint8Array> {
  if (enclosures.length === 0) {
    return mainPdfBytes;
  }

  // Load the main document
  const mainPdf = await PDFDocument.load(mainPdfBytes);
  const helveticaBold = await mainPdf.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await mainPdf.embedFont(StandardFonts.Helvetica);

  // Process each enclosure in order
  for (const enclosure of enclosures) {
    try {
      if (enclosure.data) {
        // PDF enclosure - load and copy pages
        await addPdfEnclosure(mainPdf, enclosure, helveticaBold);
      } else {
        // Text-only enclosure - create placeholder page
        addPlaceholderPage(mainPdf, enclosure, helveticaBold, helvetica);
      }
    } catch (err) {
      console.error(`Failed to add enclosure ${enclosure.number}:`, err);
      // Create a placeholder page on error
      addPlaceholderPage(mainPdf, enclosure, helveticaBold, helvetica, true);
    }
  }

  return mainPdf.save();
}

/**
 * Adds a PDF enclosure to the document with the specified page style
 */
async function addPdfEnclosure(
  mainPdf: PDFDocument,
  enclosure: EnclosureData,
  helveticaBold: Awaited<ReturnType<typeof mainPdf.embedFont>>
): Promise<void> {
  if (!enclosure.data) return;

  const enclosurePdf = await PDFDocument.load(enclosure.data);
  const pageCount = enclosurePdf.getPageCount();

  // Copy all pages from the enclosure
  const copiedPages = await mainPdf.copyPages(
    enclosurePdf,
    Array.from({ length: pageCount }, (_, i) => i)
  );

  // Add each page with enclosure marking
  for (let i = 0; i < copiedPages.length; i++) {
    const sourcePage = copiedPages[i];
    const { width: srcWidth, height: srcHeight } = sourcePage.getSize();

    // Create a new page in the main document
    const page = mainPdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    // Calculate scaling and positioning based on page style
    const style = enclosure.pageStyle || 'border';
    const { scale, x, y, drawBorder } = calculatePageLayout(
      srcWidth,
      srcHeight,
      style
    );

    // Embed the source page as an embedded page
    const embeddedPage = await mainPdf.embedPage(sourcePage);

    // Draw the embedded page with calculated position and scale
    page.drawPage(embeddedPage, {
      x,
      y,
      xScale: scale,
      yScale: scale,
    });

    // Draw border if required
    if (drawBorder) {
      const scaledWidth = srcWidth * scale;
      const scaledHeight = srcHeight * scale;
      page.drawRectangle({
        x: x,
        y: y,
        width: scaledWidth,
        height: scaledHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5,
      });
    }

    // Add enclosure header at top center
    addEnclosureHeader(page, enclosure.number, helveticaBold);

    // Add page number for multi-page enclosures
    if (pageCount > 1) {
      addPageNumber(page, i + 1, helveticaBold);
    }
  }
}

/**
 * Calculate page layout based on style
 */
function calculatePageLayout(
  srcWidth: number,
  srcHeight: number,
  style: 'border' | 'fullpage' | 'fit'
): { scale: number; x: number; y: number; drawBorder: boolean } {
  switch (style) {
    case 'fullpage': {
      // Scale to fill the entire page (no margins)
      const scaleX = PAGE_WIDTH / srcWidth;
      const scaleY = PAGE_HEIGHT / srcHeight;
      const scale = Math.min(scaleX, scaleY);
      const scaledWidth = srcWidth * scale;
      const scaledHeight = srcHeight * scale;
      return {
        scale,
        x: (PAGE_WIDTH - scaledWidth) / 2,
        y: (PAGE_HEIGHT - scaledHeight) / 2,
        drawBorder: false,
      };
    }

    case 'fit': {
      // Fit within margins (1 inch on all sides, plus space for header)
      const headerSpace = 36; // 0.5 inch for header
      const availWidth = PAGE_WIDTH - 2 * MARGIN;
      const availHeight = PAGE_HEIGHT - 2 * MARGIN - headerSpace;
      const scaleX = availWidth / srcWidth;
      const scaleY = availHeight / srcHeight;
      const scale = Math.min(scaleX, scaleY);
      const scaledWidth = srcWidth * scale;
      const scaledHeight = srcHeight * scale;
      return {
        scale,
        x: (PAGE_WIDTH - scaledWidth) / 2,
        y: MARGIN + (availHeight - scaledHeight) / 2,
        drawBorder: false,
      };
    }

    case 'border':
    default: {
      // 85% scale with border, centered
      const scale = 0.85;
      const scaledWidth = srcWidth * scale;
      const scaledHeight = srcHeight * scale;
      // Adjust vertical position to account for header
      const headerSpace = 36;
      const availHeight = PAGE_HEIGHT - headerSpace - MARGIN;
      return {
        scale,
        x: (PAGE_WIDTH - scaledWidth) / 2,
        y: MARGIN + (availHeight - scaledHeight) / 2,
        drawBorder: true,
      };
    }
  }
}

/**
 * Adds a placeholder page for text-only enclosures
 */
function addPlaceholderPage(
  mainPdf: PDFDocument,
  enclosure: EnclosureData,
  helveticaBold: Awaited<ReturnType<typeof mainPdf.embedFont>>,
  helvetica: Awaited<ReturnType<typeof mainPdf.embedFont>>,
  isError = false
): void {
  const page = mainPdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  // Add enclosure header
  addEnclosureHeader(page, enclosure.number, helveticaBold);

  // Add title in center
  const titleFontSize = 16;
  const title = enclosure.title;
  const titleWidth = helveticaBold.widthOfTextAtSize(title, titleFontSize);

  page.drawText(title, {
    x: (PAGE_WIDTH - titleWidth) / 2,
    y: PAGE_HEIGHT / 2 + 50,
    size: titleFontSize,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });

  // Add subtitle
  const subtitleFontSize = 12;
  const subtitle = isError
    ? '(Error loading PDF - document attached separately)'
    : '(Physical document attached separately)';
  const subtitleWidth = helvetica.widthOfTextAtSize(subtitle, subtitleFontSize);

  page.drawText(subtitle, {
    x: (PAGE_WIDTH - subtitleWidth) / 2,
    y: PAGE_HEIGHT / 2 - 20,
    size: subtitleFontSize,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  });
}

/**
 * Adds enclosure header at top center of page
 */
function addEnclosureHeader(
  page: PDFPage,
  enclosureNumber: number,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>
): void {
  const headerText = `Enclosure (${enclosureNumber})`;
  const fontSize = 10;
  const textWidth = font.widthOfTextAtSize(headerText, fontSize);

  page.drawText(headerText, {
    x: (PAGE_WIDTH - textWidth) / 2,
    y: PAGE_HEIGHT - 36, // 0.5 inch from top
    size: fontSize,
    font,
    color: rgb(0, 0, 0),
  });
}

/**
 * Adds page number at bottom center of page
 */
function addPageNumber(
  page: PDFPage,
  pageNum: number,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>
): void {
  const pageNumText = `${pageNum}`;
  const fontSize = 10;
  const textWidth = font.widthOfTextAtSize(pageNumText, fontSize);

  page.drawText(pageNumText, {
    x: (PAGE_WIDTH - textWidth) / 2,
    y: 36, // 0.5 inch from bottom
    size: fontSize,
    font,
    color: rgb(0, 0, 0),
  });
}
