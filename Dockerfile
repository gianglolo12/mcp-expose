FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
COPY relay-config.json ./

# Build TypeScript
RUN npm install typescript --save-dev && npm run build && npm remove typescript

# Copy config files
COPY mcp-expose.yaml ./

# Expose port
EXPOSE 8788

# Start server
CMD ["node", "dist/index.js"]
