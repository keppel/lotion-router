// TODO: route beginblock, endblock, etc

function Router (routes) {
  if (routes == null || typeof routes !== 'object') {
    throw Error('Must provide route routes')
  }

  let blockHandlers = getAllHandlers(routes, 'block')
  let initializers = getAllHandlers(routes, 'initializer')

  // lotion tx handler
  function txHandler (state, tx, chain) {
    if (tx.type == null) {
      throw Error('Must provide type')
    }
    if (typeof tx.type !== 'string') {
      throw Error('Type must be a string')
    }

    let handlers = getRouteHandlers(routes, tx.type, 'tx')

    let substate = state[tx.type]
    if (substate == null) {
      throw Error(`Substate "${tx.type}" does not exist`)
    }

    let ctx = {
      get (routeName) {
        let route = getRoute(routes, routeName)
      }
    }

    for (let handler in handlers) {
      handler(substate, tx, chain, ctx)
    }
  }

  // lotion block handler
  function blockHandler (state, chain) {
    blockHandlers.forEach(state, chain)
  }

  // lotion initialization handler
  function initializer (state, chain) {
    initializers.forEach(state, chain)
  }

  // returns a lotion middleware stack
  return [
    { type: 'tx', middleware: txHandler },
    { type: 'block', middleware: blockHandler },
    { type: 'initializer', middleware: initializer }
  ]
}

function getAllHandlers (routes, type) {
  let handlers = []
  for (let route of routes) {
    // special case: single function is tx handler
    if (typeof routes === 'function') {
      route = [ { type: 'tx', middleware: route } ]
    }

    for (let handler of route) {
      if (handler.type === type) {
        handlers[type].push(handler.middleware)
      }
    }
  }
  return handlers
}

function getRoute (routes, routeName) {
  let route = routes[routeName]
  if (route == null) {
    throw Error(`No route found for "${routeName}"`)
  }
  return route
}

function getRouteHandlers (routes, routeName, type = 'tx') {
  function throwNoHandlerError () {
    throw Error(`No ${type} handlers defined for route "${route}"`)
  }

  // find route
  let route = getRoute(routes, routeName)

  // special case: if route is a function, it's a tx handler
  if (typeof route === 'function') {
    if (type === 'tx') return [ route ]
    throwNoHandlerError()
  }

  // find handler of given type from route
  let handlers = route.filter((h) => h.type === type)
  if (handlers.length === 0) {
    throwNoHandlerError()
  }
  return handlers
}

module.exports = Router
