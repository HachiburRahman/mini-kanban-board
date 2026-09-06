FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 4000

# Applies any pending migrations, then starts the API. Safe to run on every
# container start - `migrate deploy` is a no-op when the schema is current.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
