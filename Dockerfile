FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build:web


FROM node:24-alpine AS runner

WORKDIR /app

COPY --from=builder /app ./

ENV NODE_ENV=production
ENV DOCTOR_HOST=0.0.0.0
ENV DOCTOR_PORT=8080

EXPOSE 8080

CMD ["node", "src/server/start.ts"]

