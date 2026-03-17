// =============================================================
// 2bottles — Store barrel + @lit/context keys
//
// Import stores and context keys from this file throughout
// the app. The context keys let app-shell @provide the store
// singletons to any descendant that @consumes them.
// =============================================================

import { createContext } from '@lit/context';

export { sessionStore } from './session.store.js';
export { locationStore } from './location.store.js';
export { uiStore } from './ui.store.js';

import { sessionStore } from './session.store.js';
import { locationStore } from './location.store.js';
import { uiStore } from './ui.store.js';

export type SessionStoreType = typeof sessionStore;
export type LocationStoreType = typeof locationStore;
export type UIStoreType = typeof uiStore;

// Provide the singleton instances as the initial (default) value
// for each context. This means @consume fields are never null —
// even if a component connects before app-shell's @provide has
// run, it still gets the live singleton (which is what we want).
export const sessionContext = createContext<SessionStoreType>('2b:session');
export const locationContext = createContext<LocationStoreType>('2b:location');
export const uiContext = createContext<UIStoreType>('2b:ui');