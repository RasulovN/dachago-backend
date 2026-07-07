import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { customAlphabet } from 'nanoid';

const prisma = new PrismaClient();
const slugNano = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);

const slugFor = (titleEn: string) =>
  `${titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${slugNano()}`;

async function main() {
  console.log('🌱 Seed boshlandi...');

  // --- Super admin ---
  const adminPassword = await argon2.hash('admin123');
  const admin = await prisma.user.upsert({
    where: { phone: '+998901112233' },
    update: {},
    create: {
      phone: '+998901112233',
      email: 'admin@sayohatgo.uz',
      password: adminPassword,
      role: 'SUPER_ADMIN',
      status: 'APPROVED',
    },
  });
  console.log(`✅ Super admin: ${admin.phone} / admin123`);

  // --- Sayt sozlamalari ---
  await prisma.siteSettings.upsert({ where: { id: 1 }, update: {}, create: {} });
  console.log('✅ Sayt sozlamalari (standart qiymatlar bilan)');

  // --- Zonalar ---
  const zonesData = [
    {
      slug: 'maydanak',
      nameUz: 'Maydanak',
      nameRu: 'Майданак',
      nameEn: 'Maydanak',
      descUz: 'Osmon tiniq, tog\' havosi musaffo bo\'lgan mashhur dam olish maskani.',
      descRu: 'Известное место отдыха с чистым горным воздухом и ясным небом.',
      descEn: 'A famous retreat with crystal-clear skies and fresh mountain air.',
      image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80',
      order: 1,
    },
    {
      slug: 'mirakki',
      nameUz: 'Mirakki',
      nameRu: 'Миракки',
      nameEn: 'Mirakki',
      descUz: 'Yashil vodiylar va sharsharalar bilan mashhur go\'zal hudud.',
      descRu: 'Красивый регион, известный зелёными долинами и водопадами.',
      descEn: 'A beautiful area known for green valleys and waterfalls.',
      image: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&q=80',
      order: 2,
    },
    {
      slug: 'chimyon',
      nameUz: 'Chimyon',
      nameRu: 'Чимён',
      nameEn: 'Chimyon',
      descUz: 'Tog\'li kurort — qishda chang\'i, yozda salqin havo.',
      descRu: 'Горный курорт — лыжи зимой, прохлада летом.',
      descEn: 'Mountain resort — skiing in winter, cool air in summer.',
      image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=80',
      order: 3,
    },
    {
      slug: 'chorvoq',
      nameUz: 'Chorvoq',
      nameRu: 'Чарвак',
      nameEn: 'Chorvoq',
      descUz: 'Ko\'l bo\'yidagi dam olish maskani, suv sporti va plyajlar.',
      descRu: 'Место отдыха у водохранилища, водный спорт и пляжи.',
      descEn: 'Lakeside getaway with water sports and beaches.',
      image: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=1200&q=80',
      order: 4,
    },
  ];

  const zones = [];
  for (const z of zonesData) {
    const zone = await prisma.zone.upsert({ where: { slug: z.slug }, update: {}, create: z });
    zones.push(zone);
  }
  console.log(`✅ ${zones.length} ta zona`);

  // --- Qulayliklar (types: qaysi modullar uchun) ---
  type LT = 'DACHA' | 'HOTEL' | 'CAR';
  const DH: LT[] = ['DACHA', 'HOTEL'];
  const ALL3: LT[] = ['DACHA', 'HOTEL', 'CAR'];
  const CAR: LT[] = ['CAR'];

  const amenitiesData = [
    // --- Dacha / mehmonxona qulayliklari ---
    { icon: 'waves', nameUz: 'Basseyn', nameRu: 'Бассейн', nameEn: 'Swimming pool', order: 1, types: DH },
    { icon: 'wifi', nameUz: 'Wi-Fi', nameRu: 'Wi-Fi', nameEn: 'Wi-Fi', order: 2, types: ALL3 },
    { icon: 'flame', nameUz: 'Sauna', nameRu: 'Сауна', nameEn: 'Sauna', order: 3, types: DH },
    { icon: 'beef', nameUz: 'Mangal', nameRu: 'Мангал', nameEn: 'BBQ grill', order: 4, types: DH },
    { icon: 'snowflake', nameUz: 'Konditsioner', nameRu: 'Кондиционер', nameEn: 'Air conditioning', order: 5, types: ALL3 },
    { icon: 'car', nameUz: 'Avtoturargoh', nameRu: 'Парковка', nameEn: 'Parking', order: 6, types: DH },
    { icon: 'tv', nameUz: 'Televizor', nameRu: 'Телевизор', nameEn: 'TV', order: 7, types: DH },
    { icon: 'utensils', nameUz: 'Oshxona', nameRu: 'Кухня', nameEn: 'Kitchen', order: 8, types: DH },
    { icon: 'wind', nameUz: 'Isitish', nameRu: 'Отопление', nameEn: 'Heating', order: 9, types: DH },
    { icon: 'trees', nameUz: 'Bog\'', nameRu: 'Сад', nameEn: 'Garden', order: 10, types: DH },
    { icon: 'dumbbell', nameUz: 'Sport zali', nameRu: 'Спортзал', nameEn: 'Gym', order: 11, types: DH },
    { icon: 'baby', nameUz: 'Bolalar maydonchasi', nameRu: 'Детская площадка', nameEn: 'Playground', order: 12, types: DH },
    // --- Avto imkoniyatlari ---
    { icon: 'zap', nameUz: 'USB zaryadlash', nameRu: 'USB-зарядка', nameEn: 'USB charging', order: 13, types: CAR },
    { icon: 'refrigerator', nameUz: 'Sovutgich', nameRu: 'Холодильник', nameEn: 'Cooler', order: 14, types: CAR },
    { icon: 'baby', nameUz: 'Bolalar o\'rindig\'i', nameRu: 'Детское кресло', nameEn: 'Child seat', order: 15, types: CAR },
    { icon: 'briefcase', nameUz: 'Keng bagaj', nameRu: 'Большой багажник', nameEn: 'Large luggage', order: 16, types: CAR },
    { icon: 'music', nameUz: 'Musiqa tizimi', nameRu: 'Аудиосистема', nameEn: 'Sound system', order: 17, types: CAR },
    { icon: 'droplets', nameUz: 'Ichimlik suv', nameRu: 'Питьевая вода', nameEn: 'Drinking water', order: 18, types: CAR },
    { icon: 'shield-check', nameUz: 'Sug\'urta', nameRu: 'Страховка', nameEn: 'Insurance', order: 19, types: CAR },
  ];

  const amenities = [];
  for (const a of amenitiesData) {
    const existing = await prisma.amenity.findFirst({ where: { nameEn: a.nameEn } });
    const amenity = existing
      ? await prisma.amenity.update({ where: { id: existing.id }, data: { types: a.types, icon: a.icon, order: a.order } })
      : await prisma.amenity.create({ data: a });
    amenities.push(amenity);
  }
  console.log(`✅ ${amenities.length} ta qulaylik`);

  // --- Demo seller ---
  const sellerPassword = await argon2.hash('seller123');
  const seller = await prisma.user.upsert({
    where: { phone: '+998907778899' },
    update: {},
    create: {
      phone: '+998907778899',
      email: 'seller@sayohatgo.uz',
      password: sellerPassword,
      role: 'SELLER',
      status: 'APPROVED',
      sellerProfile: {
        create: {
          firstName: 'Alisher',
          lastName: 'Karimov',
          companyName: 'Karimov Dacha Group',
          passportInfo: 'AA1234567',
          address: 'Toshkent shahri, Yunusobod tumani',
        },
      },
    },
  });
  console.log(`✅ Demo seller: ${seller.phone} / seller123`);

  const demoImages = [
    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80',
    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=80',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80',
    'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?w=1200&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80',
  ];
  const hotelImages = [
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80',
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80',
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&q=80',
  ];
  const carImages = [
    'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=1200&q=80',
    'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=1200&q=80',
  ];

  const imagesCreate = (urls: string[]) => ({
    create: urls.map((url, i) => ({ url, thumbUrl: url.replace('w=1200', 'w=400'), order: i })),
  });
  const amenitiesFor = (type: LT, count = 6) => ({
    create: amenities
      .filter((a) => (a.types as string[]).includes(type))
      .slice(0, count)
      .map((a) => ({ amenityId: a.id })),
  });

  // ==================== Demo DACHALAR ====================
  const dachaSeed = [
    {
      titleUz: 'Tog\' bag\'ridagi hashamatli dacha',
      titleRu: 'Роскошная дача в горах',
      titleEn: 'Luxury mountain villa',
      descUz: 'Toza havo, ajoyib manzara va zamonaviy qulayliklar bilan jihozlangan keng dacha. Oilaviy dam olish uchun ideal.',
      descRu: 'Просторная дача с чистым воздухом, прекрасным видом и современными удобствами. Идеально для семейного отдыха.',
      descEn: 'Spacious villa with fresh air, stunning views and modern amenities. Perfect for a family holiday.',
      pricePerDay: 1200000, priceWeekend: 1500000, capacity: 12, rooms: 5, area: 320,
      lat: 38.6733, lng: 66.8956, zoneIdx: 0,
      depositEnabled: true, depositType: 'PERCENT' as const, depositValue: 30,
    },
    {
      titleUz: 'Ko\'l bo\'yidagi zamonaviy uy',
      titleRu: 'Современный дом у озера',
      titleEn: 'Modern lakeside house',
      descUz: 'Chorvoq ko\'li yaqinidagi zamonaviy uy. Basseyn, mangal zonasi va katta hovli mavjud.',
      descRu: 'Современный дом рядом с Чарвакским озером. Бассейн, зона барбекю и большой двор.',
      descEn: 'Modern house near Chorvoq lake. Pool, BBQ area and a large yard.',
      pricePerDay: 2000000, priceWeekend: 2500000, capacity: 8, rooms: 4, area: 250,
      lat: 41.6289, lng: 70.0956, zoneIdx: 3,
      depositEnabled: true, depositType: 'FIXED' as const, depositValue: 500000,
    },
    {
      titleUz: 'Yashil vodiydagi shinam kottej',
      titleRu: 'Уютный коттедж в зелёной долине',
      titleEn: 'Cozy cottage in green valley',
      descUz: 'Mirakki vodiysidagi tinch va shinam kottej. Tabiat qo\'ynida dam olish uchun ajoyib joy.',
      descRu: 'Тихий и уютный коттедж в долине Миракки. Отличное место для отдыха на природе.',
      descEn: 'Quiet and cozy cottage in Mirakki valley. A great place to relax in nature.',
      pricePerDay: 800000, priceWeekend: 1000000, capacity: 6, rooms: 3, area: 150,
      lat: 39.05, lng: 67.12, zoneIdx: 1,
      depositEnabled: false, depositType: 'FIXED' as const, depositValue: 0,
    },
    {
      titleUz: 'Chimyon tog\'laridagi chalet',
      titleRu: 'Шале в горах Чимгана',
      titleEn: 'Chalet in Chimyon mountains',
      descUz: 'Chang\'i kurorti yaqinidagi issiq va shinam chalet. Qishki dam olish uchun ideal.',
      descRu: 'Тёплое и уютное шале рядом с горнолыжным курортом. Идеально для зимнего отдыха.',
      descEn: 'Warm and cozy chalet near the ski resort. Ideal for a winter getaway.',
      pricePerDay: 1500000, priceWeekend: 1800000, capacity: 10, rooms: 4, area: 200,
      lat: 41.5556, lng: 70.0289, zoneIdx: 2,
      depositEnabled: true, depositType: 'PERCENT' as const, depositValue: 25,
    },
  ];

  for (const d of dachaSeed) {
    const existing = await prisma.dacha.findFirst({ where: { titleEn: d.titleEn } });
    if (existing) continue;
    const { zoneIdx, ...fields } = d;
    await prisma.dacha.create({
      data: {
        ...fields,
        slug: slugFor(d.titleEn),
        sellerId: seller.id,
        zoneId: zones[zoneIdx].id,
        address: `${zones[zoneIdx].nameUz} hududi`,
        status: 'ACTIVE',
        images: imagesCreate(demoImages),
        amenities: amenitiesFor('DACHA'),
      },
    });
  }
  console.log(`✅ ${dachaSeed.length} ta demo dacha`);

  // ==================== Demo MEHMONXONA ====================
  const hotelTitleEn = 'Chorvoq Panorama Hotel';
  if (!(await prisma.hotel.findFirst({ where: { titleEn: hotelTitleEn } }))) {
    await prisma.hotel.create({
      data: {
        slug: slugFor(hotelTitleEn),
        sellerId: seller.id,
        zoneId: zones[3].id,
        titleUz: 'Chorvoq Panorama mehmonxonasi',
        titleRu: 'Отель «Чарвак Панорама»',
        titleEn: hotelTitleEn,
        descUz: 'Ko\'l manzarasiga qaragan zamonaviy mehmonxona. Restoran, konditsioner va bepul nonushta. Har bir xona balkonli.',
        descRu: 'Современный отель с видом на озеро. Ресторан, кондиционер и бесплатный завтрак. Все номера с балконом.',
        descEn: 'Modern lakeview hotel. Restaurant, air conditioning and free breakfast. Every room has a balcony.',
        starRating: 4,
        breakfastIncluded: true,
        hasConference: true,
        priceFrom: 650000,
        lat: 41.6289,
        lng: 70.0956,
        address: `${zones[3].nameUz} hududi`,
        status: 'ACTIVE',
        depositEnabled: true,
        depositType: 'PERCENT',
        depositValue: 20,
        images: imagesCreate(hotelImages),
        amenities: amenitiesFor('HOTEL'),
        rooms: {
          create: [
            {
              nameUz: 'Standart xona', nameRu: 'Стандартный номер', nameEn: 'Standard room',
              capacity: 2, pricePerNight: 650000, priceWeekend: 850000, totalRooms: 10, area: 28,
            },
            {
              nameUz: 'Oilaviy lyuks', nameRu: 'Семейный люкс', nameEn: 'Family suite',
              capacity: 4, pricePerNight: 1200000, priceWeekend: 1500000, totalRooms: 4, area: 55,
            },
          ],
        },
      },
    });
  }
  console.log('✅ 1 ta demo mehmonxona (2 xona turi bilan)');

  // ==================== Demo AVTOMOBIL ====================
  const carTitleEn = 'Chimyon mountain 4x4 trip (with driver)';
  if (!(await prisma.car.findFirst({ where: { titleEn: carTitleEn } }))) {
    await prisma.car.create({
      data: {
        slug: slugFor(carTitleEn),
        sellerId: seller.id,
        zoneId: zones[2].id,
        titleUz: 'Chimyon toqqa 4x4 sayohat (haydovchi bilan)',
        titleRu: 'Поездка в горы Чимгана на 4x4 (с водителем)',
        titleEn: carTitleEn,
        descUz: 'Kuchli 4x4 avtomobilda tajribali haydovchi bilan tog\'ga sayohat. Toshkentdan olib ketish va qaytarish. Yo\'l davomida to\'xtash va suratga tushish imkoniyati.',
        descRu: 'Поездка в горы на мощном 4x4 с опытным водителем. Забор из Ташкента и обратно. Остановки для фото в пути.',
        descEn: 'Mountain trip in a powerful 4x4 with an experienced driver. Pickup from Tashkent and back. Photo stops along the route.',
        brand: 'Toyota',
        carModel: 'Land Cruiser Prado',
        year: 2022,
        seats: 6,
        transmission: 'AUTOMATIC',
        fuelType: 'PETROL',
        driverIncluded: true,
        routeInfo: 'Toshkent → Chimyon → Chorvoq → Toshkent',
        pricePerDay: 900000,
        priceWeekend: 1100000,
        lat: 41.5556,
        lng: 70.0289,
        address: `${zones[2].nameUz} hududi`,
        status: 'ACTIVE',
        depositEnabled: true,
        depositType: 'FIXED',
        depositValue: 300000,
        images: imagesCreate(carImages),
        amenities: amenitiesFor('CAR'),
      },
    });
  }
  console.log('✅ 1 ta demo avtomobil');

  console.log('🌳 Seed tugadi!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
