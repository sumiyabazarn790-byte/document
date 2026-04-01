FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache chromium

COPY package*.json ./
COPY prisma ./prisma

RUN npm install

COPY . .

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

CMD ["sh", "-c", "npx prisma db push && npm run dev"]
