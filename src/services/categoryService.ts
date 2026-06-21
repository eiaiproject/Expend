import { db, type Transaction, type Category } from '../db/db';
import { CURATED_PALETTE } from '../utils/constants';

/**
 * Resolve category ID from name. Auto-creates if not exists (with confirmation handled by caller).
 * Returns the category ID or null.
 */
export async function resolveCategory(
  categoryName: string,
  categories: Category[]
): Promise<number | null> {
  const trimmedName = categoryName.trim();
  if (!trimmedName) return null;

  const existingCat = categories.find(
    (c) => c.name.toLowerCase() === trimmedName.toLowerCase()
  );
  if (existingCat) return existingCat.id!;

  // Pick a color that is least used or random from curated list
  const usedColors = categories.map((c) => c.color);
  const availableColors = [...CURATED_PALETTE].filter(
    (c) => !usedColors.includes(c)
  );
  const finalColor =
    availableColors.length > 0
      ? availableColors[Math.floor(Math.random() * availableColors.length)]!
      : CURATED_PALETTE[Math.floor(Math.random() * CURATED_PALETTE.length)]!;

  const newId = await db.categories.add({
    name: trimmedName,
    icon: '🏷️',
    color: finalColor,
  });
  return newId ?? null;
}
