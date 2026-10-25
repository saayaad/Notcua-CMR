import { createHash } from 'node:crypto';
export function expandSpintax(text: string, seed: string) {
  let index = 0;
  let value = text;
  for (let depth = 0; depth < 10; depth++) {
    let changed = false;
    value = value.replace(/\{([^{}]*\|[^{}]*)\}/g, (_match, body: string) => {
      changed = true;
      const choices = body.split('|');
      const number = createHash('sha256').update(`${seed}:${index++}`).digest().readUInt32BE(0);
      return choices[number % choices.length] ?? '';
    });
    if (!changed) break;
  }
  return value;
}
export function chooseCampaignText(
  text: string,
  variants: string[] | undefined,
  index: number,
  seed: string,
) {
  return expandSpintax(variants?.length ? variants[index % variants.length]! : text, seed);
}
