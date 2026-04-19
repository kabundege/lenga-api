import type { Core } from '@strapi/strapi';

const allowDocumentIdOnFindOne = (generatedDocumentation: Record<string, any>) => {
  const paths = generatedDocumentation?.paths;
  if (!paths || typeof paths !== 'object') return generatedDocumentation;

  Object.entries(paths).forEach(([pathName, pathConfig]) => {
    if (!pathName.endsWith('/{id}') || !pathConfig || typeof pathConfig !== 'object') return;

    const getOperation = (pathConfig as Record<string, any>).get;
    if (!getOperation || typeof getOperation !== 'object') return;

    const parameters = getOperation.parameters;
    if (!Array.isArray(parameters)) return;

    const idParameter = parameters.find(
      (parameter: Record<string, any>) => parameter?.in === 'path' && parameter?.name === 'id',
    );

    if (!idParameter) return;

    idParameter.description = 'Numeric id or string documentId';
    idParameter.schema = {
      oneOf: [{ type: 'integer' }, { type: 'string' }],
    };
  });

  return generatedDocumentation;
};

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  documentation: {
    enabled: env.bool('DOCUMENTATION_ENABLED', true),
    config: {
      info: {
        title: env('DOCUMENTATION_TITLE', 'UNDP Strapi API'),
        version: env('DOCUMENTATION_VERSION', '1.0.0'),
        description: env('DOCUMENTATION_DESCRIPTION', 'OpenAPI documentation for the Strapi API'),
      },
      'x-strapi-config': {
        mutateDocumentation: allowDocumentIdOnFindOne,
      },
    },
  },
  upload: {
    config: {
      sizeLimit: env.int('UPLOAD_SIZE_LIMIT_BYTES', 512 * 1024 * 1024),
      breakpoints: {
        xlarge: 1920,
        large: 1000,
        medium: 750,
        small: 500,
        xsmall: 64,
      },
    },
  },
});

export default config;
