/** MOD-employees module definition. Owner: BE1. */
import type { ModuleDefinition } from '../../shared/module.js';
import router from './routes.js';

const definition: ModuleDefinition = {
  name: 'employees',
  archId: 'MOD-employees',
  owner: 'BE1',
  mounts: [
    { path: '/api/employees', router },
  ],
};

export default definition;
