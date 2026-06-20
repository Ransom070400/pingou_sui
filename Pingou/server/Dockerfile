# Pingou sponsor backend — portable container (Fly.io / Railway / Render-docker).
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY index.mjs ./
ENV NODE_ENV=production
# Hosts inject PORT; index.mjs reads it (defaults to 8787 locally).
EXPOSE 8787
CMD ["node", "index.mjs"]
