import "server-only";
import QRCode, { type QRCodeToDataURLOptions } from "qrcode";

type QrEncoder = (text: string, options: QRCodeToDataURLOptions) => Promise<string>;

const QR_OPTIONS: QRCodeToDataURLOptions = {
  errorCorrectionLevel: "M",
  margin: 2,
  width: 240,
  color: { dark: "#000000", light: "#ffffff" },
};

export function verificationQrDataUrl(
  verifyUrl: string,
  encode: QrEncoder = QRCode.toDataURL,
): Promise<string> {
  return encode(verifyUrl, QR_OPTIONS);
}
