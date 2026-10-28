/** MOD-reports module definition. Owner: BE5. */
import type { ModuleDefinition } from '../../shared/module.js';
import router, { dashboardRouter } from './routes.js';

const definition: ModuleDefinition = {
  name: 'reports',
  archId: 'MOD-reports',
  owner: 'BE5',
  mounts: [
    { path: '/api/reports', router },
    { path: '/api/dashboard', router: dashboardRouter },
  ],
};

export default definition;
