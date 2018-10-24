const join = require('path').join
var include = join(__dirname, 'src')
module.exports = {
  entry: {
    hybridButterfly: './src/index.js',
    hybridButterflyRouter: './src/router.js'
  },
  output: {
    filename: '[name].js',
    path: join(__dirname, 'dist'),
    libraryTarget: 'umd',
    library: '[name]'
  },
  mode: 'production',
  module: {
    rules: [{ test: /\.js$/, loader: 'babel-loader', include }]
  }
}
