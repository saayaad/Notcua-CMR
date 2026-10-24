import { z } from 'zod';
import { AppError } from '../../shared/errors.js';

export const pixKeySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    type: z.enum(['EMAIL', 'PHONE', 'CPF', 'CNPJ', 'RANDOM']),
    value: z.string().trim().min(1).max(77),
    merchantName: z.string().trim().min(1).max(25),
    merchantCity: z.string().trim().min(1).max(15),
    isFavorite: z.boolean().default(false),
  })
  .superRefine((key, context) => {
    const valid =
      key.type === 'EMAIL'
        ? z.string().email().safeParse(key.value).success
        : key.type === 'PHONE'
          ? /^\+[1-9]\d{7,14}$/.test(key.value)
          : key.type === 'RANDOM'
            ? z.string().uuid().safeParse(key.value).success
            : key.type === 'CPF'
              ? /^\d{11}$/.test(key.value)
              : /^\d{14}$/.test(key.value);
    if (!valid)
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Informe uma chave válida já cadastrada no seu banco, no formato do tipo selecionado.',
      });
  });

export function crc16(value: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(value, 'utf8')) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const ascii = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 $%*+\-./:]/g, '')
    .trim();
function field(id: string, value: string): string {
  const length = Buffer.byteLength(value);
  if (length > 99) throw new AppError(422, 'O conteúdo PIX excede o tamanho permitido.');
  return `${id}${String(length).padStart(2, '0')}${value}`;
}
export function pixPayload(
  key: { value: string; merchantName: string; merchantCity: string },
  amountInCents?: number,
  transactionId = '***',
): string {
  const name = ascii(key.merchantName);
  const city = ascii(key.merchantCity);
  if (!name || !city) throw new AppError(422, 'Nome e cidade do recebedor devem conter letras ou números.');
  if (
    amountInCents !== undefined &&
    (!Number.isSafeInteger(amountInCents) || amountInCents <= 0 || amountInCents > 999_999_999)
  )
    throw new AppError(422, 'Valor PIX inválido.');
  if (transactionId !== '***' && !/^[a-zA-Z0-9]{1,25}$/.test(transactionId))
    throw new AppError(422, 'Identificador PIX inválido.');
  const content =
    field('00', '01') +
    field('26', field('00', 'br.gov.bcb.pix') + field('01', key.value)) +
    field('52', '0000') +
    field('53', '986') +
    (amountInCents === undefined ? '' : field('54', (amountInCents / 100).toFixed(2))) +
    field('58', 'BR') +
    field('59', name.slice(0, 25)) +
    field('60', city.slice(0, 15)) +
    field('62', field('05', transactionId)) +
    '6304';
  return content + crc16(content);
}
