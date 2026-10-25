import type { Conversation } from '../types.js';
export function cleanPhone(value: string) {
  if (!value || /lid:|@lid/i.test(value)) return '';
  const digits = value.replace(/@(s\.whatsapp\.net|c\.us)$/i, '').replace(/\D/g, '');
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : '';
}
export function formatContactPhone(value: string) {
  const phone = cleanPhone(value);
  if (!phone) return '';
  if (/^55\d{10,11}$/.test(phone)) {
    const local = phone.slice(4);
    return `+55 (${phone.slice(2, 4)}) ${local.slice(0, -4)}-${local.slice(-4)}`;
  }
  return `+${phone}`;
}
export function cleanContactName(name: string, phone: string) {
  const clean = name
    .replace(/\+?lid:[^\s·]+|\d+@lid|@(c\.us|s\.whatsapp\.net)/gi, '')
    .replace(/^[\s.·+\-]+|[\s.·\-]+$/g, '')
    .trim();
  return !clean || /^\+?[\d\s()\-]+$/.test(clean) ? formatContactPhone(phone) : clean;
}
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
export function validScheduledContacts(people: Conversation[]) {
  return people
    .filter((item) => !item.contact.isGroup && Boolean(cleanPhone(item.contact.phoneNumber)))
    .map((item) => ({
      ...item,
      contact: {
        ...item.contact,
        phoneNumber: cleanPhone(item.contact.phoneNumber),
        name: cleanContactName(item.contact.name, item.contact.phoneNumber),
      },
    }));
}
export function contactMatches(contact: { name: string; phoneNumber: string }, query: string) {
  const phone = cleanPhone(contact.phoneNumber);
  if (!phone) return false;
  const text = normalize(query);
  const digits = text.replace(/\D/g, '');
  if (!text) return true;
  if (/[a-z]/i.test(text)) return normalize(contact.name).includes(text);
  return (
    Boolean(digits) &&
    (phone.includes(digits) ||
      phone.replace(/^55/, '').includes(digits) ||
      phone.includes(digits.replace(/^55/, '')))
  );
}
export function newContactPhone(value: string) {
  if (/[a-z@]/i.test(value)) return '';
  const digits = value.replace(/\D/g, '');
  if (value.trim().startsWith('+')) return cleanPhone(digits);
  if (digits.length === 10 || digits.length === 11) return cleanPhone(`55${digits}`);
  return digits.length >= 12 ? cleanPhone(digits) : '';
}
