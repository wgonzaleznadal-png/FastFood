/**

* Servicio de impresión térmica con WebUSB y comandos ESC/POS

* Basado en la lógica de GastroDash 1.0

*/



// Comandos ESC/POS

const ESC = '\x1B';

const GS = '\x1D';



export const ESCPOS = {

INIT: ESC + '@',

NEWLINE: '\n',

BOLD_ON: ESC + 'E' + '\x01',

BOLD_OFF: ESC + 'E' + '\x00',

DOUBLE_HEIGHT: ESC + '!' + '\x10',

NORMAL_TEXT: ESC + '!' + '\x00',

ALIGN_CENTER: ESC + 'a' + '\x01',

ALIGN_LEFT: ESC + 'a' + '\x00',

CUT_PAPER: ESC + 'i',

FEED_3_LINES: ESC + 'd' + '\x03',

};





/**

* Sanitiza texto para impresión (elimina caracteres especiales)

*/

function sanitizeText(text: string): string {

return text

.normalize('NFD')

.replace(/[\u0300-\u036f]/g, '')

.replace(/[^\x20-\x7E]/g, '');

}



/**

* Crea una línea separadora

*/

function createLine(width: number = 42, char: string = '-'): string {

return char.repeat(width);

}



/**

* Formatea precio

*/

function formatPrice(amount: number): string {

return `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

}



/**

* Formatea fecha y hora

*/

function formatDateTime(dateString: string): string {

const date = new Date(dateString);

return date.toLocaleString('es-AR', {

day: '2-digit',

month: '2-digit',

year: 'numeric',

hour: '2-digit',

minute: '2-digit',

});

}





export interface TicketItem {

productName: string;

weightKg?: number;

pricePerKg?: number;

quantity?: number;

unitPrice?: number;

subtotal?: number;

unitType?: string;

notes?: string;

}



export interface ComandaData {

orderNumber: number;

customerName: string;

isDelivery?: boolean;

deliveryAddress?: string;

deliveryPhone?: string;

items: TicketItem[];

total?: number;

createdAt: string;

printCount?: number;

isCustomerTicket?: boolean;

headerTitle?: string;

paymentMethod?: string;

isPaid?: boolean;

// Para tickets híbridos con adiciones

isAddition?: boolean;

addedItems?: TicketItem[];

previousItems?: TicketItem[];

}



/**

* Cliente WebUSB para impresoras térmicas

*/

export class ThermalPrinter {

private device: USBDevice | null = null;

private width: number = 42;



/**

* Verifica si WebUSB está disponible

*/

static isSupported(): boolean {

return typeof navigator !== 'undefined' && 'usb' in navigator;

}



/**

* Intenta conectarse a una impresora ya autorizada, o solicita una nueva

*/

async requestDevice(): Promise<void> {

if (!ThermalPrinter.isSupported()) {

throw new Error('WebUSB no está soportado. Usa Chrome o Edge.');

}



try {

// Primero intentar obtener dispositivos ya autorizados

const devices = await navigator.usb.getDevices();


if (devices.length > 0) {

// Usar el primer dispositivo autorizado (auto-connect)

this.device = devices[0];

console.log('✅ Impresora encontrada (auto-connect)');

} else {

// Si no hay dispositivos autorizados, solicitar uno nuevo

console.log('⚠️ No hay impresoras autorizadas. Solicitando selección...');

this.device = await navigator.usb.requestDevice({ filters: [] });

console.log('✅ Impresora seleccionada');

}

} catch (error: any) {

throw new Error(`Error al solicitar dispositivo: ${error.message}`);

}

}



/**

* Conecta con la impresora

*/

async connect(): Promise<void> {

if (!this.device) {

throw new Error('No hay dispositivo seleccionado.');

}



try {

await this.device.open();


if (this.device.configuration === null) {

await this.device.selectConfiguration(1);

}


await this.device.claimInterface(0);

} catch (error: any) {

throw new Error(`Error al conectar: ${error.message}`);

}

}



/**

* Imprime datos binarios

*/

async print(data: Uint8Array): Promise<void> {

if (!this.device) {

throw new Error('No hay dispositivo conectado.');

}



try {

await this.device.transferOut(1, data as any);

} catch (error: any) {

throw new Error(`Error al imprimir: ${error.message}`);

}

}



/**

* Desconecta de la impresora

*/

async disconnect(): Promise<void> {

if (this.device && this.device.opened) {

try {

await this.device.close();

} catch (error: any) {

console.warn('Error al cerrar:', error);

}

}

this.device = null;

}



/**

* Genera el ticket de comanda en formato ESC/POS

*/

generateComanda(data: ComandaData): Uint8Array {

const { INIT, NEWLINE, BOLD_ON, BOLD_OFF, DOUBLE_HEIGHT, NORMAL_TEXT, ALIGN_CENTER, ALIGN_LEFT, CUT_PAPER } = ESCPOS;


let ticket = INIT;

const linea = createLine(this.width, '-');

const isSimpleComanda = !!data.headerTitle;



// HEADER CON LOGO

ticket += ALIGN_CENTER;

ticket += NEWLINE;

ticket += DOUBLE_HEIGHT + BOLD_ON;

ticket += 'PLAZA NADAL' + NEWLINE;

ticket += NORMAL_TEXT + BOLD_OFF;

ticket += BOLD_ON + 'Casa de Paellas' + BOLD_OFF + NEWLINE;

ticket += NEWLINE;


// Tipo de comanda

if (data.isAddition && data.addedItems && data.previousItems) {

// COMANDA HÍBRIDA CON ADICIÓN (prioridad sobre isSimpleComanda)

ticket += BOLD_ON + sanitizeText(data.headerTitle || 'ADICION [ENTREGA]') + BOLD_OFF + NEWLINE;

} else if (isSimpleComanda) {

// COMANDA SIMPLE (COCINA/BARRA/KILAJE)

ticket += BOLD_ON + sanitizeText(data.headerTitle!) + BOLD_OFF + NEWLINE;

// Marcar DUPLICADO si es re-impresión

const simplePrintCount = data.printCount || 0;

if (simplePrintCount > 0) {

ticket += DOUBLE_HEIGHT + BOLD_ON;

ticket += '** DUPLICADO #' + simplePrintCount + ' **' + NEWLINE;

ticket += NORMAL_TEXT + BOLD_OFF;

}

} else if (data.isCustomerTicket) {

ticket += DOUBLE_HEIGHT + BOLD_ON;

ticket += 'TICKET CLIENTE' + NEWLINE;

ticket += NORMAL_TEXT + BOLD_OFF;

} else if (data.isDelivery) {

ticket += sanitizeText('COMANDA DELIVERY') + NEWLINE;

} else {

ticket += sanitizeText('COMANDA RETIRO') + NEWLINE;


const printCount = data.printCount || 0;

if (printCount === 0) {

ticket += BOLD_ON + 'ORIGINAL' + BOLD_OFF + NEWLINE;

} else if (printCount === 1) {

ticket += BOLD_ON + '!RE-IMPRESION!' + BOLD_OFF + NEWLINE;

} else {

ticket += DOUBLE_HEIGHT + BOLD_ON;

ticket += '!RE-IMPRESION (' + printCount + ')!' + NEWLINE;

ticket += NORMAL_TEXT + BOLD_OFF;

}

}


ticket += linea + NEWLINE;



// INFO DEL PEDIDO

ticket += ALIGN_LEFT;

ticket += BOLD_ON + 'PEDIDO #' + data.orderNumber + BOLD_OFF + NEWLINE;


if (!isSimpleComanda) {

ticket += sanitizeText(formatDateTime(data.createdAt)) + NEWLINE;

}


ticket += linea + NEWLINE;



// DATOS DEL CLIENTE

if (!isSimpleComanda) {

if (data.isDelivery) {

ticket += NEWLINE;

ticket += DOUBLE_HEIGHT + BOLD_ON;

ticket += sanitizeText(data.customerName.toUpperCase()) + NEWLINE;

ticket += NORMAL_TEXT + BOLD_OFF;

ticket += NEWLINE;


if (data.deliveryAddress) {

ticket += BOLD_ON + 'DIR: ' + BOLD_OFF;

ticket += sanitizeText(data.deliveryAddress) + NEWLINE;

}


if (data.deliveryPhone) {

ticket += BOLD_ON + 'TEL: ' + BOLD_OFF;

ticket += sanitizeText(data.deliveryPhone) + NEWLINE;

}


// Indicador de pago MP

if (data.isPaid && data.paymentMethod === 'MERCADOPAGO') {

ticket += NEWLINE;

ticket += DOUBLE_HEIGHT + BOLD_ON;

ticket += '*** PAGADO MP ***' + NEWLINE;

ticket += NORMAL_TEXT + BOLD_OFF;

}


ticket += NEWLINE;

} else {

ticket += 'Cliente: ' + sanitizeText(data.customerName) + NEWLINE;

}


ticket += linea + NEWLINE;

} else {

// COMANDA SIMPLE: Solo nombre del cliente

ticket += 'Cliente: ' + sanitizeText(data.customerName) + NEWLINE;

ticket += linea + NEWLINE;

ticket += NEWLINE;

}



// ITEMS

if (data.isAddition && data.addedItems && data.previousItems) {

// TICKET HÍBRIDO: Mostrar adiciones y contexto

ticket += NEWLINE;

ticket += BOLD_ON + '=== AGREGAR ===' + BOLD_OFF + NEWLINE;

data.addedItems.forEach(item => {

ticket += DOUBLE_HEIGHT + BOLD_ON;

if (item.weightKg) {

ticket += item.weightKg.toFixed(3) + 'kg ' + sanitizeText(item.productName) + NEWLINE;

} else {

ticket += item.quantity + 'x ' + sanitizeText(item.productName) + NEWLINE;

}

ticket += NORMAL_TEXT + BOLD_OFF;

if (item.notes && item.notes.trim()) {

ticket += ' >> ' + sanitizeText(item.notes) + NEWLINE;

}

});


ticket += NEWLINE;

ticket += BOLD_ON + '=== TAMBIEN TIENE ===' + BOLD_OFF + NEWLINE;

data.previousItems.forEach(item => {

if (item.weightKg) {

ticket += item.weightKg.toFixed(3) + 'kg ' + sanitizeText(item.productName) + NEWLINE;

} else {

ticket += item.quantity + 'x ' + sanitizeText(item.productName) + NEWLINE;

}

if (item.notes && item.notes.trim()) {

ticket += ' >> ' + sanitizeText(item.notes) + NEWLINE;

}

});

} else if (isSimpleComanda) {
// COMANDA SIMPLE: Cantidad y nombre en grande
console.log('🖨️ DEBUG thermalPrinter - data.items:', data.items);
data.items.forEach(item => {
console.log('🖨️ DEBUG item en printer:', { productName: item.productName, weightKg: item.weightKg, quantity: item.quantity });
ticket += DOUBLE_HEIGHT + BOLD_ON;
if (item.weightKg) {
ticket += item.weightKg.toFixed(3) + 'kg ' + sanitizeText(item.productName) + NEWLINE;
} else {
ticket += item.quantity + 'x ' + sanitizeText(item.productName) + NEWLINE;
}
ticket += NORMAL_TEXT + BOLD_OFF;

// Aclaraciones del producto (se muestran en ENTREGA, COCINA y BARRA)
if (item.notes && item.notes.trim()) {
ticket += ' >> ' + sanitizeText(item.notes) + NEWLINE;
}
});

} else {

// COMANDA COMPLETA: Con todos los detalles

data.items.forEach(item => {

ticket += BOLD_ON + sanitizeText(item.productName) + BOLD_OFF + NEWLINE;


if (item.weightKg !== undefined && item.pricePerKg !== undefined) {

ticket += item.weightKg.toFixed(3) + ' kg x ' + formatPrice(item.pricePerKg) + '/kg' + NEWLINE;

} else if (item.quantity !== undefined && item.unitPrice !== undefined) {

ticket += item.quantity + ' x ' + formatPrice(item.unitPrice) + ' c/u' + NEWLINE;

}


// Aclaraciones del producto

if (item.notes && item.notes.trim()) {

ticket += ' >> ' + sanitizeText(item.notes) + NEWLINE;

}


if (item.subtotal !== undefined) {

ticket += ' ' + formatPrice(item.subtotal) + NEWLINE;

}

});



ticket += linea + NEWLINE;



// TOTAL

if (data.total !== undefined) {

ticket += DOUBLE_HEIGHT + BOLD_ON;

ticket += 'TOTAL ' + formatPrice(data.total) + NEWLINE;

ticket += NORMAL_TEXT + BOLD_OFF;

ticket += linea + NEWLINE;

}

}



// FOOTER

ticket += ALIGN_CENTER;


if (data.isCustomerTicket) {

ticket += NEWLINE;

ticket += sanitizeText('Gracias por tu compra!') + NEWLINE;

ticket += NEWLINE;

ticket += sanitizeText('NO VALIDO COMO FACTURA') + NEWLINE;

}


ticket += NEWLINE;

ticket += 'GastroDash' + NEWLINE;


ticket += NEWLINE + NEWLINE + NEWLINE + NEWLINE + NEWLINE;

ticket += CUT_PAPER;



return new TextEncoder().encode(ticket);

}



/**

* Imprime una comanda (método todo-en-uno)

*/

async printComanda(data: ComandaData): Promise<void> {

const ticketData = this.generateComanda(data);


try {

if (!this.device) {

await this.requestDevice();

}


await this.connect();

await this.print(ticketData);

} finally {

await this.disconnect();

}

}



/**

* Método estático para impresión rápida

*/

static async quickPrint(data: ComandaData): Promise<void> {

const printer = new ThermalPrinter();

await printer.printComanda(data);

}

}