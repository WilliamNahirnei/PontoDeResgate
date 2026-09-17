#!/bin/sh
# O modo headed (test:e2e:headed) roda o container Docker sem --user (precisa ser root
# para acessar o socket X11 do host sem problema de permissao), entao playwright-report/
# e test-results/ ficam donos de root. Isso quebra as demais execucoes (test:e2e:run,
# test:e2e:ui), que rodam como o usuario local. Este script devolve o dono certo depois
# de qualquer execucao headed.
cd "$(dirname "$0")/../.." || exit 1
docker run --rm -v "$(pwd):/app" alpine chown -R "$(id -u):$(id -g)" /app/playwright-report /app/test-results
