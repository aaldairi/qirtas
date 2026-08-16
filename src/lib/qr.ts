import QRCode from "qrcode";

/**
 * QR codes here end up printed on shelf labels and scanned by phone cameras
 * in shop lighting, so: error correction M, hard black on white, quiet zone
 * kept. Rendered as an SVG string so it stays crisp at any print size.
 */
export async function qrSvg(text: string, size = 256): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    width: size,
    color: { dark: "#1a1917ff", light: "#ffffffff" },
  });
}

export async function qrDataUrl(text: string, size = 512): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: size,
    color: { dark: "#1a1917ff", light: "#ffffffff" },
  });
}

/**
 * Raw PNG bytes for a QR code. Downloads on iOS Safari fail silently from a
 * data: URL, so the dialog links to a real route that returns this instead.
 */
export async function qrPng(text: string, size = 1024): Promise<Buffer> {
  return QRCode.toBuffer(text, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: size,
    color: { dark: "#1a1917ff", light: "#ffffffff" },
  });
}
