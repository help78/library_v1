import QRCode from 'qrcode';

export interface QrCodeMatrix {
  size: number;
  svgPath: string;
  isDark: (row: number, col: number) => boolean;
}

export interface IdentityCardField {
  label: string;
  value: string;
  mono?: boolean;
}

export interface IdentityCardExportPayload {
  cardTitle: string;
  institutionName: string;
  institutionSubtitle: string;
  institutionLogoSrc: string | null;
  personName: string;
  personSubtitle: string;
  personPhotoSrc: string | null;
  primaryIdLabel: string;
  primaryIdValue: string;
  qrPayloadValue: string;
  fields: IdentityCardField[];
  fileName: string;
}

/**
 * Menghasilkan matriks QR Code standar ISO/IEC 18004 yang benar-benar dapat dipindai (scannable).
 */
export function buildQrCodeMatrix(rawValue: string): QrCodeMatrix {
  const content = (rawValue || 'JIBAS').trim() || 'JIBAS';
  const qr = QRCode.create(content, {
    errorCorrectionLevel: 'M',
  });
  const size = qr.modules.size;
  const parts: string[] = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (qr.modules.get(r, c)) {
        parts.push(`M${c},${r}h1v1h-1z`);
      }
    }
  }

  return {
    size,
    svgPath: parts.join(''),
    isDark: (row: number, col: number) => Boolean(qr.modules.get(row, col)),
  };
}

function loadImageElement(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
      }
      current = word;
      if (lines.length >= maxLines - 1) {
        break;
      }
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(last).width > maxWidth && last.length > 4) {
      last = `${last.slice(0, -4)}...`;
    }
    lines[maxLines - 1] = last;
  }

  return lines.length > 0 ? lines : [text];
}

function renderCardToCanvas(
  ctx: CanvasRenderingContext2D,
  payload: IdentityCardExportPayload,
  photoImg: HTMLImageElement | null,
  logoImg: HTMLImageElement | null
) {
  const W = 1020;
  const H = 640;

  ctx.clearRect(0, 0, W, H);

  // Latar belakang utama kartu CR80
  drawRoundedRectPath(ctx, 0, 0, W, H, 28);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.save();
  drawRoundedRectPath(ctx, 0, 0, W, H, 28);
  ctx.clip();

  // Header kelembagaan gelap
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, 136);

  // Strip footer bawah
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 540, W, 100);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 540);
  ctx.lineTo(W, 540);
  ctx.stroke();

  // Logo sekolah pada header bila tersedia
  let headerTextX = 48;
  if (logoImg && logoImg.naturalWidth > 0) {
    ctx.save();
    drawRoundedRectPath(ctx, 48, 30, 76, 76, 14);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.clip();
    const scale = Math.min(64 / logoImg.naturalWidth, 64 / logoImg.naturalHeight);
    const dw = logoImg.naturalWidth * scale;
    const dh = logoImg.naturalHeight * scale;
    ctx.drawImage(logoImg, 48 + (76 - dw) / 2, 30 + (76 - dh) / 2, dw, dh);
    ctx.restore();
    headerTextX = 144;
  }

  // Nama institusi & subjudul pada header
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 25px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
  const instLines = wrapCanvasText(ctx, payload.institutionName, 560, 1);
  ctx.fillText(instLines[0], headerTextX, 62);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '500 16px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
  const subLines = wrapCanvasText(ctx, payload.institutionSubtitle, 560, 1);
  ctx.fillText(subLines[0], headerTextX, 93);

  // Jenis kartu di sisi kanan header
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 18px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(payload.cardTitle, W - 48, 63);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 15px "JetBrains Mono", ui-monospace, monospace';
  ctx.fillText(`${payload.primaryIdLabel}: ${payload.primaryIdValue}`, W - 48, 93);
  ctx.textAlign = 'left';

  // Zona Kiri: Bingkai Pasfoto 3:4
  const photoX = 48;
  const photoY = 178;
  const photoW = 192;
  const photoH = 256;

  ctx.save();
  drawRoundedRectPath(ctx, photoX, photoY, photoW, photoH, 16);
  ctx.fillStyle = '#f1f5f9';
  ctx.fill();
  ctx.clip();

  if (photoImg && photoImg.naturalWidth > 0 && photoImg.naturalHeight > 0) {
    const imgRatio = photoImg.naturalWidth / photoImg.naturalHeight;
    const targetRatio = photoW / photoH;
    let sx = 0;
    let sy = 0;
    let sw = photoImg.naturalWidth;
    let sh = photoImg.naturalHeight;

    if (imgRatio > targetRatio) {
      sw = photoImg.naturalHeight * targetRatio;
      sx = (photoImg.naturalWidth - sw) / 2;
    } else {
      sh = photoImg.naturalWidth / targetRatio;
      sy = Math.max(0, (photoImg.naturalHeight - sh) * 0.15);
    }

    ctx.drawImage(photoImg, sx, sy, sw, sh, photoX, photoY, photoW, photoH);
  } else {
    const initials = (payload.personName || 'JB')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
    ctx.fillStyle = '#475569';
    ctx.font = '700 52px "Plus Jakarta Sans", ui-sans-serif, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials || 'ID', photoX + photoW / 2, photoY + photoH / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();

  drawRoundedRectPath(ctx, photoX, photoY, photoW, photoH, 16);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Zona Tengah: Detail Identitas
  const infoX = 272;
  const infoRight = 756;
  const infoMaxW = infoRight - infoX;

  ctx.fillStyle = '#0f172a';
  ctx.font = '700 28px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
  const nameLines = wrapCanvasText(ctx, payload.personName, infoMaxW, 2);
  let textY = 208;
  for (const line of nameLines) {
    ctx.fillText(line, infoX, textY);
    textY += 34;
  }

  ctx.fillStyle = '#475569';
  ctx.font = '500 17px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
  const personSubLines = wrapCanvasText(ctx, payload.personSubtitle, infoMaxW, 1);
  ctx.fillText(personSubLines[0], infoX, textY + 4);

  const dividerY = textY + 26;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(infoX, dividerY);
  ctx.lineTo(infoRight, dividerY);
  ctx.stroke();

  const colW = (infoMaxW - 24) / 2;
  const gridStartY = dividerY + 34;

  payload.fields.slice(0, 4).forEach((field, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const fx = infoX + col * (colW + 24);
    const fy = gridStartY + row * 80;

    ctx.fillStyle = '#64748b';
    ctx.font = '500 14px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(field.label, fx, fy);

    ctx.fillStyle = '#0f172a';
    ctx.font = field.mono
      ? '600 18px "JetBrains Mono", ui-monospace, monospace'
      : '600 18px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
    const valLines = wrapCanvasText(ctx, field.value || '-', colW, 1);
    ctx.fillText(valLines[0], fx, fy + 26);
  });

  // Garis pemisah vertikal menuju Zona QR Code
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(784, 178);
  ctx.lineTo(784, 496);
  ctx.stroke();

  // Zona Kanan: QR Code Standar Scannable
  const qrBoxX = 810;
  const qrBoxY = 188;
  const qrBoxSize = 162;
  const quietZone = 12;

  drawRoundedRectPath(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 14);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.stroke();

  const qrMatrix = buildQrCodeMatrix(payload.qrPayloadValue);
  const innerSize = qrBoxSize - quietZone * 2;
  const cellSize = innerSize / Math.max(qrMatrix.size, 1);

  ctx.fillStyle = '#0f172a';
  for (let r = 0; r < qrMatrix.size; r++) {
    for (let c = 0; c < qrMatrix.size; c++) {
      if (qrMatrix.isDark(r, c)) {
        const x0 = Math.floor(qrBoxX + quietZone + c * cellSize);
        const y0 = Math.floor(qrBoxY + quietZone + r * cellSize);
        const x1 = Math.floor(qrBoxX + quietZone + (c + 1) * cellSize);
        const y1 = Math.floor(qrBoxY + quietZone + (r + 1) * cellSize);
        ctx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
      }
    }
  }

  // Keterangan di bawah QR Code
  const qrCenterX = qrBoxX + qrBoxSize / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#475569';
  ctx.font = '500 13px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('Pindai Kode QR', qrCenterX, qrBoxY + qrBoxSize + 28);

  ctx.fillStyle = '#0f172a';
  ctx.font = '600 15px "JetBrains Mono", ui-monospace, monospace';
  const idShort = wrapCanvasText(ctx, payload.primaryIdValue, qrBoxSize, 1);
  ctx.fillText(idShort[0], qrCenterX, qrBoxY + qrBoxSize + 52);
  ctx.textAlign = 'left';

  // Informasi Footer Bawah
  ctx.fillStyle = '#475569';
  ctx.font = '500 15px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
  const footerLeft = wrapCanvasText(ctx, payload.institutionSubtitle, 580, 1);
  ctx.fillText(footerLeft[0], 48, 596);

  const yearNow = new Date().getFullYear();
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = '500 15px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`Kartu Digital Terverifikasi · ${yearNow}`, W - 48, 596);
  ctx.textAlign = 'left';

  ctx.restore();

  // Garis tepi luar kartu
  drawRoundedRectPath(ctx, 1, 1, W - 2, H - 2, 28);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.stroke();
}

export async function exportIdentityCardPng(
  payload: IdentityCardExportPayload
): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = 1020;
  canvas.height = 640;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  const [photoImg, logoImg] = await Promise.all([
    loadImageElement(payload.personPhotoSrc),
    loadImageElement(payload.institutionLogoSrc),
  ]);

  let dataUrl: string;
  try {
    renderCardToCanvas(ctx, payload, photoImg, logoImg);
    dataUrl = canvas.toDataURL('image/png');
  } catch {
    renderCardToCanvas(ctx, payload, null, null);
    dataUrl = canvas.toDataURL('image/png');
  }

  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = payload.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
