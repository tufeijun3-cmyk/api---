const express = require('express');
const router = express.Router();
const { select, insert, update, delete:del, count } = require('../config/supabase');
const { getUserFromSession, checkUserRole, handleError, formatDatetime, authenticateUser, authorizeAdmin } = require('../middleware/auth');


// 获取所有联系记录数据（带搜索、分页和筛选）
router.get('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    // 处理查询参数
    const { search, offset = 0, limit = 10 } = req.query;

    // 构建条件
    const conditions = [];
    if (search) {
      conditions.push({'type':'or','conditions':[
        {'type':'like','column':'device_fingerprint','value':search},
        {'type':'like','column':'ip_address','value':search},
        {'type':'like','column':'user_agent','value':search}
      ]});
    }

    // 获取登录用户信息
    const user = await getUserFromSession(req);

     // 如果用户不是超级管理员，并且有trader_uuid，则只返回该trader_uuid的数据
        if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
        }

    // 构建排序 - 默认按时间戳降序
    const orderBy = {'column':'"timestamp"','ascending':false};

    const contactRecords = await select('contact_records', '*', conditions, limit, offset, orderBy);

    // 获取总数用于分页
    const total = await count('contact_records', conditions);

    res.status(200).json({
      success: true,
      data: contactRecords,
      total: total || 0,
      pages: Math.ceil((total || 0) / limit)
    });
  } catch (error) {
    console.error('获取联系记录数据失败:', error);
    res.status(500).json({ success: false, error: '获取联系记录数据失败', details: error.message });
  }
});

// 获取单个联系记录数据
router.get('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // id是uuid类型
    const contactRecords = await select('contact_records', '*', [{'type':'eq','column':'id','value':id}]);

    if (!contactRecords || contactRecords.length === 0) {
      return res.status(404).json({ success: false, error: '联系记录数据不存在' });
    }

    res.status(200).json({ success: true, data: contactRecords[0] });
  } catch (error) {
    console.error('获取单个联系记录数据失败:', error);
    res.status(500).json({ success: false, error: '获取单个联系记录数据失败', details: error.message });
  }
});

// 创建新的联系记录数据
router.post('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { device_fingerprint, agent_id, ip_address, user_agent, click_time, trader_uuid } = req.body;

    // 输入验证
    if (!device_fingerprint || !agent_id) {
      return res.status(400).json({ success: false, error: '缺少必要的字段' });
    }

    // 获取登录用户信息
    const user = await getUserFromSession(req);

    const newContactRecord = await insert('contact_records', {
      device_fingerprint,
      agent_id,
      ip_address,
      user_agent,
      click_time,
      trader_uuid: trader_uuid || (user && user.trader_uuid ? user.trader_uuid : null),
      "timestamp": new Date()
    });

    res.status(201).json({ success: true, data: newContactRecord });
  } catch (error) {
    console.error('创建联系记录数据失败:', error);
    res.status(500).json({ success: false, error: '创建联系记录数据失败', details: error.message });
  }
});

// 更新联系记录数据
router.put('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { device_fingerprint, agent_id, ip_address, user_agent, click_time, trader_uuid } = req.body;

    // 检查数据是否存在
    const existingRecord = await select('contact_records', '*', [{'type':'eq','column':'id','value':id}]);
    if (!existingRecord || existingRecord.length === 0) {
      return res.status(404).json({ success: false, error: '联系记录数据不存在' });
    }

    // 获取登录用户信息
    const user = await getUserFromSession(req);

    // 检查权限 - 只有管理员或记录所属者可以更新
    if (user && user.trader_uuid !== existingRecord[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限更新此联系记录' });
    }

    const updateData = {
      "timestamp": new Date()
    };

    if (device_fingerprint !== undefined) updateData.device_fingerprint = device_fingerprint;
    if (agent_id !== undefined) updateData.agent_id = agent_id;
    if (ip_address !== undefined) updateData.ip_address = ip_address;
    if (user_agent !== undefined) updateData.user_agent = user_agent;
    if (click_time !== undefined) updateData.click_time = click_time;
    if (trader_uuid !== undefined) updateData.trader_uuid = trader_uuid;

    const updatedRecord = await update('contact_records', updateData, [
      { type: 'eq', column: 'id', value: id }
    ]);

    res.status(200).json({ success: true, data: updatedRecord });
  } catch (error) {
    console.error('更新联系记录数据失败:', error);
    res.status(500).json({ success: false, error: '更新联系记录数据失败', details: error.message });
  }
});

// 删除联系记录数据
router.delete('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // 检查数据是否存在
    const existingRecord = await select('contact_records', '*', [{'type':'eq','column':'id','value':id}]);
    if (!existingRecord || existingRecord.length === 0) {
      return res.status(404).json({ success: false, error: '联系记录数据不存在' });
    }

    // 获取登录用户信息
    const user = await getUserFromSession(req);

    // 检查权限 - 只有管理员或记录所属者可以删除
    if (user && user.trader_uuid !== existingRecord[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限删除此联系记录' });
    }

    // 删除记录
    await del('contact_records', [
      { type: 'eq', column: 'id', value: id } ,{ type: 'eq', column: 'trader_uuid', value: req.user.trader_uuid }
    ]);

    res.status(200).json({ success: true, message: '联系记录数据已成功删除' });
  } catch (error) {
    console.error('删除联系记录数据失败:', error);
    res.status(500).json({ success: false, error: '删除联系记录数据失败', details: error.message });
  }
});

module.exports = router;