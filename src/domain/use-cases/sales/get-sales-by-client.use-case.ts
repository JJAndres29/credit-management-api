import { CustomError } from '../../errors';
import { SaleEntity } from '../../entities';
import { SaleRepository } from '../../repositories';
import { ClientRepository } from '../../repositories';

export class GetSalesByClientUseCase {
  constructor(
    private readonly saleRepository: SaleRepository,
    private readonly clientRepository: ClientRepository,
  ) {}

  async execute(clientId: string): Promise<SaleEntity[]> {
    const client = await this.clientRepository.findById(clientId);
    if (!client) throw CustomError.notFound(`Cliente con ID ${clientId} no encontrado`);

    return this.saleRepository.findByClientId(clientId);
  }
}
