import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { parseInvoiceText } from '../src/invoiceParser.js';

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
