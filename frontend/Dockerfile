FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Fix permissions for node_modules and binaries
RUN chmod -R 755 node_modules/.bin

EXPOSE 3000

CMD ["npm", "start"]
