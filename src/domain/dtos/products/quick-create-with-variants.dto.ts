const MAX_NAME = 200;
const MAX_DESC = 2000;
const MIN_DESC = 30;
const MAX_CATEGORY_NAME = 120;
const MAX_ATTR_NAME = 80;
const MAX_ATTR_VALUE = 120;
const MAX_PRODUCT_ATTRIBUTES = 20;
const MAX_BRAND = 120;
const MAX_VARIANTS = 100;
const MAX_SKU = 100;
const MAX_LABEL = 200;

export interface VariantSpec {
  attributes: { name: string; value: string }[];
  stock: number;
  retailPrice: number;
  investmentCost: number;
  sku: string | null;
  label: string | null;
}

export class QuickCreateWithVariantsDto {
  private constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly categoryName: string,
    public readonly attributes: { name: string; value: string }[],
    public readonly variants: VariantSpec[],
    public readonly weightKg: number | null,
    public readonly brand: string | null,
  ) {}

  static create(object: Record<string, unknown>): [string?, QuickCreateWithVariantsDto?] {
    const { name, description, category, attributes, variants, weightKg, brand } = object;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return ['name es requerido (mín. 2 caracteres)'];
    }
    if (name.trim().length > MAX_NAME) {
      return [`name máximo ${MAX_NAME} caracteres`];
    }

    if (!description || typeof description !== 'string' || description.trim().length < MIN_DESC) {
      return [`description es requerida (mín. ${MIN_DESC} caracteres)`];
    }
    if (description.trim().length > MAX_DESC) {
      return [`description máximo ${MAX_DESC} caracteres`];
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
    if (attributes.length > MAX_PRODUCT_ATTRIBUTES) {
      return [`attributes máximo ${MAX_PRODUCT_ATTRIBUTES} elementos`];
    }

    const parsedProductAttrs: { name: string; value: string }[] = [];
    for (let i = 0; i < attributes.length; i++) {
      const raw = attributes[i];
      if (!raw || typeof raw !== 'object') {
        return ['cada attribute debe ser { name, value }'];
      }
      const a = raw as Record<string, unknown>;
      if (!a.name || typeof a.name !== 'string' || a.name.trim().length < 1) {
        return ['attribute.name es requerido'];
      }
      if (a.name.trim().length > MAX_ATTR_NAME) {
        return [`attribute.name máximo ${MAX_ATTR_NAME}`];
      }
      if (!a.value || typeof a.value !== 'string' || a.value.trim().length < 1) {
        return ['attribute.value es requerido'];
      }
      if (a.value.trim().length > MAX_ATTR_VALUE) {
        return [`attribute.value máximo ${MAX_ATTR_VALUE}`];
      }
      parsedProductAttrs.push({ name: a.name.trim(), value: a.value.trim() });
    }

    if (!Array.isArray(variants) || variants.length === 0) {
      return ['variants debe ser un arreglo con al menos una variante'];
    }
    if (variants.length > MAX_VARIANTS) {
      return [`variants máximo ${MAX_VARIANTS} elementos`];
    }

    const parsedVariants: VariantSpec[] = [];
    const seenCombinations = new Set<string>();

    for (let i = 0; i < variants.length; i++) {
      const raw = variants[i];
      if (!raw || typeof raw !== 'object') {
        return [`variants[${i}] debe ser un objeto`];
      }
      const v = raw as Record<string, unknown>;

      if (!Array.isArray(v.attributes) || v.attributes.length === 0) {
        return [`variants[${i}].attributes debe tener al menos un atributo`];
      }

      const variantAttrs: { name: string; value: string }[] = [];
      const seenAttrNames = new Set<string>();

      for (let j = 0; j < v.attributes.length; j++) {
        const attrRaw = (v.attributes as unknown[])[j];
        if (!attrRaw || typeof attrRaw !== 'object') {
          return [`variants[${i}].attributes[${j}] debe ser { name, value }`];
        }
        const attr = attrRaw as Record<string, unknown>;
        if (!attr.name || typeof attr.name !== 'string' || attr.name.trim().length < 1) {
          return [`variants[${i}].attributes[${j}].name es requerido`];
        }
        if (attr.name.trim().length > MAX_ATTR_NAME) {
          return [`variants[${i}].attributes[${j}].name máximo ${MAX_ATTR_NAME}`];
        }
        if (!attr.value || typeof attr.value !== 'string' || attr.value.trim().length < 1) {
          return [`variants[${i}].attributes[${j}].value es requerido`];
        }
        if (attr.value.trim().length > MAX_ATTR_VALUE) {
          return [`variants[${i}].attributes[${j}].value máximo ${MAX_ATTR_VALUE}`];
        }

        const normalizedName = attr.name.trim().toLowerCase();
        if (seenAttrNames.has(normalizedName)) {
          return [`variants[${i}] tiene el atributo "${attr.name.trim()}" duplicado`];
        }
        seenAttrNames.add(normalizedName);

        variantAttrs.push({ name: attr.name.trim(), value: attr.value.trim() });
      }

      const combinationKey = variantAttrs
        .map((a) => `${a.name.toLowerCase()}:${a.value.toLowerCase()}`)
        .sort()
        .join('|');

      if (seenCombinations.has(combinationKey)) {
        return [`variants[${i}] tiene una combinación de atributos duplicada con otra variante`];
      }
      seenCombinations.add(combinationKey);

      if (v.stock === undefined || v.stock === null) {
        return [`variants[${i}].stock es requerido`];
      }
      const parsedStock = Number(v.stock);
      if (!Number.isInteger(parsedStock) || parsedStock < 0) {
        return [`variants[${i}].stock debe ser un entero >= 0`];
      }

      if (v.retailPrice === undefined || v.retailPrice === null) {
        return [`variants[${i}].retailPrice es requerido`];
      }
      const parsedRetailPrice = Number(v.retailPrice);
      if (!Number.isFinite(parsedRetailPrice) || parsedRetailPrice <= 0) {
        return [`variants[${i}].retailPrice debe ser un número > 0`];
      }

      if (v.investmentCost === undefined || v.investmentCost === null) {
        return [`variants[${i}].investmentCost es requerido`];
      }
      const parsedInvestmentCost = Number(v.investmentCost);
      if (!Number.isFinite(parsedInvestmentCost) || parsedInvestmentCost < 0) {
        return [`variants[${i}].investmentCost debe ser un número >= 0`];
      }

      let parsedSku: string | null = null;
      if (v.sku !== undefined && v.sku !== null) {
        if (typeof v.sku !== 'string') return [`variants[${i}].sku debe ser un string`];
        const trimmed = v.sku.trim();
        if (trimmed.length > MAX_SKU) return [`variants[${i}].sku máximo ${MAX_SKU} caracteres`];
        parsedSku = trimmed || null;
      }

      let parsedLabel: string | null = null;
      if (v.label !== undefined && v.label !== null) {
        if (typeof v.label !== 'string') return [`variants[${i}].label debe ser un string`];
        const trimmed = v.label.trim();
        if (trimmed.length > MAX_LABEL) return [`variants[${i}].label máximo ${MAX_LABEL} caracteres`];
        parsedLabel = trimmed || null;
      }

      parsedVariants.push({
        attributes: variantAttrs,
        stock: parsedStock,
        retailPrice: parsedRetailPrice,
        investmentCost: parsedInvestmentCost,
        sku: parsedSku,
        label: parsedLabel,
      });
    }

    const allVariantAttrNames = new Set<string>();
    for (const v of parsedVariants) {
      for (const a of v.attributes) {
        allVariantAttrNames.add(a.name.toLowerCase());
      }
    }
    for (const v of parsedVariants) {
      const thisNames = new Set(v.attributes.map((a) => a.name.toLowerCase()));
      for (const expected of allVariantAttrNames) {
        if (!thisNames.has(expected)) {
          return [`Todas las variantes deben definir los mismos atributos. Falta "${expected}" en una variante`];
        }
      }
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
      parsedBrand = brand.trim() || null;
    }

    return [
      undefined,
      new QuickCreateWithVariantsDto(
        name.trim(),
        description.trim(),
        (categoryName as string).trim(),
        parsedProductAttrs,
        parsedVariants,
        parsedWeight,
        parsedBrand,
      ),
    ];
  }
}
