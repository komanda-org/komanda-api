require('dotenv').config();
const { defineConfig } = require('prisma/config');
const { PrismaPg } = require('@prisma/adapter-pg');

module.exports = defineConfig({
  earlyAccess: true,
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrate: {
    adapter: () => new PrismaPg(process.env.DATABASE_URL),
  },
});
