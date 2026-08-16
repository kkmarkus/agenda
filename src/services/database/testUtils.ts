// Helpers compartilhados pelos testes dos repositórios (não é um arquivo
// de teste em si — não bate no padrão *.test.ts, então o Jest não tenta
// rodá-lo como suíte).

// Cada chamada de `criarBancoDeTeste()` monta um banco novo e ISOLADO
// (via `jest.isolateModules`, que dá um registro de módulos próprio pra
// esse require): o schema real é criado de verdade (`initDatabase()`
// roda o SQL de produção, não uma cópia à parte que poderia divergir).
// Só a conexão SQLite em si é trocada pelo mock em `__mocks__/db.ts`.
export function criarBancoDeTeste(): typeof import('./index') {
  let modulo!: typeof import('./index');
  jest.isolateModules(() => {
    jest.mock('./db');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    modulo = require('./index');
    modulo.initDatabase();
  });
  return modulo;
}

// Mesma ideia do helper acima, mas SEM chamar `initDatabase()` — pros
// testes de migração, que precisam montar um schema "antigo" à mão
// antes de rodar `initDatabase()` por cima (senão o `CREATE TABLE IF NOT
// EXISTS` nunca chegaria a exercitar o caminho de migração de verdade).
export function criarConexaoDeTesteSemInit(): {
  db: typeof import('./db').db;
  database: typeof import('./index');
  migrations: typeof import('./migrations');
} {
  let resultado!: ReturnType<typeof criarConexaoDeTesteSemInit>;
  jest.isolateModules(() => {
    jest.mock('./db');
    resultado = {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      db: require('./db').db,
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      database: require('./index'),
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      migrations: require('./migrations'),
    };
  });
  return resultado;
}
