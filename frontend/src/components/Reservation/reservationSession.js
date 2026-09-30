import constants from '../../constants.json';

/** Where the browser keeps this property's signed reservation session. */
export const sessionStorageKey = (hotelId) =>
  `${constants.RESERVATION_SESSION_STORAGE_KEY_PREFIX}${hotelId}`;

/**
 * The session token, handed to socket.io for every connection attempt.
 *
 * Shared by both reservation surfaces because getting it wrong is silent and
 * neither page can tell. It belongs in `auth`, not `query`: a query is fixed
 * when the manager is built, so a reconnect — or switching between voice and
 * text, which reuses the manager the first page opened — sends whatever was in
 * storage back then, which on a first visit is nothing at all.
 */
export const sessionAuth = (storageKey) => (cb) => {
  let token;
  try {
    token = localStorage.getItem(storageKey) || undefined;
  } catch {
    // Private browsing with storage blocked: start a fresh session.
    token = undefined;
  }
  cb({ sessionToken: token });
};
