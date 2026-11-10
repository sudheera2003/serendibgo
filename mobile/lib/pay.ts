import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { api } from './api';
import { queryClient } from './query';
import { toast } from './toast';
import type { Payment } from './types';

interface InitResponse {
  payment: Payment & { gatewayRef: string };
  mode: 'payhere' | 'simulator';
  checkoutUrl: string;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Starts a payment for a booking or an order:
 * 1. the API creates a pending payment,
 * 2. the PayHere checkout (or the test simulator) opens in an in-app browser,
 * 3. after the browser closes the app polls the payment status.
 */
export async function pay(target: { bookingId: number } | { orderId: number }): Promise<'success' | 'pending' | 'failed'> {
  const init = await api.post<InitResponse>('/payments/init', target);
  if (Platform.OS === 'web') window.open(init.checkoutUrl, '_blank');
  else await WebBrowser.openBrowserAsync(init.checkoutUrl, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });

  let status: Payment['status'] = 'pending';
  const tries = Platform.OS === 'web' ? 30 : 6;
  for (let i = 0; i < tries; i++) {
    const { payment } = await api.get<{ payment: Payment }>(`/payments/${init.payment.id}`);
    status = payment.status;
    if (status !== 'pending') break;
    await wait(Platform.OS === 'web' ? 2000 : 1000);
  }
  queryClient.invalidateQueries();
  if (status === 'success') {
    toast.success('Payment successful', 'Your receipt is saved under Payments.');
    return 'success';
  }
  if (status === 'failed') {
    toast.info('Payment not completed', 'No money was taken. You can try again.');
    return 'failed';
  }
  toast.info('Payment pending', 'We will notify you when the payment is confirmed.');
  return 'pending';
}
