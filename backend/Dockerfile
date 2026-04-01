FROM node:22-slim

# Install runtime dependencies used by the backend service
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci
RUN cp /app/node_modules/vscode-jsonrpc/node.js /app/node_modules/vscode-jsonrpc/node

COPY . .
RUN node ./node_modules/typescript/bin/tsc

RUN mkdir -p /app/sessions

EXPOSE 3001

CMD ["node", "--experimental-specifier-resolution=node", "dist/main.js"]
