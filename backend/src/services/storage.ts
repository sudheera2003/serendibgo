import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const cloud = (() => {
  const m = env.CLOUDINARY_URL.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  return m ? { apiKey: m[1], apiSecret: m[2], cloudName: m[3] } : null;
})();

export const storageMode = cloud ? 'cloudinary' : 'local';

/**
 * Stores an uploaded image or PDF and returns its public URL.
 * Uses Cloudinary when CLOUDINARY_URL is set (signed upload through the REST API);
 * otherwise saves the file in ./uploads and serves it from this API.
 */
export async function storeFile(file: { buffer: Buffer; mimetype: string; originalname: string }, ext: string): Promise<string> {
  if (!cloud) {
    const name = `${crypto.randomUUID()}${ext}`;
    await fs.promises.writeFile(path.join(UPLOAD_DIR, name), file.buffer);
    return `${env.PUBLIC_API_URL}/uploads/${name}`;
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'serendibgo';
  // Cloudinary signature: sha1 of the sorted parameters followed by the API secret.
  const signature = crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${cloud.apiSecret}`).digest('hex');
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.originalname);
  form.append('api_key', cloud.apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  form.append('signature', signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud.cloudName}/auto/upload`, { method: 'POST', body: form, signal: AbortSignal.timeout(30_000) });
  const data = (await res.json()) as { secure_url?: string; error?: { message: string } };
  if (!res.ok || !data.secure_url) throw new Error(`Cloudinary upload failed: ${data.error?.message ?? res.status}`);
  return data.secure_url;
}
