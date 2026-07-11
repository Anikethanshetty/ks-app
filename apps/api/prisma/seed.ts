import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// The owner's number bootstraps the first admin — there is no other way in (§10).
// Override with OWNER_PHONE / SHOP_PHONE at seed time for a real deployment.
const OWNER_PHONE = process.env.OWNER_PHONE ?? "+919000000001";
const SHOP_PHONE = process.env.SHOP_PHONE ?? OWNER_PHONE;

// 13 categories, in the order given in Backend Schema §3.3.
const CATEGORIES: Array<{ slug: string; en: string; kn: string; hi: string }> = [
  { slug: "rice-grains", en: "Rice & Grains", kn: "ಅಕ್ಕಿ ಮತ್ತು ಧಾನ್ಯ", hi: "चावल और अनाज" },
  { slug: "pulses-dals", en: "Pulses & Dals", kn: "ಬೇಳೆ ಕಾಳು", hi: "दाल और दलहन" },
  { slug: "oils-ghee", en: "Oils & Ghee", kn: "ಎಣ್ಣೆ ಮತ್ತು ತುಪ್ಪ", hi: "तेल और घी" },
  { slug: "spices-masala", en: "Spices & Masala", kn: "ಮಸಾಲೆ ಪದಾರ್ಥ", hi: "मसाले" },
  { slug: "flour-atta", en: "Flour & Atta", kn: "ಹಿಟ್ಟು", hi: "आटा" },
  { slug: "sugar-jaggery", en: "Sugar & Jaggery", kn: "ಸಕ್ಕರೆ ಮತ್ತು ಬೆಲ್ಲ", hi: "चीनी और गुड़" },
  { slug: "dry-fruits", en: "Dry Fruits", kn: "ಒಣ ಹಣ್ಣುಗಳು", hi: "सूखे मेवे" },
  { slug: "snacks-biscuits", en: "Snacks & Biscuits", kn: "ತಿಂಡಿ ಮತ್ತು ಬಿಸ್ಕತ್", hi: "स्नैक्स और बिस्किट" },
  { slug: "beverages", en: "Beverages", kn: "ಪಾನೀಯಗಳು", hi: "पेय पदार्थ" },
  { slug: "dairy", en: "Dairy", kn: "ಹಾಲಿನ ಉತ್ಪನ್ನ", hi: "डेयरी" },
  { slug: "personal-care", en: "Personal Care", kn: "ವೈಯಕ್ತಿಕ ಆರೈಕೆ", hi: "व्यक्तिगत देखभाल" },
  { slug: "household-cleaning", en: "Household & Cleaning", kn: "ಮನೆ ಬಳಕೆ ಮತ್ತು ಸ್ವಚ್ಛತೆ", hi: "घरेलू और सफाई" },
  { slug: "pooja-items", en: "Pooja Items", kn: "ಪೂಜಾ ಸಾಮಗ್ರಿ", hi: "पूजा सामग्री" },
];

async function main(): Promise<void> {
  // ── shop_settings: the single row (id = 1) ──
  await prisma.shopSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      shopPhone: SHOP_PHONE,
      shopAddress: "Mysuru, Karnataka",
    },
  });

  // ── categories ──
  for (const [i, c] of CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { nameEn: c.en, nameKn: c.kn, nameHi: c.hi, sortOrder: i },
      create: {
        slug: c.slug,
        nameEn: c.en,
        nameKn: c.kn,
        nameHi: c.hi,
        sortOrder: i,
      },
    });
  }

  // ── the owner: the one bootstrapped admin ──
  await prisma.user.upsert({
    where: { phone: OWNER_PHONE },
    update: { role: "admin" },
    create: { phone: OWNER_PHONE, fullName: "Shop Owner", role: "admin", language: "kn" },
  });

  // ── dev-only test users (customer / delivery / admin) — never in production ──
  if (process.env.NODE_ENV !== "production") {
    const devUsers: Array<{ phone: string; name: string; role: "customer" | "delivery" | "admin" }> = [
      { phone: "+919000000010", name: "Test Customer", role: "customer" },
      { phone: "+919000000020", name: "Test Delivery", role: "delivery" },
      { phone: "+919000000030", name: "Test Admin", role: "admin" },
    ];
    for (const u of devUsers) {
      await prisma.user.upsert({
        where: { phone: u.phone },
        update: { role: u.role },
        create: { phone: u.phone, fullName: u.name, role: u.role },
      });
    }
  }

  const [cats, users] = await Promise.all([
    prisma.category.count(),
    prisma.user.count(),
  ]);
  // eslint-disable-next-line no-console
  console.log(`Seed complete: ${cats} categories, ${users} users, 1 shop_settings row.`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
