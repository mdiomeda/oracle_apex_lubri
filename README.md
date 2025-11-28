# Oracle APEX / JavaScript - Lector de facturas de proveedores

Este repositorio contiene una base JavaScript (apta para integrarse en Oracle APEX como servicio REST o proceso de servidor) que lee facturas en PDF de proveedores de un lubricentro y devuelve un JSON con los campos necesarios para cargar la factura y actualizar inventario.

## Características
- Lee archivos PDF de facturas y extrae texto con `pdf-parse`.
- Identifica proveedor, número de factura, fecha, productos, cantidades y precios mediante heurísticas pensadas para facturas simples.
- Expone una función reutilizable y un ejecutable CLI `parse-invoice` que devuelve el JSON en consola.

## Requisitos
- Node.js 18+.
- Para usar `parse-invoice` instale las dependencias: `npm install`.

## Uso rápido del CLI
```bash
node bin/parse-invoice.js ./ruta/a/factura.pdf
# o con el binario global
npx parse-invoice ./ruta/a/factura.pdf
```
La salida será un JSON similar a:
```json
{
  "supplier": "Lubricentro del Centro SA",
  "invoiceNumber": "A-00231",
  "issueDate": "12/03/2024",
  "items": [
    { "description": "Filtro de aceite 5W30", "quantity": 2, "unitPrice": 1500, "totalPrice": 3000 }
  ],
  "subtotal": 3000,
  "currency": "ARS"
}
```

## Uso como módulo
```javascript
import { parseInvoicePdf, parseInvoiceText } from './src/invoiceParser.js';

const invoice = await parseInvoicePdf('/tmp/factura.pdf');
// o si ya tienes el texto plano de la factura
const invoiceFromText = parseInvoiceText(textoPlano);
```

## Ajustar las heurísticas
Las facturas pueden variar mucho. Si una factura no se interpreta correctamente:
1. Revise el texto extraído del PDF (por ejemplo, con `pdftotext` o registrando `result.text`).
2. Ajuste las funciones de extracción en `src/invoiceParser.js`, especialmente `pickSupplier`, `pickInvoiceNumber`, `pickDate` y `parseLineItem`.
3. Agregue pruebas con ejemplos similares a sus facturas en `test/invoiceParser.test.js`.

## Pruebas
```bash
npm test
```
Las pruebas incluidas operan sobre texto de ejemplo para validar las heurísticas básicas.

## Demo web para subir un PDF
Si quieres probar desde el navegador:

```bash
npm install
npm run web
```

Luego abre `http://localhost:3000` y sube un PDF (campo `invoice`). El backend (Express + multer) guardará el archivo temporalmente,
usará `parseInvoicePdf` y devolverá el JSON mostrado en pantalla.
