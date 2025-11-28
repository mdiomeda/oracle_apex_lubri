# Oracle APEX / JavaScript - Lector de facturas de proveedores

Este repositorio contiene una base JavaScript (apta para integrarse en Oracle APEX como servicio REST o proceso de servidor) que lee facturas en PDF de proveedores de un lubricentro y devuelve un JSON con los campos necesarios para cargar la factura y actualizar inventario.

## Características
- Lee archivos PDF de facturas y extrae texto con `pdf-parse`.
- Identifica proveedor, número de factura, fecha, productos, cantidades y precios mediante heurísticas pensadas para facturas simples.
- Expone una función reutilizable y un ejecutable CLI `parse-invoice` que devuelve el JSON en consola.

## Requisitos
- Node.js 18+.
- Para usar `parse-invoice` instale las dependencias: `npm install`.

### ¿Cómo instalar Node.js y npm en Windows?
1. Descarga el instalador LTS oficial desde https://nodejs.org/es/download.
2. Ejecuta el instalador y deja marcada la casilla **Automatically install the necessary tools** si aparece.
3. Reinicia la terminal y verifica que todo quedó disponible:
   ```powershell
   node -v
   npm -v
   ```
4. Si prefieres usar el gestor de paquetes de Windows, en PowerShell puedes ejecutar:
   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```

## Uso rápido del CLI (local)
1. Instala dependencias (solo la primera vez):
   ```bash
   npm install
   ```

   > Si ves un error tipo `Cannot find package 'pdf-parse'`, verifica que ejecutas el comando **desde la raíz del proyecto**
   > y repite `npm install`. La dependencia `pdf-parse` se descarga automáticamente al correr ese comando.

2. Ejecuta el parser sobre un PDF de factura:
   ```bash
   node bin/parse-invoice.js ./ruta/a/factura.pdf
   # o con el binario global
   npx parse-invoice ./ruta/a/factura.pdf
   ```

   > Si recibes un error `bad XRef entry` u otro mensaje de referencia cruzada al ejecutar `npx parse-invoice`, el PDF suele estar dañado o fue generado con un exportador defectuoso. El parser intentará repararlo automáticamente y volver a leerlo; si persiste el error, ábrelo en tu visor de PDF y reexpórtalo como **PDF estándar** o **PDF/A**, o bien imprímelo nuevamente a PDF y vuelve a intentarlo.

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

## Demo web para subir un PDF (local)
1. Instala dependencias (si no lo hiciste antes):
   ```bash
   npm install
   ```

2. Arranca el servidor de prueba:
   ```bash
   npm run web
   ```

3. Abre `http://localhost:3000` en el navegador y selecciona tu PDF en el campo **Invoice PDF**. El backend (Express + multer) guarda el archivo en `/tmp`, invoca `parseInvoicePdf` y devuelve el JSON en pantalla.
