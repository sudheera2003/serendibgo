import type { Request } from 'express';
import { prisma } from '../lib/prisma';
import { forbidden } from '../lib/errors';
import { userId } from '../lib/auth';

/** Returns the caller's provider profile; listings require an approved profile. */
export async function myProvider(req: Request, mustBeApproved = true) {
  const p = await prisma.providerProfile.findUnique({ where: { userId: userId(req) } });
  if (!p) throw forbidden('Complete your provider application first');
  if (mustBeApproved && p.verificationStatus !== 'approved') throw forbidden('Your provider profile is waiting for admin approval');
  return p;
}

export async function myVendor(req: Request, mustBeApproved = true) {
  const v = await prisma.vendorProfile.findUnique({ where: { userId: userId(req) } });
  if (!v) throw forbidden('Complete your shop application first');
  if (mustBeApproved && v.verificationStatus !== 'approved') throw forbidden('Your shop is waiting for admin approval');
  return v;
}
