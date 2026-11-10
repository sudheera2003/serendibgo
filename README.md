# SerendibGO

Tourism companion and artisan marketplace for Sri Lanka – IS 4110 capstone project.

One **React Native (Expo) mobile app** for all four roles (tourist, service provider, artisan vendor, administrator), one **Node.js/Express REST API**, and one **MySQL/MariaDB database**.

```
serendibgo/
├── backend/   Node.js + Express + TypeScript + Prisma (REST API, modules M1–M8)
└── mobile/    React Native + Expo Router + NativeWind + React Native Reusables (shadcn-style UI)
```

## 1. Prerequisites

| Tool | Notes |
|---|---|
| Node.js 20+ (tested with 24) | `node -v` |
| MySQL 8 or MariaDB 10.4+ | XAMPP's MariaDB works – start **MySQL** in the XAMPP Control Panel |
| Expo Go app on your phone | From the Play Store / App Store, must support **Expo SDK 58** |
| Phone and PC on the same Wi-Fi | Allow Node.js through Windows Firewall when asked (ports 4000 and 8081) |

## 2. Backend

```bash
cd backend
npm install
cp .env.example .env              # then edit if your MySQL user/password differ
npx prisma migrate deploy          # creates all tables + CHECK constraints
npm run db:seed                    # demo data (wipes the database first!)
npm run dev                        # http://localhost:4000  ·  docs: http://localhost:4000/api/docs
```

The server prints a **Network** address such as `http://192.168.1.20:4000` – that is what your phone uses.

Tests (use a separate `serendibgo_test` database, configured in `.env.test`):

```bash
npm test          # 34 tests: algorithms, PayHere signatures and end-to-end API flows
```

## 3. Mobile app

```bash
cd mobile
npm install
npx expo start            # scan the QR code with Expo Go (Android) or the Camera app (iOS)
npx expo start --web      # optional: run in a browser (handy for the admin screens)
```

The app automatically talks to port 4000 on the computer running Expo. To use a different API (e.g. a deployed one), create `mobile/.env` with:

```
EXPO_PUBLIC_API_URL=https://your-api.example.com
```

**Phone can't reach the PC over Wi-Fi?** Start MySQL in XAMPP, then run `npm run dev` from the repo root. It starts the backend (logs in `backend/dev.log`) and Expo with `--tunnel`; Metro forwards `/api` to the backend (`mobile/metro.config.js`), so that one tunnel is all the phone needs – just scan the QR code. Ctrl+C stops everything.

## 4. Demo accounts

All passwords are **`Password123`**. The login screen has one-tap buttons for these in development.

| Role | E-mail |
|---|---|
| Tourist | tourist@serendibgo.lk (also traveller@serendibgo.lk) |
| Guide | guide@serendibgo.lk |
| Tour operator | tours@serendibgo.lk |
| Vehicle owner | drive@serendibgo.lk |
| Vendor (spices & tea) | vendor@serendibgo.lk |
| Vendor (handloom & crafts) | handloom@serendibgo.lk |
| Pending provider / vendor (for the approval demo) | newguide@serendibgo.lk / newvendor@serendibgo.lk |
| Administrator | admin@serendibgo.lk |

New accounts need an e-mail code. Without SMTP settings the code is **printed in the API terminal** and shown on screen in development.

## 5. Optional integrations (`backend/.env`)

| Setting | Without it | With it |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` (Routes API enabled) | Distances are estimated from coordinates (straight line × 1.35, 40 km/h) | Real road distances and times via the Routes API (cached in the database) |
| `ORS_API_KEY` | – | OpenRouteService used when no Google key is set |
| `PAYHERE_MERCHANT_ID` + `PAYHERE_MERCHANT_SECRET` | Built-in **payment simulator** ("TEST MODE") | PayHere sandbox checkout; `PUBLIC_API_URL` must be reachable from the internet for `notify_url` (e.g. via ngrok) |
| `SMTP_*` | OTP codes printed in the log | Real e-mails |
| `CLOUDINARY_URL` (`cloudinary://API_KEY:API_SECRET@CLOUD_NAME`) | Uploads saved in `backend/uploads` | Uploads stored on Cloudinary |

**Demo photos**: `npm run images:fetch` finds freely licensed photos on Wikimedia Commons, uploads them to Cloudinary (`serendibgo/` folder) and saves the list in `prisma/seed-images.json`. `npm run db:seed` re-applies them automatically. Photo credits (required by the CC licences) are in `backend/prisma/IMAGE_CREDITS.md` – keep that file and mention it in your report.

**Push notifications**: the in-app notification centre always works. Real push needs a development build (`npx expo run:android` or EAS Build) because Expo Go on Android no longer supports remote push.

**Maps on Android builds**: Expo Go includes a Google Maps key; for your own build add `android.config.googleMaps.apiKey` in `app.json`.

## 6. How the proposal maps to the code

| Module | Backend | Mobile |
|---|---|---|
| M1 Auth & profiles | `src/modules/auth`, `src/modules/users` (JWT + rotating refresh tokens, OTP, RBAC, PDPA account deletion) | `app/(auth)`, profile screens |
| M2 Trip planner | `src/modules/trips`, `src/services/distance.ts`, `src/algorithms/routeOptimizer.ts` (nearest neighbour + 2-opt) | `app/tourist/trip/[id].tsx` |
| M3 Tour packages | `src/modules/packages` (comparison, availability) | `app/tourist/packages`, `app/provider/package-editor.tsx` |
| M4 Vehicle rental | `src/modules/vehicles`, `src/algorithms/pricing.ts` (itemised quotes, overlap check) | `app/tourist/vehicles`, `app/provider/vehicle-editor.tsx` |
| M3/M4 Bookings | `src/modules/bookings` (row locking, status workflow) | booking screens for tourist and provider |
| M5 Verified reviews | `src/modules/reviews`, `src/algorithms/trustScore.ts` (Bayesian), GPS check-ins (Haversine ≤ 500 m) | review screens, `components/app/reviews-list.tsx` |
| M6 Marketplace | `src/modules/marketplace` (multi-vendor order splitting, atomic stock) | `app/tourist/(tabs)/market.tsx`, cart, checkout, `app/vendor` |
| M7 Payments & notifications | `src/modules/payments` (PayHere hash + notify signature), `src/services/notify.ts` (Expo Push) | `lib/pay.ts`, `app/notifications.tsx` |
| M8 Admin | `src/modules/admin` (verification, moderation, complaints, analytics, audit log) | `app/admin` |

Security: Helmet, CORS, rate limiting on auth, Zod validation on every request, bcrypt (cost 12), 15-minute access tokens, secure token storage on the device, card data never touches the server.
