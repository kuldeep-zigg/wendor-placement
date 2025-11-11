import { promises as fs } from 'fs';
import path from 'path';

export interface JsonProduct {
  id: number;
  name: string;
  price: number;
  image_url: string;
  category: string;
  meta_data: Record<string, unknown>;
}

interface RawProduct {
  product_id: string;
  product_name: string;
  product_price: number | string;
  image?: string | null;
  category_id?: string | number | null;
  sub_category_id?: string | number | null;
  sku_id?: string | null;
  organisation_id?: number | string | null;
  brand_id?: string | number | null;
  brand_id_backup?: string | number | null;
  created_at?: string;
  updated_at?: string;
  description?: string | null;
  [key: string]: unknown;
}

let cachedProducts: JsonProduct[] | null = null;
let lastLoaded = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

const DATA_FILE_PATH = (() => {
  const customPath = process.env.JSON_DB_PATH;
  if (customPath) {
    return path.resolve(process.cwd(), customPath);
  }
  // Default: file lives at project root (`../data.json` from backend/)
  return path.resolve(process.cwd(), '..', 'data.json');
})();

async function readJsonFile(): Promise<RawProduct[]> {
  const fileContents = await fs.readFile(DATA_FILE_PATH, 'utf-8');
  const rawData = JSON.parse(fileContents);

  if (!Array.isArray(rawData)) {
    throw new Error('Expected data.json to export an array of products.');
  }

  return rawData as RawProduct[];
}

function resolveImageUrl(raw: RawProduct): string {
  const placeholder = 'https://via.placeholder.com/300x300?text=No+Image';
  const candidates = [raw.image, (raw as RawProduct & { image_mini?: string }).image_mini];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'string') {
      continue;
    }

    const trimmed = candidate.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed) as { preview?: string; path?: string };
        if (parsed.preview && typeof parsed.preview === 'string') {
          return parsed.preview;
        }
        if (parsed.path && typeof parsed.path === 'string') {
          return parsed.path;
        }
      } catch {
        // Ignore JSON parse errors and fall back to trimmed string
      }
    } else {
      return trimmed;
    }
  }

  return placeholder;
}

function toJsonProduct(raw: RawProduct): JsonProduct {
  const id = Number(raw.product_id);
  const price =
    typeof raw.product_price === 'string'
      ? Number.parseFloat(raw.product_price)
      : Number(raw.product_price ?? 0);

  const meta: Record<string, unknown> = {
    skuId: raw.sku_id,
    organisationId: raw.organisation_id,
    brandId: raw.brand_id,
    backupBrandId: raw.brand_id_backup,
    categoryId: raw.category_id,
    subCategoryId: raw.sub_category_id,
    description: raw.description,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };

  // Include additional fields while avoiding duplication of top-level keys
  for (const [key, value] of Object.entries(raw)) {
    if (
      [
        'product_id',
        'product_name',
        'product_price',
        'image',
        'category_id',
        'sub_category_id',
        'sku_id',
        'organisation_id',
        'brand_id',
        'brand_id_backup',
        'created_at',
        'updated_at',
        'description',
      ].includes(key)
    ) {
      continue;
    }
    meta[key] = value;
  }

  return {
    id,
    name: raw.product_name,
    price: Number.isFinite(price) ? price : 0,
    image_url: resolveImageUrl(raw),
    category:
      raw.category_id !== undefined && raw.category_id !== null
        ? String(raw.category_id)
        : 'uncategorised',
    meta_data: meta,
  };
}

export async function loadProducts(force = false): Promise<JsonProduct[]> {
  const now = Date.now();

  if (!force && cachedProducts && now - lastLoaded < CACHE_TTL_MS) {
    return cachedProducts;
  }

  const rawProducts = await readJsonFile();
  cachedProducts = rawProducts.map(toJsonProduct);
  lastLoaded = now;

  return cachedProducts;
}

export async function getProductFromJson(id: number): Promise<JsonProduct | undefined> {
  const products = await loadProducts();
  return products.find((product) => product.id === id);
}

export function invalidateJsonCache(): void {
  cachedProducts = null;
  lastLoaded = 0;
}


