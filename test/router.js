'use strict'

const test = require('ava')
const Router = require('..')

test('create router without routes', (t) => {
  try {
    let router = new Router()
    t.fail(router)
  } catch (e) {
    t.is(e.message, 'Must provide routes object')
  }
})

test('create router', (t) => {
  let router = new Router({})
  t.true('transactionHandlers' in router)
  t.true('blockHandlers' in router)
  t.true('initializers' in router)
})

test('routes txs to correct handlers', (t) => {
  let router = new Router({
    foo (state, tx, ctx) {
      t.is(tx.type, 'foo')
      t.is(tx.value, 100)
    },
    bar (state, tx, ctx) {
      t.is(tx.type, 'bar')
      t.is(tx.value, 123)
    }
  })

  let txHandler = (...args) =>
    router.transactionHandlers.forEach((h) => h(...args))

  txHandler(
    { foo: {}, bar: {} },
    { type: 'bar', value: 123 },
    {},
    {}
  )
  txHandler(
    { foo: {}, bar: {} },
    { type: 'foo', value: 100 },
    {},
    {}
  )

  try {
    txHandler(
      { foo: {}, bar: {} },
      { type: 'x', value: 100 },
      {},
      {}
    )
    t.fail()
  } catch (err) {
    t.is(err.message, 'No route found for "x"')
  }
})

test('errors on bad tx type', (t) => {
  let router = new Router({})

  let txHandler = (...args) =>
    router.transactionHandlers.forEach((h) => h(...args))

  try {
    txHandler({}, {}, {}, {})
    t.fail()
  } catch (err) {
    t.is(err.message, 'Must provide type')
  }

  try {
    txHandler({}, { type: 123 }, {}, {})
    t.fail()
  } catch (err) {
    t.is(err.message, 'Type must be a string')
  }
})

test('calls initializers', (t) => {
  let router = new Router({
    foo (state, tx, ctx) {},
    bar: {
      initializers: [
        function (state, context) {
          state.x = 123
          context.y = 456
        }
      ]
    },
    baz: {
      initialState: { y: 456 }
    }
  })

  let initializer = (...args) =>
    router.initializers.forEach((h) => h(...args))

  let context = {}
  let state = {}
  initializer(state, context)
  t.deepEqual(context, {
    modules: {},
    rootState: state,
    y: 456
  })
  t.deepEqual(state, {
    foo: {},
    bar: { x: 123 },
    baz: { y: 456 }
  })
})

test('calls block handlers', (t) => {
  let router = new Router({
    foo: {
      blockHandlers: [
        function (state, chain) {
          t.is(state.x, 123)
        }
      ]
    }
  })

  let blockHandler = (...args) =>
    router.blockHandlers.forEach((h) => h(...args))

  blockHandler({ foo: { x: 123 } }, {})
})

test('errors on missing substate', (t) => {
  let router = new Router({
    foo () {}
  })

  let txHandler = (...args) =>
    router.transactionHandlers.forEach((h) => h(...args))

  try {
    txHandler({}, { type: 'foo' }, {}, {})
    t.fail()
  } catch (err) {
    t.is(err.message, 'Substate "foo" does not exist')
  }
})

test('cross-route methods', (t) => {
  let router = new Router({
    foo (state, tx, ctx) {
      state.value = ctx.modules.bar.increment()
    },
    bar: {
      methods: {
        increment (state) {
          state.value += 1
          return state.value
        }
      }
    }
  })

  let txHandler = (...args) =>
    router.transactionHandlers.forEach((h) => h(...args))

  let state = { foo: {}, bar: { value: 5 } }
  txHandler(state, { type: 'foo' }, {})
  txHandler(state, { type: 'foo' }, {})
  t.is(state.foo.value, 7)
  t.is(state.bar.value, 7)
})

test('cross-route methods must be functions', (t) => {
  let router = new Router({
    foo (state, tx, ctx) {
      state.value = ctx.modules.bar.x
    },
    bar: {
      methods: {
        x: 5
      }
    }
  })

  let txHandler = (...args) =>
    router.transactionHandlers.forEach((h) => h(...args))

  let state = { foo: {}, bar: {} }
  try {
    txHandler(state, { type: 'foo' }, {})
    t.fail()
  } catch (err) {
    t.is(err.message, 'Got non-function in methods')
  }
})

test('cross-route methods are read-only', (t) => {
  let router = new Router({
    foo (state, tx, ctx) {
      state.value = ctx.modules.bar.y = 5
    },
    bar: {
      methods: {
        x () {}
      }
    }
  })

  let txHandler = (...args) =>
    router.transactionHandlers.forEach((h) => h(...args))

  let state = { foo: {}, bar: {} }
  try {
    txHandler(state, { type: 'foo' }, {})
    t.fail()
  } catch (err) {
    t.is(err.message, 'Route methods are read-only')
  }
})

test('module with multiple middleware of type', (t) => {
  let router = new Router({
    foo: {
      transactionHandlers: [
        function (state, tx) {
          state.x = tx.count
        },
        function (state, tx) {
          state.y = tx.count
        }
      ]
    }
  })

  let txHandler = (...args) =>
    router.transactionHandlers.forEach((h) => h(...args))

  let state = { foo: {} }
  txHandler(state, { type: 'foo', count: 1 }, {})

  t.is(state.foo.x, 1)
  t.is(state.foo.y, 1)
})

test('tx for route with no tx handler', (t) => {
  let router = new Router({
    foo: [
      {
        type: 'block',
        middleware (state) {}
      }
    ]
  })

  let txHandler = (...args) =>
    router.transactionHandlers.forEach((h) => h(...args))

  let state = { foo: {} }
  try {
    txHandler(state, { type: 'foo', count: 1 })
    t.fail()
  } catch (err) {
    t.is(err.message, 'No tx handlers defined for route "foo"')
  }
})

test('initialState override', (t) => {
  let router = new Router({
    foo: {
      initialState: { x: 'y' }
    }
  })

  let initializer = (...args) =>
    router.initializers.forEach((h) => h(...args))

  let state = { foo: {} }
  try {
    initializer(state)
    t.fail()
  } catch (err) {
    t.is(err.message, 'Route "foo" has initialState, but state.foo already exists')
  }
})

test('existing state not overriden', (t) => {
  let router = new Router({
    foo (state, tx, context) {}
  })

  let initializer = (...args) =>
    router.initializers.forEach((h) => h(...args))

  let state = { foo: { bar: 'baz' } }
  initializer(state, {})
  t.is(state.foo.bar, 'baz')
})

test('context has rootState', (t) => {
  let router = new Router({
    foo (state, tx, ctx) {
      t.is(ctx.rootState.x, 123)
    }
  })

  let txHandler = (...args) =>
    router.transactionHandlers.forEach((h) => h(...args))

  let state = { x: 123, foo: {} }
  txHandler(state, { type: 'foo' }, {})
})
