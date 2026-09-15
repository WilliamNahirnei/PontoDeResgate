# Requisitos do PontoDeResgate

> Este arquivo é a fonte de verdade para regras de negócio e requisitos de produto do PontoDeResgate. Deve ser mantido atualizado conforme as decisões do projeto evoluírem.

## 1. Visão geral

O PontoDeResgate é um sistema web para coordenar pedidos de socorro durante desastres de grande escala (enchentes, incêndios, terremotos, entre outros).

O sistema **não é específico a um tipo de desastre** e não possui um campo de "tipo de desastre" nos registros: cada implantação (deploy) do sistema já está associada a um evento específico e a um contexto operacional próprio.

O objetivo central é permitir que:
- Pessoas em situação de risco registrem um pedido de socorro rapidamente, sem barreiras de acesso.
- Operadores e voluntários visualizem, priorizem e coordenem o atendimento desses pedidos em tempo hábil.

## 2. Papéis de usuário

| Papel | Autenticação | Acesso |
|---|---|---|
| Pessoa em situação de risco | Sem login | Somente a tela pública de solicitação de socorro |
| Operador / voluntário | Login com Bearer token (Laravel Sanctum) | Painel de coordenação (mapa, lista, gestão de status dos pedidos) |
| Admin master | Login com Bearer token (Laravel Sanctum) | Cadastro de operadores, além do acesso do operador |

## 3. Tela pública (sem autenticação)

Acessível a qualquer pessoa, sem necessidade de login. É a tela padrão do site (rota raiz).

A tela pública deve conter **somente** informações relacionadas a solicitar um resgate. Ela não deve citar, referenciar ou linkar a área do operador (login, painel, etc.) de forma alguma — o acesso do operador não é divulgado nem sugerido nesta tela, incluindo o link/rota do painel (`/painel`). O operador precisa conhecer o endereço de acesso por fora do sistema (ex.: repassado pelo admin master).

### 3.1 Seleção de localização
- Seleção da localização em um mapa (Leaflet + OpenStreetMap).
- Ao abrir a tela, o pin padrão já é posicionado na localização que o navegador detectar (geolocalização), quando disponível/permitida. Caso não seja possível obter a localização do navegador, a pessoa marca o pin manualmente.
- O pin de localização pode ser ajustado manualmente pela pessoa após a seleção inicial (automática ou não).

### 3.2 Formulário de pedido (todos os campos opcionais, exceto a localização)
- Nome da pessoa solicitante.
- Quantidade total de pessoas no local.
- Quantidade de pessoas por categoria: homens, mulheres, crianças, idosos.
- Quantidade de animais.
- Ponto de referência textual, complementar à localização marcada no mapa.

### 3.3 Regras de negócio
- Ao ser enviado, o pedido é persistido como um registro de `rescue_request` com status inicial **"pendente"**.
- A localização (coordenadas do mapa) é obrigatória; os demais campos do formulário são opcionais.
- A pessoa solicitante **não tem acesso a nenhum identificador ou meio de consulta** do pedido após o envio:
  - Não pode editar o pedido já enviado.
  - Não pode visualizar o status do pedido.
  - Caso precise atualizar informações ou reforçar o pedido, a única ação possível é enviar um **novo** pedido.

## 4. Painel autenticado (operadores e admin master)

Acesso restrito a usuários autenticados via Bearer token (Sanctum).

### 4.1 Visualização de pedidos
- **Mapa**: exibe os pedidos georreferenciados; ao passar o mouse (hover) sobre um pedido, mostra a quantidade de pessoas e a data/hora do pedido.
- Ao carregar os pedidos, o mapa se ajusta automaticamente para enquadrar todos eles (não fica centralizado num local fixo/padrão) — a implantação do sistema pode ser em qualquer cidade, então o mapa não pode presumir uma região. Esse enquadramento automático acontece apenas na primeira carga dos pedidos; atualizações e mudanças de status seguintes não reposicionam o mapa, para não atrapalhar o operador.
- **Lista**: visualização alternativa ao mapa, em formato de lista de pedidos.
- Ao clicar em um pedido na lista, ele fica em destaque no mapa e informações sobre ele aparecem. Ao clicar em outro pedido, as informações do pedido clicado anteriormente no mapa não são mais mostradas — somente as do novo pedido clicado.

### 4.2 Gestão de status do pedido
- **Assumir pedido**: altera o status para **"em_resgate"** e registra o operador responsável pelo atendimento.
- **Concluir pedido**: altera o status para **"concluído"**.
- **Cancelar pedido**: altera o status para **"cancelado"**; exige o preenchimento obrigatório do motivo do cancelamento.
- **Compartilhar localização**: ao clicar, os dados da localização são copiados para a área de transferência e uma confirmação visual é exibida informando que a cópia foi feita.
- **Compartilhar localização**: permite compartilhar a localização do pedido (ex.: para acionar uma equipe de resgate externa).

### 4.3 Regras de negócio
- Todo `rescue_request` utiliza **soft delete** — nunca é removido fisicamente do banco de dados.
- Toda mudança de status gera um registro de auditoria em `rescue_status_logs`, contendo:
  - Pedido relacionado (`rescue_request`).
  - Operador responsável pela mudança.
  - Status anterior.
  - Novo status.
  - Data/hora da mudança.

### 4.4 Cadastro e gestão de operadores (admin master)
- O admin master é responsável por cadastrar novos operadores/voluntários no sistema.
- A tela do admin master possui um ponto de navegação para a lista de operadores.
- **Lista de operadores**:
  - Exibe os dados dos operadores cadastrados.
  - Possui um botão para desativar um operador específico.
  - Um operador desativado pode ser reativado.
  - Possui filtro por nome do operador.
  - Possui filtro por e-mail do operador.
  - É paginada.
  - Possui um botão que direciona para o cadastro de um novo operador.
- Um operador desativado não consegue autenticar-se no sistema.
- Operadores (que não sejam admin master) não têm acesso à lista de operadores nem ao cadastro de novos operadores — essas telas e os respectivos endpoints são exclusivos do admin master.

### 4.5 Consulta de logs de operações (admin master)
- Junto aos itens de navegação para o painel principal e para a lista de operadores, o admin master tem acesso a um menu para a lista de logs (`rescue_status_logs`) das operações realizadas sobre os pedidos de resgate.
- A lista de logs é paginada.
- Operadores (que não sejam admin master) não têm acesso a essa tela nem ao endpoint correspondente — exclusivo do admin master.

## 5. Alertas em tempo real (websocket leve)

- Quando um novo pedido de socorro é registrado, todos os operadores conectados recebem um alerta via websocket informando que há um novo pedido, sugerindo que atualizem a tela.
- **Não há sincronização automática de dados**: o alerta apenas notifica a existência de novidade — a atualização da lista/mapa com os dados mais recentes continua sendo uma ação manual do operador (ex.: recarregar ou clicar em atualizar).

## 6. Fora do escopo do MVP

- Área autenticada para os próprios resgatistas em campo atualizarem o status dos resgates diretamente. Está prevista como evolução futura, não faz parte do MVP.

## 7. Status de um pedido (`rescue_request`)

| Status | Descrição |
|---|---|
| `pendente` | Estado inicial, ao ser criado pela pessoa em situação de risco |
| `em_resgate` | Um operador assumiu o pedido e está em atendimento |
| `concluido` | O resgate foi concluído |
| `cancelado` | O pedido foi cancelado (motivo obrigatório) |

## 8. Entidades principais

### `rescue_request`
- Localização (coordenadas de mapa).
- Nome (opcional).
- Quantidade total de pessoas (opcional).
- Quantidade de homens/mulheres/crianças/idosos (opcional).
- Quantidade de animais (opcional).
- Ponto de referência textual (opcional).
- Status (`pendente`, `em_resgate`, `concluido`, `cancelado`).
- Motivo do cancelamento (obrigatório apenas quando `status = cancelado`).
- Operador responsável (quando assumido).
- Soft delete.
- Timestamps de criação/atualização.

### `rescue_status_logs`
- Pedido relacionado (`rescue_request`).
- Operador responsável pela mudança de status.
- Status anterior.
- Novo status.
- Data/hora da mudança.

### Usuário (operador / admin master)
- Autenticação via Laravel Sanctum (Bearer token).
- Papel: operador ou admin master.

## 9. Ambiente de desenvolvimento

- O `DatabaseSeeder` (`backend/database/seeders/DatabaseSeeder.php`) cria automaticamente um usuário admin master padrão ao rodar as migrations/seeds:
  - E-mail: `admin@pontoderesgate.local`
  - Senha: `password`
- Esse usuário existe apenas em ambiente de desenvolvimento, para permitir o primeiro acesso ao painel e o cadastro dos demais operadores. Não deve ser usado em produção.
