/**
 * Demo photos for destinations, vehicles and products.
 *
 *   npm run images:fetch   – finds freely licensed photos on Wikimedia Commons, has Cloudinary fetch
 *                            them into the "serendibgo/" folder, saves prisma/seed-images.json and
 *                            prisma/IMAGE_CREDITS.md, and updates the database.
 *   (seed.ts calls applySeedImages() so reseeding keeps the photos.)
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const MAP_FILE = path.join(__dirname, 'seed-images.json');
const CREDITS_FILE = path.join(__dirname, 'IMAGE_CREDITS.md');
const UA = 'SerendibGO-capstone/1.0 (student project; demo images)';

interface ImageRecord {
  url: string;
  title: string;
  author: string;
  license: string;
  source: string;
}
type ImageMap = Record<'destinations' | 'vehicles' | 'products', Record<string, ImageRecord>>;

// Wikipedia article titles to try, in order, for each item (the article's main photo is used).
const DESTINATIONS: Record<string, string[]> = {
  'Sigiriya Rock Fortress': ['Sigiriya'],
  'Dambulla Cave Temple': ['Dambulla cave temple'],
  'Polonnaruwa Ancient City': ['Gal Vihara', 'Polonnaruwa'],
  'Anuradhapura Sacred City': ['Ruwanwelisaya', 'Anuradhapura'],
  'Temple of the Sacred Tooth Relic': ['Temple of the Tooth'],
  'Royal Botanic Gardens, Peradeniya': ['Royal Botanical Gardens, Peradeniya'],
  'Pinnawala Elephant Orphanage': ['Pinnawala Elephant Orphanage'],
  'Gregory Lake, Nuwara Eliya': ['Gregory Lake', 'Nuwara Eliya'],
  'Pedro Tea Estate': ['Tea production in Sri Lanka', 'Nuwara Eliya'],
  'Horton Plains National Park': ['Horton Plains National Park'],
  'Nine Arches Bridge': ['Nine Arch Bridge', 'Nine Arches Bridge'],
  "Little Adam's Peak": ["Little Adam's Peak", 'Ella, Sri Lanka'],
  'Ravana Falls': ['Ravana Falls'],
  "Adam's Peak (Sri Pada)": ["Adam's Peak"],
  'Yala National Park': ['Yala National Park'],
  'Udawalawe National Park': ['Udawalawe National Park'],
  'Galle Fort': ['Galle Fort'],
  'Unawatuna Beach': ['Unawatuna'],
  'Mirissa Beach': ['Mirissa'],
  'Bentota Beach': ['Bentota'],
  'Arugam Bay': ['Arugam Bay'],
  'Nilaveli Beach': ['Nilaveli', 'Pigeon Island National Park'],
  'Minneriya National Park': ['Minneriya National Park'],
  'Gangaramaya Temple': ['Gangaramaya Temple'],
  'Nallur Kandaswamy Temple': ['Nallur Kandaswamy Kovil'],
};
const VEHICLES: Record<string, string[]> = {
  'Toyota Prius (Hybrid)': ['Toyota Prius'],
  'Toyota KDH High Roof': ['Toyota HiAce'],
  'Honda Vezel': ['Honda HR-V', 'Honda Vezel'],
  'Bajaj RE Tuk-tuk': ['Bajaj RE', 'Auto rickshaw'],
  'Honda Dio Scooter': ['Honda Dio', 'Scooter (motorcycle)'],
  'Toyota Coaster': ['Toyota Coaster'],
};
const PRODUCTS: Record<string, string[]> = {
  'True Ceylon Cinnamon Sticks (200 g)': ['Cinnamomum verum', 'Cinnamon'],
  'Black Pepper Corns (250 g)': ['Black pepper'],
  'Roasted Curry Powder (200 g)': ['Curry powder'],
  'High-Grown BOPF Black Tea (400 g)': ['Ceylon tea', 'Black tea'],
  'Ceylon Green Tea with Ginger (100 g)': ['Green tea'],
  'Handloom Cotton Sarong': ['Sarong', 'Handloom'],
  'Dumbara Rataa Table Mat Set': ['Dumbara mats', 'Mat', 'Handloom'],
  'Hand-carved Mahogany Elephant': ['Wood carving'],
  'Batik Peacock Wall Hanging': ['Batik'],
  'Kandyan Lacquer Jewellery Box': ['Lacquerware', 'Lacquer'],
  'Polished Coconut-shell Bowl Set': ['Coconut shell', 'Coconut'],
};

// Commons search used when no article photo is usable (default: "<name> Sri Lanka").
const SEARCH: Record<string, string> = {
  'Temple of the Sacred Tooth Relic': 'Sri Dalada Maligawa Kandy',
  'Royal Botanic Gardens, Peradeniya': 'Peradeniya botanical garden',
  'Pinnawala Elephant Orphanage': 'Pinnawala elephants river',
  'Horton Plains National Park': "Horton Plains World's End",
  "Little Adam's Peak": "Little Adam's Peak Ella",
  'Ravana Falls': 'Ravana Falls Ella',
  "Adam's Peak (Sri Pada)": 'Sri Pada Adams Peak',
  'Yala National Park': 'Yala National Park leopard',
  'Udawalawe National Park': 'Udawalawe elephants',
  'Nilaveli Beach': 'Nilaveli beach Trincomalee',
  'Minneriya National Park': 'Minneriya elephants',
  'Gangaramaya Temple': 'Gangaramaya temple Colombo',
  'Nallur Kandaswamy Temple': 'Nallur Kandaswamy temple Jaffna',
  'Honda Dio Scooter': 'Honda Dio scooter',
  'Toyota Coaster': 'Toyota Coaster bus',
  'True Ceylon Cinnamon Sticks (200 g)': 'cinnamon sticks quills',
  'Black Pepper Corns (250 g)': 'black peppercorns',
  'High-Grown BOPF Black Tea (400 g)': 'Ceylon black tea leaves',
  'Dumbara Rataa Table Mat Set': 'Dumbara mat weaving',
  'Hand-carved Mahogany Elephant': 'wooden elephant carving',
  'Batik Peacock Wall Hanging': 'batik Sri Lanka',
};

// Hand-picked Commons files (checked manually) – used before any search.
const EXACT_FILE: Record<string, string> = {
  'Ravana Falls': 'File:Ravana Falls Ella.jpg',
};

// Items whose article photo was unsuitable: search Commons with these terms first (tried in order).
const SEARCH_FIRST: Record<string, string[]> = {
  'Gregory Lake, Nuwara Eliya': ['Gregory Lake Nuwara Eliya', 'Lake Gregory'],
  'Galle Fort': ['Galle Fort lighthouse', 'Galle fort rampart'],
  "Little Adam's Peak": ["Little Adam's Peak", 'Little Adams Peak Ella'],
  'Ravana Falls': ['Ravana Ella falls', 'Ravana waterfall Ella'],
  'Yala National Park': ['Yala National Park elephant', 'Yala leopard'],
  'Udawalawe National Park': ['Udawalawe elephant', 'Uda Walawe elephants'],
  'Minneriya National Park': ['Minneriya elephants', 'Minneriya elephant gathering'],
  'Handloom Cotton Sarong': ['handloom sarong', 'sarong fabric', 'handloom weaving Sri Lanka'],
  'Dumbara Rataa Table Mat Set': ['Dumbara rata kalala', 'Sri Lanka handloom mat', 'woven mat Sri Lanka'],
  'Kandyan Lacquer Jewellery Box': ['Sri Lanka lacquer work', 'Laksha lacquer Sri Lanka', 'lacquerware box'],
  'Polished Coconut-shell Bowl Set': ['coconut shell bowl', 'coconut shell craft'],
  'Hand-carved Mahogany Elephant': ['wooden elephant statue', 'carved wooden elephant'],
};

const FREE = /^(cc[ -]?by|cc[ -]?by-sa|cc0|public domain|pd)/i;
const strip = (html = '') => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polite requests to Wikimedia: identified user agent, spacing, and back-off when rate-limited. */
async function wmFetch(url: string) {
  for (let i = 0; i < 5; i++) {
    await wait(700);
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res;
    if (res.status !== 429 && res.status < 500) throw new Error(`HTTP ${res.status}`);
    await wait(4000 * (i + 1));
  }
  throw new Error(`Wikimedia kept rate-limiting ${url}`);
}
const getJson = async (url: string) => (await wmFetch(url)).json();

type CommonsInfo = { thumburl: string; descriptionurl: string; width: number; extmetadata: Record<string, { value: string }> };

function toImage(file: string, ii: CommonsInfo | undefined) {
  if (!ii) return null;
  const license = strip(ii.extmetadata.LicenseShortName?.value);
  if (!FREE.test(license) || ii.width < 800) return null;
  return { thumb: ii.thumburl, title: file.replace(/^File:/, '').replace(/_/g, ' '), author: strip(ii.extmetadata.Artist?.value) || 'Unknown', license, source: ii.descriptionurl };
}

/** Free-licensed photo found by searching Wikimedia Commons directly. */
async function commonsSearch(query: string) {
  const j = await getJson(
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=${encodeURIComponent(query + ' filetype:bitmap')}&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1600`,
  );
  const pages = Object.values(j.query?.pages ?? {}) as { title: string; index: number; imageinfo?: CommonsInfo[] }[];
  for (const p of pages.sort((a, b) => a.index - b.index)) {
    const img = toImage(p.title, p.imageinfo?.[0]);
    if (img) return img;
  }
  return null;
}

/** Main photo of a Wikipedia article, with its Commons licence and author. */
async function wikiImage(title: string) {
  const page = await getJson(`https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageimages&piprop=name&titles=${encodeURIComponent(title)}`);
  const file = (Object.values(page.query?.pages ?? {})[0] as { pageimage?: string })?.pageimage;
  if (!file) return null;
  const info = await getJson(
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1600&titles=${encodeURIComponent('File:' + file)}`,
  );
  // Missing on Commons usually means a non-free image, which is skipped.
  return toImage(file, (Object.values(info.query?.pages ?? {})[0] as { imageinfo?: CommonsInfo[] })?.imageinfo?.[0]);
}

function cloudinary() {
  const m = (process.env.CLOUDINARY_URL ?? '').match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!m) throw new Error('Set CLOUDINARY_URL in backend/.env first');
  return { key: m[1], secret: m[2], cloud: m[3] };
}

/** Downloads the photo from Wikimedia (politely) and uploads the bytes to Cloudinary. */
async function uploadFromUrl(remoteUrl: string, folder: string, publicId: string) {
  const c = cloudinary();
  const bytes = new Uint8Array(await (await wmFetch(remoteUrl)).arrayBuffer());
  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string> = { folder, overwrite: 'true', public_id: publicId, timestamp: String(timestamp) };
  const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  const signature = crypto.createHash('sha1').update(toSign + c.secret).digest('hex');
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'image/jpeg' }), `${publicId}.jpg`);
  for (const [k, v] of Object.entries(params)) form.append(k, v);
  form.append('api_key', c.key);
  form.append('signature', signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${c.cloud}/image/upload`, { method: 'POST', body: form });
  const j = (await res.json()) as { secure_url?: string; error?: { message: string } };
  if (!j.secure_url) throw new Error(j.error?.message ?? `Cloudinary ${res.status}`);
  // Deliver a phone-friendly size in the best format for each device.
  return j.secure_url.replace('/image/upload/', '/image/upload/c_limit,w_1200,q_auto,f_auto/');
}

/** Applies seed-images.json to the current database (safe to run any number of times). */
export async function applySeedImages(prisma: PrismaClient) {
  if (!fs.existsSync(MAP_FILE)) return 0;
  const map = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8')) as ImageMap;
  let n = 0;
  for (const [name, img] of Object.entries(map.destinations ?? {})) n += (await prisma.destination.updateMany({ where: { name }, data: { imageUrl: img.url } })).count;
  for (const [makeModel, img] of Object.entries(map.vehicles ?? {})) n += (await prisma.vehicle.updateMany({ where: { makeModel }, data: { imageUrl: img.url } })).count;
  for (const [name, img] of Object.entries(map.products ?? {})) n += (await prisma.product.updateMany({ where: { name }, data: { imageUrls: [img.url] } })).count;
  // Tour packages show the photo of their first destination.
  const packages = await prisma.tourPackage.findMany({ where: { imageUrl: null }, include: { destinations: { orderBy: { dayNo: 'asc' }, include: { destination: true } } } });
  for (const p of packages) {
    const url = p.destinations.find((d) => d.destination.imageUrl)?.destination.imageUrl;
    if (url) {
      await prisma.tourPackage.update({ where: { id: p.id }, data: { imageUrl: url } });
      n++;
    }
  }
  return n;
}

async function fetchAll() {
  const map: ImageMap = fs.existsSync(MAP_FILE) ? JSON.parse(fs.readFileSync(MAP_FILE, 'utf8')) : { destinations: {}, vehicles: {}, products: {} };
  const groups: [keyof ImageMap, Record<string, string[]>][] = [
    ['destinations', DESTINATIONS],
    ['vehicles', VEHICLES],
    ['products', PRODUCTS],
  ];
  const missing: string[] = [];
  for (const [group, items] of groups) {
    for (const [name, titles] of Object.entries(items)) {
      if (map[group][name]) continue; // already uploaded
      let found = null;
      if (EXACT_FILE[name]) {
        const j = await getJson(
          `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1600&titles=${encodeURIComponent(EXACT_FILE[name])}`,
        ).catch(() => null);
        found = j ? toImage(EXACT_FILE[name], (Object.values(j.query?.pages ?? {})[0] as { imageinfo?: CommonsInfo[] })?.imageinfo?.[0]) : null;
      }
      for (const q of found ? [] : (SEARCH_FIRST[name] ?? [])) {
        found = await commonsSearch(q).catch(() => null);
        if (found) break;
      }
      for (const t of found ? [] : titles) {
        found = await wikiImage(t).catch(() => null);
        if (found) break;
      }
      if (!found) found = await commonsSearch(SEARCH[name] ?? `${name} Sri Lanka`).catch(() => null);
      if (!found) {
        missing.push(`${group}: ${name}`);
        console.log(`  ✗ ${name} – no free photo found`);
        continue;
      }
      try {
        const url = await uploadFromUrl(found.thumb, `serendibgo/${group}`, slug(name));
        map[group][name] = { url, title: found.title, author: found.author, license: found.license, source: found.source };
        console.log(`  ✓ ${name} (${found.license})`);
        fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 2));
      } catch (e) {
        missing.push(`${group}: ${name}`);
        console.log(`  ✗ ${name} – upload failed: ${(e as Error).message}`);
      }
      await wait(300);
    }
  }
  // Attribution file required by the CC BY / CC BY-SA licences.
  const lines = ['# Image credits', '', 'Demo photos come from Wikimedia Commons and are used under the licences below. They are hosted on Cloudinary for the app.', ''];
  for (const [group] of groups) {
    lines.push(`## ${group[0].toUpperCase()}${group.slice(1)}`, '', '| Used for | Photo | Author | Licence |', '|---|---|---|---|');
    for (const [name, img] of Object.entries(map[group])) lines.push(`| ${name} | [${img.title}](${img.source}) | ${img.author.replace(/\|/g, '/')} | ${img.license} |`);
    lines.push('');
  }
  fs.writeFileSync(CREDITS_FILE, lines.join('\n'));
  return missing;
}

if (require.main === module) {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config({ quiet: true });
    const prisma = new PrismaClient();
    try {
      console.log('Finding photos and uploading them to Cloudinary…');
      const missing = await fetchAll();
      console.log('\nCredits written to prisma/IMAGE_CREDITS.md');
      try {
        console.log(`Updated ${await applySeedImages(prisma)} database rows.`);
      } catch {
        console.log('Database not reachable – start MySQL and run `npm run images:fetch` again to apply the photos (uploads are kept).');
      }
      if (missing.length) console.log(`No photo for: ${missing.join('; ')}`);
    } finally {
      await prisma.$disconnect();
    }
  })();
}
