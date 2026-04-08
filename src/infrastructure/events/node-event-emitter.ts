import { EventEmitter } from 'events';
import { EventEmitterPort } from '../../domain/events';

class NodeEventEmitter implements EventEmitterPort {
  private readonly emitter = new EventEmitter();

  on(event: string, handler: (data: unknown) => void): void {
    this.emitter.on(event, handler);
  }

  emit(event: string, data: unknown): void {
    this.emitter.emit(event, data);
  }
}

/**
 * Instancia singleton compartida por todos los routers.
 *
 * Los routers (composition roots) importan esta instancia para:
 *   1. Inyectarla en los use cases (que emiten eventos).
 *   2. Pasarla a los subscribers (que escuchan esos eventos).
 *
 * Al ser la misma instancia en memoria, los eventos emitidos en el use case
 * llegan al subscriber correcto. Si cada router creara su propia instancia,
 * el use case y el subscriber estarían en canales distintos y los eventos
 * nunca serían recibidos.
 */
export const globalEventEmitter = new NodeEventEmitter();
