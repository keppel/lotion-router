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
  t.true(Array.isArray(router))
})

test('routes txs to correct handlers', (t) => {
  let router = new Router({
    foo (state, tx, chain, ctx) {
      t.is(tx.type, 'foo')
      t.is(tx.value, 100)
    },
    bar (state, tx, chain, ctx) {
      t.is(tx.type, 'bar')
      t.is(tx.value, 123)
    }
  })

  let txHandler = router
    .find(({ type }) => type === 'tx')
    .middleware

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

  let txHandler = router
    .find(({ type }) => type === 'tx')
    .middleware

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
    foo (state, tx, chain, ctx) {},
    bar: [
      {
        type: 'initializer',
        middleware (state) {
          state.x = 123
        }
      }
    ],
    baz: Object.assign([], {
      initialState: { y: 456 }
    })
  })

  let initializer = router
    .find(({ type }) => type === 'initializer')
    .middleware

  let state = {}
  initializer(state)
  t.deepEqual(state, {
    foo: {},
    bar: { x: 123 },
    baz: { y: 456 }
  })
})

test('calls block handlers', (t) => {
  let router = new Router({
    foo: [
      {
        type: 'block',
        middleware (state, chain) {
          t.is(state.x, 123)
        }
      }
    ]
  })

  let blockHandler = router
    .find(({ type }) => type === 'block')
    .middleware

  blockHandler({ foo: { x: 123 } }, {})
})

test('errors on missing substate', (t) => {
  let router = new Router({
    foo () {}
  })

  let txHandler = router
    .find(({ type }) => type === 'tx')
    .middleware

  try {
    txHandler({}, { type: 'foo' }, {}, {})
    t.fail()
  } catch (err) {
    t.is(err.message, 'Substate "foo" does not exist')
  }
})
