# Índice de regras

Mapa de glob de arquivo → arquivo de regra. Leia o arquivo de regra correspondente
antes de criar, mover ou editar qualquer arquivo cujo caminho bata com o glob.

| Glob | Arquivo | Assunto |
|---|---|---|
| `app/**`, `Modules/**` | [`modules-architecture.md`](./modules-architecture.md) | Organização do backend por domínio com `nwidart/laravel-modules`: onde cada tipo de arquivo entra, autoloading, rotas, dependência entre módulos, factories, migrations. |
| `app/**`, `Modules/**` | [`layered-architecture.md`](./layered-architecture.md) | Arquitetura em camadas dentro de cada módulo: Controller → Service → Repository → Model, injeção via interface no Repository, quando um Service pode chamar outro Service. |
