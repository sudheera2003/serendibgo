/* Demo data for development and the capstone demonstration. Run: npm run db:seed */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DAY = 86_400_000;
const today = () => new Date(new Date().toISOString().slice(0, 10));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

// Entrance fees are indicative foreign-visitor prices in LKR.
const destinations = [
  ['Sigiriya Rock Fortress', 'heritage', 'Central', 'Matale', 7.957, 80.7603, 10500, 'A 5th-century rock fortress and UNESCO World Heritage Site with frescoes and mirror wall.'],
  ['Dambulla Cave Temple', 'heritage', 'Central', 'Matale', 7.8567, 80.6492, 2000, 'Five cave shrines filled with Buddha statues and painted ceilings.'],
  ['Polonnaruwa Ancient City', 'heritage', 'North Central', 'Polonnaruwa', 7.9403, 81.0188, 9000, 'Ruins of the medieval capital, including the Gal Vihara rock carvings.'],
  ['Anuradhapura Sacred City', 'heritage', 'North Central', 'Anuradhapura', 8.3452, 80.3886, 9000, 'Ancient capital with giant dagobas and the sacred Sri Maha Bodhi tree.'],
  ['Temple of the Sacred Tooth Relic', 'religious', 'Central', 'Kandy', 7.2936, 80.6413, 2000, 'Kandy temple that houses the relic of the tooth of the Buddha.'],
  ['Royal Botanic Gardens, Peradeniya', 'nature', 'Central', 'Kandy', 7.269, 80.597, 3000, '147 acres of orchids, spice gardens and giant Java fig trees.'],
  ['Pinnawala Elephant Orphanage', 'wildlife', 'Sabaragamuwa', 'Kegalle', 7.3006, 80.3866, 3000, 'Care centre for orphaned elephants; watch them bathe in the river.'],
  ['Gregory Lake, Nuwara Eliya', 'hill_country', 'Central', 'Nuwara Eliya', 6.9581, 80.7725, 200, 'Lakeside park in "Little England", surrounded by tea-covered hills.'],
  ['Pedro Tea Estate', 'tea', 'Central', 'Nuwara Eliya', 6.9709, 80.7864, 500, 'Working tea factory with tours and tastings of high-grown Ceylon tea.'],
  ['Horton Plains National Park', 'nature', 'Central', 'Nuwara Eliya', 6.8022, 80.8027, 6000, 'Cloud-forest plateau with the dramatic World\'s End escarpment.'],
  ['Nine Arches Bridge', 'scenic', 'Uva', 'Badulla', 6.8768, 81.0608, 0, 'Colonial-era railway viaduct set in jungle and tea plantations.'],
  ['Little Adam\'s Peak', 'scenic', 'Uva', 'Badulla', 6.8698, 81.0619, 0, 'Easy hike with sweeping views over the Ella gap.'],
  ['Ravana Falls', 'nature', 'Uva', 'Badulla', 6.8406, 81.0533, 0, 'Wide waterfall beside the Ella–Wellawaya road.'],
  ['Adam\'s Peak (Sri Pada)', 'religious', 'Sabaragamuwa', 'Ratnapura', 6.8096, 80.4994, 0, 'Sacred mountain climbed overnight to watch the sunrise.'],
  ['Yala National Park', 'wildlife', 'Southern', 'Hambantota', 6.3725, 81.5185, 7500, 'Famous for leopards, elephants and sloth bears.'],
  ['Udawalawe National Park', 'wildlife', 'Sabaragamuwa', 'Ratnapura', 6.4744, 80.8986, 7000, 'Open grasslands with large herds of wild elephants.'],
  ['Galle Fort', 'heritage', 'Southern', 'Galle', 6.0267, 80.217, 0, 'Dutch-built fortified old town with ramparts, cafés and boutiques.'],
  ['Unawatuna Beach', 'beach', 'Southern', 'Galle', 6.0097, 80.2491, 0, 'Sheltered golden bay that is good for swimming and snorkelling.'],
  ['Mirissa Beach', 'beach', 'Southern', 'Matara', 5.9483, 80.4716, 0, 'Palm-lined beach and the main base for blue-whale watching.'],
  ['Bentota Beach', 'beach', 'Southern', 'Galle', 6.421, 79.996, 0, 'Long beach known for water sports and river safaris.'],
  ['Arugam Bay', 'beach', 'Eastern', 'Ampara', 6.8406, 81.8368, 0, 'World-class surf point and laid-back beach village.'],
  ['Nilaveli Beach', 'beach', 'Eastern', 'Trincomalee', 8.69, 81.19, 0, 'Calm turquoise water near Pigeon Island marine park.'],
  ['Minneriya National Park', 'wildlife', 'North Central', 'Polonnaruwa', 8.0367, 80.8919, 7000, 'Site of "The Gathering" of hundreds of elephants in the dry season.'],
  ['Gangaramaya Temple', 'religious', 'Western', 'Colombo', 6.9167, 79.8562, 500, 'Eclectic Colombo temple and museum by Beira Lake.'],
  ['Nallur Kandaswamy Temple', 'religious', 'Northern', 'Jaffna', 9.6747, 80.0295, 0, 'Golden Hindu temple and the heart of Jaffna\'s culture.'],
] as const;

async function reset() {
  const tables = await prisma.$queryRaw<{ t: string }[]>`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
  for (const { t } of tables) await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${t}\``);
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed a production database');
  await reset();
  const passwordHash = await bcrypt.hash('Password123', 12);
  const user = (email: string, fullName: string, role: 'tourist' | 'provider' | 'vendor' | 'admin', phone?: string) =>
    prisma.user.create({ data: { email, fullName, role, phone, passwordHash, isEmailVerified: true } });

  const admin = await user('admin@serendibgo.lk', 'Nimal Perera', 'admin', '0771234567');
  const tourist = await user('tourist@serendibgo.lk', 'Emma Carter', 'tourist', '0779876543');
  const tourist2 = await user('traveller@serendibgo.lk', 'Lukas Becker', 'tourist');
  const guideU = await user('guide@serendibgo.lk', 'Kasun Jayasinghe', 'provider', '0712223344');
  const operatorU = await user('tours@serendibgo.lk', 'Dilani Fernando', 'provider', '0713334455');
  const driveU = await user('drive@serendibgo.lk', 'Ruwan Bandara', 'provider', '0714445566');
  const pendingProvU = await user('newguide@serendibgo.lk', 'Sahan Wickramasinghe', 'provider');
  const spiceU = await user('vendor@serendibgo.lk', 'Chamari Silva', 'vendor', '0755556677');
  const loomU = await user('handloom@serendibgo.lk', 'Anoma Rathnayake', 'vendor', '0756667788');
  const pendingVendU = await user('newvendor@serendibgo.lk', 'Pradeep Kumara', 'vendor');

  const approved = { verificationStatus: 'approved' as const, verifiedById: admin.id, verifiedAt: new Date() };
  const guide = await prisma.providerProfile.create({ data: { userId: guideU.id, providerType: 'guide', businessName: 'Lanka Heritage Guides', licenceNo: 'SLTDA/NG/2023/0412', description: 'National tourist guides specialising in history and culture.', ...approved } });
  const operator = await prisma.providerProfile.create({ data: { userId: operatorU.id, providerType: 'tour_operator', businessName: 'Island Explorer Holidays', licenceNo: 'SLTDA/TO/2021/1188', description: 'Small-group tours across the island since 2015.', ...approved } });
  const drive = await prisma.providerProfile.create({ data: { userId: driveU.id, providerType: 'vehicle_owner', businessName: 'Kandy Drive Rentals', licenceNo: 'BR/KY/2019/5521', description: 'Family-run fleet with friendly English-speaking drivers.', ...approved } });
  await prisma.providerProfile.create({ data: { userId: pendingProvU.id, providerType: 'guide', businessName: 'Ella Hiking Buddy', licenceNo: 'SLTDA/AG/2026/0091', description: 'Chauffeur guide for the Ella and Haputale region.' } });
  await prisma.verificationDocument.create({ data: { userId: pendingProvU.id, docType: 'Guide licence', fileUrl: 'https://example.com/sample-licence.pdf' } });

  const spice = await prisma.vendorProfile.create({ data: { userId: spiceU.id, shopName: 'Ceylon Spice Garden', description: 'Organic spices from our garden in Matale.', address: 'No. 12, Spice Road, Matale', district: 'Matale', ...approved } });
  const loom = await prisma.vendorProfile.create({ data: { userId: loomU.id, shopName: 'Dumbara Handloom & Crafts', description: 'Traditional Dumbara weaving and hand-carved crafts.', address: 'Kalasirigama, Henawala', district: 'Kandy', ...approved } });
  await prisma.vendorProfile.create({ data: { userId: pendingVendU.id, shopName: 'Ambalangoda Masks', description: 'Hand-painted traditional masks.', address: 'Main Street, Ambalangoda', district: 'Galle' } });

  const dest: Record<string, number> = {};
  for (const [name, category, province, district, lat, lng, fee, description] of destinations) {
    const d = await prisma.destination.create({ data: { name, category, province, district, latitude: lat, longitude: lng, entryFee: fee, description } });
    dest[name] = d.id;
  }

  const pkg = (providerId: number, title: string, description: string, durationDays: number, pricePerPerson: number, maxGroupSize: number, inclusions: string[], exclusions: string[], itinerary: [string, number][]) =>
    prisma.tourPackage.create({
      data: {
        providerId,
        title,
        description,
        durationDays,
        pricePerPerson,
        maxGroupSize,
        inclusions,
        exclusions,
        cancellationPolicy: 'Free cancellation up to 48 hours before the start date.',
        destinations: { create: itinerary.map(([n, dayNo]) => ({ destinationId: dest[n], dayNo })) },
      },
    });
  const triangle = await pkg(operator.id, 'Cultural Triangle Explorer', 'Three days through Sri Lanka\'s ancient kingdoms: climb Sigiriya, explore the Dambulla caves and cycle the ruins of Polonnaruwa and Anuradhapura.', 3, 45000, 12,
    ['Air-conditioned transport', 'English-speaking guide', 'Hotel accommodation', 'Breakfast', 'Entrance tickets', 'Bottled water'], ['Lunch and dinner', 'Tips'],
    [['Sigiriya Rock Fortress', 1], ['Dambulla Cave Temple', 1], ['Polonnaruwa Ancient City', 2], ['Anuradhapura Sacred City', 3]]);
  await pkg(operator.id, 'Hill Country Tea Trail', 'From the Temple of the Tooth in Kandy to misty Nuwara Eliya, with a tea-factory tour and tasting.', 2, 32000, 10,
    ['Air-conditioned transport', 'English-speaking guide', 'Hotel accommodation', 'Breakfast', 'Tea factory tour'], ['Entrance tickets', 'Lunch and dinner', 'Tips'],
    [['Temple of the Sacred Tooth Relic', 1], ['Royal Botanic Gardens, Peradeniya', 1], ['Gregory Lake, Nuwara Eliya', 2], ['Pedro Tea Estate', 2]]);
  const ella = await pkg(operator.id, 'Ella Adventure Weekend', 'Hike Little Adam\'s Peak at sunrise, watch the train cross Nine Arches Bridge and cool off at Ravana Falls.', 2, 28000, 8,
    ['Air-conditioned transport', 'English-speaking guide', 'Hotel accommodation', 'Breakfast', 'Bottled water'], ['Lunch and dinner', 'Tips'],
    [['Little Adam\'s Peak', 1], ['Nine Arches Bridge', 1], ['Ravana Falls', 2]]);
  await pkg(operator.id, 'Southern Coast & Galle Fort', 'Walk the ramparts of Galle Fort, snorkel at Unawatuna and end with sunset at Mirissa.', 2, 30000, 12,
    ['Air-conditioned transport', 'English-speaking guide', 'Hotel accommodation', 'Breakfast', 'Snorkelling gear'], ['Whale-watching boat', 'Lunch and dinner', 'Tips'],
    [['Galle Fort', 1], ['Unawatuna Beach', 1], ['Mirissa Beach', 2]]);
  await pkg(operator.id, 'Yala Leopard Safari', 'Full-day jeep safari in Yala with an experienced tracker – the best chance to see leopards.', 1, 22000, 6,
    ['Safari jeep', 'Park tracker', 'Entrance tickets', 'Packed lunch', 'Bottled water'], ['Hotel accommodation', 'Tips'],
    [['Yala National Park', 1]]);
  const kandy = await pkg(guide.id, 'Kandy Heritage Walk', 'A relaxed guided day in Kandy: the Temple of the Tooth, the lake and the Peradeniya gardens.', 1, 9000, 8,
    ['English-speaking guide', 'Bottled water', 'Tuk-tuk transfers'], ['Entrance tickets', 'Lunch', 'Tips'],
    [['Temple of the Sacred Tooth Relic', 1], ['Royal Botanic Gardens, Peradeniya', 1]]);
  await pkg(guide.id, 'Sigiriya & Dambulla Day Trip', 'Climb the Lion Rock with a licensed guide who brings its history to life, then visit the Dambulla caves.', 1, 18000, 10,
    ['English-speaking guide', 'Air-conditioned transport', 'Bottled water'], ['Entrance tickets', 'Lunch', 'Tips'],
    [['Sigiriya Rock Fortress', 1], ['Dambulla Cave Temple', 1]]);

  const veh = (data: { vehicleType: string; makeModel: string; seats: number; withDriver: boolean; pricePerDay: number; pricePerKm: number; driverFeePerDay?: number; baseLocation: string }) =>
    prisma.vehicle.create({ data: { providerId: drive.id, driverFeePerDay: 0, ...data } });
  const prius = await veh({ vehicleType: 'car', makeModel: 'Toyota Prius (Hybrid)', seats: 4, withDriver: true, pricePerDay: 9500, pricePerKm: 45, driverFeePerDay: 3500, baseLocation: 'Kandy' });
  await veh({ vehicleType: 'van', makeModel: 'Toyota KDH High Roof', seats: 10, withDriver: true, pricePerDay: 14000, pricePerKm: 60, driverFeePerDay: 4000, baseLocation: 'Colombo' });
  await veh({ vehicleType: 'suv', makeModel: 'Honda Vezel', seats: 5, withDriver: false, pricePerDay: 12000, pricePerKm: 30, baseLocation: 'Kandy' });
  await veh({ vehicleType: 'tuk_tuk', makeModel: 'Bajaj RE Tuk-tuk', seats: 3, withDriver: false, pricePerDay: 4500, pricePerKm: 0, baseLocation: 'Ella' });
  await veh({ vehicleType: 'motorbike', makeModel: 'Honda Dio Scooter', seats: 2, withDriver: false, pricePerDay: 2500, pricePerKm: 0, baseLocation: 'Galle' });
  await veh({ vehicleType: 'minibus', makeModel: 'Toyota Coaster', seats: 25, withDriver: true, pricePerDay: 25000, pricePerKm: 85, driverFeePerDay: 5000, baseLocation: 'Colombo' });

  const cats: Record<string, number> = {};
  for (const [name, description] of [
    ['Spices', 'Cinnamon, pepper, cloves and spice blends'],
    ['Ceylon Tea', 'Single-estate black, green and white teas'],
    ['Handloom & Textiles', 'Hand-woven sarongs, scarves and Dumbara mats'],
    ['Wood Carvings', 'Hand-carved elephants, masks and décor'],
    ['Batik', 'Wax-resist dyed wall hangings and clothing'],
    ['Lacquerware & Crafts', 'Lacquer boxes, coconut-shell and brass crafts'],
  ]) cats[name] = (await prisma.productCategory.create({ data: { name, description } })).id;

  const prod = (vendorId: number, category: string, name: string, description: string, price: number, stockQty: number) =>
    prisma.product.create({ data: { vendorId, categoryId: cats[category], name, description, price, stockQty, imageUrls: [] } });
  const cinnamon = await prod(spice.id, 'Spices', 'True Ceylon Cinnamon Sticks (200 g)', 'Alba-grade Cinnamomum verum quills, hand-rolled in Matale.', 2400, 60);
  await prod(spice.id, 'Spices', 'Black Pepper Corns (250 g)', 'Bold, aromatic pepper grown without chemical sprays.', 1600, 80);
  await prod(spice.id, 'Spices', 'Roasted Curry Powder (200 g)', 'Traditional Sri Lankan dark-roasted curry blend.', 1200, 100);
  await prod(spice.id, 'Ceylon Tea', 'High-Grown BOPF Black Tea (400 g)', 'Bright, brisk tea from Nuwara Eliya estates.', 2800, 50);
  await prod(spice.id, 'Ceylon Tea', 'Ceylon Green Tea with Ginger (100 g)', 'Gentle green tea blended with dried ginger.', 1900, 40);
  const sarong = await prod(loom.id, 'Handloom & Textiles', 'Handloom Cotton Sarong', 'Hand-woven on traditional looms in natural dyes.', 5500, 20);
  await prod(loom.id, 'Handloom & Textiles', 'Dumbara Rataa Table Mat Set', 'Set of four mats in the 700-year-old Dumbara pattern.', 4200, 25);
  await prod(loom.id, 'Wood Carvings', 'Hand-carved Mahogany Elephant', 'Carved from sustainably sourced mahogany; 20 cm.', 8900, 12);
  await prod(loom.id, 'Batik', 'Batik Peacock Wall Hanging', 'Hand-drawn wax batik on cotton, 60 × 90 cm.', 7600, 10);
  await prod(loom.id, 'Lacquerware & Crafts', 'Kandyan Lacquer Jewellery Box', 'Turned wood box with traditional lacquer patterns.', 3900, 15);
  await prod(loom.id, 'Lacquerware & Crafts', 'Polished Coconut-shell Bowl Set', 'Set of two food-safe bowls from upcycled coconut shells.', 2200, 30);

  // --- Demo transactions so every screen has data -------------------------------------
  const pastStart = addDays(today(), -20);
  const doneBooking = await prisma.booking.create({
    data: { touristId: tourist.id, bookingType: 'package', packageId: kandy.id, startDate: pastStart, endDate: pastStart, numPersons: 2, priceBreakdown: [{ label: '2 person(s) × LKR 9000.00', amount: 18000 }], totalAmount: 18000, status: 'completed' },
  });
  await prisma.payment.create({ data: { bookingId: doneBooking.id, amount: 18000, gatewayRef: 'SGDEMO0001', status: 'success', method: 'simulator', paidAt: addDays(pastStart, -3) } });
  await prisma.review.create({ data: { touristId: tourist.id, targetType: 'package', targetId: kandy.id, bookingId: doneBooking.id, rating: 5, comment: 'Kasun was a fantastic guide – full of stories and very patient with our questions!' } });

  const rentStart = addDays(today(), -10);
  const doneRental = await prisma.booking.create({
    data: { touristId: tourist2.id, bookingType: 'vehicle', vehicleId: prius.id, startDate: rentStart, endDate: addDays(rentStart, 2), estimatedKm: 220, priceBreakdown: [{ label: 'Rental', amount: 28500 }, { label: 'Distance', amount: 9900 }, { label: 'Driver', amount: 10500 }], totalAmount: 48900, status: 'completed' },
  });
  await prisma.payment.create({ data: { bookingId: doneRental.id, amount: 48900, gatewayRef: 'SGDEMO0002', status: 'success', method: 'simulator', paidAt: addDays(rentStart, -1) } });
  await prisma.review.create({ data: { touristId: tourist2.id, targetType: 'vehicle', targetId: prius.id, bookingId: doneRental.id, rating: 4, comment: 'Clean car and a careful driver. Pickup was 15 minutes late.' } });

  const future = addDays(today(), 14);
  await prisma.booking.create({
    data: { touristId: tourist.id, bookingType: 'package', packageId: triangle.id, startDate: future, endDate: addDays(future, 2), numPersons: 2, priceBreakdown: [{ label: '2 person(s) × LKR 45000.00', amount: 90000 }], totalAmount: 90000, status: 'accepted' },
  });
  await prisma.booking.create({
    data: { touristId: tourist2.id, bookingType: 'package', packageId: ella.id, startDate: addDays(today(), 21), endDate: addDays(today(), 22), numPersons: 3, priceBreakdown: [{ label: '3 person(s) × LKR 28000.00', amount: 84000 }], totalAmount: 84000, status: 'pending' },
  });

  const order = await prisma.order.create({
    data: {
      touristId: tourist.id,
      totalAmount: 2 * 2400 + 5500,
      deliveryType: 'hotel',
      hotelName: 'Cinnamon Citadel Kandy',
      deliveryAddress: '124 Srimath Kuda Ratwatte Mawatha, Kandy',
      status: 'processing',
      items: { create: [{ productId: cinnamon.id, vendorId: spice.id, quantity: 2, unitPrice: 2400, itemStatus: 'delivered' }, { productId: sarong.id, vendorId: loom.id, quantity: 1, unitPrice: 5500, itemStatus: 'packed' }] },
    },
    include: { items: true },
  });
  await prisma.payment.create({ data: { orderId: order.id, amount: order.totalAmount, gatewayRef: 'SGDEMO0003', status: 'success', method: 'simulator', paidAt: addDays(today(), -2) } });

  // Visible GPS check-in so the tourist can review a destination in the demo.
  await prisma.destinationCheckin.create({ data: { touristId: tourist.id, destinationId: dest['Galle Fort'], latitude: 6.0268, longitude: 80.2171, distanceM: 15 } });

  await prisma.complaint.create({ data: { touristId: tourist2.id, targetType: 'booking', targetId: doneRental.id, subject: 'Driver arrived late', description: 'The driver arrived 15 minutes late on the first day and did not inform us.' } });

  for (const [code, rate] of [['USD', 300], ['EUR', 325], ['GBP', 385], ['INR', 3.55], ['AUD', 195], ['CNY', 41.5], ['JPY', 2.05], ['RUB', 3.4], ['CAD', 218]] as const) {
    await prisma.exchangeRate.create({ data: { currencyCode: code, rateToLkr: rate } });
  }

  // Ratings are recalculated through the same service the API uses.
  const { refreshRatings } = await import('../src/services/ratings');
  await refreshRatings('package', kandy.id);
  await refreshRatings('vehicle', prius.id);

  await prisma.notification.create({ data: { userId: tourist.id, title: 'Booking accepted', body: 'Your Cultural Triangle Explorer booking was accepted. Complete the payment to confirm it.', type: 'booking' } });

  // Demo photos hosted on Cloudinary (see prisma/seed-images.json and IMAGE_CREDITS.md).
  const { applySeedImages } = await import('./seed-images');
  const photos = await applySeedImages(prisma);
  if (photos) console.log(`Applied ${photos} demo photos from Cloudinary.`);

  console.log('\nSeed complete. Every demo account uses the password: Password123');
  console.table([
    { role: 'admin', email: admin.email },
    { role: 'tourist', email: tourist.email },
    { role: 'tourist', email: tourist2.email },
    { role: 'provider (guide)', email: guideU.email },
    { role: 'provider (tour operator)', email: operatorU.email },
    { role: 'provider (vehicle owner)', email: driveU.email },
    { role: 'provider (pending)', email: pendingProvU.email },
    { role: 'vendor (spices & tea)', email: spiceU.email },
    { role: 'vendor (handloom & crafts)', email: loomU.email },
    { role: 'vendor (pending)', email: pendingVendU.email },
  ]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
