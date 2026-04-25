import { OAuth2Client } from 'google-auth-library';
import { CustomerRepository } from '../../repositories';
import { CustomerJwtService } from '../../services';
import { CustomError } from '../../errors';
import { GoogleAuthDto } from '../../dtos/customer-auth';

export class GoogleAuthUseCase {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly jwtService: CustomerJwtService,
    private readonly googleClientId: string,
  ) {}

  async execute(dto: GoogleAuthDto) {
    if (!this.googleClientId) {
      throw CustomError.internalServer('Google OAuth no configurado');
    }

    const client = new OAuth2Client(this.googleClientId);

    let payload: { sub: string; email: string; name: string } | null = null;
    try {
      const ticket = await client.verifyIdToken({
        idToken: dto.idToken,
        audience: this.googleClientId,
      });
      const p = ticket.getPayload();
      if (!p?.sub || !p.email || !p.name) throw new Error('Payload incompleto');
      payload = { sub: p.sub, email: p.email, name: p.name };
    } catch {
      throw CustomError.unauthorized('Token de Google inválido');
    }

    let customer = await this.customerRepository.findByGoogleId(payload.sub);

    if (!customer) {
      customer = await this.customerRepository.create({
        name: payload.name,
        email: payload.email,
        phone: '',
        googleId: payload.sub,
      });
    }

    if (!customer.isActive) {
      throw CustomError.unauthorized('Cuenta inactiva');
    }

    const token = await this.jwtService.generateToken({ id: customer.id });

    return { token, customer: customer.toJSON() };
  }
}
