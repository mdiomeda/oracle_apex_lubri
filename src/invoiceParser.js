import fs from 'fs';
import path from 'path';

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

function looksLikeCode(token) {
  return /^[\w-]{4,}$/.test(token) && /[a-zA-Z]/.test(token);
}

function parseLineItem(line) {
  const normalized = line.replace(/\t/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const tokens = normalized.split(' ');
  if (tokens.length < 3) return null;

  const numericTokens = [];
  tokens.forEach((token, idx) => {
    const value = normalizeNumber(token);
    if (Number.isFinite(value)) {
      numericTokens.push({ idx, raw: token, value });
    }
  });

  if (numericTokens.length < 2) return null;

  let quantity;
  let unitPrice;
  let totalPrice;
  let cutIndex;

  if (numericTokens.length === 2) {
    const [qtyToken, priceToken] = numericTokens;
    quantity = qtyToken.value;
    unitPrice = priceToken.value;
    totalPrice = Number((quantity * unitPrice).toFixed(2));
    cutIndex = priceToken.idx;
  } else {
    const totalEntry = numericTokens[numericTokens.length - 1];
    const unitEntry = numericTokens[numericTokens.length - 2];
    const qtyEntry = numericTokens[numericTokens.length - 3];

    quantity = qtyEntry?.value ?? null;
    unitPrice = unitEntry.value;
    totalPrice = totalEntry.value;

    if (!quantity && unitPrice && totalPrice) {
      const computed = totalPrice / unitPrice;
      const rounded = Number(computed.toFixed(4));
      if (rounded > 0) {
        quantity = Number(Number(rounded).toFixed(rounded % 1 === 0 ? 0 : 2));
      }
    }

    cutIndex = quantity != null ? qtyEntry?.idx ?? unitEntry.idx : unitEntry.idx;
  }

  let descStart = 0;
  if (tokens.length > 0 && looksLikeCode(tokens[0])) {
    descStart = 1;
  }
  // For lines that start directly with quantity, skip that leading number in the description.
  if (numericTokens[0].idx === 0 && descStart === 0) {
    descStart = 1;
  }

  const description = tokens.slice(descStart, cutIndex).join(' ').trim();

  if (!description || quantity == null || !Number.isFinite(unitPrice) || !Number.isFinite(totalPrice)) {
    return null;
  }

  return {
    description,
    quantity,
    unitPrice,
    totalPrice
  };
}

function pickItems(lines) {
  const detailIndex = lines.findIndex((line) => /detalle|concepto|descripcion/i.test(line));
  const start = detailIndex >= 0 ? detailIndex + 1 : 0;
  const candidates = lines.slice(start).filter((line) => {
    const numericCount = (line.match(/[-+]?\d[\d.,]*/g) || []).length;
    return numericCount >= 2 && !/total\s*(bruto|general|neto)?/i.test(line);
  });

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
    subtotal: Number(subtotal.toFixed(2)),
    currency: 'ARS'
  };
}

async function ensurePdfParser(pdfParser) {
  if (pdfParser) return pdfParser;
  const pdfParsePath = path.join(process.cwd(), 'node_modules', 'pdf-parse', 'package.json');
  if (!fs.existsSync(pdfParsePath)) {
    throw new Error(
      'Dependencia faltante: instala las dependencias con "npm install" en la raíz del proyecto antes de ejecutar el parser (se requiere pdf-parse).'
    );
  }
  const { default: pdf } = await import('pdf-parse');
  return pdf;
}

async function repairPdfBuffer(buffer, repairFn) {
  if (repairFn) return repairFn(buffer);
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
  return Buffer.from(await doc.save());
}

function buildCorruptionHint(originalMessage) {
  return `El PDF parece dañado o mal generado (por ejemplo, "bad XRef entry"). Abre el archivo y reexpórtalo como PDF estándar/PDF-A o imprime a PDF antes de volver a intentar. Detalle original: ${originalMessage}`;
}

export async function parseInvoicePdf(filePath, { pdfParser, repairPdfBuffer: repairFn } = {}) {
  const resolvedPath = path.resolve(filePath);
  const buffer = await fs.promises.readFile(resolvedPath);
  const pdf = await ensurePdfParser(pdfParser);

  const tryParse = async (inputBuffer) => {
    const result = await pdf(inputBuffer);
    return parseInvoiceText(result.text);
  };

  try {
    return await tryParse(buffer);
  } catch (error) {
    const message = String(error?.message || error).toLowerCase();
    const looksCorrupted = message.includes('xref') || message.includes('unexpected object');
    const hint = looksCorrupted
      ? buildCorruptionHint(error.message)
      : `No se pudo leer el PDF. Confirma que el archivo no está protegido, corrupto o escaneado únicamente como imagen. Detalle original: ${error.message}`;

    if (!looksCorrupted) throw new Error(hint);

    try {
      const repairedBuffer = await repairPdfBuffer(buffer, repairFn);
      return await tryParse(repairedBuffer);
    } catch (repairError) {
      const repairMessage = repairError?.message || repairError;
      throw new Error(`${hint} | Intentamos repararlo pero falló: ${repairMessage}`);
    }
  }
}

export default {
  parseInvoiceText,
  parseInvoicePdf
};
