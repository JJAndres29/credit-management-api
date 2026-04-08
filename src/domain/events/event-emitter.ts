/**
 * Puerto del Event Emitter.
 *
 * El dominio depende solo de esta interfaz — no de EventEmitter de Node.js
 * ni de ningún bus externo. Cualquier implementación que cumpla este contrato
 * puede inyectarse sin tocar las capas internas.
 */
export interface EventEmitterPort {
  /** Registra un handler para un nombre de evento */
  on(event: string, handler: (data: unknown) => void): void;
  /** Emite un evento con sus datos asociados */
  emit(event: string, data: unknown): void;
}
