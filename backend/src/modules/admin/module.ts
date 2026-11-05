/** MOD-admin module definition. Owner: BE1. */
import type { ModuleDefinition } from '../../shared/module.js';
import { auditRouter, settingsRouter } from './routes.js';

const definition: ModuleDefinition = {
  name: 'admin',
  archId: 'MOD-admin',
  owner: 'BE1',
  mounts: [
    { path: '/api/audit-events', router: auditRouter },
    { path: '/api/settings', router: settingsRouter },
  ],
};

export default definition;
