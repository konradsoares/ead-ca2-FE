# Use lightweight Node.js image
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json package-lock.json ./
RUN npm ci

# Copy app source
COPY . .

# Expose port and start the app
EXPOSE 3000
CMD ["node", "fe-server.js"]
