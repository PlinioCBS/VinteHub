/* eslint-disable */
/**
 * Generated `api` utility — browser-compatible, no convex/server dependency.
 *
 * Uses the same Symbol-based function reference format that Convex's
 * useQuery / useMutation hooks expect internally.
 * @module
 */

const FUNCTION_NAME = Symbol.for("functionName");

function createApiProxy(parts) {
  return new Proxy(Object.create(null), {
    get(_, prop) {
      if (prop === FUNCTION_NAME) return parts.join(":");
      if (typeof prop === "string") return createApiProxy([...parts, prop]);
      return undefined;
    },
  });
}

export const api = createApiProxy([]);
export const internal = createApiProxy([]);
export const components = {};
