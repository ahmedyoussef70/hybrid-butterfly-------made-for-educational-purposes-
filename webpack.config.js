const join = require('path').join
var include = join(__dirname, 'src')
module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'index.min.js',
    path: join(__dirname, 'dist'),
    libraryTarget: 'umd',
    library: 'hybridButterfly'
  },
  mode: 'production',
  module: {
    rules: [{ test: /\.js$/, loader: 'babel-loader', include }]
  }
}
