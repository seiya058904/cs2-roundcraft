import raw from './world.json';
import type {World} from '../domain/types';
export const initialWorld=raw as World;
export const newWorld=():World=>structuredClone(initialWorld);
