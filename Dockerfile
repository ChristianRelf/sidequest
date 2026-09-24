FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS production-dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN addgroup -S sidequest && adduser -S sidequest -G sidequest
RUN mkdir /app/.local && chown sidequest:sidequest /app/.local
COPY --from=build --chown=sidequest:sidequest /app/.next/standalone ./
COPY --from=build --chown=sidequest:sidequest /app/.next/static ./.next/static
COPY --from=build --chown=sidequest:sidequest /app/public ./public
COPY --from=production-dependencies --chown=sidequest:sidequest /app/node_modules ./node_modules
COPY --from=build --chown=sidequest:sidequest /app/src ./src
COPY --from=build --chown=sidequest:sidequest /app/scripts ./scripts
COPY --from=build --chown=sidequest:sidequest /app/migrations ./migrations
COPY --from=build --chown=sidequest:sidequest /app/package.json /app/tsconfig.json ./
USER sidequest
EXPOSE 3000
CMD ["node", "server.js"]
