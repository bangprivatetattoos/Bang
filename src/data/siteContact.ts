// Official public contact details — the single source for every email, phone and WhatsApp action on the site.
export const siteContact = {
  email: 'bangprivatetattoos@gmail.com',
  whatsappDisplay: '+1 (646) 954-5537',
  whatsappNumber: '16469545537',
} as const;

export const whatsappUrl = (message?: string) =>
  `https://wa.me/${siteContact.whatsappNumber}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
