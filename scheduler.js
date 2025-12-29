const schedule = require('node-schedule');
const { select, update } = require('./config/supabase');
const { get_real_time_price, get_India_price } = require('./config/common');

// 存储印度股票价格列表
let India_price_List = {};

/**
 * 更新持仓股票价格
 */
async function update_holding_stocks_prices() {
  try {
    console.log('Starting update_holding_stocks_prices at', new Date().toISOString());
    
    // 获取所有未平仓的交易记录
    const conditions = [
      { type: 'is', column: 'exit_price', value: null },
      { type: 'is', column: 'exit_date', value: null }
    ];
    
    const holdingTrades = await select('trades1', '*', conditions);
    
    if (!holdingTrades || holdingTrades.length === 0) {
      console.log('No holding trades found');
      return;
    }
    
    console.log(`Found ${holdingTrades.length} holding trades to update`);
    
    // 遍历持仓交易，更新价格
    for (const trade of holdingTrades) {
      try {
        const currentPrice = await get_real_time_price(trade.trade_market, trade.symbol);
        
        if (currentPrice) {
          // console.log(`Updating price for ${trade.symbol}: ${currentPrice}`);
          
          // 更新数据库中的价格
          await update('trades1', {
            current_price: currentPrice
          }, [
            { type: 'eq', column: 'id', value: trade.id }
          ]);
        } else {
          console.log(`Failed to get price for ${trade.symbol}`);
        }
      } catch (error) {
       // console.error(`Error updating price for trade ${trade.id}:`, error);
        // 继续处理下一个交易，不中断整个过程
      }
    }
    
    console.log('update_holding_stocks_prices completed successfully');
  } catch (error) {
    console.error('Error in update_holding_stocks_prices:', error);
  }
}

/**
 * 统一同步更新所有交易价格
 */
async function update_all_trades_prices() {
  try {
    console.log('Starting update_all_trades_prices at', new Date().toISOString());
    const conditions = [
      { type: 'is', column: 'exit_price', value: null }
    ];
    // 获取所有交易记录
    const allTrades = await select('trades', '*', conditions);
    
    if (!allTrades || allTrades.length === 0) {
      console.log('No trades found');
      return;
    }
    
    console.log(`Found ${allTrades.length} trades to update`);
    
    // 遍历所有交易，更新价格
    for (const trade of allTrades) {
      try {
        // 只更新未平仓的交易价格
        if (!trade.exit_price && !trade.exit_date) {
          const currentPrice = await get_real_time_price(trade.trade_market, trade.symbol);
          
          if (currentPrice) {
            console.log(`Updating price for ${trade.symbol}: ${currentPrice}`);
            
            // 更新数据库中的价格
            await update('trades', {
              current_price: currentPrice
            }, [
              { type: 'eq', column: 'id', value: trade.id }
            ]);
          } else {
            console.log(`Failed to get price for ${trade.symbol}`);
          }
        }
      } catch (error) {
        console.error(`Error updating price for trade ${trade.id}:`, error);
        // 继续处理下一个交易，不中断整个过程
      }
    }
    
    console.log('update_all_trades_prices completed successfully');
  } catch (error) {
    console.error('Error in update_all_trades_prices:', error);
  }
}


/**
 * 统一同步更新所有交易价格
 */
async function update_all_vip_trades_prices() {
  try {
    console.log('Starting update_all_vip_trades_prices at', new Date().toISOString());
    const conditions = [
      { type: 'is', column: 'exit_price', value: null }
    ];
    // 获取所有交易记录
    const allTrades = await select('vip_trades', '*', conditions);
    
    if (!allTrades || allTrades.length === 0) {
      console.log('No vip_trades found');
      return;
    }
    
    console.log(`Found ${allTrades.length} vip_trades to update`);
    
    // 遍历所有交易，更新价格
    for (const trade of allTrades) {
      try {
        // 只更新未平仓的交易价格
        if (!trade.exit_price && !trade.exit_date) {
          const currentPrice = await get_real_time_price(trade.trade_market, trade.symbol);
          
          if (currentPrice) {
            console.log(`Updating vip_trades price for ${trade.symbol}: ${currentPrice}`);
            
            // 更新数据库中的价格
            await update('vip_trades', {
              current_price: currentPrice,
              updated_at: new Date().toISOString()
            }, [
              { type: 'eq', column: 'id', value: trade.id }
            ]);
          } else {
            console.log(`Failed to get vip_trades price for ${trade.symbol}`);
          }
        }
      } catch (error) {
        console.error(`Error updating price for trade ${trade.id}:`, error);
        // 继续处理下一个交易，不中断整个过程
      }
    }
    
    console.log('update_all_vip_trades_prices completed successfully');
  } catch (error) {
    console.error('Error in update_all_vip_trades_prices:', error);
  }
}

/**
 * 初始化定时任务
 */
function initScheduler() {
  console.log('Initializing scheduler...');
  
  // 每30秒更新持仓股票价格
  schedule.scheduleJob('*/30 * * * * *', update_holding_stocks_prices);
  console.log('Scheduled update_holding_stocks_prices to run every 30 seconds');
  
  // 每30秒更新印度股票价格
  schedule.scheduleJob('*/30 * * * * *', get_India_price);
  console.log('Scheduled get_India_price to run every 30 seconds');
  
  // 每30秒统一同步更新所有交易价格
  schedule.scheduleJob('*/30 * * * * *', update_all_trades_prices);
  console.log('Scheduled update_all_trades_prices to run every 30 seconds');

   // 每30秒统一同步更新所有交易价格
  schedule.scheduleJob('*/30 * * * * *', update_all_vip_trades_prices);
  console.log('Scheduled update_all_vip_trades_prices to run every 30 seconds');
  
  // 立即执行一次印度股票价格更新，避免首次加载时价格为空
  get_India_price();
  
  console.log('Scheduler initialized successfully');
}

module.exports = {
  initScheduler,
  update_holding_stocks_prices,
  update_all_trades_prices
};