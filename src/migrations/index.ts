import * as migration_20260627_184840 from './20260627_184840';
import * as migration_20260628_100000 from './20260628_100000';

export const migrations = [
  {
    up: migration_20260627_184840.up,
    down: migration_20260627_184840.down,
    name: '20260627_184840'
  },
  {
    up: migration_20260628_100000.up,
    down: migration_20260628_100000.down,
    name: '20260628_100000'
  },
];
