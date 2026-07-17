import * as migration_20260627_184840 from './20260627_184840';
import * as migration_20260628_100000 from './20260628_100000';
import * as migration_20260628_183901 from './20260628_183901';
import * as migration_20260630_120000 from './20260630_120000';
import * as migration_20260713_090000 from './20260713_090000';
import * as migration_20260715_090000 from './20260715_090000';
import * as migration_20260715_100000 from './20260715_100000';
import * as migration_20260716_090000 from './20260716_090000';
import * as migration_20260717_120000 from './20260717_120000';
import * as migration_20260718_090000 from './20260718_090000';
import * as migration_20260718_140000 from './20260718_140000';

export const migrations = [
  {
    up: migration_20260627_184840.up,
    down: migration_20260627_184840.down,
    name: '20260627_184840',
  },
  {
    up: migration_20260628_100000.up,
    down: migration_20260628_100000.down,
    name: '20260628_100000',
  },
  {
    up: migration_20260628_183901.up,
    down: migration_20260628_183901.down,
    name: '20260628_183901',
  },
  {
    up: migration_20260630_120000.up,
    down: migration_20260630_120000.down,
    name: '20260630_120000',
  },
  {
    up: migration_20260713_090000.up,
    down: migration_20260713_090000.down,
    name: '20260713_090000',
  },
  {
    up: migration_20260715_090000.up,
    down: migration_20260715_090000.down,
    name: '20260715_090000',
  },
  {
    up: migration_20260715_100000.up,
    down: migration_20260715_100000.down,
    name: '20260715_100000',
  },
  {
    up: migration_20260716_090000.up,
    down: migration_20260716_090000.down,
    name: '20260716_090000',
  },
  {
    up: migration_20260717_120000.up,
    down: migration_20260717_120000.down,
    name: '20260717_120000',
  },
  {
    up: migration_20260718_090000.up,
    down: migration_20260718_090000.down,
    name: '20260718_090000',
  },
  {
    up: migration_20260718_140000.up,
    down: migration_20260718_140000.down,
    name: '20260718_140000',
  },
];
