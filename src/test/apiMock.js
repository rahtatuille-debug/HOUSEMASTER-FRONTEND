// A stand-in for the `api` object: every method, however deeply nested,
// resolves to an empty list unless a test overrides it.
export function deepApiMock(overrides = {}) {
  const make = (path) =>
    new Proxy(function () {}, {
      apply: () => Promise.resolve([]),
      get: (target, prop) => {
        if (prop === 'then') return undefined
        const key = [...path, prop].join('.')
        if (key in overrides) return overrides[key]
        if (!(prop in target)) target[prop] = make([...path, prop])
        return target[prop]
      },
    })
  return make([])
}
