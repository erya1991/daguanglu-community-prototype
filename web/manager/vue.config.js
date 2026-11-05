const CompressionPlugin=require('compression-webpack-plugin')
module.exports={publicPath:'/web/',productionSourceMap:false,configureWebpack:{plugins:[new CompressionPlugin({algorithm:'gzip',test:/\.(js|css|html|svg)$/,threshold:10240})]},css:{loaderOptions:{less:{lessOptions:{javascriptEnabled:true}}}}}
