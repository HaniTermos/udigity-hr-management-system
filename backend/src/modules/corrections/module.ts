/** MOD-corrections module definition. Owner: BE2. */
import type { ModuleDefinition } from '../../shared/module.js';
import { registerOutboxConsumer } from '../../shared/outbox.js';
import { registerCorrectionsBridge } from '../businesses/service.js';
import router from './routes.js';
import './schemas.js'; // VT-3 declarations (registered at import)
import { correctionsBridge, releaseOnDeactivationConsumer } from './service.js';

let registered = false;

const definition: ModuleDefinition = {
  name: 'corrections',
  archId: 'MOD-corrections',
  owner: 'BE2',
  mounts: [{ path: '/api/correction-requests', router }],
  init() {
    // MOD-business reads open-request summaries and applies `correctionId` through this bridge
    // (dependency inversion: corrections → businesses only).
    registerCorrectionsBridge(correctionsBridge);
    // N-4 / AC-DFIX-008: reviewer deactivated → In review returns to Submitted.
    if (!registered) {
      registered = true;
      registerOutboxConsumer(releaseOnDeactivationConsumer);
    }
  },
};

export default definition;
