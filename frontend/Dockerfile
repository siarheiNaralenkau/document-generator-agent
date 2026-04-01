FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN node ./node_modules/next/dist/bin/next build

EXPOSE 3000

CMD ["node", "./node_modules/next/dist/bin/next", "start"]
