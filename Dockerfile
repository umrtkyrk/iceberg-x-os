# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
# Vite inlines feature flags at build time. Pass --build-arg VITE_CUBE_FORUM_ENABLED=true
# together with FORUM_ENABLED=true on the backend to open the Cube Forum.
ARG VITE_CUBE_FORUM_ENABLED=false
ENV VITE_CUBE_FORUM_ENABLED=$VITE_CUBE_FORUM_ENABLED
# Pass --build-arg VITE_DARK_THEME_ENABLED=true to show the light/dark theme toggle.
ARG VITE_DARK_THEME_ENABLED=false
ENV VITE_DARK_THEME_ENABLED=$VITE_DARK_THEME_ENABLED
# Pass --build-arg VITE_CUBE_FOCUS_ENABLED=true to show the Cube focus panel.
ARG VITE_CUBE_FOCUS_ENABLED=false
ENV VITE_CUBE_FOCUS_ENABLED=$VITE_CUBE_FOCUS_ENABLED
# Pass --build-arg VITE_ATTACHMENTS_ENABLED=true to allow files on updates and demos.
ARG VITE_ATTACHMENTS_ENABLED=false
ENV VITE_ATTACHMENTS_ENABLED=$VITE_ATTACHMENTS_ENABLED
# Pass --build-arg VITE_MENTOR_CUBES_ENABLED=true to show the mentor's My Cubes signals panel.
ARG VITE_MENTOR_CUBES_ENABLED=false
ENV VITE_MENTOR_CUBES_ENABLED=$VITE_MENTOR_CUBES_ENABLED
# Pass --build-arg VITE_SCORING_V2_ENABLED=true to show the scoring v2 admin screens.
ARG VITE_SCORING_V2_ENABLED=false
ENV VITE_SCORING_V2_ENABLED=$VITE_SCORING_V2_ENABLED
# Pass --build-arg VITE_SCORING_V2_LIVE=true (with SCORING_V2_LIVE=true on the backend) to show Cubes their v2 score.
ARG VITE_SCORING_V2_LIVE=false
ENV VITE_SCORING_V2_LIVE=$VITE_SCORING_V2_LIVE
RUN npm run build

# Stage 2: Build Backend
FROM node:18-alpine AS backend-builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN npx prisma generate
RUN npm run build

# Stage 3: Runner
FROM node:18-alpine AS runner
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5001

# Copy backend built files
COPY --from=backend-builder /app/backend/package*.json ./backend/
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/prisma ./backend/prisma
COPY --from=backend-builder /app/backend/tsconfig.json ./backend/

# Copy frontend static assets
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

WORKDIR /app/backend

EXPOSE 5001

# Run wait-db, migrations, and start server
CMD ["sh", "-c", "node dist/wait-db.js && npx prisma migrate deploy && npm start"]
