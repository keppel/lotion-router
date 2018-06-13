let lotion = require('lotion')
let coins = require('coins')
let router = require('..')

let app = lotion()

// create 2 separate token denominations, each with
// a "peg" handler that can convert coins to the
// other denom
let alphacoin = coins({
  handlers: {
    peg: peg('betacoin', 0.1)
  },
  initialBalances: {
    'asdfasdf': 1000
  }
})
let betacoin = coins({
  handlers: {
    peg: peg('alphacoin', 10)
  },
  // 0 betacoins in existence at genesis
  initialBalances: {}
})

// route transactions to either alphacoin or betacoin
app.use(router({ alphacoin, betacoin }))

// start node
app.listen(8888)

// handler constructor
function peg (otherDenom, exchangeRate) {
  return {
    onOutput (output, state, tx, chain, router) {
      // user's output specifies where to pay out
      // in the other denom (with a simple fixed exchange rate)
      let mintedOutput = output.output
      mintedOutput.amount = output.amount * exchangeRate

      // get the other coin module from the router
      // so we can do a cross-module call
      let otherCoin = router.get(otherDenom)
      // mint coins in the other module
      otherCoin.mint(mintedOutput)
    }
  }
}
