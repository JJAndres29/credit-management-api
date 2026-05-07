/**
 * E6-T4: Structural guards para InstallmentScheduleService
 *
 * 1. El servicio NO importa nada de infraestructura ni de Prisma.
 *    → Cumple la Regla de Cero Acoplamiento definida en CLAUDE.md.
 *
 * 2. Ambos use cases que calculan cuotas (dashboard y notify-client)
 *    importan InstallmentScheduleService desde el MISMO módulo.
 *    → Garantiza single-source-of-truth del algoritmo FIFO.
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Rutas absolutas ──────────────────────────────────────────────────────────

const SERVICE_FILE = path.resolve(
  __dirname,
  'installment-schedule.service.ts',
);

const DASHBOARD_USE_CASE = path.resolve(
  __dirname,
  '../../use-cases/dashboard/get-dashboard.use-case.ts',
);

const NOTIFY_CLIENT_USE_CASE = path.resolve(
  __dirname,
  '../../use-cases/clients/notify-client.use-case.ts',
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readSource(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

/** Extrae todos los paths de import de un archivo TypeScript. */
function extractImportPaths(source: string): string[] {
  const regex = /from\s+['"]([^'"]+)['"]/g;
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(source)) !== null) {
    matches.push(m[1]);
  }
  return matches;
}

// ─── Guard 1: el service es puro (sin dependencias de infraestructura) ────────

describe('InstallmentScheduleService — zero infrastructure coupling', () => {
  const serviceSource = readSource(SERVICE_FILE);
  const importPaths = extractImportPaths(serviceSource);

  const FORBIDDEN = [
    'infrastructure',
    '@prisma/client',
    'prisma',
    'mercadopago',
    'nodemailer',
    'axios',
    'fetch(',
    'EventEmitter',
  ];

  for (const forbidden of FORBIDDEN) {
    it(`no importa "${forbidden}"`, () => {
      expect(serviceSource).not.toContain(forbidden);
    });
  }

  it('no tiene imports de rutas externas que no sean el propio dominio', () => {
    const nonDomain = importPaths.filter(
      (p) => !p.startsWith('.') && !p.startsWith('..'),
    );
    // Solo está permitido importar módulos builtin o de dominio puro
    // (en la práctica el service solo usa imports relativos de la propia entidad)
    const forbiddenExternals = nonDomain.filter(
      (p) => !['path', 'fs', 'crypto'].includes(p),
    );
    expect(forbiddenExternals).toHaveLength(0);
  });
});

// ─── Guard 2: dashboard y notify-client usan el MISMO módulo ─────────────────

describe('Single source of truth — ambos use cases usan InstallmentScheduleService del mismo módulo', () => {
  const dashboardSource = readSource(DASHBOARD_USE_CASE);
  const notifySource = readSource(NOTIFY_CLIENT_USE_CASE);

  it('get-dashboard.use-case.ts importa InstallmentScheduleService', () => {
    expect(dashboardSource).toContain('InstallmentScheduleService');
  });

  it('notify-client.use-case.ts importa InstallmentScheduleService', () => {
    expect(notifySource).toContain('InstallmentScheduleService');
  });

  it('ambos use cases importan desde la misma ruta relativa al módulo de installments', () => {
    const dashboardImports = extractImportPaths(dashboardSource);
    const notifyImports = extractImportPaths(notifySource);

    // Normalizar rutas: ambas deben apuntar a services/installments
    const dashboardInstallmentImport = dashboardImports.find((p) =>
      p.includes('installments'),
    );
    const notifyInstallmentImport = notifyImports.find((p) =>
      p.includes('installments'),
    );

    expect(dashboardInstallmentImport).toBeDefined();
    expect(notifyInstallmentImport).toBeDefined();

    // Resolver rutas absolutas para comparación canónica
    const dashboardResolved = path.resolve(
      path.dirname(DASHBOARD_USE_CASE),
      dashboardInstallmentImport!,
    );
    const notifyResolved = path.resolve(
      path.dirname(NOTIFY_CLIENT_USE_CASE),
      notifyInstallmentImport!,
    );

    // Ambas deben apuntar al mismo directorio de installments
    expect(dashboardResolved).toBe(notifyResolved);
  });
});
