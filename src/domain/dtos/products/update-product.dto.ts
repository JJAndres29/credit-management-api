import { isValidSlugFormat } from '../../services/slug';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_META_TITLE = 200;
const MAX_META_DESCRIPTION = 500;
const MAX_BRAND = 120;

const MAX_WEIGHT_KG = 500;

export class UpdateProductDto {
  private constructor(
    public readonly name: string | undefined,
    public readonly description: string | null | undefined,
    public readonly categoryId: string | null | undefined,
    public readonly investmentCost: number | null | undefined,
    public readonly weightKg: number | null | undefined,
    public readonly slug: string | undefined,
    public readonly brand: string | null | undefined,
    public readonly metaTitle: string | null | undefined,
    public readonly metaDescription: string | null | undefined,
  ) {}

  static create(object: Record<string, unknown>): [string?, UpdateProductDto?] {
    const {
      name,
      description,
      categoryId,
      investmentCost,
      weightKg,
      slug,
      brand,
      metaTitle,
      metaDescription,
    } = object;

    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
      return ['El nombre debe tener al menos 2 caracteres'];
    }
    if (typeof name === 'string' && name.trim().length > MAX_NAME_LENGTH) {
      return [`El nombre no puede superar los ${MAX_NAME_LENGTH} caracteres`];
    }

    if (description !== undefined && description !== null) {
      if (typeof description !== 'string' || description.trim().length === 0) {
        return ['La descripción debe ser un texto no vacío'];
      }
      if ((description as string).trim().length > MAX_DESCRIPTION_LENGTH) {
        return [`La descripción no puede superar los ${MAX_DESCRIPTION_LENGTH} caracteres`];
      }
    }

    if (categoryId !== undefined && categoryId !== null) {
      if (typeof categoryId !== 'string' || !UUID_V4.test(categoryId.trim())) {
        return ['El categoryId debe ser un UUID v4 válido'];
      }
    }

    if (investmentCost !== undefined && investmentCost !== null) {
      if (typeof investmentCost !== 'number' || Number.isNaN(investmentCost) || investmentCost < 0) {
        return ['El costo de inversión debe ser un número mayor o igual a 0'];
      }
    }

    if (weightKg !== undefined && weightKg !== null) {
      const w = Number(weightKg);
      if (!Number.isFinite(w) || w <= 0 || w > MAX_WEIGHT_KG) {
        return [`weightKg debe ser un número positivo hasta ${MAX_WEIGHT_KG} kg`];
      }
    }

    if (slug !== undefined) {
      if (slug === null) {
        return ['slug no puede ser null; omita el campo para no cambiarlo'];
      }
      if (typeof slug !== 'string' || !isValidSlugFormat(slug.trim())) {
        return ['slug debe ser minúsculas, números y guiones (formato URL)'];
      }
    }

    if (brand !== undefined && brand !== null) {
      if (typeof brand !== 'string' || brand.trim().length > MAX_BRAND) {
        return [`brand máximo ${MAX_BRAND} caracteres`];
      }
    }

    if (metaTitle !== undefined && metaTitle !== null) {
      if (typeof metaTitle !== 'string' || metaTitle.trim().length > MAX_META_TITLE) {
        return [`metaTitle máximo ${MAX_META_TITLE} caracteres`];
      }
    }

    if (metaDescription !== undefined && metaDescription !== null) {
      if (typeof metaDescription !== 'string' || metaDescription.trim().length > MAX_META_DESCRIPTION) {
        return [`metaDescription máximo ${MAX_META_DESCRIPTION} caracteres`];
      }
    }

    if (
      name === undefined
      && description === undefined
      && categoryId === undefined
      && investmentCost === undefined
      && weightKg === undefined
      && slug === undefined
      && brand === undefined
      && metaTitle === undefined
      && metaDescription === undefined
    ) {
      return ['Debe enviar al menos un campo para actualizar'];
    }

    return [
      undefined,
      new UpdateProductDto(
        typeof name === 'string' ? name.trim() : undefined,
        description === null ? null : typeof description === 'string' ? description.trim() : undefined,
        categoryId === null ? null : typeof categoryId === 'string' ? categoryId.trim() : undefined,
        investmentCost === null ? null : typeof investmentCost === 'number' ? investmentCost : undefined,
        weightKg === null ? null : typeof weightKg === 'number' ? weightKg : undefined,
        typeof slug === 'string' ? slug.trim() : undefined,
        brand === null ? null : typeof brand === 'string' ? brand.trim() : undefined,
        metaTitle === null ? null : typeof metaTitle === 'string' ? metaTitle.trim() : undefined,
        metaDescription === null
          ? null
          : typeof metaDescription === 'string'
            ? metaDescription.trim()
            : undefined,
      ),
    ];
  }
}
