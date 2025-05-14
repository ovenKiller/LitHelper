const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  devtool: 'inline-source-map',
  entry: {
    background: './src/background/background.js',
    content: './src/content/content.js',
    popup: './src/popup/popup.js', // Add this if you have a popup.js file
    settings: './src/config/settings.js', // 添加配置设置页面的入口
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.svg$/,
        type: 'asset/resource',
        generator: {
          filename: 'icons/[name][ext]'
        }
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: './' },
        { from: 'src/assets/icons', to: './icons' },
        { from: 'src/content/ui/styles', to: './content/ui/styles' },
        { from: 'src/content/ui/icons', to: './icons' }
      ]
    }),
    new HtmlWebpackPlugin({
      template: './src/pages/popup.html',
      filename: 'popup.html',
      chunks: ['popup']
    }),
    new HtmlWebpackPlugin({
      template: './src/config/settings.html',
      filename: 'settings.html',
      chunks: ['settings'],
      inject: 'body'
    })
  ],
  resolve: {
    extensions: ['.js']
  }
}; 