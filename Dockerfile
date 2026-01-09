# Gunakan image Node.js LTS yang ringan (berbasis Alpine)
FROM node:lts-alpine

# Instal curl dan bash (bash sering dibutuhkan oleh script Railway)
RUN apk add --no-cache curl bash

# Buat direktori app
WORKDIR /app

# Salin package.json dan instal dependencies
COPY package*.json ./
RUN npm ci --only=production

# Salin semua kode aplikasi
COPY . .

# Opsi 1: Nonaktifkan health check (sederhana)
HEALTHCHECK NONE

# Jalankan aplikasi
CMD ["node", "index.js"]
