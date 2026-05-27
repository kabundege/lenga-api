import type { Core } from '@strapi/strapi';

const bodySizeMb = Number(process.env.BODY_SIZE_LIMIT_MB || 512);

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      formLimit: `${bodySizeMb}mb`,
      jsonLimit: `${bodySizeMb}mb`,
      textLimit: `${bodySizeMb}mb`,
      formidable: {
        maxFileSize: bodySizeMb * 1024 * 1024,
      },
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
