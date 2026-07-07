import { customAlphabet } from 'nanoid';

const nano = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);

const translitMap: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};

export function slugify(text: string): string {
  const lower = text.toLowerCase().trim();
  let out = '';
  for (const ch of lower) {
    out += translitMap[ch] ?? ch;
  }
  return (
    out
      .replace(/['']/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'item'
  );
}

export function uniqueSlug(text: string): string {
  return `${slugify(text)}-${nano()}`;
}

// Bron uchun qisqa, o'qiladigan kod: DG-XXXXXX
const codeNano = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);
export function bookingCode(): string {
  return `DG-${codeNano()}`;
}
