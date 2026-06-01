/**
 * Analytics custom routes
 *
 * Admin-only reporting endpoints. Authentication is enforced via the
 * global is-admin-authenticated policy (Strapi admin access tokens).
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/analytics/demographics',
      handler: 'analytics.getDemographics',
      config: {
        auth: false,
        policies: ['global::is-admin-authenticated'],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/analytics/attendance',
      handler: 'analytics.getAttendance',
      config: {
        auth: false,
        policies: ['global::is-admin-authenticated'],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/analytics/assessments',
      handler: 'analytics.getAssessments',
      config: {
        auth: false,
        policies: ['global::is-admin-authenticated'],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/analytics/assessments/passed-learners',
      handler: 'analytics.getPassedLearners',
      config: {
        auth: false,
        policies: ['global::is-admin-authenticated'],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/analytics/attendance/completed-learners',
      handler: 'analytics.getCompletedLearners',
      config: {
        auth: false,
        policies: ['global::is-admin-authenticated'],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/analytics/export/:type',
      handler: 'analytics.exportToExcel',
      config: {
        auth: false,
        policies: ['global::is-admin-authenticated'],
        middlewares: [],
      },
    },
  ],
};
