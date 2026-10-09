# Static build of the web app served by nginx.
# Build: docker build -f deploy/web/Dockerfile \
#          --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=... --build-arg VITE_API_URL=... .
ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=nginx:1.27-alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_API_URL
RUN test -n "$VITE_SUPABASE_URL" && test -n "$VITE_SUPABASE_PUBLISHABLE_KEY" && test -n "$VITE_API_URL" \
  || (echo "VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY and VITE_API_URL build args are required" && exit 1)
RUN npm run build

FROM ${NGINX_IMAGE}
COPY deploy/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/web/security-headers.inc.template /etc/nginx/templates/security-headers.inc.template
COPY --from=build /app/dist /usr/share/nginx/html
# Origins the browser may call; substituted into the Content-Security-Policy at container start.
ENV API_ORIGIN="" SUPABASE_ORIGIN=""
EXPOSE 8080
