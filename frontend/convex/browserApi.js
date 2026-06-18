/**
 * Browser-compatible API proxy.
 * Replaces the anyApi from convex/server which can fail in Vite production builds.
 * Uses the same Symbol-based function reference format expected by useQuery/useMutation.
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
