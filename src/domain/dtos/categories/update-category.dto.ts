import { isValidSlugFormat } from '../../services/slug';

const MAX_NAME_LENGTH = 200;
const MAX_DESC = 2000;
const MAX_META_TITLE = 200;
const MAX_META_DESC = 500;

export class UpdateCategoryDto {
  private constructor(
    public readonly name: string | undefined,
    public readonly slug: string | undefined,
    public readonly description: string | null | undefined,
    public readonly metaTitle: string | null | undefined,
    public readonly metaDescription: string | null | undefined,
  ) {}

  static create(object: Record<string, unknown>): [string?, UpdateCategoryDto?] {
    const { name, slug, description, metaTitle, metaDescription } = object;

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return ['El nombre debe tener al menos 2 caracteres'];
      }
      if (name.trim().length > MAX_NAME_LENGTH) {
        return [`El nombre no puede superar los ${MAX_NAME_LENGTH} caracteres`];
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

    if (
      name === undefined
      && slug === undefined
      && description === undefined
      && metaTitle === undefined
      && metaDescription === undefined
    ) {
      return ['Debe enviar al menos un campo para actualizar'];
    }

    return [
      undefined,
      new UpdateCategoryDto(
        typeof name === 'string' ? name.trim() : undefined,
        typeof slug === 'string' ? slug.trim() : undefined,
        description === null ? null : typeof description === 'string' ? description.trim() : undefined,
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
