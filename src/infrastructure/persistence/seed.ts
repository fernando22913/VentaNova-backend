import { eq } from 'drizzle-orm';

import { env } from '../../config/env.js';
import type { CategoryCreateInput } from '../../domain/model/category.js';
import type { ProductCreateInput } from '../../domain/model/product.js';
import type { ProductType, ProductPlatform, ProductStatus } from '../../domain/model/enums.js';
import { ArgonHasher } from '../auth/argon.hasher.js';
import { logger } from '../logging/logger.js';
import { createDb } from './db.js';
import { runMigrations } from './run-migrations.js';
import { categories, products, users } from './schema.js';

/**
 * Declarative seed for the database:
 *  - 4 categories
 *  - 23 products (21 published, 1 DRAFT and 1 ARCHIVED to demo admin)
 *  - 1 admin user
 *
 * The script is idempotent: it seeds only rows that are missing (matched by
 * unique slug/email), so re-running after schema changes is safe.
 *
 * Initial admin credentials come from the environment — never from source:
 *  - ADMIN_EMAIL    — the admin account email (backend/.env locally, a Render
 *                     environment variable in production)
 *  - ADMIN_PASSWORD — the initial password (backend/.env locally, a Render
 *                     secret in production)
 */

const adminEmail = env.ADMIN_EMAIL;
const adminPassword = env.ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  throw new Error(
    '[seed] ADMIN_EMAIL and ADMIN_PASSWORD must be set to provision the initial admin. ' +
      'Configure them in the environment (Render secrets in production, backend/.env locally).',
  );
}

await runMigrations(env.DATABASE_URL);

const { db, client } = createDb(env.DATABASE_URL);
const hasher = new ArgonHasher();

// --- Categories -------------------------------------------------------------
const seedCategories: CategoryCreateInput[] = [
  { slug: 'videogames', name: 'Videogames' },
  { slug: 'software', name: 'Software' },
  { slug: 'dlc', name: 'DLC & Add-ons' },
  { slug: 'assets', name: 'Digital Assets' },
];

const categoryIds = new Map<string, string>();
for (const category of seedCategories) {
  const [existing] = await db.select().from(categories).where(eq(categories.slug, category.slug));
  if (existing) {
    categoryIds.set(category.slug, existing.id);
    continue;
  }
  const [created] = await db.insert(categories).values(category).returning();
  if (!created) {
    throw new Error(`[seed] failed to create category: ${category.slug}`);
  }
  categoryIds.set(category.slug, created.id);
}

// --- Products (23 shop items) -------------------------------------------------
type SeedProduct = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  type: ProductType;
  platform: ProductPlatform;
  categorySlug: string;
  priceCents: number;
  status: ProductStatus;
  hasCover: boolean;
};

const seedProducts: SeedProduct[] = [
  // Videogames
  {
    slug: 'neo-tokyo-racer',
    title: 'Neo Tokyo Racer',
    summary: 'Cyberpunk street racing through a neon megacity.',
    description:
      'Drift through hand-crafted neon districts, dodge traffic and chase the fastest lap times in a sprawling open-world racer. Full game with 40+ tracks and garage tuning.',
    type: 'GAME',
    platform: 'CROSS',
    categorySlug: 'videogames',
    priceCents: 3999,
    status: 'PUBLISHED',
    hasCover: true,
  },
  {
    slug: 'emberkeep',
    title: 'Emberkeep',
    summary: 'Bastion-building fantasy roguelike.',
    description:
      'Fortify a crumbling keep against nightly sieges. Every run reshapes the walls, the wardens and the loot table. Reap what you hoard.',
    type: 'GAME',
    platform: 'WINDOWS',
    categorySlug: 'videogames',
    priceCents: 2499,
    status: 'PUBLISHED',
    hasCover: true,
  },
  {
    slug: 'starfall-progeny',
    title: 'Starfall: Progeny',
    summary: 'Single-player space opera RPG.',
    description:
      'Command a generation ship, negotiate with three alien factions and decide the fate of the Orm system across 60 hours of branching narrative.',
    type: 'GAME',
    platform: 'CROSS',
    categorySlug: 'videogames',
    priceCents: 5999,
    status: 'PUBLISHED',
    hasCover: true,
  },
  {
    slug: 'moss-harbor',
    title: 'Moss Harbor',
    summary: 'Cozy fishing-and-town sim.',
    description:
      'Restore a sleepy harbor town one catch at a time. Fish, craft, befriend the locals and rebuild the lighthouse with your earnings.',
    type: 'GAME',
    platform: 'MAC',
    categorySlug: 'videogames',
    priceCents: 1999,
    status: 'PUBLISHED',
    hasCover: true,
  },
  {
    slug: 'voidprotocol',
    title: 'VOID://PROTOCOL',
    summary: 'Competitive hacker-vs-hacker PvP.',
    description:
      'Infiltrate rival networks in 5v5 asymmetrical matches. Map glitches, plant bombs of code, and zero the server before the counter runs out.',
    type: 'GAME',
    platform: 'WINDOWS',
    categorySlug: 'videogames',
    priceCents: 1499,
    status: 'PUBLISHED',
    hasCover: true,
  },
  {
    slug: 'pixel-dungeon-2',
    title: 'Pixel Dungeon II',
    summary: 'Retro roguelike sequel.',
    description:
      'A hundred floors, a thousand deaths, one pixel. Classic turn-based roguelike gameplay with modern QoL and daily challenge runs.',
    type: 'GAME',
    platform: 'LINUX',
    categorySlug: 'videogames',
    priceCents: 999,
    status: 'PUBLISHED',
    hasCover: true,
  },
  {
    slug: 'wanderers-vale',
    title: "Wanderer's Vale",
    summary: 'Exploration adventure in a cursed valley.',
    description:
      'A hand-painted valley where memories leak through the fog. Solve environmental puzzles and lift the curse one wandering step at a time.',
    type: 'GAME',
    platform: 'CROSS',
    categorySlug: 'videogames',
    priceCents: 2999,
    status: 'PUBLISHED',
    hasCover: true,
  },
  {
    slug: 'cosmic-bridge',
    title: 'Cosmic Bridge',
    summary: 'Design-your-own-station builder.',
    description:
      'Assemble modular orbital stations from endless prefab parts, balance life support and power, and keep 200 colonists from rioting.',
    type: 'GAME',
    platform: 'WEB',
    categorySlug: 'videogames',
    priceCents: 3499,
    status: 'DRAFT',
    hasCover: false,
  },

  // Software
  {
    slug: 'harbur-desktop',
    title: 'Harbur Desktop',
    summary: 'Privacy-first productivity suite.',
    description:
      'A local-first notes, tasks and workspace app. Your data stays on your machine; sync is opt-in and end-to-end encrypted.',
    type: 'SOFTWARE',
    platform: 'CROSS',
    categorySlug: 'software',
    priceCents: 7999,
    status: 'PUBLISHED',
    hasCover: true,
  },
  {
    slug: 'dashpixel',
    title: 'Dashpixel',
    summary: 'Pragmatic analytics dashboard.',
    description:
      'Connect PostgreSQL, click streams and payment data, then ship a pixel-perfect dashboard in an afternoon. No dark patterns, no data leaving your VPC.',
    type: 'SOFTWARE',
    platform: 'WEB',
    categorySlug: 'software',
    priceCents: 14999,
    status: 'PUBLISHED',
    hasCover: true,
  },
  {
    slug: 'remotely',
    title: 'Remotely',
    summary: 'Scripted remote server management.',
    description:
      'Manage fleets of Linux servers from your terminal or browser. Idempotent runbooks, zero-agent SSH, audit logging built in.',
    type: 'SOFTWARE',
    platform: 'LINUX',
    categorySlug: 'software',
    priceCents: 12999,
    status: 'PUBLISHED',
    hasCover: true,
  },
  {
    slug: 'staticfold',
    title: 'Staticfold',
    summary: 'Static site generator for the 2030s.',
    description:
      'Type-safe templating, edge-first builds and instant previews. Compile 10,000 pages in under a second.',
    type: 'SOFTWARE',
    platform: 'MAC',
    categorySlug: 'software',
    priceCents: 3999,
    status: 'PUBLISHED',
    hasCover: true,
  },
  {
    slug: 'quanta-pro',
    title: 'Quanta Pro',
    summary: 'Jupyter-native research IDE.',
    description:
      'A desktop IDE for computational notebooks with live collaboration, GPU job queuing and exportable publication figures.',
    type: 'SOFTWARE',
    platform: 'CROSS',
    categorySlug: 'software',
    priceCents: 9999,
    status: 'PUBLISHED',
    hasCover: true,
  },
  {
    slug: 'sently',
    title: 'Sently',
    summary: 'Email deliverability toolkit.',
    description:
      'Warm up, monitor and protect sender reputation across major providers, all from one calm interface.',
    type: 'SOFTWARE',
    platform: 'WEB',
    categorySlug: 'software',
    priceCents: 1999,
    status: 'ARCHIVED',
    hasCover: false,
  },

  // DLC & Add-ons
  {
    slug: 'neo-tokyo-racer-skyline-dlc',
    title: 'Neo Tokyo Racer: Skyline District',
    summary: 'Expansion with new district, cars and races.',
    description:
      'Four new tracks in the rain-soaked Skyline District, twelve licensed rides and a night-drift season pack.',
    type: 'DLC',
    platform: 'CROSS',
    categorySlug: 'dlc',
    priceCents: 1499,
    status: 'PUBLISHED',
    hasCover: true,
  },
  {
    slug: 'emberkeep-midnight-defense',
    title: 'Emberkeep: Midnight Defense',
    summary: 'Endless wave mode expansion.',
    description:
      'An endless survival mode with leaderboards, cursed wardens and modifiers that break your own builds.',
    type: 'DLC',
    platform: 'WINDOWS',
    categorySlug: 'dlc',
    priceCents: 999,
    status: 'PUBLISHED',
    hasCover: true,
  },
  {
    slug: 'starfall-progeny-exo-pack',
    title: 'Starfall: Progeny Exo-Suit Pack',
    summary: 'Outer-space exploration content.',
    description:
      'Fly to the ring rubble, pilot two new exo-suits and settle a hidden station with its own quest chain.',
    type: 'DLC',
    platform: 'CROSS',
    categorySlug: 'dlc',
    priceCents: 799,
    status: 'PUBLISHED',
    hasCover: true,
  },
  {
    slug: 'moss-harbor-autumn',
    title: 'Moss Harbor: Autumn Winds',
    summary: 'Seasonal content pack.',
    description: 'A new season, 15 harvest recipes, cider stand economy and the fog festival.',
    type: 'DLC',
    platform: 'MAC',
    categorySlug: 'dlc',
    priceCents: 599,
    status: 'PUBLISHED',
    hasCover: true,
  },
  {
    slug: 'voidprotocol-season-2',
    title: 'VOID://PROTOCOL Season 2',
    summary: 'New operators and maps.',
    description:
      'Three new operators, a mirrored datacenter map and the breach-in-reverse game mode.',
    type: 'DLC',
    platform: 'WINDOWS',
    categorySlug: 'dlc',
    priceCents: 499,
    status: 'PUBLISHED',
    hasCover: true,
  },

  // Digital Assets
  {
    slug: 'neon-city-pbr-pack',
    title: 'Neon City PBR Pack',
    summary: '300+ PBR kits for cyberpunk scenes.',
    description:
      'Alleys, neon signs, wet asphalt, holograms and props. 2K/4K PBR textures with Unity and Unreal bridge configs.',
    type: 'ASSET',
    platform: 'CROSS',
    categorySlug: 'assets',
    priceCents: 5999,
    status: 'PUBLISHED',
    hasCover: true,
  },
  {
    slug: 'audiogram-botanical',
    title: 'Audiogram: Botanical',
    summary: 'Ambient sound design library.',
    description:
      '256 royalty-free ambient loops and foley beds recorded in temperate gardens — ready for games, video and streams.',
    type: 'ASSET',
    platform: 'WEB',
    categorySlug: 'assets',
    priceCents: 2499,
    status: 'PUBLISHED',
    hasCover: true,
  },
  {
    slug: 'isotype-icon-set',
    title: 'Isotype Icon Set',
    summary: '1,200 geometric icons.',
    description:
      'Clean line icons for dashboards and marketing sites, in SVG/PNG/Font with Figma components.',
    type: 'ASSET',
    platform: 'CROSS',
    categorySlug: 'assets',
    priceCents: 999,
    status: 'PUBLISHED',
    hasCover: true,
  },
  {
    slug: 'lowpoly-bastion-kit',
    title: 'Lowpoly Bastion Kit',
    summary: 'Modular low-poly castle set.',
    description:
      '164 modular pieces, 8 hero buildings and 12 color palettes for fantasy settlements.',
    type: 'ASSET',
    platform: 'MAC',
    categorySlug: 'assets',
    priceCents: 3499,
    status: 'PUBLISHED',
    hasCover: true,
  },
];

for (const product of seedProducts) {
  const categoryId = categoryIds.get(product.categorySlug);
  if (!categoryId) {
    throw new Error(`[seed] missing category: ${product.categorySlug}`);
  }
  const [existing] = await db.select().from(products).where(eq(products.slug, product.slug));
  if (existing) continue;

  const input: ProductCreateInput = {
    slug: product.slug,
    title: product.title,
    summary: product.summary,
    description: product.description,
    type: product.type,
    platform: product.platform,
    categoryId,
    priceCents: product.priceCents,
    status: product.status,
    coverImageUrl: product.hasCover ? `https://picsum.photos/seed/${product.slug}/640/360` : null,
    assetUrl: `https://cdn.bytemarket.dev/downloads/${product.slug}.zip`,
  };
  await db.insert(products).values(input);
}

// --- Admin user --------------------------------------------------------------
// Idempotent and password-preserving: an existing admin is never overwritten,
// so redeploying cannot reset (or silently downgrade) a rotated password.
const [existingAdmin] = await db.select().from(users).where(eq(users.email, adminEmail));
if (existingAdmin) {
  logger.info({ adminEmail }, 'Admin already exists (password left unchanged)');
} else {
  const passwordHash = await hasher.hash(adminPassword);
  await db.insert(users).values({
    email: adminEmail,
    name: 'VentaNova Admin',
    passwordHash,
    role: 'ADMIN',
  });
  logger.info({ adminEmail }, 'Admin created');
}

logger.info({ categories: seedCategories.length, products: seedProducts.length }, 'Seed complete');

await client.end();
