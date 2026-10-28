import path from 'path';

export type RoleKey = 'owner' | 'dataEntry' | 'callCenter' | 'developer';
export const stateOf = (key: RoleKey) => path.join(__dirname, '..', '.auth', `${key}.json`);
