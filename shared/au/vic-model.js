// Node entry for the PolTok Victorian seat model: binds the core to the bundled 2022 primaries + 2026 candidates.
import PRIM from './vic-2022-primaries.json' with { type: 'json' };
import CANDS from './vic-candidates-2026.json' with { type: 'json' };
import { createModel, FLOWS } from './vic-model-core.js';

export { FLOWS };
export const { runModel, NOTABLE_IND } = createModel(PRIM, CANDS);
