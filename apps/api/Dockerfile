FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/module-registry/package.json packages/module-registry/package.json
COPY packages/industry-packs/upvc/package.json packages/industry-packs/upvc/package.json
COPY packages/industry-packs/catalog/package.json packages/industry-packs/catalog/package.json
RUN npm ci
COPY . .
RUN npm run build -w @avin/api

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
EXPOSE 4000
CMD ["npm", "run", "start", "-w", "@avin/api"]
