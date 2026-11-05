/** MOD-assignment module definition. Owner: BE3. */
import type { ModuleDefinition } from '../../shared/module.js';
import { registerResourceResolver } from '../access/schemas.js';
import router from './routes.js';
import { resolveAssignmentOwner } from './service.js';

const definition: ModuleDefinition = {
  name: 'assignment',
  archId: 'MOD-assignment',
  owner: 'BE3',
  mounts: [
    { path: '/api/calling-assignments', router },
  ],
  init() {
    // BE2-C1: `calling_assignment` is an own-record type (the assignee). List filters pass idColumn 'assignee_id'.
    registerResourceResolver('calling_assignment', async (db, id) => {
      const ownerIds = await resolveAssignmentOwner(db, id);
      return ownerIds ? { kind: 'own', ownerIds } : null;
    });
  },
};

export default definition;
