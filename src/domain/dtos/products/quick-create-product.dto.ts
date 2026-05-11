const MAX_NAME = 200;
const MAX_DESC = 2000;
const MIN_DESC = 30;
const MAX_CATEGORY_NAME = 120;
const MAX_ATTR_NAME = 80;
const MAX_ATTR_VALUE = 120;
const MAX_ATTRIBUTES = 20;
const MAX_BRAND = 120;

export class QuickCreateProductDto {
  private constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly stock: number,
    public readonly retailPrice: number,
    public readonly investmentCost: number,
    public readonly categoryName: string,
    public readonly attributes: { name: string; value: string }[],
    public readonly weightKg: number | null,
    public readonly brand: string | null,
  ) {}

  static create(object: Record<string, unknown>): [string?, QuickCreateProductDto?] {
    const {
      name,
      description,
      stock,
      retailPrice,
      investmentCost,
      category,
      attributes,
      weightKg,
      brand,
    } = object;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return ['name es requerido (mín. 2 caracteres)'];
    }
    if (name.trim().length > MAX_NAME) {
      return [`name máximo ${MAX_NAME} caracteres`];
    }

    if (!description || typeof description !== 'string' || description.trim().length < MIN_DESC) {
      return [`description es requerida (mín. ${MIN_DESC} caracteres para publicación/SEO)`];
    }
    if (description.trim().length > MAX_DESC) {
      return [`description máximo ${MAX_DESC} caracteres`];
    }

    if (typeof stock !== 'number' || !Number.isInteger(stock) || stock < 0) {
      return ['stock debe ser entero >= 0'];
    }

    if (typeof retailPrice !== 'number' || !Number.isFinite(retailPrice) || retailPrice <= 0) {
      return ['retailPrice debe ser un número > 0'];
    }

    if (typeof investmentCost !== 'number' || !Number.isFinite(investmentCost) || investmentCost < 0) {
      return ['investmentCost debe ser un número >= 0'];
    }

    if (!category || typeof category !== 'object' || category === null) {
      return ['category es requerido (objeto { name })'];
    }
    const catObj = category as Record<string, unknown>;
    const categoryName = catObj.name;
    if (!categoryName || typeof categoryName !== 'string' || categoryName.trim().length < 2) {
      return ['category.name es requerido (mín. 2 caracteres)'];
    }
    if (categoryName.trim().length > MAX_CATEGORY_NAME) {
      return [`category.name máximo ${MAX_CATEGORY_NAME} caracteres`];
    }

    if (!Array.isArray(attributes)) {
      return ['attributes debe ser un arreglo {name,value}'];
    }
    if (attributes.length > MAX_ATTRIBUTES) {
      return [`attributes máximo ${MAX_ATTRIBUTES} elementos`];
    }

    const parsedAttrs: { name: string; value: string }[] = [];
    for (const raw of attributes) {
      if (!raw || typeof raw !== 'object') {
        return ['cada attribute debe ser { name, value }'];
      }
      const a = raw as Record<string, unknown>;
      const an = a.name;
      const av = a.value;
      if (!an || typeof an !== 'string' || an.trim().length < 1) {
        return ['attribute.name es requerido'];
      }
      if (an.trim().length > MAX_ATTR_NAME) {
        return [`attribute.name máximo ${MAX_ATTR_NAME}`];
      }
      if (!av || typeof av !== 'string' || av.trim().length < 1) {
        return ['attribute.value es requerido'];
      }
      if (av.trim().length > MAX_ATTR_VALUE) {
        return [`attribute.value máximo ${MAX_ATTR_VALUE}`];
      }
      parsedAttrs.push({ name: an.trim(), value: av.trim() });
    }

    let parsedWeight: number | null = null;
    if (weightKg !== undefined && weightKg !== null) {
      const w = Number(weightKg);
      if (!Number.isFinite(w) || w <= 0 || w > 500) {
        return ['weightKg opcional: número positivo hasta 500'];
      }
      parsedWeight = w;
    }

    let parsedBrand: string | null = null;
    if (brand !== undefined && brand !== null) {
      if (typeof brand !== 'string' || brand.trim().length > MAX_BRAND) {
        return [`brand máximo ${MAX_BRAND}`];
      }
      parsedBrand = brand.trim();
    }

    return [
      undefined,
      new QuickCreateProductDto(
        name.trim(),
        description.trim(),
        stock,
        retailPrice,
        investmentCost,
        categoryName.trim(),
        parsedAttrs,
        parsedWeight,
        parsedBrand,
      ),
    ];
  }
}
