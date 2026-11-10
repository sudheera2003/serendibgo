import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { prisma } from '../lib/prisma';
import { isTest } from '../config/env';

const expo = new Expo();

interface NotifyInput {
  title: string;
  body: string;
  type: string;
  referenceType?: string;
  referenceId?: number;
}

/** Saves an in-app notification and sends a push message to the user's devices. */
export async function notify(userId: number, n: NotifyInput) {
  await prisma.notification.create({ data: { userId, ...n } });
  if (isTest) return;
  const tokens = await prisma.deviceToken.findMany({ where: { userId } });
  const messages: ExpoPushMessage[] = tokens
    .filter((t) => Expo.isExpoPushToken(t.expoPushToken))
    .map((t) => ({ to: t.expoPushToken, title: n.title, body: n.body, sound: 'default', data: { type: n.type, referenceType: n.referenceType, referenceId: n.referenceId } }));
  if (!messages.length) return;
  try {
    for (const chunk of expo.chunkPushNotifications(messages)) {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      // Remove tokens for uninstalled apps straight away.
      tickets.forEach(async (ticket, i) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          await prisma.deviceToken.deleteMany({ where: { expoPushToken: String(chunk[i].to) } });
        }
      });
    }
  } catch (err) {
    console.warn('[push] failed:', (err as Error).message);
  }
}

export async function notifyAdmins(n: NotifyInput) {
  const admins = await prisma.user.findMany({ where: { role: 'admin', status: 'active' }, select: { id: true } });
  await Promise.all(admins.map((a) => notify(a.id, n)));
}
