import type { ProviderProfile, User, VendorProfile } from '@prisma/client';

/** The only user fields that ever leave the server (never the password hash). */
export function publicUser(u: User & { providerProfile?: ProviderProfile | null; vendorProfile?: VendorProfile | null }) {
  return {
    id: u.id,
    role: u.role,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    preferredCurrency: u.preferredCurrency,
    preferredLanguage: u.preferredLanguage,
    isEmailVerified: u.isEmailVerified,
    createdAt: u.createdAt,
    providerProfile: u.providerProfile ?? null,
    vendorProfile: u.vendorProfile ?? null,
  };
}
