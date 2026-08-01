import { deveDispararSincronizacao } from '../syncTrigger';

// `syncTrigger.ts` importa `syncQueue.ts`, que importa `database.ts` (expo-sqlite real) —
// mockado aqui porque `deveDispararSincronizacao` é pura e não precisa dessa cadeia.
jest.mock('../syncQueue', () => ({
  sincronizarTudo: jest.fn(),
}));

describe('deveDispararSincronizacao', () => {
  it('dispara quando estava offline e ficou online', () => {
    expect(deveDispararSincronizacao(false, true)).toBe(true);
  });

  it('não dispara quando já estava online', () => {
    expect(deveDispararSincronizacao(true, true)).toBe(false);
  });

  it('não dispara ao ficar offline', () => {
    expect(deveDispararSincronizacao(true, false)).toBe(false);
  });

  it('não dispara quando continua offline', () => {
    expect(deveDispararSincronizacao(false, false)).toBe(false);
  });
});
