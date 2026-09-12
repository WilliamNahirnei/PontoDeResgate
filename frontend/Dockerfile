# Stage 1: build dos assets estaticos com Node 22 LTS
FROM node:22-alpine AS build

WORKDIR /app

# VITE_API_BASE_URL precisa existir em build-time: o Vite embute
# variaveis de ambiente no bundle final, nao ha leitura em runtime.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: serve os arquivos estaticos via Nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
