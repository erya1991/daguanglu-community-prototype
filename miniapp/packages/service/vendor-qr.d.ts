declare module "qrcode-terminal/vendor/QRCode/index.js" {
  /** MIT QR encoder already present in the locked qrcode-terminal 0.12.0 vendor. */
  export default class QRCode {
    constructor(typeNumber: number, errorCorrectLevel: number);
    addData(data: string): void;
    make(): void;
    getModuleCount(): number;
    isDark(row: number, column: number): boolean;
  }
}
