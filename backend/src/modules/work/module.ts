/** MOD-work module definition. Owner: BE1. */
import type { ModuleDefinition } from '../../shared/module.js';
import { registerResourceResolver } from '../access/schemas.js';
import { targetsRouter, workItemsRouter } from './routes.js';
import { getTargetById, getWorkItemById } from './repo.js';

const definition: ModuleDefinition = {
  name: 'work',
  archId: 'MOD-work',
  owner: 'BE1',
  mounts: [
    { path: '/api/targets', router: targetsRouter },
    { path: '/api/work-items', router: workItemsRouter },
  ],
  init() {
    registerResourceResolver('target', async (db, id) => {
      const item = await getTargetById(db, id);
      return item ? { kind: 'own', ownerIds: [item.employeeId] } : null;
    });
    registerResourceResolver('work_item', async (db, id) => {
      const item = await getWorkItemById(db, id);
      return item ? { kind: 'own', ownerIds: [item.assigneeId] } : null;
    });
  },
};

export default definition;
