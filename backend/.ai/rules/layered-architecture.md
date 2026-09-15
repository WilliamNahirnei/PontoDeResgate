# Arquitetura em camadas dentro de cada módulo: Controller → Service → Repository → Model

Este documento complementa `modules-architecture.md`: aquele descreve os limites *entre*
módulos (`Modules/Usuarios`, `Modules/Resgates`); este descreve a organização *dentro*
de cada módulo.

## Responsabilidade de cada camada

- **Controller**: recebe a requisição, orquestra a chamada de um ou mais Services, trata
  erros da requisição (deixando exceções subirem até o exception handler global — ver
  seção "Tratamento de erro" abaixo), aciona formatação de resposta (Resources) quando
  necessário. **Não contém regra de negócio.**
- **Service**: executa regras de negócio, controla transações de banco
  (`DB::transaction()`), chama Repositories (via interface) para consultar ou persistir
  dados.
- **Repository**: realiza operações no banco de dados (queries, consultas,
  persistência) por trás de uma interface. Não decide regra de negócio.
- **Model**: contém regras de modelo e mapeamento de colunas (Eloquent — relations,
  casts, `#[Fillable]`). Não executa regra de negócio nem é chamado fora de
  Repository/Service (Controllers nunca importam um Model diretamente, exceto para
  type-hint de route-model-binding).

## Estrutura de pastas dentro de um módulo

```
Modules/Resgates/
├── app/
│   ├── Enums/RescueRequestStatus.php
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── RescueRequestController.php      # fino: Service + Resource
│   │   │   └── RescueStatusLogController.php
│   │   ├── Requests/RescueRequest/...
│   │   └── Resources/...
│   ├── Models/
│   │   ├── RescueRequest.php
│   │   └── RescueStatusLog.php
│   ├── Services/
│   │   ├── RescueRequestService.php              # regra de negócio + transação
│   │   └── RescueStatusLogService.php
│   ├── Repositories/
│   │   ├── Contracts/
│   │   │   ├── RescueRequestRepositoryInterface.php
│   │   │   └── RescueStatusLogRepositoryInterface.php
│   │   ├── RescueRequestRepository.php           # implementa a interface
│   │   └── RescueStatusLogRepository.php
│   └── Providers/
│       ├── ResgatesServiceProvider.php           # + bind() das interfaces
│       └── RouteServiceProvider.php
├── database/...
├── routes/api.php
└── tests/...
```

`Modules/Usuarios` segue a mesma simetria: `Services/{AuthService,OperatorService}.php`
e `Repositories/{Contracts/UserRepositoryInterface,UserRepository}.php`.

## Exemplo completo — fluxo `assume` de um pedido de resgate

**Controller** (`Modules/Resgates/app/Http/Controllers/RescueRequestController.php`):
```php
class RescueRequestController extends Controller
{
    public function __construct(private RescueRequestService $service) {}

    public function assume(Request $request, RescueRequest $rescueRequest): RescueRequestResource
    {
        return new RescueRequestResource(
            $this->service->assume($rescueRequest, $request->user())
        );
    }
}
```

**Service** (`Modules/Resgates/app/Services/RescueRequestService.php`):
```php
class RescueRequestService
{
    public function __construct(
        private RescueRequestRepositoryInterface $rescueRequests,
        private RescueStatusLogRepositoryInterface $statusLogs,
    ) {}

    public function assume(RescueRequest $rescueRequest, User $operator): RescueRequest
    {
        abort_if($rescueRequest->status !== RescueRequestStatus::Pendente, 409, 'Este pedido não está mais pendente.');

        return DB::transaction(function () use ($rescueRequest, $operator) {
            $previousStatus = $rescueRequest->status;

            $rescueRequest = $this->rescueRequests->updateStatus($rescueRequest, [
                'operator_id' => $operator->id,
                'status' => RescueRequestStatus::EmResgate,
            ]);

            $this->statusLogs->create([
                'rescue_request_id' => $rescueRequest->id,
                'operator_id' => $operator->id,
                'previous_status' => $previousStatus,
                'new_status' => RescueRequestStatus::EmResgate,
            ]);

            return $this->rescueRequests->freshWithOperator($rescueRequest);
        });
    }
}
```

**Repository** (`Modules/Resgates/app/Repositories/Contracts/RescueRequestRepositoryInterface.php`
+ `RescueRequestRepository.php`):
```php
interface RescueRequestRepositoryInterface
{
    public function create(array $attributes): RescueRequest;
    public function listWithFilters(array $filters, string $sortBy, string $sortDirection): Collection;
    public function updateStatus(RescueRequest $rescueRequest, array $attributes): RescueRequest;
    public function freshWithOperator(RescueRequest $rescueRequest): RescueRequest;
}

class RescueRequestRepository implements RescueRequestRepositoryInterface
{
    public function updateStatus(RescueRequest $rescueRequest, array $attributes): RescueRequest
    {
        $rescueRequest->update($attributes);

        return $rescueRequest;
    }

    public function freshWithOperator(RescueRequest $rescueRequest): RescueRequest
    {
        return $rescueRequest->fresh('operator');
    }
}
```

**Binding** (`Modules/Resgates/app/Providers/ResgatesServiceProvider.php`):
```php
public function register(): void
{
    parent::register(); // registra o RouteServiceProvider do módulo — não pular

    $this->app->bind(RescueRequestRepositoryInterface::class, RescueRequestRepository::class);
    $this->app->bind(RescueStatusLogRepositoryInterface::class, RescueStatusLogRepository::class);
}
```

## Como as camadas se comunicam

**Controller → Service: injeção direta da classe concreta, sem interface.** Regra de
negócio normalmente tem uma única implementação real, e a suíte de testes deste projeto
é 100% Feature/HTTP (bate no endpoint real, com `RefreshDatabase`) — não há teste
isolando Controller de Service. Uma interface aqui seria abstração sem uso real.

**Service → Repository: injeção via interface (`XRepositoryInterface`), com `bind()` no
`ServiceProvider` do próprio módulo.** Motivos:
1. Permite testar um Service isoladamente no futuro (`Mockery::mock(XRepositoryInterface::class)`)
   sem precisar de banco — não existe esse tipo de teste hoje, mas a interface deixa a
   porta aberta sem custo extra (o `bind()` já seria necessário de qualquer forma).
2. Inversão de dependência real: a regra de negócio (política de alto nível) não deveria
   depender do detalhe de implementação de acesso a dado.
3. Ponto único de troca: mudar a fonte de dados de uma consulta não toca nenhum Service.

**Repository ↔ Model:** o Repository é o único lugar que fala Eloquent/query builder
diretamente.

### Nem toda ação precisa de Service + Repository

Ações sem regra de negócio nem consulta própria ficam direto no Controller:
- `AuthController::me()` só devolve `new UserResource($request->user())` — o usuário já
  vem resolvido pelo Sanctum.

E ações que tocam um recurso do framework (não uma entidade de domínio) ficam no Service
sem passar por um Repository dedicado — não existe (nem faria sentido criar) um
Repository só pra isso:
- `AuthService::logout()` chama `$user->currentAccessToken()->delete()` diretamente —
  é uma operação de sessão/token do Sanctum, não uma consulta a `User`, `RescueRequest`
  ou `RescueStatusLog`.

### Controller chamando múltiplos Services em sequência

Regra de decisão: **existe uma regra de negócio amarrando as chamadas** (ordem
obrigatória, atomicidade, "se A falhar B não deve acontecer")?

- **Não** (leituras/escritas independentes, nenhuma depende do resultado da outra) → o
  Controller pode injetar e chamar os Services diretamente em sequência. Exemplo: um
  endpoint de dashboard que combina `OperatorService::list()` e
  `RescueRequestService::list()` só para exibição.
- **Sim** (precisa de uma transação só, ou uma chamada depende da outra) → a coordenação
  é regra de negócio e não pode ficar no Controller. Ela desce um nível: um Service
  injeta e chama o outro Service diretamente (mesmo motivo do Controller→Service: ainda
  é regra de negócio, não acesso a dado). Só extraia um Service dedicado exclusivamente
  à orquestração se isso crescer demais para caber no Service que já é dono da ação —
  não antecipe essa extração sem necessidade concreta.

Exemplo (hipotético, ilustrativo — não implementado): se "desativar um operador"
precisar também "cancelar os pedidos que ele está atendendo", isso cruza `Usuarios` e
`Resgates`. Quem já é dono da ação disparadora (`OperatorService::deactivate()`, em
`Usuarios`) injeta `RescueRequestService` (de `Resgates`) diretamente e envolve as duas
operações em um único `DB::transaction()`:

```php
// Modules/Usuarios/app/Services/OperatorService.php
use Modules\Resgates\Services\RescueRequestService; // outro Service, injetado igual um Repository

class OperatorService
{
    public function __construct(
        private UserRepositoryInterface $users,
        private RescueRequestService $rescueRequests,
    ) {}

    public function deactivate(User $operator): User
    {
        abort_unless($operator->isOperador(), 404);

        return DB::transaction(function () use ($operator) {
            $this->rescueRequests->cancelAllAssumedBy($operator, 'Operador desativado.');
            $this->users->revokeTokens($operator);

            return $this->users->update($operator, ['active' => false]);
        });
    }
}
```

O Controller de `Usuarios` continua chamando só `OperatorService::deactivate()` — nunca
sabe que `Resgates` está envolvido. O `DB::transaction()` fica no Service dono da regra;
o Service dependente não abre sua própria transação aninhada para esse caso. Dependência
de Service entre módulos segue a mesma direção já documentada em
`modules-architecture.md` (`Resgates` pode depender de `Usuarios`, não o contrário).

## Tratamento de erro no Controller

"Controller trata erros de toda a requisição" é satisfeito deixando exceções
(`ValidationException`, `HttpException` via `abort()`/`abort_if()` lançadas de dentro do
Service) subirem até o exception handler global já configurado em `bootstrap/app.php`
(`withExceptions` → `shouldRenderJsonWhen`). Não é necessário `try/catch` manual em cada
método de Controller. `abort_if`/`abort_unless` continuam sendo chamados a partir do
Service — é ele quem conhece a regra (ex.: "só pode assumir se pendente").
