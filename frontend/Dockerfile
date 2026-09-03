FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# NEXT_PUBLIC_* variables are baked in at build time (they end up in the
# client-side JS bundle), so this has to be a build arg, not a runtime env
# var. Default matches the browser hitting the docker-compose port mapping.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
