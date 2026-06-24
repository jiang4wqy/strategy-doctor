FROM node:24-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build:web

FROM node:24-slim AS runtime

WORKDIR /app

COPY --from=build /app /app

ENV DOCTOR_HOST=0.0.0.0 \
    DOCTOR_PORT=8080 \
    DOCTOR_SESSION_TTL_SECONDS=43200 \
    NODE_ENV=production

EXPOSE 8080

CMD ["node", "src/server/start.ts"]
