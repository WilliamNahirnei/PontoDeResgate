# Arquitetura do backend: organização por domínio com nwidart/laravel-modules

Este documento descreve como o código do backend é organizado desde a adoção do pacote
[`nwidart/laravel-modules`](https://laravelmodules.com/docs/13) e serve como referência
para qualquer IA (ou humano) que for editar, ler ou planejar mudanças neste repositório.

## Por que existe

O Laravel, por padrão, organiza código "por tipo técnico": todos os models em
`app/Models`, todos os controllers em `app/Http/Controllers`, etc. Isso funciona bem em
projetos pequenos, mas dilui o domínio de negócio — pra entender tudo que envolve
"pedidos de resgate", é preciso caçar arquivos espalhados em várias pastas técnicas.

Este projeto adota o oposto: organização **por domínio**. Cada módulo é uma fatia
vertical completa (models, controllers, requests, resources, migrations, rotas, testes)
de uma área de negócio. `app/` deixou de ser o lugar principal do código — hoje só
contém o que é genuinely compartilhado por todos os módulos.

## Módulos existentes

| Módulo | Caminho | Domínio |
|---|---|---|
| `Usuarios` | `Modules/Usuarios/` | Autenticação (Sanctum), usuários/operadores, papéis (`role`) |
| `Resgates` | `Modules/Resgates/` | Pedidos de socorro e histórico de mudanças de status |

**Regra de decisão — em qual módulo um arquivo novo entra:**
- Se o arquivo gira em torno da entidade `User` (login, permissões, cadastro de
  operador) → `Modules/Usuarios`.
- Se o arquivo gira em torno de `RescueRequest`/`RescueStatusLog` (o pedido de socorro
  em si e seu ciclo de vida) → `Modules/Resgates`.
- Se um novo domínio de negócio surgir que não se encaixa nos dois acima (ex.: um
  futuro módulo de notificações, relatórios, etc.), crie um módulo novo — não force o
  código dentro de um módulo existente só porque já existe.
- Código verdadeiramente compartilhado entre **todos** os módulos (ex.: a classe base
  `Controller`) continua em `app/`. Isso deve ser raro — a maior parte das dependências
  entre domínios deve ser uma dependência explícita de um módulo sobre o outro (ver
  seção "Dependência entre módulos" abaixo), não um terceiro lugar genérico.

## O que sobrou em `app/`

```
app/
├── Http/Controllers/Controller.php   # classe base abstrata, sem lógica própria
└── Providers/AppServiceProvider.php  # provider global do Laravel
```

Todo o resto do domínio de negócio foi movido para dentro de `Modules/`.

## Estrutura de um módulo

```
Modules/<Nome>/
├── app/
│   ├── Enums/
│   ├── Http/
│   │   ├── Controllers/
│   │   ├── Middleware/         (só se o middleware for específico do módulo)
│   │   ├── Requests/
│   │   └── Resources/
│   ├── Models/
│   └── Providers/
│       ├── <Nome>ServiceProvider.php   # registra o módulo no Laravel
│       └── RouteServiceProvider.php    # registra routes/api.php do módulo
├── config/
├── database/
│   ├── factories/
│   ├── migrations/
│   └── seeders/
├── routes/
│   └── api.php                 # único arquivo de rotas — projeto é API-only
├── tests/
│   ├── Feature/
│   └── Unit/
├── module.json                 # manifest: nome, providers registrados
└── composer.json                # autoload PSR-4 do módulo (ver seção abaixo)
```

Não existe `resources/views/` nem `routes/web.php` em nenhum módulo — o projeto é uma
API pura consumida pelo frontend Vue, sem Blade.

## Namespace e autoloading

Cada módulo mapeia seu próprio namespace PSR-4 no `composer.json` do módulo, por exemplo
(`Modules/Usuarios/composer.json`):

```json
{
    "autoload": {
        "psr-4": {
            "Modules\\Usuarios\\": "app/",
            "Modules\\Usuarios\\Database\\Factories\\": "database/factories/",
            "Modules\\Usuarios\\Database\\Seeders\\": "database/seeders/"
        }
    }
}
```

Esses `composer.json` de módulo **não aparecem no autoload do `composer.json` raiz**.
Eles são injetados em tempo de build pelo `wikimedia/composer-merge-plugin`, configurado
no `composer.json` raiz:

```json
"extra": {
    "merge-plugin": {
        "include": ["Modules/*/composer.json"]
    }
}
```

**Implicação prática:** depois de criar ou mover qualquer arquivo dentro de um módulo, é
preciso rodar `composer dump-autoload` (dentro do container: `docker compose exec backend
composer dump-autoload`) pra esse arquivo ser reconhecido. Sem isso, a classe existe no
disco mas não é resolvida pelo autoloader.

Isso também explica por que editores de código (VSCode/PHPStorm) às vezes mostram
`Modules\...` em vermelho logo após um módulo ser criado: eles precisam reindexar depois
que o Composer gera os arquivos `vendor/composer/autoload_*.php` — não é um erro real de
código, é o índice do editor estar desatualizado.

## Rotas

Cada módulo define suas próprias rotas em `Modules/<Nome>/routes/api.php`, registradas
pelo `RouteServiceProvider` do módulo com o middleware `api` (sem prefixo automático de
nome de módulo — customizado propositalmente pra manter os paths estáveis, ex.:
`POST /api/login`, não `POST /api/usuarios/login`). O `routes/api.php` da raiz do backend
ficou vazio; ele não deve voltar a acumular rotas.

**Exemplo — adicionar uma rota nova em um módulo existente** (`Modules/Resgates/routes/api.php`):

```php
use Modules\Resgates\Http\Controllers\RescueRequestController;

Route::middleware('auth:sanctum')->group(function () {
    // ... rotas existentes ...
    Route::get('/rescue-requests/{rescueRequest}', [RescueRequestController::class, 'show']);
});
```

## Dependência entre módulos

Módulos podem depender uns dos outros — isso é esperado, não um "vazamento" de
arquitetura. Hoje `Modules/Resgates` depende de `Modules/Usuarios` porque um pedido de
resgate tem um operador (`User`). Exemplo real (`Modules/Resgates/app/Models/RescueRequest.php`):

```php
namespace Modules\Resgates\Models;

use Modules\Usuarios\Models\User;

class RescueRequest extends Model
{
    public function operator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'operator_id');
    }
}
```

O mesmo vale para API Resources — `RescueStatusLogResource` (em `Resgates`) usa
`UserResource` (em `Usuarios`) pra serializar o campo `operator`:

```php
namespace Modules\Resgates\Http\Resources;

use Modules\Usuarios\Http\Resources\UserResource;

class RescueStatusLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            // ...
            'operator' => new UserResource($this->operator),
        ];
    }
}
```

Não crie um módulo "compartilhado"/"core" só pra hospedar esse tipo de dependência.
Duas dependências de módulo cruzadas são normais; um terceiro módulo genérico de
"coisas compartilhadas" tende a virar uma lixeira sem coesão de domínio.

## Factories: por que têm `newFactory()`/`$model` explícitos

O Laravel resolve a factory de um model (e vice-versa) por convenção de nome,
assumindo o namespace `App\Models\...` ↔ `Database\Factories\...`. Como os models agora
vivem em `Modules\<Nome>\Models\...`, essa convenção quebra silenciosamente. Por isso
todo model de módulo sobrescreve `newFactory()`, e toda factory de módulo declara
`$model` explicitamente:

```php
// Modules/Usuarios/app/Models/User.php
protected static function newFactory(): UserFactory
{
    return UserFactory::new();
}

// Modules/Usuarios/database/factories/UserFactory.php
class UserFactory extends Factory
{
    protected $model = User::class;
    // ...
}
```

**Ao criar um model novo em qualquer módulo, replique esse padrão** — sem ele,
`Model::factory()` lança `Class "Database\Factories\...Factory" not found`.

## Migrations: nome do arquivo é a chave, não a pasta

O Laravel casa migrations já executadas pelo **nome do arquivo** na tabela `migrations`,
não pelo caminho. Migrations de cada módulo ficam em `Modules/<Nome>/database/migrations/`
e são descobertas automaticamente (`auto-discover.migrations => true` em
`config/modules.php`), mas a ordem de execução continua global — todas as migrations de
todos os módulos são ordenadas juntas pelo prefixo de data no nome do arquivo,
independente de em qual módulo cada uma está. **Nunca renomeie uma migration já
executada em qualquer ambiente** — o Laravel a trataria como nova e tentaria rodá-la de
novo.

## Middleware de papel (`role`)

O alias `role` (`EnsureUserHasRole`) é registrado globalmente em `bootstrap/app.php`,
mesmo a classe vivendo dentro de `Modules/Usuarios`:

```php
use Modules\Usuarios\Http\Middleware\EnsureUserHasRole;

->withMiddleware(function (Middleware $middleware): void {
    $middleware->alias(['role' => EnsureUserHasRole::class]);
})
```

Middleware que é conceitualmente de um módulo mas usado por rotas de outro módulo
(como `role:admin_master`, usado tanto em `Usuarios` quanto em `Resgates`) não precisa
"morar" em nenhum lugar neutro — o alias global resolve isso independente de onde a
classe física está.

## Criando um módulo novo do zero

```sh
docker compose exec backend php artisan module:make NomeDoModulo
```

Isso gera o esqueleto padrão (ver "Estrutura de um módulo" acima). Depois de gerar:

1. Delete o que não se aplica a uma API sem views (`resources/`, `routes/web.php`,
   `vite.config.js`, `package.json`, o controller de exemplo, `EventServiceProvider.php`
   se não for usado) e remova as referências a eles no
   `app/Providers/<Nome>ServiceProvider.php` e `RouteServiceProvider.php`.
2. Rode `composer dump-autoload` depois de adicionar os primeiros arquivos reais.
3. Confirme com `php artisan module:list` que o módulo aparece como `Enabled`.

## Referência rápida

| Tipo de arquivo | Caminho | Namespace |
|---|---|---|
| Model | `Modules/<Nome>/app/Models/X.php` | `Modules\<Nome>\Models\X` |
| Controller | `Modules/<Nome>/app/Http/Controllers/XController.php` | `Modules\<Nome>\Http\Controllers\XController` |
| Form Request | `Modules/<Nome>/app/Http/Requests/.../XRequest.php` | `Modules\<Nome>\Http\Requests\...\XRequest` |
| API Resource | `Modules/<Nome>/app/Http/Resources/XResource.php` | `Modules\<Nome>\Http\Resources\XResource` |
| Enum | `Modules/<Nome>/app/Enums/X.php` | `Modules\<Nome>\Enums\X` |
| Migration | `Modules/<Nome>/database/migrations/*.php` | (sem namespace — classe anônima) |
| Factory | `Modules/<Nome>/database/factories/XFactory.php` | `Modules\<Nome>\Database\Factories\XFactory` |
| Rotas de API | `Modules/<Nome>/routes/api.php` | — |
