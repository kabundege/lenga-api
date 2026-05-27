/**
 * Module attendance controller
 *
 * Tracks per-user lesson progress (started / completed) for attendance analytics.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::module-attendance.module-attendance');
