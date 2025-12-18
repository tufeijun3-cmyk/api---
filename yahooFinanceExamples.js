const yf = require('yahoo-finance');

// 获取历史行情数据
yf.historical({
    symbol: 'AAPL', // 苹果公司的股票代码
    from: '2023-01-01', // 开始日期
    to: '2023-03-01', // 结束日期
    period: 'd' // 'd' for day, 'w' for week, 'm' for month, 'v' for verbose
}).then(historical => {
    console.log(historical);
}).catch(err => {
    console.error(err);
});