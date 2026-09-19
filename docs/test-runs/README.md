# Histórico de execuções de testes

Relatórios das execuções de testes funcionais do PontoDeResgate: suíte E2E (Playwright) e
exploração manual, contra os cenários de [`docs/test-plans/`](../test-plans/index.md).

Não confundir com os planos: o plano diz **o que** testar; cada arquivo aqui registra **o que
aconteceu** numa execução. Testes Unit e de endpoint do backend não entram (mesma fronteira dos
planos).

## Convenções

- Um arquivo por execução, nomeado `AAAA-MM-DD-<escopo>.md`. Duas execuções no mesmo dia: acrescente
  um sufixo (`-2`, ou o escopo que as distingue).
- Relatórios são **históricos**: não se reescrevem depois. Uma correção ou um novo resultado vira
  uma nova execução.
- Estrutura do relatório (formato da skill `qa-executor`): cabeçalho com data, commit base,
  estado da árvore e ambiente; 1. Resumo; 2. Falhas; 3. Divergências com os planos; 4. Achados
  exploratórios; 5. Lacunas sugeridas ao `qa-analyst`; 6. Não executado; e uma seção final de dados
  e evidências.
- Toda afirmação de "passa" vem da execução registrada no próprio relatório, nunca do status dos planos.
- **Evidências** ficam numa pasta com o mesmo nome do relatório, sem a extensão
  (`AAAA-MM-DD-<escopo>/`), com um `LEIA-ME.md` que liga cada achado à sua evidência. Subpastas usuais:
  `screenshots/`, `saidas/` (logs, relatório HTML do Playwright, saídas dos scripts) e `scripts/`.
  Saída que só existiu no terminal e foi transcrita depois deve dizer isso no próprio arquivo.
- Scripts exploratórios são descartáveis e não substituem specs em `frontend/e2e/`.

## Execuções

| Data | Escopo | Resultado | Relatório |
|---|---|---|---|
| 2026-09-19 | E2E completo (com reset do banco) e exploração dos cenários novos | E2E 29/29; 2 achados de alta severidade, 6 de média | [`2026-09-19-e2e-e-exploratorio.md`](./2026-09-19-e2e-e-exploratorio.md) ([evidências](./2026-09-19-e2e-e-exploratorio/LEIA-ME.md)) |
