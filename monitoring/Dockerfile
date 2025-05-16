FROM node:20-alpine
WORKDIR /app
COPY . .
RUN apk add --no-cache net-tools arp-scan sudo \
    && npm install --production
CMD ["npm", "start"] 