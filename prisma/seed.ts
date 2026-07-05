import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { customAlphabet } from 'nanoid';

const prisma = new PrismaClient();
const slugNano = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);

async function main() {
  console.log('🌱 Seed boshlandi...');

  // --- Super admin ---
  const adminPassword = await argon2.hash('admin123');
  const admin = await prisma.user.upsert({
    where: { phone: '+998901112233' },
    update: {},
    create: {
      phone: '+998901112233',
      email: 'admin@dachago.uz',
      password: adminPassword,
      role: 'SUPER_ADMIN',
      status: 'APPROVED',
    },
  });
  console.log(`✅ Super admin: ${admin.phone} / admin123`);

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
    const zone = await prisma.zone.upsert({
      where: { slug: z.slug },
      update: {},
      create: z,
    });
    zones.push(zone);
  }
  console.log(`✅ ${zones.length} ta zona`);

  // --- Qulayliklar ---
  const amenitiesData = [
    { icon: 'waves', nameUz: 'Basseyn', nameRu: 'Бассейн', nameEn: 'Swimming pool', order: 1 },
    { icon: 'wifi', nameUz: 'Wi-Fi', nameRu: 'Wi-Fi', nameEn: 'Wi-Fi', order: 2 },
    { icon: 'flame', nameUz: 'Sauna', nameRu: 'Сауна', nameEn: 'Sauna', order: 3 },
    { icon: 'beef', nameUz: 'Mangal', nameRu: 'Мангал', nameEn: 'BBQ grill', order: 4 },
    { icon: 'snowflake', nameUz: 'Konditsioner', nameRu: 'Кондиционер', nameEn: 'Air conditioning', order: 5 },
    { icon: 'car', nameUz: 'Avtoturargoh', nameRu: 'Парковка', nameEn: 'Parking', order: 6 },
    { icon: 'tv', nameUz: 'Televizor', nameRu: 'Телевизор', nameEn: 'TV', order: 7 },
    { icon: 'utensils', nameUz: 'Oshxona', nameRu: 'Кухня', nameEn: 'Kitchen', order: 8 },
    { icon: 'wind', nameUz: 'Konditsioner', nameRu: 'Отопление', nameEn: 'Heating', order: 9 },
    { icon: 'trees', nameUz: 'Bog\'', nameRu: 'Сад', nameEn: 'Garden', order: 10 },
    { icon: 'dumbbell', nameUz: 'Sport zali', nameRu: 'Спортзал', nameEn: 'Gym', order: 11 },
    { icon: 'baby', nameUz: 'Bolalar maydonchasi', nameRu: 'Детская площадка', nameEn: 'Playground', order: 12 },
  ];

  const amenities = [];
  for (const a of amenitiesData) {
    const existing = await prisma.amenity.findFirst({ where: { nameEn: a.nameEn } });
    const amenity = existing
      ? existing
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
      email: 'seller@dachago.uz',
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

  // --- Demo dachalar ---
  const demoImages = [
    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80',
    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=80',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80',
    'https://images.unsplash.com/photo-1416331108676-a22ccb276e35?w=1200&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80',
  ];

  const dachaSeed = [
    {
      titleUz: 'Tog\' bag\'ridagi hashamatli dacha',
      titleRu: 'Роскошная дача в горах',
      titleEn: 'Luxury mountain villa',
      descUz: 'Toza havo, ajoyib manzara va zamonaviy qulayliklar bilan jihozlangan keng dacha. Oilaviy dam olish uchun ideal.',
      descRu: 'Просторная дача с чистым воздухом, прекрасным видом и современными удобствами. Идеально для семейного отдыха.',
      descEn: 'Spacious villa with fresh air, stunning views and modern amenities. Perfect for a family holiday.',
      pricePerDay: 1200000,
      priceWeekend: 1500000,
      capacity: 12,
      rooms: 5,
      area: 320,
      lat: 38.6733,
      lng: 66.8956,
      zoneIdx: 0,
      depositEnabled: true,
      depositType: 'PERCENT' as const,
      depositValue: 30,
    },
    {
      titleUz: 'Ko\'l bo\'yidagi zamonaviy uy',
      titleRu: 'Современный дом у озера',
      titleEn: 'Modern lakeside house',
      descUz: 'Chorvoq ko\'li yaqinidagi zamonaviy uy. Basseyn, mangal zonasi va katta hovli mavjud.',
      descRu: 'Современный дом рядом с Чарвакским озером. Бассейн, зона барбекю и большой двор.',
      descEn: 'Modern house near Chorvoq lake. Pool, BBQ area and a large yard.',
      pricePerDay: 2000000,
      priceWeekend: 2500000,
      capacity: 8,
      rooms: 4,
      area: 250,
      lat: 41.6289,
      lng: 70.0956,
      zoneIdx: 3,
      depositEnabled: true,
      depositType: 'FIXED' as const,
      depositValue: 500000,
    },
    {
      titleUz: 'Yashil vodiydagi shinam kottej',
      titleRu: 'Уютный коттедж в зелёной долине',
      titleEn: 'Cozy cottage in green valley',
      descUz: 'Mirakki vodiysidagi tinch va shinam kottej. Tabiat qo\'ynida dam olish uchun ajoyib joy.',
      descRu: 'Тихий и уютный коттедж в долине Миракки. Отличное место для отдыха на природе.',
      descEn: 'Quiet and cozy cottage in Mirakki valley. A great place to relax in nature.',
      pricePerDay: 800000,
      priceWeekend: 1000000,
      capacity: 6,
      rooms: 3,
      area: 150,
      lat: 39.05,
      lng: 67.12,
      zoneIdx: 1,
      depositEnabled: false,
      depositType: 'FIXED' as const,
      depositValue: 0,
    },
    {
      titleUz: 'Chimyon tog\'laridagi chalet',
      titleRu: 'Шале в горах Чимгана',
      titleEn: 'Chalet in Chimyon mountains',
      descUz: 'Chang\'i kurorti yaqinidagi issiq va shinam chalet. Qishki dam olish uchun ideal.',
      descRu: 'Тёплое и уютное шале рядом с горнолыжным курортом. Идеально для зимнего отдыха.',
      descEn: 'Warm and cozy chalet near the ski resort. Ideal for a winter getaway.',
      pricePerDay: 1500000,
      priceWeekend: 1800000,
      capacity: 10,
      rooms: 4,
      area: 200,
      lat: 41.5556,
      lng: 70.0289,
      zoneIdx: 2,
      depositEnabled: true,
      depositType: 'PERCENT' as const,
      depositValue: 25,
    },
  ];

  for (const d of dachaSeed) {
    const slug = `${d.titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${slugNano()}`;
    const existing = await prisma.dacha.findFirst({ where: { titleEn: d.titleEn } });
    if (existing) continue;

    const pickedAmenities = amenities.slice(0, 6 + Math.floor((d.capacity % 4)));

    await prisma.dacha.create({
      data: {
        slug,
        sellerId: seller.id,
        zoneId: zones[d.zoneIdx].id,
        titleUz: d.titleUz,
        titleRu: d.titleRu,
        titleEn: d.titleEn,
        descUz: d.descUz,
        descRu: d.descRu,
        descEn: d.descEn,
        pricePerDay: d.pricePerDay,
        priceWeekend: d.priceWeekend,
        capacity: d.capacity,
        rooms: d.rooms,
        area: d.area,
        lat: d.lat,
        lng: d.lng,
        address: `${zones[d.zoneIdx].nameUz} hududi`,
        status: 'ACTIVE',
        depositEnabled: d.depositEnabled,
        depositType: d.depositType,
        depositValue: d.depositValue,
        images: {
          create: demoImages.slice(0, 5).map((url, i) => ({
            url,
            thumbUrl: url.replace('w=1200', 'w=400'),
            order: i,
          })),
        },
        amenities: {
          create: pickedAmenities.map((a) => ({ amenityId: a.id })),
        },
      },
    });
  }
  console.log(`✅ ${dachaSeed.length} ta demo dacha`);

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
