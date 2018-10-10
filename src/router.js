'use strict'

const old = require('old')

// TODO: change standard lotion module format to object (not array)

function Router (routes) {
  if (routes == null || typeof routes !== 'object') {
    throw Error('Must provide routes object')
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
    let substate = getSubstate(state, tx.type)

    // get exported methods from other routes
    let exportedMethods = {}
    for (let [ routeName, route ] of Object.entries(routes)) {
      if (routeName === tx.type) continue
      if (route.methods == null) continue
      // define getter, so we bind the methods as they are accessed
      Object.defineProperty(exportedMethods, routeName, {
        get () {
          let substate = getSubstate(state, routeName)
          // TODO: use a more complete way of making object read-only
          return new Proxy(route.methods, {
            get (obj, key) {
              if (typeof obj[key] !== 'function') {
                throw Error('Got non-function in methods')
              }
              // use the external route's own substate as first arg
              return obj[key].bind(null, substate)
            },
            set () {
              throw Error('Route methods are read-only')
            }
          })
        }
      })
    }

    // TODO: combine ctx with chainInfo
    let ctx = {
      // root state, just in case
      rootState: state,

      // exported methods from other routes
      routes: exportedMethods
    }

    for (let handler of handlers) {
      handler(substate, tx, chain, ctx)
    }
  }

  // lotion block handler
  function blockHandler (state, chain) {
    for (let { route, handler } of blockHandlers) {
      let substate = getSubstate(state, route)
      handler(substate, chain)
    }
  }

  // lotion initialization handler
  function initializer (state, chain) {
    for (let route in routes) {
      let substate

      if (routes[route].initialState != null) {
        if (route in state) {
          throw Error(`Route "${route}" has initialState, but state.${route} already exists`)
        }
        substate = routes[route].initialState
      }

      state[route] = substate || {}
    }

    for (let { route, handler } of initializers) {
      let substate = state[route]
      handler(substate, chain)
    }
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
  for (let routeName in routes) {
    let route = routes[routeName]

    // special case: single function is tx handler
    if (typeof route === 'function') {
      route = [ { type: 'tx', middleware: route } ]
    }

    for (let handler of route) {
      if (handler.type !== type) continue
      handlers.push({
        route: routeName,
        handler: handler.middleware
      })
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
    throw Error(`No ${type} handlers defined for route "${routeName}"`)
  }

  // find route
  let route = getRoute(routes, routeName)

  // special case: if route is a function, it's a tx handler
  if (typeof route === 'function') {
    if (type === 'tx') return [ route ]
    throwNoHandlerError()
  }

  // find handler of given type from route
  let handlers = route
    .filter((h) => h.type === type)
    .map((h) => h.middleware)
  if (handlers.length === 0) {
    throwNoHandlerError()
  }
  return handlers
}

function getSubstate (state, key) {
  let substate = state[key]
  if (substate == null) {
    throw Error(`Substate "${key}" does not exist`)
  }
  return substate
}

module.exports = old(Router)
