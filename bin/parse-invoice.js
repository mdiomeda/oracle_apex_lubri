#!/usr/bin/env node
import { parseInvoicePdf } from '../src/invoiceParser.js';

async function main() {
  const [filePath] = process.argv.slice(2);
  if (!filePath) {
    console.error('Uso: parse-invoice <ruta_al_pdf>');
    process.exit(1);
  }

  try {
    const invoice = await parseInvoicePdf(filePath);
    console.log(JSON.stringify(invoice, null, 2));
  } catch (error) {
    console.error('No se pudo leer la factura:', error.message);
    process.exit(1);
  }
}

main();
