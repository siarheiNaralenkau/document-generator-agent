FROM node:22-slim

RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci
RUN cp /app/node_modules/vscode-jsonrpc/node.js /app/node_modules/vscode-jsonrpc/node

COPY . .
RUN npm run build

RUN mkdir -p /app/sessions

EXPOSE 3000

ENV NODE_ENV=production
CMD ["node", "--experimental-specifier-resolution=node", "dist/server/index.js"]
