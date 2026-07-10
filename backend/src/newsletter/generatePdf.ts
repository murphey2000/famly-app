import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getGermanMonth } from './germanMonths.js';

interface NewsletterContent {
  headline: string;
  sections?: Array<{
    icon?: string;
    title: string;
    items: string[];
  }>;
  member_sections?: Array<{
    name: string;
    text: string;
    avatar_url?: string | null;
  }>;
  featured_photos?: Array<{
    url: string;
    post_title: string;
    author_name: string;
  }>;
  stats: { posts: number; photos: number; members_active: number };
  closing: string;
}

export async function generateNewsletterPdf(
  familyName: string,
  month: number,
  year: number,
  content: NewsletterContent
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const monthName = getGermanMonth(month);
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 60;
  const contentWidth = pageWidth - margin * 2;

  // Helper to wrap text
  function wrapText(text: string, maxWidth: number, fontSize: number, usedFont: typeof font): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = usedFont.widthOfTextAtSize(testLine, fontSize);
      if (width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  // --- Title Page ---
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Header bar
  page.drawRectangle({ x: 0, y: pageHeight - 80, width: pageWidth, height: 80, color: rgb(0.18, 0.47, 0.95) });
  page.drawText('Famly', { x: margin, y: pageHeight - 52, size: 28, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText('Monatlicher Rückblick', { x: margin, y: pageHeight - 72, size: 12, font, color: rgb(0.85, 0.9, 1) });

  y = pageHeight - 130;

  // Month/Year title
  page.drawText(`${monthName} ${year}`, { x: margin, y, size: 32, font: boldFont, color: rgb(0.1, 0.1, 0.2) });
  y -= 20;
  page.drawText(`Familie ${familyName}`, { x: margin, y, size: 18, font, color: rgb(0.4, 0.4, 0.5) });
  y -= 40;

  // Divider
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: rgb(0.85, 0.85, 0.9) });
  y -= 30;

  // Headline
  const headlineLines = wrapText(content.headline, contentWidth, 16, boldFont);
  for (const line of headlineLines) {
    page.drawText(line, { x: margin, y, size: 16, font: boldFont, color: rgb(0.18, 0.47, 0.95) });
    y -= 22;
  }
  y -= 10;

  // Stats box
  if (y < margin + 80) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  }
  page.drawRectangle({ x: margin, y: y - 60, width: contentWidth, height: 70, color: rgb(0.95, 0.97, 1), borderColor: rgb(0.8, 0.87, 1), borderWidth: 1 });
  page.drawText('📊 Statistiken des Monats', { x: margin + 15, y: y - 15, size: 12, font: boldFont, color: rgb(0.18, 0.47, 0.95) });
  page.drawText(
    `${content.stats.photos} Fotos  •  ${content.stats.posts} Beiträge  •  ${content.stats.members_active} Mitglieder`,
    { x: margin + 15, y: y - 38, size: 11, font, color: rgb(0.3, 0.3, 0.4) }
  );
  y -= 90;

  // Sections
  if (content.sections && content.sections.length > 0) {
    if (y < margin + 40) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText('Highlights', { x: margin, y, size: 16, font: boldFont, color: rgb(0.1, 0.1, 0.2) });
    y -= 8;
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: rgb(0.85, 0.85, 0.9) });
    y -= 20;

    for (const section of content.sections) {
      if (y < margin + 60) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      // Section title
      page.drawText(`${section.icon || '▸'} ${section.title}`, { x: margin + 10, y, size: 13, font: boldFont, color: rgb(0.18, 0.47, 0.95) });
      y -= 18;
      // Items
      for (const item of (section.items || [])) {
        if (y < margin + 20) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        const itemLines = wrapText(`• ${item}`, contentWidth - 20, 10, font);
        for (const line of itemLines) {
          page.drawText(line, { x: margin + 10, y, size: 10, font, color: rgb(0.25, 0.25, 0.3) });
          y -= 14;
        }
      }
      y -= 8;
    }
  }

  // Closing
  if (y < margin + 60) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  }
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: rgb(0.85, 0.85, 0.9) });
  y -= 20;
  const closingLines = wrapText(content.closing, contentWidth, 11, font);
  for (const line of closingLines) {
    if (y < margin + 20) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(line, { x: margin, y, size: 11, font, color: rgb(0.3, 0.3, 0.4) });
    y -= 16;
  }

  // Footer on last page
  page.drawText('Erstellt mit Famly • famly.app', {
    x: margin,
    y: 30,
    size: 9,
    font,
    color: rgb(0.65, 0.65, 0.7),
  });

  return pdfDoc.save();
}
