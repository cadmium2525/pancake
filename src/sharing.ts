import { platedPancake } from './plating';

export type ScoreCard = {
  total: number;
  technique: number;
  art: number;
  heat: number[];
  integrity: number;
};
export const SHARE_TAGS = '#PANCAKEAXEL #パンケーキチャレンジ';
export const SHARE_SENTENCE = '60秒のパンケーキ演技に挑戦しました！';
const number = (value: number) => value.toLocaleString('ja-JP');

export function scoreMessage(score: ScoreCard, url: string) {
  return `パンケーキを焼いて、飛ばして、${number(score.total)}点！🥞\n技術 ${number(score.technique)} / 芸術 ${number(score.art)}\n${SHARE_SENTENCE}\n${SHARE_TAGS}\n${url}`;
}

export function scoreShareData(score: ScoreCard, url: string, file?: File): ShareData {
  // Some share targets prioritize `url` and discard `text`. Keep the URL inside
  // the message, and include the image when the OS supports file sharing.
  return { title: 'PANCAKE AXEL スコアカード', text: scoreMessage(score, url), ...(file ? { files: [file] } : {}) };
}

export type ShareService = Pick<Navigator, 'share' | 'canShare'>;
export async function shareScore(score: ScoreCard, url: string, file: File, service: Partial<ShareService>): Promise<'image' | 'text' | 'unavailable'> {
  if (!service.share) return 'unavailable';
  let supportsFile = false;
  try { supportsFile = service.canShare?.({ files: [file] }) === true; } catch { /* Use the text fallback. */ }
  if (supportsFile) {
    try { await service.share(scoreShareData(score, url, file)); return 'image'; }
    catch (error) {
      // Cancellation is final. Permission and unexpected errors should be
      // surfaced to the player instead of opening another share sheet.
      if (!(error instanceof Error) || !['TypeError', 'NotSupportedError'].includes(error.name)) throw error;
    }
  }
  await service.share(scoreShareData(score, url));
  return 'text';
}

async function illustration(heat: number, integrity: number, side: number) {
  const url = URL.createObjectURL(new Blob([platedPancake(heat, integrity, side)], { type: 'image/svg+xml' }));
  const img = new Image();
  try {
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('Could not render pancake')); img.src = url; });
    return img;
  } finally { URL.revokeObjectURL(url); }
}

export async function createScoreCard(score: ScoreCard, url: string): Promise<File> {
  const [front, back] = await Promise.all([illustration(score.heat[0], score.integrity, 0), illustration(score.heat[1], score.integrity, 1)]);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1080;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable');
  const font = '"Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';
  const text = (content: string, y: number, size: number, color = '#594333', weight = 800, maxWidth = 920) => {
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    while (size > 12) { ctx.font = `${weight} ${size}px ${font}`; if (ctx.measureText(content).width <= maxWidth) break; size--; }
    ctx.fillText(content, 540, y);
  };
  ctx.fillStyle = '#f3e8ca'; ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.roundRect(30, 30, 1020, 1020, 42); ctx.fill();
  ctx.strokeStyle = '#ddcba6'; ctx.lineWidth = 3; ctx.stroke();
  text('PANCAKE AXEL', 105, 48);
  text('MY BREAKFAST RECORD', 158, 19, '#9d7755', 700);
  text(number(score.total), 262, 120, '#df7640');
  text('TOTAL SCORE', 346, 22, '#8d765e', 700);
  ctx.strokeStyle = '#e4d7bb'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(110, 390); ctx.lineTo(970, 390); ctx.stroke();
  text(`技術 ${number(score.technique)}　 /　 芸術 ${number(score.art)}`, 440, 34);
  ctx.drawImage(front, 56, 485, 480, 309); ctx.drawImage(back, 544, 485, 480, 309);
  ctx.fillStyle = '#83684e'; ctx.font = `800 25px ${font}`;
  ctx.fillText('表', 296, 790); ctx.fillText('裏', 784, 790);
  text(SHARE_SENTENCE, 856, 27);
  text(SHARE_TAGS, 920, 29, '#51816c');
  text(url.replace(/^https?:\/\//, ''), 984, 23, '#8c765c', 600);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG export failed')), 'image/png'));
  return new File([blob], `pancake-axel-${score.total}.png`, { type: 'image/png' });
}
