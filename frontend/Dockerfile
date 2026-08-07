FROM node:20-alpine

WORKDIR /app

# Install serve to run the React app
RUN npm install -g serve

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY public ./public
COPY src ./src
COPY scripts ./scripts

# Install all dependencies (including dev for build)
RUN npm install

# Create default constants.json if it doesn't exist (required for build)

# CRA bakes REACT_APP_* vars into the bundle at build time, so they must be
# passed as build args (docker-compose's `environment:` only applies at runtime)
ARG REACT_APP_BACKEND_URL
ARG REACT_APP_FRONTEND_URL
ARG REACT_APP_GOOGLE_CLIENT_ID
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV REACT_APP_FRONTEND_URL=$REACT_APP_FRONTEND_URL
ENV REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID

# Build the application
RUN npm run build

# Expose port
EXPOSE 7678

# Start the application
CMD ["serve", "-s", "build", "-l", "7678"]
