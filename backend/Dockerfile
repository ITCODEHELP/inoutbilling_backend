FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./

ENV NODE_ENV=production

RUN npm ci --omit=dev

COPY . .

EXPOSE 5000

CMD ["npm", "start"]

