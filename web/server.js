import express from 'express';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseInvoicePdf } from '../src/invoiceParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const publicDir = path.join(__dirname, 'public');

app.use(express.static(publicDir));

app.post('/api/parse', upload.single('invoice'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Falta el archivo de factura en el campo "invoice".' });
  }

  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'invoice-'));
  const tempFile = path.join(tempDir, req.file.originalname || 'factura.pdf');

  try {
    await fs.promises.writeFile(tempFile, req.file.buffer);
    const invoice = await parseInvoicePdf(tempFile);
    return res.json({ invoice });
  } catch (error) {
    console.error('Error al procesar la factura', error);
    return res.status(500).json({ error: 'No se pudo procesar la factura.' });
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor web de facturas escuchando en http://localhost:${port}`);
});
