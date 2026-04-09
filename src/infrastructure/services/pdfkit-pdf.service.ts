import PDFDocument from 'pdfkit';
import { PdfService, AccountStatementData } from '../../domain/services/pdf.service';

// ─── Paleta de colores ────────────────────────────────────────────────────────
const COLORS = {
  primary: '#1a56db',     // Azul corporativo — encabezado, títulos de sección
  success: '#057a55',     // Verde — ventas PAID / crédito disponible
  warning: '#c27803',     // Ámbar — ventas PARTIAL
  danger: '#c81e1e',      // Rojo — ventas PENDING con saldo alto
  muted: '#6b7280',       // Gris — texto secundario
  border: '#e5e7eb',      // Borde suave de tablas
  headerBg: '#1e3a5f',    // Fondo encabezado principal
  sectionBg: '#f3f4f6',   // Fondo de encabezados de sección
  altRow: '#f9fafb',      // Fila alternada de tabla
  white: '#ffffff',
  black: '#111827',
} as const;

// ─── Dimensiones de página ────────────────────────────────────────────────────
const PAGE_MARGIN = 40;
const PAGE_WIDTH = 595.28;   // A4 en puntos
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

/**
 * Implementación concreta del PdfService usando PDFKit.
 *
 * Si en el futuro se reemplaza PDFKit por Puppeteer u otra librería,
 * solo se reescribe este archivo — el resto del sistema no cambia.
 */
export class PdfkitPdfService implements PdfService {
  async generateAccountStatement(data: AccountStatementData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.buildDocument(doc, data);
      doc.end();
    });
  }

  // ─── Construcción del documento ─────────────────────────────────────────────

  private buildDocument(doc: PDFKit.PDFDocument, data: AccountStatementData): void {
    this.drawHeader(doc, data);
    this.drawClientInfo(doc, data);
    this.drawCreditBar(doc, data.client.balance, data.client.creditLimit);
    this.drawSalesSection(doc, data.sales);
    this.drawPaymentsSection(doc, data.payments);
    this.drawFinancialSummary(doc, data);
    this.drawFooter(doc, data);
  }

  // ─── Encabezado principal ────────────────────────────────────────────────────

  private drawHeader(doc: PDFKit.PDFDocument, data: AccountStatementData): void {
    const headerHeight = 72;

    // Fondo del encabezado
    doc
      .rect(0, 0, PAGE_WIDTH, headerHeight)
      .fill(COLORS.headerBg);

    // Título
    doc
      .fillColor(COLORS.white)
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('Estado de Cuenta', PAGE_MARGIN, 18, { width: CONTENT_WIDTH / 2 });

    // Subtítulo
    doc
      .fillColor('#93c5fd')
      .fontSize(9)
      .font('Helvetica')
      .text('Sistema de Gestión de Créditos', PAGE_MARGIN, 42, { width: CONTENT_WIDTH / 2 });

    // Fecha de generación (alineada a la derecha)
    const generatedLabel = `Generado: ${this.formatDate(data.generatedAt)}`;
    const generatedByLabel = `Por: ${data.generatedBy}`;

    doc
      .fillColor(COLORS.white)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text(generatedLabel, PAGE_MARGIN + CONTENT_WIDTH / 2, 22, {
        width: CONTENT_WIDTH / 2,
        align: 'right',
      });

    doc
      .fillColor('#93c5fd')
      .fontSize(8)
      .font('Helvetica')
      .text(generatedByLabel, PAGE_MARGIN + CONTENT_WIDTH / 2, 36, {
        width: CONTENT_WIDTH / 2,
        align: 'right',
      });

    doc.moveDown(0.5);
    doc.y = headerHeight + 16;
  }

  // ─── Información del cliente ─────────────────────────────────────────────────

  private drawClientInfo(doc: PDFKit.PDFDocument, data: AccountStatementData): void {
    this.drawSectionTitle(doc, 'Información del Cliente');

    const { client } = data;
    const colW = CONTENT_WIDTH / 2 - 8;
    const startY = doc.y;

    // Columna izquierda
    this.drawLabelValue(doc, PAGE_MARGIN, startY, 'Cliente', client.name);
    this.drawLabelValue(doc, PAGE_MARGIN, startY + 24, 'Teléfono', client.phone);

    // Columna derecha
    const rightX = PAGE_MARGIN + colW + 16;
    this.drawLabelValue(doc, rightX, startY, 'Email', client.email ?? 'No registrado');
    this.drawLabelValue(
      doc,
      rightX,
      startY + 24,
      'ID',
      `#${client.id.slice(0, 8).toUpperCase()}`,
    );

    doc.y = startY + 52;
  }

  // ─── Barra de uso de crédito ─────────────────────────────────────────────────

  private drawCreditBar(
    doc: PDFKit.PDFDocument,
    balance: number,
    creditLimit: number,
  ): void {
    this.drawSectionTitle(doc, 'Posición de Crédito');

    const y = doc.y;
    const barWidth = CONTENT_WIDTH;
    const barHeight = 14;
    const usedFraction = creditLimit > 0 ? Math.min(balance / creditLimit, 1) : 0;
    const available = Math.max(creditLimit - balance, 0);

    // Fondo de la barra (gris claro)
    doc
      .roundedRect(PAGE_MARGIN, y, barWidth, barHeight, 4)
      .fillColor(COLORS.border)
      .fill();

    // Porción usada
    if (usedFraction > 0) {
      const usedColor = usedFraction > 0.8 ? COLORS.danger : usedFraction > 0.5 ? COLORS.warning : COLORS.success;
      doc
        .roundedRect(PAGE_MARGIN, y, barWidth * usedFraction, barHeight, 4)
        .fillColor(usedColor)
        .fill();
    }

    // Etiquetas debajo de la barra
    const labelY = y + barHeight + 6;
    doc
      .fillColor(COLORS.muted)
      .fontSize(8)
      .font('Helvetica')
      .text(`Deuda: ${this.formatCurrency(balance)}`, PAGE_MARGIN, labelY);

    doc
      .fillColor(COLORS.success)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text(
        `Disponible: ${this.formatCurrency(available)}`,
        PAGE_MARGIN,
        labelY,
        { width: CONTENT_WIDTH, align: 'center' },
      );

    doc
      .fillColor(COLORS.muted)
      .fontSize(8)
      .font('Helvetica')
      .text(`Límite: ${this.formatCurrency(creditLimit)}`, PAGE_MARGIN, labelY, {
        width: CONTENT_WIDTH,
        align: 'right',
      });

    doc.y = labelY + 20;
  }

  // ─── Sección de ventas ───────────────────────────────────────────────────────

  private drawSalesSection(doc: PDFKit.PDFDocument, sales: AccountStatementData['sales']): void {
    this.ensureSpace(doc, 80);
    this.drawSectionTitle(doc, `Ventas (${sales.length})`);

    if (sales.length === 0) {
      doc
        .fillColor(COLORS.muted)
        .fontSize(9)
        .font('Helvetica')
        .text('Sin ventas registradas.', PAGE_MARGIN, doc.y);
      doc.moveDown(1);
      return;
    }

    // Encabezados de columnas
    const cols = {
      id: { x: PAGE_MARGIN, w: 80 },
      date: { x: PAGE_MARGIN + 80, w: 80 },
      type: { x: PAGE_MARGIN + 160, w: 55 },
      status: { x: PAGE_MARGIN + 215, w: 60 },
      total: { x: PAGE_MARGIN + 275, w: 240 },
    };

    this.drawTableHeader(doc, [
      { label: 'ID Venta', x: cols.id.x, w: cols.id.w },
      { label: 'Fecha', x: cols.date.x, w: cols.date.w },
      { label: 'Tipo', x: cols.type.x, w: cols.type.w },
      { label: 'Estado', x: cols.status.x, w: cols.status.w },
      { label: 'Total', x: cols.total.x, w: cols.total.w },
    ]);

    sales.forEach((sale, idx) => {
      this.ensureSpace(doc, 32 + sale.items.length * 14);

      const rowY = doc.y;
      const rowH = 18;

      // Fila alternada
      if (idx % 2 === 0) {
        doc.rect(PAGE_MARGIN, rowY, CONTENT_WIDTH, rowH).fillColor(COLORS.altRow).fill();
      }

      // Datos de la fila principal
      const statusColor = this.saleStatusColor(sale.status);
      doc.fillColor(COLORS.black).fontSize(8).font('Helvetica');

      doc.text(`#${sale.id.slice(0, 8).toUpperCase()}`, cols.id.x + 2, rowY + 5, { width: cols.id.w - 4 });
      doc.text(this.formatDate(sale.createdAt), cols.date.x + 2, rowY + 5, { width: cols.date.w - 4 });
      doc.text(sale.type === 'CREDIT' ? 'Crédito' : 'Contado', cols.type.x + 2, rowY + 5, { width: cols.type.w - 4 });

      doc.fillColor(statusColor).font('Helvetica-Bold');
      doc.text(this.translateStatus(sale.status), cols.status.x + 2, rowY + 5, { width: cols.status.w - 4 });

      doc.fillColor(COLORS.black).font('Helvetica-Bold');
      doc.text(this.formatCurrency(sale.total), cols.total.x + 2, rowY + 5, { width: cols.total.w - 4, align: 'right' });

      doc.y = rowY + rowH;

      // Sub-filas de ítems
      sale.items.forEach((item) => {
        const itemY = doc.y;
        doc
          .rect(PAGE_MARGIN, itemY, CONTENT_WIDTH, 14)
          .fillColor('#f0f7ff')
          .fill();

        doc
          .fillColor(COLORS.muted)
          .fontSize(7.5)
          .font('Helvetica')
          .text(
            `  ↳ ${item.productName}`,
            PAGE_MARGIN + 8,
            itemY + 3,
            { width: 160 },
          )
          .text(
            `Cant: ${item.quantity}`,
            PAGE_MARGIN + 170,
            itemY + 3,
            { width: 60 },
          )
          .text(
            `P.Unit: ${this.formatCurrency(item.unitPrice)}`,
            PAGE_MARGIN + 235,
            itemY + 3,
            { width: 100 },
          )
          .text(
            `Sub: ${this.formatCurrency(item.subtotal)}`,
            PAGE_MARGIN + 340,
            itemY + 3,
            { width: CONTENT_WIDTH - 340, align: 'right' },
          );

        doc.y = itemY + 14;
      });

      // Línea separadora entre ventas
      doc
        .moveTo(PAGE_MARGIN, doc.y)
        .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .stroke();
    });

    doc.moveDown(1);
  }

  // ─── Sección de pagos ────────────────────────────────────────────────────────

  private drawPaymentsSection(doc: PDFKit.PDFDocument, payments: AccountStatementData['payments']): void {
    this.ensureSpace(doc, 80);
    this.drawSectionTitle(doc, `Pagos / Abonos (${payments.length})`);

    if (payments.length === 0) {
      doc
        .fillColor(COLORS.muted)
        .fontSize(9)
        .font('Helvetica')
        .text('Sin pagos registrados.', PAGE_MARGIN, doc.y);
      doc.moveDown(1);
      return;
    }

    const cols = {
      id: { x: PAGE_MARGIN, w: 80 },
      date: { x: PAGE_MARGIN + 80, w: 85 },
      sale: { x: PAGE_MARGIN + 165, w: 85 },
      note: { x: PAGE_MARGIN + 250, w: 145 },
      amount: { x: PAGE_MARGIN + 395, w: 120 },
    };

    this.drawTableHeader(doc, [
      { label: 'ID Pago', x: cols.id.x, w: cols.id.w },
      { label: 'Fecha', x: cols.date.x, w: cols.date.w },
      { label: 'Venta asociada', x: cols.sale.x, w: cols.sale.w },
      { label: 'Nota', x: cols.note.x, w: cols.note.w },
      { label: 'Monto', x: cols.amount.x, w: cols.amount.w },
    ]);

    payments.forEach((payment, idx) => {
      this.ensureSpace(doc, 22);
      const rowY = doc.y;
      const rowH = 18;

      if (idx % 2 === 0) {
        doc.rect(PAGE_MARGIN, rowY, CONTENT_WIDTH, rowH).fillColor(COLORS.altRow).fill();
      }

      doc.fillColor(COLORS.black).fontSize(8).font('Helvetica');
      doc.text(`#${payment.id.slice(0, 8).toUpperCase()}`, cols.id.x + 2, rowY + 5, { width: cols.id.w - 4 });
      doc.text(this.formatDate(payment.createdAt), cols.date.x + 2, rowY + 5, { width: cols.date.w - 4 });
      doc.text(
        payment.saleId ? `#${payment.saleId.slice(0, 8).toUpperCase()}` : '—',
        cols.sale.x + 2,
        rowY + 5,
        { width: cols.sale.w - 4 },
      );
      doc.text(payment.note ?? '—', cols.note.x + 2, rowY + 5, { width: cols.note.w - 4 });
      doc
        .fillColor(COLORS.success)
        .font('Helvetica-Bold')
        .text(this.formatCurrency(payment.amount), cols.amount.x + 2, rowY + 5, {
          width: cols.amount.w - 4,
          align: 'right',
        });

      doc.y = rowY + rowH;

      doc
        .moveTo(PAGE_MARGIN, doc.y)
        .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .stroke();
    });

    doc.moveDown(1);
  }

  // ─── Resumen financiero ──────────────────────────────────────────────────────

  private drawFinancialSummary(doc: PDFKit.PDFDocument, data: AccountStatementData): void {
    this.ensureSpace(doc, 100);
    this.drawSectionTitle(doc, 'Resumen Financiero');

    const totalSales = data.sales.reduce((s, sale) => s + sale.total, 0);
    const totalPayments = data.payments.reduce((s, p) => s + p.amount, 0);
    const creditSales = data.sales.filter((s) => s.type === 'CREDIT').length;
    const cashSales = data.sales.filter((s) => s.type === 'CASH').length;
    const pendingSales = data.sales.filter((s) => s.status === 'PENDING').length;
    const paidSales = data.sales.filter((s) => s.status === 'PAID').length;

    const boxW = (CONTENT_WIDTH - 8) / 3;
    const boxH = 60;
    const y = doc.y;

    const boxes = [
      {
        x: PAGE_MARGIN,
        label: 'Total Ventas',
        value: this.formatCurrency(totalSales),
        sub: `${data.sales.length} ventas (${creditSales} crédito, ${cashSales} contado)`,
        color: COLORS.primary,
      },
      {
        x: PAGE_MARGIN + boxW + 4,
        label: 'Total Abonado',
        value: this.formatCurrency(totalPayments),
        sub: `${data.payments.length} pagos registrados`,
        color: COLORS.success,
      },
      {
        x: PAGE_MARGIN + (boxW + 4) * 2,
        label: 'Saldo Pendiente',
        value: this.formatCurrency(data.client.balance),
        sub: `${pendingSales} ventas pendientes, ${paidSales} pagadas`,
        color: data.client.balance > data.client.creditLimit * 0.8 ? COLORS.danger : COLORS.warning,
      },
    ];

    boxes.forEach((box) => {
      // Fondo del recuadro
      doc
        .roundedRect(box.x, y, boxW, boxH, 6)
        .fillColor(COLORS.sectionBg)
        .fill();

      // Barra de color superior
      doc
        .rect(box.x, y, boxW, 4)
        .fillColor(box.color)
        .fill();

      // Etiqueta
      doc
        .fillColor(COLORS.muted)
        .fontSize(8)
        .font('Helvetica')
        .text(box.label, box.x + 8, y + 10, { width: boxW - 16 });

      // Valor principal
      doc
        .fillColor(box.color)
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(box.value, box.x + 8, y + 22, { width: boxW - 16 });

      // Sub-texto
      doc
        .fillColor(COLORS.muted)
        .fontSize(7)
        .font('Helvetica')
        .text(box.sub, box.x + 8, y + 42, { width: boxW - 16 });
    });

    doc.y = y + boxH + 16;
  }

  // ─── Pie de página ────────────────────────────────────────────────────────────

  private drawFooter(doc: PDFKit.PDFDocument, data: AccountStatementData): void {
    const footerY = doc.page.height - 40;

    doc
      .moveTo(PAGE_MARGIN, footerY)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, footerY)
      .strokeColor(COLORS.border)
      .lineWidth(1)
      .stroke();

    doc
      .fillColor(COLORS.muted)
      .fontSize(7)
      .font('Helvetica')
      .text(
        `Documento generado el ${this.formatDateTime(data.generatedAt)} — Confidencial`,
        PAGE_MARGIN,
        footerY + 8,
        { width: CONTENT_WIDTH, align: 'center' },
      );
  }

  // ─── Helpers de layout ────────────────────────────────────────────────────────

  private drawSectionTitle(doc: PDFKit.PDFDocument, title: string): void {
    const y = doc.y;
    doc
      .rect(PAGE_MARGIN, y, CONTENT_WIDTH, 20)
      .fillColor(COLORS.sectionBg)
      .fill();

    doc
      .fillColor(COLORS.primary)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(title, PAGE_MARGIN + 8, y + 5, { width: CONTENT_WIDTH - 16 });

    doc.y = y + 24;
  }

  private drawTableHeader(
    doc: PDFKit.PDFDocument,
    columns: { label: string; x: number; w: number }[],
  ): void {
    const y = doc.y;
    const rowH = 18;

    doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, rowH).fillColor(COLORS.primary).fill();

    columns.forEach((col) => {
      doc
        .fillColor(COLORS.white)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(col.label, col.x + 2, y + 5, { width: col.w - 4 });
    });

    doc.y = y + rowH;
  }

  private drawLabelValue(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    label: string,
    value: string,
  ): void {
    doc
      .fillColor(COLORS.muted)
      .fontSize(8)
      .font('Helvetica')
      .text(label, x, y, { width: 80 });

    doc
      .fillColor(COLORS.black)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(value, x + 82, y, { width: CONTENT_WIDTH / 2 - 90 });
  }

  /**
   * Verifica si quedan al menos `minSpace` puntos antes del final de la página.
   * Si no, agrega una nueva página para evitar cortes de tabla.
   */
  private ensureSpace(doc: PDFKit.PDFDocument, minSpace: number): void {
    const spaceLeft = doc.page.height - doc.page.margins.bottom - doc.y;
    if (spaceLeft < minSpace) {
      doc.addPage();
    }
  }

  // ─── Helpers de formato ───────────────────────────────────────────────────────

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Bogota',
    });
  }

  private formatDateTime(date: Date): string {
    return new Date(date).toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Bogota',
    });
  }

  private translateStatus(status: string): string {
    const map: Record<string, string> = {
      PAID: 'Pagado',
      PENDING: 'Pendiente',
      PARTIAL: 'Parcial',
    };
    return map[status] ?? status;
  }

  private saleStatusColor(status: string): string {
    const map: Record<string, string> = {
      PAID: COLORS.success,
      PENDING: COLORS.danger,
      PARTIAL: COLORS.warning,
    };
    return map[status] ?? COLORS.black;
  }
}
