import crypto from 'crypto';

const md5 = (s: string) => crypto.createHash('md5').update(s).digest('hex').toUpperCase();

describe('PayHere signatures', () => {
  // Import inside the test so env from setup-env is loaded first.
  const { payhereHash, payhereNotifySig } = jest.requireActual('../../src/modules/payments/routes') as typeof import('../../src/modules/payments/routes');

  it('builds the checkout hash from merchant id, order, amount, currency and hashed secret', () => {
    const expected = md5('1211149' + 'ORDER1' + '1000.00' + 'LKR' + md5('secret'));
    expect(payhereHash('ORDER1', 1000, 'LKR', '1211149', 'secret')).toBe(expected);
  });

  it('verifies the notification signature', () => {
    const p = { merchant_id: '1211149', order_id: 'ORDER1', payhere_amount: '1000.00', payhere_currency: 'LKR', status_code: '2' };
    const expected = md5('1211149ORDER11000.00LKR2' + md5('secret'));
    expect(payhereNotifySig(p, 'secret')).toBe(expected);
    expect(payhereNotifySig({ ...p, payhere_amount: '1.00' }, 'secret')).not.toBe(expected);
  });
});
