export type Watermark = {
  text: string;
  opacity: number;
  size?: number;
  position: 'bottom-right' | 'center' | 'diagonal';
  imageData?: string;
};

export async function drawWatermark(context: CanvasRenderingContext2D, width: number, height: number, mark: Watermark) {
  const text = mark.text.trim();
  if (!text && !mark.imageData) throw new Error('O modelo de marca d’água precisa de texto ou de um selo PNG.');
  let logo: HTMLImageElement | undefined;
  if (mark.imageData) {
    logo = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Não foi possível carregar o selo da marca d’água.'));
      image.src = mark.imageData!;
    });
  }
  const factor = Math.max(0.5, Math.min(2, (mark.size ?? 100) / 100));
  let fontSize = Math.max(8, Math.round(width * 0.035 * factor));
  context.save();
  try {
    context.globalAlpha = Math.max(0.1, Math.min(0.9, mark.opacity / 100));
    context.font = `700 ${fontSize}px Arial, sans-serif`;
    const maxWidth = width * 0.88;
    const measured = context.measureText(text).width;
    if (measured > maxWidth) fontSize *= maxWidth / measured;
    context.font = `700 ${fontSize}px Arial, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const logoHeight = logo ? Math.min(height * 0.4, width * 0.16 * factor) : 0;
    const logoWidth = logo ? Math.min(maxWidth, logoHeight * logo.naturalWidth / Math.max(logo.naturalHeight, 1)) : 0;
    const logoDrawHeight = logo ? logoWidth * logo.naturalHeight / Math.max(logo.naturalWidth, 1) : 0;
    const textWidth = context.measureText(text).width;
    const markWidth = Math.max(textWidth, logoWidth);
    const markHeight = logoDrawHeight + (text ? fontSize * 1.5 : 0);
    const draw = (x: number, y: number) => {
      context.save();
      context.translate(x, y);
      if (logo) context.drawImage(logo, -logoWidth / 2, -markHeight / 2, logoWidth, logoDrawHeight);
      if (text) {
        const baseline = markHeight / 2 - fontSize * 0.6;
        context.lineWidth = Math.max(1, fontSize * 0.12);
        context.strokeStyle = 'rgba(0,0,0,.72)';
        context.fillStyle = 'rgba(255,255,255,.95)';
        context.strokeText(text, 0, baseline);
        context.fillText(text, 0, baseline);
      }
      context.restore();
    };
    if (mark.position === 'diagonal') {
      context.translate(width / 2, height / 2);
      context.rotate(-Math.PI / 6);
      const extent = Math.hypot(width, height);
      const stepX = Math.max(width * 0.45, markWidth + fontSize * 2);
      const stepY = Math.max(height * 0.28, markHeight + fontSize * 2);
      for (let y = -extent; y <= extent; y += stepY)
        for (let x = -extent; x <= extent; x += stepX) draw(x, y);
    } else {
      const margin = Math.max(4, width * 0.025);
      draw(mark.position === 'center' ? width / 2 : width - margin - markWidth / 2,
        mark.position === 'center' ? height / 2 : height - margin - markHeight / 2);
    }
  } finally { context.restore(); }
}

export async function optimizeImage(file: File, mark?: Watermark): Promise<File> {
  if (!mark && (file.size < 700 * 1024 || file.type === 'image/gif')) return file;
  let bitmap: ImageBitmap | undefined;
  try {
    if (mark && file.type === 'image/gif') throw new Error('Para marcar uma imagem animada, use o formato de vídeo.');
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Seu navegador não disponibilizou o editor de imagem.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (mark) await drawWatermark(context, canvas.width, canvas.height, mark);
    const type = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, 0.9));
    if (!blob) throw new Error('Não foi possível finalizar a imagem.');
    if (!mark && blob.size >= file.size) return file;
    const extension = type === 'image/png' ? '.png' : type === 'image/webp' ? '.webp' : '.jpg';
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}${extension}`, { type, lastModified: Date.now() });
  } catch (error) {
    if (mark) throw new Error(`Não foi possível aplicar a marca d’água. Nenhum arquivo foi enviado. ${error instanceof Error ? error.message : ''}`);
    return file;
  } finally { bitmap?.close(); }
}

export async function createVideoWatermark(file: File, mark: Watermark): Promise<string> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('Não foi possível ler as dimensões do vídeo.')), 15_000);
      video.preload = 'metadata';
      video.onloadedmetadata = () => { clearTimeout(timer); resolve({ width: video.videoWidth, height: video.videoHeight }); };
      video.onerror = () => { clearTimeout(timer); reject(new Error('O navegador não conseguiu abrir este vídeo.')); };
      video.src = url;
    });
    if (!dimensions.width || !dimensions.height) throw new Error('Vídeo sem dimensões válidas.');
    const width = Math.max(2, Math.min(1920, dimensions.width) - Math.min(1920, dimensions.width) % 2);
    const height = Math.max(2, Math.round(dimensions.height * width / dimensions.width / 2) * 2);
    if (height > 4096) throw new Error('O vídeo é alto demais para aplicar a marca d’água.');
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Editor de imagem indisponível.');
    await drawWatermark(context, width, height, mark);
    return canvas.toDataURL('image/png');
  } finally {
    video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url);
  }
}
