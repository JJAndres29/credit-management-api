const MAX_SEARCH_LENGTH = 100;

export class FilterClientsDto {
  private constructor(
    public readonly search?: string,
    public readonly minBalance?: number,
    public readonly maxBalance?: number,
    public readonly hasDebt?: boolean,
  ) {}

  static create(object: Record<string, unknown>): [string?, FilterClientsDto?] {
    const { search, minBalance, maxBalance, hasDebt } = object;

    if (search !== undefined && typeof search !== 'string') {
      return ['search debe ser una cadena de texto'];
    }
    if (typeof search === 'string' && search.trim().length > MAX_SEARCH_LENGTH) {
      return [`search no puede superar los ${MAX_SEARCH_LENGTH} caracteres`];
    }

    let minBalanceNum: number | undefined;
    if (minBalance !== undefined) {
      minBalanceNum = parseFloat(String(minBalance));
      if (isNaN(minBalanceNum) || minBalanceNum < 0) {
        return ['minBalance debe ser un número mayor o igual a 0'];
      }
    }

    let maxBalanceNum: number | undefined;
    if (maxBalance !== undefined) {
      maxBalanceNum = parseFloat(String(maxBalance));
      if (isNaN(maxBalanceNum) || maxBalanceNum < 0) {
        return ['maxBalance debe ser un número mayor o igual a 0'];
      }
    }

    if (minBalanceNum !== undefined && maxBalanceNum !== undefined && minBalanceNum > maxBalanceNum) {
      return ['minBalance no puede ser mayor que maxBalance'];
    }

    let hasDebtBool: boolean | undefined;
    if (hasDebt !== undefined) {
      if (hasDebt === 'true' || hasDebt === true) hasDebtBool = true;
      else if (hasDebt === 'false' || hasDebt === false) hasDebtBool = false;
      else return ['hasDebt debe ser true o false'];
    }

    return [
      undefined,
      new FilterClientsDto(
        search ? (search as string).trim() : undefined,
        minBalanceNum,
        maxBalanceNum,
        hasDebtBool,
      ),
    ];
  }
}
