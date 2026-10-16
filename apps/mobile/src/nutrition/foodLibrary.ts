// Food library: the member's own foods (existing /v1/nutrition/foods API) plus the global
// Open Food Facts database (open data, ODbL — attribution shown in the UI). Nothing here
// invents nutrition values: a product without a usable energy value is dropped, missing
// macros are flagged as incomplete rather than guessed, and values outside physical limits
// (e.g. >900 kcal per 100 g, macros summing past 100 g) are rejected as bad source data.

export type Per100g = { energyKcal: number; proteinMg: number; carbohydrateMg: number; fatMg: number };

export type LibraryFood = {
  /** 'local:<uuid>' or 'off:<barcode>' — stable across searches. */
  key: string;
  source: 'local' | 'global';
  localId?: string;
  code?: string;
  nameAr: string;
  nameEn: string;
  brand?: string;
  imageUrl?: string;
  per100g: Per100g;
  servingGrams?: number;
  /** False when the source lacked protein/carb/fat values (shown as 0, flagged in UI). */
  complete: boolean;
};

const OFF_FIELDS = [
  'code',
  'product_name',
  'product_name_ar',
  'product_name_en',
  'generic_name',
  'brands',
  'nutriments',
  'image_front_small_url',
  'serving_quantity',
  'serving_quantity_unit',
].join(',');

const OFF_TIMEOUT_MS = 9_000;
const NAME_MAX = 80;

type OffNutriments = Record<string, unknown>;
export type OffProduct = {
  code?: unknown;
  _id?: unknown;
  product_name?: unknown;
  product_name_ar?: unknown;
  product_name_en?: unknown;
  generic_name?: unknown;
  brands?: unknown;
  nutriments?: OffNutriments;
  image_front_small_url?: unknown;
  serving_quantity?: unknown;
  serving_quantity_unit?: unknown;
};

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string').join(', ');
  return '';
}

export function cleanName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
}

/** Converts an Open Food Facts product into a LibraryFood, or null if it can't be trusted. */
export function normalizeOffProduct(raw: OffProduct): LibraryFood | null {
  const code = asText(raw.code ?? raw._id).trim();
  if (!/^\d{4,24}$/.test(code)) return null;
  const n = raw.nutriments ?? {};

  let energyKcal = asNumber(n['energy-kcal_100g']);
  if (energyKcal === null) {
    const kj = asNumber(n['energy-kj_100g']) ?? asNumber(n['energy_100g']);
    energyKcal = kj === null ? null : kj / 4.184;
  }
  if (energyKcal === null || energyKcal < 0 || energyKcal > 900) return null;

  const protein = asNumber(n['proteins_100g']);
  const carbs = asNumber(n['carbohydrates_100g']);
  const fat = asNumber(n['fat_100g']);
  if ((protein ?? 0) < 0 || (carbs ?? 0) < 0 || (fat ?? 0) < 0) return null;
  if ((protein ?? 0) + (carbs ?? 0) + (fat ?? 0) > 100.5) return null;

  const english = cleanName(asText(raw.product_name_en) || asText(raw.product_name) || asText(raw.generic_name));
  const arabic = cleanName(asText(raw.product_name_ar) || english);
  if (english.length === 0 && arabic.length === 0) return null;

  const servingRaw = asNumber(raw.serving_quantity);
  const servingUnit = asText(raw.serving_quantity_unit).toLowerCase();
  const servingGrams =
    servingRaw !== null && servingRaw >= 1 && servingRaw <= 2000 && (servingUnit === '' || servingUnit === 'g' || servingUnit === 'ml')
      ? Math.round(servingRaw)
      : undefined;

  const image = asText(raw.image_front_small_url);
  const brand = cleanName(asText(raw.brands).split(',')[0] ?? '');

  return {
    key: `off:${code}`,
    source: 'global',
    code,
    nameAr: arabic.length > 0 ? arabic : english,
    nameEn: english.length > 0 ? english : arabic,
    brand: brand.length > 0 ? brand : undefined,
    imageUrl: image.startsWith('https://') ? image : undefined,
    per100g: {
      energyKcal: Math.round(energyKcal),
      proteinMg: Math.round((protein ?? 0) * 1000),
      carbohydrateMg: Math.round((carbs ?? 0) * 1000),
      fatMg: Math.round((fat ?? 0) * 1000),
    },
    servingGrams,
    complete: protein !== null && carbs !== null && fat !== null,
  };
}

/** Normalizes a list, dropping unusable products and duplicate barcodes. */
export function normalizeOffList(products: readonly OffProduct[]): LibraryFood[] {
  const seen = new Set<string>();
  const out: LibraryFood[] = [];
  for (const product of products) {
    const food = normalizeOffProduct(product);
    if (food === null || seen.has(food.key)) continue;
    seen.add(food.key);
    out.push(food);
  }
  return out;
}

export type LocalFoodRow = {
  id: string;
  name_ar: string;
  name_en: string;
  energy_kcal: number | string;
  protein_mg?: number | string | null;
  carbohydrate_mg?: number | string | null;
  fat_mg?: number | string | null;
};

export function normalizeLocalFood(row: LocalFoodRow): LibraryFood {
  const has = (value: unknown) => value !== null && value !== undefined;
  return {
    key: `local:${row.id}`,
    source: 'local',
    localId: row.id,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    per100g: {
      energyKcal: Number(row.energy_kcal) || 0,
      proteinMg: Number(row.protein_mg ?? 0) || 0,
      carbohydrateMg: Number(row.carbohydrate_mg ?? 0) || 0,
      fatMg: Number(row.fat_mg ?? 0) || 0,
    },
    complete: has(row.protein_mg) && has(row.carbohydrate_mg) && has(row.fat_mg),
  };
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OFF_TIMEOUT_MS);
  const forward = () => controller.abort();
  signal?.addEventListener('abort', forward);
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new Error(`OFF_HTTP_${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forward);
  }
}

/** Full-text search of the global library. Tries the fast search service, falls back to the classic API. */
export async function searchGlobalFoods(query: string, signal?: AbortSignal): Promise<LibraryFood[]> {
  const q = encodeURIComponent(query.trim());
  if (q.length === 0) return [];
  try {
    const body = (await fetchJson(`https://search.openfoodfacts.org/search?q=${q}&page_size=24&fields=${OFF_FIELDS}`, signal)) as { hits?: OffProduct[] };
    if (Array.isArray(body.hits) && body.hits.length > 0) return normalizeOffList(body.hits);
  } catch (error) {
    if (signal?.aborted === true) throw error;
  }
  const body = (await fetchJson(
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=24&fields=${OFF_FIELDS}`,
    signal,
  )) as { products?: OffProduct[] };
  return normalizeOffList(Array.isArray(body.products) ? body.products : []);
}

/** Exact product lookup for a scanned barcode. Null when the product is unknown or unusable. */
export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<LibraryFood | null> {
  const clean = code.replace(/\D/g, '');
  if (clean.length < 4) return null;
  const body = (await fetchJson(`https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=${OFF_FIELDS}`, signal)) as {
    status?: number;
    product?: OffProduct;
  };
  if (body.status !== 1 || body.product === undefined) return null;
  return normalizeOffProduct({ ...body.product, code: body.product.code ?? clean });
}
