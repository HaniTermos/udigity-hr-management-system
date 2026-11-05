/** MOD-business module definition. Owner: BE2. */
import type { ModuleDefinition } from '../../shared/module.js';
import router, { categoriesRouter, searchRouter } from './routes.js';
import './schemas.js'; // VT-3 declarations (registered at import)

const definition: ModuleDefinition = {
  name: 'businesses',
  archId: 'MOD-business',
  owner: 'BE2',
  mounts: [
    { path: '/api/businesses', router },
    { path: '/api/categories', router: categoriesRouter },
    { path: '/api/search', router: searchRouter },
  ],
};

export default definition;
