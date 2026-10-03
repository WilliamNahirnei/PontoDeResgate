# Requisitos do PontoDeResgate

> Este arquivo é a fonte de verdade para regras de negócio e requisitos de produto do PontoDeResgate. Deve ser mantido atualizado conforme as decisões do projeto evoluírem.

## 1. Visão geral

O PontoDeResgate é um sistema web para coordenar pedidos de socorro durante desastres de grande escala (enchentes, incêndios, terremotos, entre outros).

O sistema **não é específico a um tipo de desastre** e não possui um campo de "tipo de desastre" nos registros: cada implantação (deploy) do sistema já está associada a um evento específico e a um contexto operacional próprio.

O objetivo central é permitir que:
- Pessoas em situação de risco registrem um pedido de socorro rapidamente, sem barreiras de acesso.
- Operadores visualizem, priorizem e coordenem o atendimento desses pedidos em tempo hábil.
- Voluntários, acionados pelos operadores, realizem o resgate no local indicado pela localização do pedido.

## 2. Papéis de usuário

- **Pessoa em situação de risco**: pessoa que, durante um desastre de grande escala, precisa ser resgatada.
- **Operador**: pessoa que gerencia a logística do atendimento aos pedidos de socorro — acompanha, prioriza e assume pedidos, e repassa a localização aos voluntários que vão ao resgate.
- **Voluntário**: pessoa não autenticada que vai fisicamente ao resgate das pessoas em situação de risco, a partir da localização repassada pelo operador. Não acessa nenhuma tela do sistema.
- **Admin master**: usuário responsável por administrar o sistema — gerencia operadores e consulta o log de operações —, além de ter acesso a tudo que o operador acessa. Por concentrar a administração do sistema, tende a ser o papel apto a usar qualquer funcionalidade nova que vier a ser implementada.

| Papel | Autenticação | Acesso |
|---|---|---|
| Pessoa em situação de risco | Sem login | Somente a tela pública de solicitação de socorro |
| Operador | Login com Bearer token (Laravel Sanctum) | Painel de coordenação (mapa, lista, gestão de status dos pedidos) |
| Voluntário | Sem login | Nenhum — recebe a localização repassada pelo operador (ação "Compartilhar localização", §4.2), fora do sistema |
| Admin master | Login com Bearer token (Laravel Sanctum) | Cadastro, listagem e desativação/reativação de operadores; consulta ao log de operações; além do acesso do operador |

## 3. Tela pública (sem autenticação)

Acessível a qualquer pessoa, sem necessidade de login. É a tela padrão do site (rota raiz).

A tela pública deve conter **somente** informações relacionadas a solicitar um resgate. Ela não deve citar, referenciar ou linkar a área do operador (login, painel, etc.) de forma alguma — o acesso do operador não é divulgado nem sugerido nesta tela, incluindo o link/rota do painel (`/painel`). O operador precisa conhecer o endereço de acesso por fora do sistema (ex.: repassado pelo admin master).

### 3.1 Seleção de localização
- Seleção da localização em um mapa (Leaflet + OpenStreetMap).
- Ao abrir a tela, o pin padrão já é posicionado na localização que o navegador detectar (geolocalização), quando disponível/permitida. Caso não seja possível obter a localização do navegador, a pessoa marca o pin manualmente.
- O pin de localização pode ser ajustado manualmente pela pessoa após a seleção inicial (automática ou não).

### 3.2 Formulário de pedido (todos os campos opcionais, exceto a localização)
- Nome da pessoa solicitante — até **255 caracteres**.
- Quantidade total de pessoas no local.
- Quantidade de pessoas por categoria: homens, mulheres, crianças, idosos.
- Quantidade de animais.
- Ponto de referência textual, complementar à localização marcada no mapa — até **1000 caracteres**.

#### Limites dos campos
- Cada quantidade (total de pessoas, homens, mulheres, crianças, idosos e animais), quando informada, é um número inteiro de **0 a 999**.
- Uma quantidade deixada em branco é tratada como não informada; zero é um valor informado.
- Quando a pessoa informa uma quantidade inválida (acima de 999, negativa ou com casas decimais), o próprio campo mostra a mensagem "Informe um número inteiro de 0 a 999", e o pedido não é enviado até que ela corrija o valor ou apague o campo.
- Os campos de nome e de ponto de referência mostram quantos caracteres já foram usados do limite e não aceitam além disso: o texto digitado ou colado para no último caractere permitido.
- O total de pessoas não precisa coincidir com a soma das categorias: qualquer combinação de quantidades válidas é aceita.
- O sistema não registra pedido com nome, quantidade ou ponto de referência fora desses limites, mesmo que ele não tenha sido enviado pela tela.

### 3.3 Regras de negócio
- Ao ser enviado, o pedido é persistido como um registro de `rescue_request` com status inicial **"Pendente"**.
- A localização (coordenadas do mapa) é obrigatória; os demais campos do formulário são opcionais.
- A pessoa solicitante **não tem acesso a nenhum identificador ou meio de consulta** do pedido após o envio:
  - Não pode editar o pedido já enviado.
  - Não pode visualizar o status do pedido.
  - Caso precise atualizar informações ou reforçar o pedido, a única ação possível é enviar um **novo** pedido.

## 4. Painel autenticado (operadores e admin master)

Acesso restrito a usuários autenticados via Bearer token (Sanctum).

### 4.1 Visualização de pedidos
- O painel exibe o **mapa** e a **lista** de pedidos ao mesmo tempo, sempre com os mesmos pedidos (respeitando os filtros aplicados).
- **Mapa**: exibe os pedidos georreferenciados; ao passar o mouse (hover) sobre um pedido, mostra a quantidade total de pessoas e a data/hora do pedido. Quando a quantidade total não foi informada, o hover indica que ela não foi informada.
- Ao carregar os pedidos, o mapa se ajusta automaticamente para enquadrar todos eles (não fica centralizado num local fixo/padrão) — a implantação do sistema pode ser em qualquer cidade, então o mapa não pode presumir uma região. Esse enquadramento automático acontece apenas na primeira carga dos pedidos; atualizações, mudanças de status e mudanças de filtro seguintes não reposicionam o mapa, para não atrapalhar o operador.
- Quando não há nenhum pedido na primeira carga, o painel informa que não há pedidos a exibir.
- **Lista**: exibe os pedidos em formato de lista.
- O card de cada pedido na lista mostra a quantidade total de pessoas. Quando ela não foi informada, o card indica que não foi informada, com o mesmo texto do hover do mapa.
- O card mostra as quantidades por categoria informadas (homens, mulheres, crianças, idosos); as não informadas não aparecem.
- Ao clicar em um pedido na lista, ele fica em destaque no mapa e mostra as mesmas informações do hover (quantidade total de pessoas e data/hora do pedido), que permanecem visíveis até outro pedido ser clicado.
- Ao clicar em um marcador no mapa, o pedido fica selecionado da mesma forma: o marcador fica em destaque com as mesmas informações do hover, e o card do pedido fica em destaque na lista.
- Quando o pedido é selecionado pelo mapa e o card dele não está visível na lista, a lista rola até o card.
- Ao clicar em outro pedido, na lista ou no mapa, o destaque e as informações do pedido clicado anteriormente deixam de ser mostrados — somente os do novo pedido clicado.
- **Filtros**: os pedidos exibidos no mapa e na lista podem ser filtrados por:
  - Status: um status por vez ou todos. Ao abrir o painel, todos os status são exibidos.
  - Quantidade mínima de pessoas — total, homens, mulheres, crianças, idosos e animais.
  - Botão "Limpar filtros": volta o painel ao estado de abertura — todos os status, nenhuma quantidade mínima e a lista ordenada pela data/hora do pedido, do mais recente para o mais antigo.
- Com um filtro de quantidade mínima aplicado, só aparecem os pedidos em que essa quantidade foi informada e é igual ou maior que o mínimo; os pedidos em que ela não foi informada (campos opcionais no formulário público) não aparecem no mapa nem na lista.
- Os filtros aplicados ao mesmo tempo valem em conjunto: o pedido só aparece se atender a todos.
- **Ordenação**: a lista pode ser ordenada pela data/hora do pedido ou por uma das quantidades (total, homens, mulheres, crianças, idosos, animais), em ordem crescente ou decrescente.
- Ao abrir o painel, a lista vem ordenada pela data/hora do pedido, do mais recente para o mais antigo.
- Ao ordenar por uma quantidade, os pedidos em que ela não foi informada ficam sempre no fim da lista, tanto na ordem crescente quanto na decrescente.
- A ordenação altera apenas a lista; o mapa não muda.

### 4.2 Gestão de status do pedido
- **Assumir pedido**: altera o status para **"Em resgate"** e registra o operador responsável pelo atendimento.
  - Um pedido só pode ser assumido por um operador. Quando dois operadores tentam assumir o mesmo pedido ao mesmo tempo, só o primeiro consegue; o outro vê uma mensagem de erro informando que o pedido não está mais pendente e que pode ter sido assumido por outro operador, sem o nome de quem o assumiu.
  - Essa mensagem é a mesma qualquer que seja o motivo de o pedido não estar mais pendente (assumido, concluído ou cancelado por outro operador).
  - Depois do erro, o painel do operador que não conseguiu assumir atualiza o pedido: ele aparece como "Em resgate", com o operador responsável, e sem o botão "Assumir".
- **Concluir pedido**: altera o status para **"Concluído"**. Ao acionar "Concluir", o operador vê um campo para informar uma observação sobre o resgate antes de confirmar.
  - A observação é **opcional**: o operador pode confirmar a conclusão sem preenchê-la.
  - A observação tem no máximo **1000 caracteres**.
  - Um texto só com espaços em branco é tratado como observação não informada.
  - O operador pode desistir no diálogo de observação; nesse caso o pedido continua "Em resgate", sem alteração.
  - Depois de confirmada, a observação faz parte da conclusão e **não pode ser alterada nem incluída depois**: o pedido concluído continua sem nenhuma ação de transição.
  - A observação é registrada somente ao concluir; assumir e cancelar não têm esse campo (o cancelamento continua exigindo o motivo).
  - Qualquer operador autenticado ou o admin master vê a observação da conclusão no card do pedido concluído, no painel. Quando não foi informada, o card não exibe nenhuma linha de observação.
  - A pessoa em situação de risco (tela pública) nunca vê a observação, coerente com §3.3.
- **Cancelar pedido**: altera o status para **"Cancelado"**; exige o preenchimento obrigatório do motivo do cancelamento.
  - O motivo tem no máximo **1000 caracteres**.
  - O campo do motivo mostra ao operador quantos caracteres já foram usados de 1000 e não aceita além disso: o texto digitado ou colado para no 1000º caractere.
  - O sistema não registra motivo com mais de 1000 caracteres, mesmo que ele não tenha sido informado pela tela.
- **Compartilhar localização**: o operador ou o admin master repassa a localização do pedido a um voluntário, para que ele vá ao local. A ação aparece no card do pedido em qualquer status.
  - Ao clicar, um link que abre o local do pedido num mapa, a partir das coordenadas do pedido, é copiado para a área de transferência, e uma confirmação visual informa que a localização foi copiada.
  - A ação sempre copia o link: ela não abre o menu de compartilhamento do dispositivo.
  - Quando não é possível copiar o link, um diálogo informa que a localização não pôde ser copiada automaticamente e mostra o link em texto selecionável, para que o operador ou o admin master o copie manualmente. Nesse caso, a confirmação de cópia não aparece.
  - O diálogo só é fechado pelo operador ou pelo admin master e não altera o pedido.
- **Ações sobre um pedido já alterado por outro operador**: se o status do pedido mudou depois que o operador abriu a tela (por exemplo, um operador cancela enquanto outro conclui), assumir, concluir ou cancelar esse pedido falha. Ao concluir ou cancelar, o operador vê uma mensagem de erro informando que o pedido foi alterado por outro operador; ao assumir, vê a mensagem da regra de assumir acima. Em todos os casos, o painel atualiza o pedido com o status atual.
  - Uma ação que falha não altera o pedido e não gera entrada no log de operações (§4.3).
  - Se o diálogo de conclusão ou de cancelamento estiver aberto, ele é fechado junto com a mensagem de erro.
- **Ação em andamento**: enquanto a ação de assumir, concluir ou cancelar um pedido está em andamento, o botão que o operador ou o admin master acionou ("Assumir", "Concluir" ou "Confirmar cancelamento") fica indisponível até a ação terminar.
  - Clicar de novo nesse botão enquanto a ação está em andamento (por exemplo, com um duplo clique) não repete a ação: o pedido muda de status uma única vez e o log de operações (§4.3) ganha uma única entrada.
  - Quem clicou duas vezes não vê mensagem de erro: vê apenas o resultado da ação, como se tivesse clicado uma vez.
  - As ações dos demais pedidos continuam disponíveis enquanto a ação está em andamento.

### 4.3 Log de operações
- Toda ação de um operador ou do admin master que altera o status de um pedido — assumir, concluir e cancelar — gera uma entrada no log de operações.
- "Compartilhar localização" não altera o pedido e não gera entrada no log.
- Cada entrada do log contém:
  - Pedido relacionado.
  - Operador (ou admin master) que realizou a ação.
  - Status anterior.
  - Novo status.
  - Data/hora da ação.

### 4.4 Consulta de logs de operações (admin master)
- Junto aos itens de navegação para o painel principal e para a lista de operadores, o admin master tem acesso a um menu para a lista de logs (`rescue_status_logs`) das operações realizadas sobre os pedidos de resgate.
- A lista de logs é paginada.
- A entrada de log da mudança de status para "Concluído" exibe a observação da conclusão, quando informada; as demais entradas de log não exibem observação.
- Operadores (que não sejam admin master) não têm acesso a essa tela nem ao endpoint correspondente — exclusivo do admin master.

### 4.5 Cadastro e gestão de operadores (admin master)
- O admin master é responsável por cadastrar novos operadores no sistema.
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

## 5. Alertas em tempo real (websocket leve)

- Quando um novo pedido de socorro é registrado, todos os operadores conectados recebem um alerta via websocket informando que há um novo pedido, sugerindo que atualizem a tela.
- **Não há sincronização automática de dados**: o alerta apenas notifica a existência de novidade — a atualização da lista/mapa com os dados mais recentes continua sendo uma ação manual do operador (ex.: recarregar ou clicar em atualizar).

## 6. Fora do escopo do MVP

- Área autenticada para os próprios resgatistas em campo atualizarem o status dos resgates diretamente. Está prevista como evolução futura, não faz parte do MVP.
- Editar, incluir ou apagar a observação de um pedido depois de concluído; observação nas ações de assumir e cancelar; exibir a observação no hover do mapa. Fora do escopo por decisão do PO: a observação é definida uma única vez, junto com a conclusão, e só é consultada no card e no log.
- Conferir se o total de pessoas é coerente com a soma das categorias (homens, mulheres, crianças, idosos). Fora do escopo por decisão do PO: em uma emergência, a pessoa pode conhecer só parte das categorias ou estimar o total.
- Compartilhar a localização pelo menu de compartilhamento do dispositivo (por exemplo, no celular). Fora do escopo por decisão do PO: a ação "Compartilhar localização" sempre copia o link da localização.

## 7. Status de um pedido (`rescue_request`)

| Status | Descrição |
|---|---|
| Pendente | Estado inicial, ao ser criado pela pessoa em situação de risco |
| Em resgate | Um operador assumiu o pedido e está em atendimento |
| Concluído | O resgate foi concluído |
| Cancelado | O pedido foi cancelado (motivo obrigatório) |

- Nenhum pedido é excluído do sistema, nem pelo painel nem de outra forma. Em todo o ciclo de vida, o pedido só passa pelas transições de status acima; pedidos concluídos ou cancelados continuam no sistema.

## 8. Entidades principais

### `rescue_request`
- Localização (coordenadas de mapa).
- Nome (opcional, até 255 caracteres).
- Quantidade total de pessoas (opcional, inteiro de 0 a 999).
- Quantidade de homens/mulheres/crianças/idosos (opcional, inteiro de 0 a 999 cada).
- Quantidade de animais (opcional, inteiro de 0 a 999).
- Ponto de referência textual (opcional, até 1000 caracteres).
- Status (Pendente, Em resgate, Concluído, Cancelado).
- Motivo do cancelamento (obrigatório apenas quando o status é Cancelado).
- Observação da conclusão (opcional, até 1000 caracteres; só existe quando o status é Concluído).
- Operador responsável (quando assumido).
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
