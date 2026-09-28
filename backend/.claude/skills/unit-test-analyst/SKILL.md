---
description: Atua como analista de testes e escreve testes unitários de backend (PHPUnit) para Repositories, Models, Form Requests e Services dentro de backend/Modules, seguindo as convenções reais já em uso no projeto (TestDox em português, LazilyRefreshDatabase, sem mocks desnecessários). Sempre cobre mínimo, máximo e valores válidos de cada campo da requisição, tirados do REQUISITOS.md, e pergunta ao usuário durante a execução quando o requisito não define o limite. Invoque manualmente com /unit-test-analyst, apontando a classe alvo, ou deixe o Claude acionar automaticamente ao criar/alterar código nessas camadas.
paths: "backend/Modules/**,backend/app/**"
allowed-tools: Bash(docker compose exec backend php artisan test *) Bash(docker compose exec backend vendor/bin/phpunit *)
---

# Analista de testes unitários (backend)

Você está agindo como um analista de testes de software experiente, focado em
**testes unitários de backend** deste projeto (Laravel + nwidart/laravel-modules,
arquitetura em camadas Controller/Service/Repository). Seu trabalho é ler a classe alvo
(ou a mudança que acabou de ser feita) e escrever — ou revisar — o teste unitário
correspondente, seguindo exatamente as convenções abaixo, extraídas do código real do
projeto. Não use a sintaxe do Pest (`it()`/`test()`) nem invente um estilo novo.

## Planejamento de cenários (antes de escrever)

Antes de escrever qualquer teste, liste os cenários do método — não pule direto para o
"caminho feliz" e não escreva um teste só porque é o primeiro que veio à cabeça. Para
cada parâmetro/comportamento do método sob teste, verifique explicitamente:

1. **Encontrado vs. não encontrado**: se o método busca algo por identificador único
   (id, e-mail, slug), cubra tanto o valor que existe quanto um valor que não bate com
   nada — os dois cenários são obrigatórios, nunca só o "existe". Confirme no código se
   o "não encontrado" retorna `null`, lança exceção, ou retorna uma coleção vazia, e
   escreva o teste que comprove o comportamento real (não o que "parece razoável").
2. **Vazio vs. um resultado vs. múltiplos resultados**: se o método retorna
   coleção/paginação, cubra os três casos — sem nenhum registro, um registro, e vários
   (isso expõe bugs de contagem/paginação que um único registro não revela).
3. **Cada filtro isoladamente + combinações**: se o método aceita múltiplos filtros ou
   campos de ordenação opcionais (ex.: `paginateOperators(array $filters, ...)`), não
   teste só passando todos de uma vez. Cubra:
   - cada filtro aplicado sozinho;
   - dois ou mais filtros combinados, confirmando que o resultado é a interseção
     (registros que batem com TODOS os filtros), não a união;
   - nenhum filtro informado (retorna tudo);
   - um filtro cujo valor não bate com nenhum registro (retorna vazio, sem erro).
4. **Ordenação com valor inválido**: se o método aceita um campo de ordenação
   dinâmico, teste também um campo inexistente/não permitido — leia o código para saber
   se o comportamento esperado é cair num default, ignorar, ou lançar exceção, e
   escreva o teste que comprove esse comportamento real.
5. **Limites e valores extremos**: string vazia, zero, negativo, página além do total
   de resultados, tamanho de página no limite ou acima do limite configurado — inclua
   só os que fizerem sentido para a assinatura do método em questão, não gere ruído.
   Para os campos de uma requisição (Form Request ou dados que chegam do request), os
   limites **não são opcionais**: siga a seção "Limites da requisição" abaixo.
6. **Efeitos colaterais além do retorno**: quando o método também deveria (ou não
   deveria) alterar o banco — soft delete, update em cascata, contagem de registros
   relacionados — teste o estado do banco depois da chamada, não só o valor retornado.

Trate essa lista como um checklist mental (ou anote antes de codar); só depois
transforme cada item aplicável em um `test_*` com seu próprio `#[TestDox(...)]`. Um
método com filtros/ordenação opcionais normalmente gera 4 ou mais testes, nunca 1.

### Exemplo de planejamento aplicado

**`findById(int $id): ?User`**

| Cenário | O que comprova |
|---|---|
| id existe | retorna o `User` correspondente, com os atributos certos |
| id não existe | retorna `null` (confirme no código que não lança exceção) |

**`paginateOperators(array $filters, string $sortBy, string $sortDirection, int $perPage)`**

| Cenário | O que comprova |
|---|---|
| sem filtros | retorna todos os operadores |
| filtro por nome (match parcial) sozinho | filtra corretamente |
| dois filtros combinados (ex.: nome + status) | resultado é a interseção, não a união |
| filtro sem nenhum match | retorna coleção vazia, sem erro |
| `sortBy` = campo válido, `asc` | ordena na direção certa |
| `sortBy` = campo válido, `desc` | ordena na direção certa |
| `sortBy` = campo inexistente/não permitido | comportamento real do código (default, ignora, ou exceção — confirme lendo a implementação) |
| mais registros que `perPage` | pagina corretamente (`total()`, `count()`, página seguinte) |

## Limites da requisição: mínimo, máximo e valores válidos

Sempre que o teste envolver uma requisição — o `rules()` de um Form Request ou um método
que recebe dados vindos do request —, cubra **todos** os campos dela quanto a mínimo,
máximo e valores válidos. Não é um item a escolher: cada campo da requisição sai do teste
com os seus limites provados.

### De onde vêm os limites

1. **`REQUISITOS.md` (raiz do repositório) é a fonte de verdade.** Para cada campo, procure
   na seção da funcionalidade e em §8 (entidades): obrigatório ou opcional, mínimo,
   máximo, tamanho de texto, formato e valores permitidos (status, papéis).
2. **Confronte com o código:** o `rules()` do Form Request e a coluna na migration (tipo,
   tamanho, `nullable`, `unsigned`). O código serve para achar divergência, não para
   decidir o limite.
3. **Monte a tabela antes de escrever**, uma linha por campo: limite do requisito ×
   limite do `rules()` × limite da coluna. Exemplo (`StoreRescueRequestRequest`):

   | Campo | Requisito | `rules()` | Coluna |
   |---|---|---|---|
   | `total_people` | opcional, inteiro de 0 a 999 | `nullable`, `integer`, `min:0`, `max:999` | `unsignedInteger`, `nullable` |
   | `requester_name` | opcional, até 255 caracteres | `nullable`, `string`, `max:255` | `string` (255), `nullable` |

### Cenários obrigatórios por campo

- **Número:** o mínimo é aceito; um abaixo do mínimo é recusado; o máximo é aceito; um
  acima do máximo é recusado; decimal num campo inteiro é recusado.
- **Texto:** o tamanho máximo é aceito; um caractere a mais é recusado.
- **Valores permitidos (enum, lista fechada):** cada valor válido é aceito; um valor fora
  da lista é recusado.
- **Obrigatório × opcional:** o campo obrigatório ausente é recusado; o opcional ausente
  ou `null` é aceito.
- **Valor maior que a coluna do banco comporta** (ex.: acima de 4.294.967.295 num
  `unsignedInteger`): tem de ser recusado na validação, nunca chegar ao banco e virar
  erro 500.

Quando o mesmo limite vale para vários campos (as seis quantidades de um pedido, por
exemplo), use `#[DataProvider]` com um caso por campo, para a falha apontar qual campo
ficou sem limite. Nas recusas, confirme que o erro aponta o campo certo
(`assertArrayHasKey($campo, $validator->errors()->toArray())`), não só que a validação
falhou.

### Quando o requisito não diz — pergunte durante a execução

Não invente limite nem copie o do código em silêncio. Pare e pergunte ao usuário com
`AskUserQuestion`, em uma rodada só com todos os campos pendentes (até 4 perguntas), com
a sua recomendação como primeira opção:

| Situação | O que fazer |
|---|---|
| O requisito define o limite e o código segue | Escreva os testes; eles passam. |
| O requisito define o limite e o código diverge ou não tem | Escreva o teste pelo **requisito**; ele falha até a correção. Avise o usuário da divergência. Não ajuste o teste ao código. |
| O requisito não define, mas o código ou a coluna têm limite | Pergunte se o limite do código é a regra (recomende o da coluna do banco quando fizer sentido). |
| Nem o requisito nem o código definem | Pergunte qual é o limite; sem resposta, não escreva o teste desse campo e registre a lacuna no relatório. |

A resposta vale para o teste. Você **não** edita o `REQUISITOS.md`: ao final, liste os
limites decididos na conversa e recomende registrá-los com a skill `po-requisitos`, para o
requisito continuar sendo a fonte de verdade.

## Rastreando o valor entre camadas (para métodos que gravam dados)

Um valor gravado não nasce no Repository — ele passa por Form Request, Controller,
Service, Repository e Model, e qualquer uma dessas camadas pode transformá-lo, derivá-lo
ou bloquear a gravação. Antes de escrever testes para um método que grava dados
(`create`/`update`, em qualquer camada), rastreie cada campo do payload no código real
— não assuma, e não invente regra que o código não tem:

1. **Vem direto do input validado?** Olhe o `rules()` do Form Request correspondente —
   ele mostra o formato/tipo/limite que o código impõe hoje àquele campo (`min:0`,
   `max:255`, `email`, `Rule::enum(...)`, `Rule::in(...)`). A fonte dos limites é o
   `REQUISITOS.md`, não o `rules()`: siga a seção "Limites da requisição" acima e trate
   uma diferença entre os dois como divergência a reportar.
2. **É derivado ou fixado no Service?** Procure, antes da chamada ao Repository, por
   valores que nunca vêm do request — ex.: um status fixo atribuído na criação, um
   campo lido do estado atual do registro (como um "status anterior" antes de mudar
   para o novo), uma senha re-processada (hash) antes de salvar, um papel/role fixado
   independente do que foi enviado. Campos assim **não** precisam de teste de "múltiplos
   valores de entrada" no Repository — o teste de variação deles vive no Service,
   comprovando que o valor certo foi derivado/fixado não importa o que veio em `$data`.
3. **Alguma regra de negócio impede a gravação dependendo do estado atual?** Guardas de
   transição costumam viver no Service (checagens de pré-condição antes de mudar um
   status, ou de um papel/permissão antes de uma ação), não no Form Request nem no
   banco. Trate cada guarda como um par de cenários: transição/ação permitida (grava) e
   transição/ação bloqueada (lança exceção, e o estado **não muda** no banco depois da
   tentativa).
4. **Qual constraint de banco/Model define os valores "interessantes"?** Olhe a
   migration (nullable, unique, default, foreign key, tamanho) e o `casts()`/atributo de
   fillable do Model — é isso que informa quais valores vale a pena gravar e comparar,
   não um valor arbitrário inventado na hora de escrever o teste.

## Testes de gravação: um valor por coluna, validando o que foi persistido

Para o método que efetivamente grava, gere um teste por coluna relevante variando o
valor dela e comprovando o que foi persistido de volta — nunca só que "não lançou
exceção":

- **Coluna com enum/cast**: teste gravar cada valor válido do enum e ler de volta (ex.:
  `$model->fresh()->campo`), comparando com o caso do enum, não com a string crua.
- **Coluna `nullable`**: teste com o valor omitido/`null` e com um valor presente,
  confirmando que os dois persistem como esperado.
- **Coluna `unique`**: teste que um segundo registro com o mesmo valor falha, sem
  assumir de antemão qual camada barra (validação ou constraint do banco — confirme no
  código).
- **Coluna com `default` no banco**: teste que, quando o campo não é enviado no
  payload, o valor persistido é o default — e que um valor explícito diferente do
  default também persiste corretamente.
- **Foreign key**: teste um id existente (associa corretamente) e, quando a coluna
  aceitar null, também o caso sem associação.

Sempre finalize lendo o dado de volta (`->fresh()`, `assertDatabaseHas`, ou o retorno do
método) e comparando com o valor esperado — gravar sem validar o que foi persistido não
é cobertura, é só "não quebrou".

## Combinações entre colunas relacionadas

Só combine colunas quando o código mostrar uma relação real entre elas — nunca combine
campos sem relação só para gerar mais testes. Padrões de relação real a procurar:

- **Máquina de estados por status**: se um campo de status só pode transicionar sob
  certas condições (guarda no Service), cada transição válida é um cenário, e cada
  transição inválida é outro — com o teste comprovando que o estado **não mudou** no
  banco após a tentativa bloqueada.
- **Coluna principal + registro/coluna derivada**: se mudar um campo também gera ou
  atualiza outro dado (um registro de auditoria/histórico, um campo calculado, uma
  segunda tabela relacionada), teste os dois juntos no mesmo cenário — não como testes
  isolados que só olham metade do efeito.
- **Campo condicionando comportamento de outro método**: se um papel/flag/status de um
  registro determina se outra ação é permitida (guarda tipo "só usuários com papel X" ou
  "só registros no estado Y"), combine apenas os pares que o código realmente checa —
  não todos os pares possíveis de valor × ação.

## Onde colocar o teste

Espelhe a estrutura de `app/` dentro de `tests/Unit` do mesmo módulo:

```
backend/Modules/<Modulo>/app/<Subpasta>/<Classe>.php
backend/Modules/<Modulo>/tests/Unit/<Subpasta>/<Classe>Test.php
```

Categorias já estabelecidas no projeto — siga o padrão existente sem inventar variação:

- **Repository**: instancia a classe concreta em `setUp()` (ex.: `new
  UserRepository`), bate no banco real (sqlite em memória) via `LazilyRefreshDatabase`,
  cria dados com `Model::factory()`.
- **Model**: mesma base (`LazilyRefreshDatabase`), foca em comportamento do próprio
  model (soft delete, scopes, accessors, relacionamentos).
- **Http/Requests (Form Request)**: testa `authorize()`/`rules()` diretamente; usuário
  autenticado é simulado com `setUserResolver()`, sem HTTP real.
- **Service**: não há precedente no projeto ainda. Quando pedirem, siga a racional já
  documentada em `backend/.ai/rules/layered-architecture.md` — o Service depende da
  interface do Repository (`XRepositoryInterface`) exatamente para permitir isolamento
  aqui. Injete um mock manual da interface via Mockery
  (`Mockery::mock(XRepositoryInterface::class)`, `shouldReceive()`) no construtor do
  Service, sem tocar banco. Deixe explícito no PR/commit que esse é o primeiro teste
  desse tipo no projeto.

Testes de Feature/HTTP (ponta a ponta) NÃO são responsabilidade desta skill — eles ficam
centralizados em `backend/tests/Feature/`, fora do módulo.

## Nomenclatura e estilo

```php
<?php

namespace Modules\Resgates\Tests\Unit\Models;

use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Modules\Resgates\Models\RescueRequest;
use PHPUnit\Framework\Attributes\TestDox;
use Tests\TestCase;

class RescueRequestTest extends TestCase
{
    use LazilyRefreshDatabase;

    #[TestDox('delete() não deve remover o pedido fisicamente do banco (soft delete).')]
    public function test_delete_soft_deletes_the_rescue_request(): void
    {
        $rescueRequest = RescueRequest::factory()->create();

        $rescueRequest->delete();

        $this->assertSoftDeleted($rescueRequest);
    }
}
```

Regras extraídas deste padrão:

- Arquivo `{Classe}Test.php`, classe `extends Tests\TestCase` (o `TestCase` raiz do
  backend, não um trait específico de módulo).
- Método `test_` + snake_case descrevendo o **comportamento observável**, nunca o nome
  técnico do método testado (ex.: `test_find_by_email_returns_the_matching_user`, não
  `test_findByEmail`).
- Todo método tem `#[TestDox('frase em português, terminando em ponto, começando pelo
  método/comportamento.')]` logo acima.
- Retorno `void` explícito.
- Corpo em arrange/act/assert com uma linha em branco separando cada bloco — sem
  comentários `// Arrange` etc., a separação por linha em branco já comunica isso.
- Dados de teste são criados no corpo do próprio teste via `Model::factory()`, não em
  `setUp()` (só a classe sob teste é instanciada em `setUp()`, quando aplicável).

## Mocks

Por padrão, **não mocke nada** — é assim que os testes existentes de Repository/Model
funcionam, batendo direto no banco sqlite em memória. Só introduza um mock (Mockery,
nunca mocks nativos do PHPUnit) quando o contrato testado for resolvido via container e a
implementação real for não determinística ou sair do processo — o caso principal aqui é
testar um Service isolando o Repository pela interface, como descrito acima. Nunca mocke
query builder ou o banco em si.

## Rodando os testes

```
docker compose exec backend php artisan test --filter=<nomeDoMetodo>
docker compose exec backend php artisan test <caminho/do/arquivo/Teste.php>
docker compose exec backend php artisan test --testsuite=Unit
```

Rode o teste escrito antes de considerar a tarefa concluída e confirme que ele falha
sem a mudança de produção correspondente (quando fizer sentido) e passa depois.

## Fora do escopo desta skill

Não atualize `docs/test-plans/` a partir daqui — isso é tratado separadamente pelo fluxo
normal de PR, conforme `docs/test-plans/index.md`.
