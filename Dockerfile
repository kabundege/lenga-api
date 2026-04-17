FROM node:20

WORKDIR /app

# Strapi loads these during `strapi build`; .dockerignore omits `.env`, so defaults
# are required for the image build. Override all of these in real deployments.
ARG APP_KEYS=ci-placeholder-key-one,ci-placeholder-key-two
ARG API_TOKEN_SALT=ci-api-token-salt
ARG ADMIN_JWT_SECRET=ci-admin-jwt-secret
ARG TRANSFER_TOKEN_SALT=ci-transfer-token-salt
ARG JWT_SECRET=ci-jwt-secret
ARG ENCRYPTION_KEY=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
ARG DATABASE_CLIENT=sqlite
ENV APP_KEYS=${APP_KEYS} \
    API_TOKEN_SALT=${API_TOKEN_SALT} \
    ADMIN_JWT_SECRET=${ADMIN_JWT_SECRET} \
    TRANSFER_TOKEN_SALT=${TRANSFER_TOKEN_SALT} \
    JWT_SECRET=${JWT_SECRET} \
    ENCRYPTION_KEY=${ENCRYPTION_KEY} \
    DATABASE_CLIENT=${DATABASE_CLIENT}

# Install dependencies first for better build caching
COPY package*.json ./
RUN npm install

# Copy application source
COPY . .

# Build Strapi admin panel
RUN npm run build

ENV NODE_ENV=production

VOLUME /app/.tmp

EXPOSE 1337

CMD ["npm", "run", "start"]