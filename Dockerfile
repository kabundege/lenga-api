FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better build caching
COPY package*.json ./
RUN npm install

# Copy application source
COPY . .

# Build Strapi admin panel
RUN npm run build

ENV NODE_ENV=production

EXPOSE 1337

CMD ["npm", "run", "start"]
