import { CustomError } from '../../errors';
import { ClientRepository } from '../../repositories';
import { SaleRepository } from '../../repositories';
import { PaymentRepository } from '../../repositories';
import { ProductRepository } from '../../repositories';
import { PdfService, AccountStatementData } from '../../services/pdf.service';

/**
 * Orquesta la generación de un estado de cuenta en PDF.
 *
 * Flujo:
 *   1. Valida que el cliente existe.
 *   2. Trae las ventas del cliente (con ítems).
 *   3. Enriquece cada ítem con el nombre del producto (lookup por productId).
 *   4. Trae los pagos del cliente.
 *   5. Delega la generación del PDF al PdfService (interfaz — no sabe qué librería usa).
 *   6. Retorna el Buffer listo para enviar como respuesta HTTP o adjunto de email.
 *
 * Separación de responsabilidades:
 *   - Este use case no sabe nada de pdfkit ni de formato visual.
 *   - El PdfService no sabe nada de repositorios ni de lógica de negocio.
 */
export class GenerateAccountStatementUseCase {
  constructor(
    private readonly clientRepository: ClientRepository,
    private readonly saleRepository: SaleRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly productRepository: ProductRepository,
    private readonly pdfService: PdfService,
  ) {}

  async execute(clientId: string, generatedBy: string): Promise<Buffer> {
    const client = await this.clientRepository.findById(clientId);
    if (!client) throw CustomError.notFound(`Cliente con ID ${clientId} no encontrado`);

    const [sales, payments] = await Promise.all([
      this.saleRepository.findByClientId(clientId),
      this.paymentRepository.findByClientId(clientId),
    ]);

    // Recopilar todos los productId únicos para hacer un solo lookup por producto
    // en lugar de uno por ítem (reduce queries duplicadas cuando hay varios ítems
    // del mismo producto en distintas ventas).
    const uniqueProductIds = [...new Set(sales.flatMap((s) => s.items.map((i) => i.productId)))];

    const productMap = new Map<string, string>();
    await Promise.all(
      uniqueProductIds.map(async (productId) => {
        const product = await this.productRepository.findById(productId);
        productMap.set(productId, product?.name ?? `Producto ${productId.slice(0, 8)}`);
      }),
    );

    const data: AccountStatementData = {
      client: {
        id: client.id,
        name: client.name,
        phone: client.phone,
        email: client.email,
        creditLimit: client.creditLimit,
        balance: client.balance,
      },
      sales: sales.map((sale) => ({
        id: sale.id,
        type: sale.type,
        status: sale.status,
        total: sale.total,
        createdAt: sale.createdAt,
        items: sale.items.map((item) => ({
          productName: productMap.get(item.productId) ?? item.productId,
          quantity: item.quantity,
          basePrice: item.basePrice,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          appliedRule: item.appliedRule,
        })),
      })),
      payments: payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        note: payment.note,
        createdAt: payment.createdAt,
        saleId: payment.saleId,
      })),
      generatedAt: new Date(),
      generatedBy,
    };

    return this.pdfService.generateAccountStatement(data);
  }
}
