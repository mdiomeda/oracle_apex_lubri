import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseInvoiceText, parseInvoicePdf } from '../src/invoiceParser.js';

const samplePath = path.resolve('sample/invoice_sample.txt');
const sampleText = fs.readFileSync(samplePath, 'utf-8');

const invoice = parseInvoiceText(sampleText);

assert.strictEqual(invoice.supplier, 'Lubricentro del Centro SA');
assert.strictEqual(invoice.invoiceNumber, 'A-00231');
assert.strictEqual(invoice.issueDate, '12/03/2024');
assert.strictEqual(invoice.items.length, 2);

const [firstItem] = invoice.items;
assert.strictEqual(firstItem.description, 'Filtro de aceite 5W30');
assert.strictEqual(firstItem.quantity, 2);
assert.strictEqual(firstItem.unitPrice, 1500);
assert.strictEqual(firstItem.totalPrice, 3000);

console.log('Pruebas básicas OK');

const tempPdf = path.join(os.tmpdir(), 'fake-invoice.pdf');
fs.writeFileSync(tempPdf, Buffer.from('fake pdf content'));

await assert.rejects(
  parseInvoicePdf(tempPdf, {
    pdfParser: async () => {
      throw new Error('bad XRef entry');
    }
  }),
  (error) => error.message.includes('bad XRef entry') || error.message.includes('PDF parece dañado')
);

console.log('Manejo de PDF corrupto OK');

const tempRepairPdf = path.join(os.tmpdir(), 'fake-invoice-repair.pdf');
fs.writeFileSync(tempRepairPdf, Buffer.from('fake pdf content 2'));

let firstCall = true;
const stubParser = async () => {
  if (firstCall) {
    firstCall = false;
    throw new Error('bad XRef entry');
  }
  return { text: sampleText };
};

const repairFn = async (buffer) => Buffer.from(`${buffer.toString()} repaired`);

const repaired = await parseInvoicePdf(tempRepairPdf, { pdfParser: stubParser, repairPdfBuffer: repairFn });
assert.strictEqual(repaired.supplier, invoice.supplier);
console.log('Reparación de PDF corrupto OK');
