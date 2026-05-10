import { isValidSlugFormat } from '../../services/slug';

const MAX_DESC = 2000;
const MAX_META_TITLE = 200;
const MAX_META_DESC = 500;

export class CreateCategoryDto {
  private constructor(
    public readonly name: string,
    public readonly slug: string | null,
    public readonly description: string | null,
    public readonly metaTitle: string | null,
    public readonly metaDescription: string | null,
  ) {}

  static create(object: Record<string, unknown>): [string?, CreateCategoryDto?] {
    const { name, slug, description, metaTitle, metaDescription } = object;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return ['El nombre de la categoría es requerido y debe tener al menos 2 caracteres'];
    }

    if (slug !== undefined && slug !== null) {
      if (typeof slug !== 'string' || !isValidSlugFormat(slug.trim())) {
        return ['slug debe ser minúsculas, números y guiones (formato URL)'];
      }
    }

    if (description !== undefined && description !== null) {
      if (typeof description !== 'string' || description.trim().length > MAX_DESC) {
        return [`description máximo ${MAX_DESC} caracteres`];
      }
    }

    if (metaTitle !== undefined && metaTitle !== null) {
      if (typeof metaTitle !== 'string' || metaTitle.trim().length > MAX_META_TITLE) {
        return [`metaTitle máximo ${MAX_META_TITLE} caracteres`];
      }
    }

    if (metaDescription !== undefined && metaDescription !== null) {
      if (typeof metaDescription !== 'string' || metaDescription.trim().length > MAX_META_DESC) {
        return [`metaDescription máximo ${MAX_META_DESC} caracteres`];
      }
    }

    return [
      undefined,
      new CreateCategoryDto(
        name.trim(),
        typeof slug === 'string' ? slug.trim() : null,
        typeof description === 'string' ? description.trim() : null,
        typeof metaTitle === 'string' ? metaTitle.trim() : null,
        typeof metaDescription === 'string' ? metaDescription.trim() : null,
      ),
    ];
  }
}
