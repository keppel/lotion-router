let lotion = require('lotion')
let router = require('..')

let app = lotion({
  initialState: {}
})

// routes transactions to either counter1 or counter2
app.use(router({
  counter1: counter,
  counter2: counter
}))

app.start()

// counter is a normal tx handler.
// `state` is this handler's own local state,
// automatically created by the router
function counter (state, tx) {
  if (state.count == null) {
    state.count = 0
  }

  if (tx.count !== state.count) {
    throw Error('Invalid tx count')
  }

  state.count += 1
}
