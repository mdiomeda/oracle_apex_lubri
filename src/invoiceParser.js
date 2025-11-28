import fs from 'fs';
import path from 'path';

const decimalFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function normalizeNumber(raw) {
  if (!raw) return null;
  const withDots = raw.replace(/\./g, '').replace(/,/g, '.');
  const parsed = Number(withDots);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickSupplier(lines) {
  const supplierLine = lines.find((line) => /proveedor|vendor|supplier/i.test(line));
  if (supplierLine) {
    const [, value] = supplierLine.split(/:\s*/);
    if (value) return value.trim();
  }
  return lines.find((line) => line.trim().length > 3) || '';
}

function pickInvoiceNumber(lines) {
  const invoiceLine = lines.find((line) => /factura\s*(n|no|nº|n°|#)/i.test(line));
  if (!invoiceLine) return '';
  const match = invoiceLine.match(/factura\s*(?:n(?:o|º|°)?\.?)?\s*[:#-]?\s*([\w-]+)/i);
  return match?.[1] || '';
}

function pickDate(lines) {
  const joined = lines.join(' ');
  const match = joined.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/);
  return match?.[1] || '';
}

function parseLineItem(line) {
  const normalized = line.replace(/\s{2,}/g, ' ').trim();
  const parts = normalized.split(' ');
  if (parts.length < 3) return null;

  const qtyCandidate = normalizeNumber(parts[0]);
  if (!Number.isFinite(qtyCandidate)) return null;

  const priceMatch = normalized.match(/(\d+[.,]?\d*)\s*$/);
  if (!priceMatch) return null;
  const unitPrice = normalizeNumber(priceMatch[1]);
  if (!Number.isFinite(unitPrice)) return null;

  const description = normalized
    .replace(/^\d+[.,]?\d*\s+/, '')
    .replace(/\s+\d+[.,]?\d*$/, '')
    .trim();

  const totalPrice = Number((qtyCandidate * unitPrice).toFixed(2));

  return {
    description,
    quantity: qtyCandidate,
    unitPrice,
    totalPrice
  };
}

function pickItems(lines) {
  const detailIndex = lines.findIndex((line) => /detalle|concepto|descripcion/i.test(line));
  const start = detailIndex >= 0 ? detailIndex + 1 : 0;
  const candidates = lines.slice(start);

  const items = [];
  for (const line of candidates) {
    const cleaned = line.trim();
    if (!cleaned || cleaned.length < 5) continue;
    const item = parseLineItem(cleaned);
    if (item) items.push(item);
  }
  return items;
}

export function parseInvoiceText(text) {
  const rawLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const supplier = pickSupplier(rawLines);
  const invoiceNumber = pickInvoiceNumber(rawLines);
  const issueDate = pickDate(rawLines);
  const items = pickItems(rawLines);

  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);

  return {
    supplier,
    invoiceNumber,
    issueDate,
    items,
    subtotal: Number(decimalFormatter.format(subtotal).replace(/\./g, '').replace(/,/g, '.')),
    currency: 'ARS'
  };
}

export async function parseInvoicePdf(filePath, { pdfParser } = {}) {
  const resolvedPath = path.resolve(filePath);
  const buffer = await fs.promises.readFile(resolvedPath);
  let pdf = pdfParser;

  if (!pdf) {
    const pdfParsePath = path.join(process.cwd(), 'node_modules', 'pdf-parse', 'package.json');
    if (!fs.existsSync(pdfParsePath)) {
      throw new Error(
        'Dependencia faltante: instala las dependencias con "npm install" en la raíz del proyecto antes de ejecutar el parser (se requiere pdf-parse).'
      );
    }
    ({ default: pdf } = await import('pdf-parse'));
  }

  try {
    const result = await pdf(buffer);
    return parseInvoiceText(result.text);
  } catch (error) {
    const message = String(error?.message || error).toLowerCase();
    const looksCorrupted = message.includes('xref') || message.includes('unexpected object');
    const hint = looksCorrupted
      ? 'El PDF parece dañado o mal generado (por ejemplo, "bad XRef entry"). Abre el archivo y reexpórtalo como PDF estándar/PDF-A o imprime a PDF antes de volver a intentar.'
      : 'No se pudo leer el PDF. Confirma que el archivo no está protegido, corrupto o escaneado únicamente como imagen.';
    throw new Error(`${hint} Detalle original: ${error.message}`);
  }
}

export default {
  parseInvoiceText,
  parseInvoicePdf
};
