/**
 * Extended profile controller
 *
 * Stores demographic and cooperative metadata linked 1:1 to a user account.
 * Consumed by analytics aggregation queries (demographics, attendance, assessments).
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::extended-profile.extended-profile');
