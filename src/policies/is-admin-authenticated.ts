import type { Core } from '@strapi/strapi';

type PolicyContext = {
  request: {
    header: {
      authorization?: string;
    };
  };
  state: Record<string, unknown>;
};

export default async (
  policyContext: PolicyContext,
  _config: unknown,
  { strapi }: { strapi: Core.Strapi },
) => {
  const authorization = policyContext.request.header.authorization;

  if (!authorization) {
    return false;
  }

  const parts = authorization.split(/\s+/);

  if (parts[0]?.toLowerCase() !== 'bearer' || parts.length !== 2) {
    return false;
  }

  const token = parts[1];
  const manager = strapi.sessionManager;

  if (!manager) {
    return false;
  }

  const result = manager('admin').validateAccessToken(token);

  if (!result.isValid) {
    return false;
  }

  const isActive = await manager('admin').isSessionActive(result.payload.sessionId);

  if (!isActive) {
    return false;
  }

  const rawUserId = result.payload.userId;
  const numericUserId = Number(rawUserId);
  const userId =
    Number.isFinite(numericUserId) && String(numericUserId) === rawUserId
      ? numericUserId
      : rawUserId;

  const user = await strapi.db.query('admin::user').findOne({
    where: { id: userId },
    populate: ['roles'],
  });

  if (!user || user.isActive !== true) {
    return false;
  }

  policyContext.state.adminUser = user;
  policyContext.state.isAdminAuthenticated = true;

  return true;
};
