const { select,update,insert } = require('../config/supabase');
const { getUserFromSession } = require('../middleware/auth');

// 获取用户积分规则
async function get_trader_points_rules(req) {
  if (!req) {
    throw new Error('Request object is required');
  }
  
  // 从cookie或请求头中获取session token
  const Web_Trader_UUID = req.headers['web-trader-uuid'];
  console.log('Web_Trader_UUID:', Web_Trader_UUID);
  const rules=await select('membership_points_rules', '*', [{'type':'eq','column':'trader_uuid','value':Web_Trader_UUID}]);
  if(rules&&rules.length>0)
  {
    return rules[0];
  }
  else
  {
    return {
      trader_uuid: Web_Trader_UUID,
      register_points: 100,
      likes_points: 10,
      upload_trades_points: 1000,
      ai_recommended_consumption: 10,
      ai_diagnostic_consumption: 5,
      answer_questions: 10,
      answering_consumption: 50,
    };
  }
}
async function update_user_points(req,userid,nowpoint,points,stype) {
  // 从cookie或请求头中获取session token
  const Web_Trader_UUID=req.headers['web-trader-uuid'];
  await update('users', {
            membership_points: nowpoint +points
        }, [{ 'type': 'eq', 'column': 'id', 'value': userid },{ 'type': 'eq', 'column': 'trader_uuid', 'value': Web_Trader_UUID }]);
  
  const pointlogData = {
    user_id: userid,
    trader_uuid: Web_Trader_UUID,
    points: points,
    stype: stype,
    creatertime: new Date().toISOString()
  };
  await insert('membership_points_log', pointlogData);
}
module.exports = {
    get_trader_points_rules,update_user_points
};