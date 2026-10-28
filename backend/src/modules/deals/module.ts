/** MOD-deals module definition. Owner: BE4. */
import type { ModuleDefinition } from '../../shared/module.js';
import { registerResourceResolver } from '../access/schemas.js';
import router from './routes.js';
import { resolveDealBusiness } from './service.js';

const definition: ModuleDefinition = {
  name: 'deals',
  archId: 'MOD-deals',
  owner: 'BE4',
  mounts: [{ path: '/api/deals', router }],
  init() {
    // BE2-C1: a deal resolves to its business (R-06); the engine applies steps 5–8 on that business.
    registerResourceResolver('deal', async (db, id) => {
      const businessId = await resolveDealBusiness(db, id);
      return businessId ? { kind: 'business', businessId } : null;
    });
  },
};

export default definition;
