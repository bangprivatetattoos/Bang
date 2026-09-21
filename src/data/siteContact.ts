// Official public contact details — the single source for every email, phone and WhatsApp action on the site.
export const siteContact = {
  email: 'bangprivatetattoos@gmail.com',
  whatsappDisplay: '+1 (646) 954-5537',
  whatsappNumber: '16469545537',
  // TODO: confirm the official BANG PRIVATE TATTOOS Instagram account. This is
  // the handle the legacy footer has been linking to; it does not match the
  // brand name and is very likely a leftover from an earlier design.
  instagramUrl: 'https://instagram.com/noir.studio',
} as const;

export const whatsappUrl = (message?: string) =>
  `https://wa.me/${siteContact.whatsappNumber}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
