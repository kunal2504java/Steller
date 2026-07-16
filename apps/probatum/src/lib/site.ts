export const DEFAULT_SITE_ORIGIN = "https://candela.dev";

export function siteOrigin(value = process.env.NEXT_PUBLIC_SITE_ORIGIN): string {
  if (!value) return DEFAULT_SITE_ORIGIN;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.origin
      : DEFAULT_SITE_ORIGIN;
  } catch {
    return DEFAULT_SITE_ORIGIN;
  }
}

export function verificationUrl(id: string, origin = siteOrigin()): string {
  return new URL(`/verify/${encodeURIComponent(id)}`, siteOrigin(origin)).toString();
}

export function linkedInShareUrl(verifyUrl: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(verifyUrl)}`;
}
