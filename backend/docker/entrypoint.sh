#!/bin/sh
set -e

if [ ! -f vendor/autoload.php ]; then
    composer install --no-interaction --prefer-dist
fi

# Remove caches de bootstrap gerados fora deste container (ex.: no host,
# com dependencias de dev que nao existem no vendor "--no-dev" da imagem).
# Sem esses arquivos, o Laravel refaz a descoberta de pacotes normalmente.
rm -f bootstrap/cache/packages.php bootstrap/cache/services.php

if [ ! -f .env ] && [ -f .env.example ]; then
    cp .env.example .env
fi

if ! grep -q "^APP_KEY=base64" .env 2>/dev/null; then
    php artisan key:generate --ansi --no-interaction
fi

# Regenera o cache de descoberta de pacotes (bootstrap/cache/packages.php),
# que pode ter sido gerado no host com dependencias de dev que nao existem
# no vendor da imagem (build de producao roda "composer install --no-dev").
php artisan package:discover --ansi

if [ "$RUN_MIGRATIONS" = "true" ]; then
    php artisan migrate --force
fi

if [ "$APP_ENV" = "production" ]; then
    php artisan config:cache
    php artisan route:cache
else
    php artisan config:clear
fi

chown -R www-data:www-data storage bootstrap/cache

exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
