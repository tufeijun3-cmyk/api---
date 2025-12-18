const express = require('express');
const router = express.Router();
const { select, insert, update, delete: del, count } = require('../config/supabase');
const { getUserFromSession, checkUserRole, handleError, formatDatetime, authenticateUser, authorizeAdmin } = require('../middleware/auth');


// 获取所有WhatsApp代理数据（带搜索、分页和筛选）
router.get('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    // 处理查询参数
    const { search, is_active, offset = 0, limit = 10 } = req.query;
    
    // 构建条件
    const conditions = [];
    if (search) {
      conditions.push({ type: 'ilike', column: 'name', value: `%${search}%` });
      conditions.push({ type: 'or', column: 'phone_number', value: `%${search}%` });
      conditions.push({ type: 'or', column: 'description', value: `%${search}%` });
    }
    if (is_active !== undefined) {
      if(is_active!=""){
      conditions.push({ type: 'eq', column: 'is_active', value: is_active });
      }
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
    }
    
    // 构建排序
    const orderBy = { 'column': 'created_at', 'ascending': false };
    
    const whatsappAgents = await select('whatsapp_agents', '*', conditions, limit,
      offset,
      orderBy
    );
    
    // 获取总数用于分页
    const total = await count('whatsapp_agents', conditions);
    
    res.status(200).json({
      success: true,
      data: whatsappAgents,
      total: total || 0,
      pages: Math.ceil((total || 0) / limit)
    });
  } catch (error) {
    console.error('获取WhatsApp代理数据失败:', error);
    res.status(500).json({ success: false, error: '获取WhatsApp代理数据失败', details: error.message });
  }
});

// 获取单个WhatsApp代理数据
router.get('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const whatsappAgents = await select('whatsapp_agents', '*', [{ 'type': 'eq', 'column': 'id', 'value': id }]);
    
    if (!whatsappAgents || whatsappAgents.length === 0) {
      return res.status(404).json({ success: false, error: 'WhatsApp代理数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或记录所属者可以查看
    if (user && user.trader_uuid !== whatsappAgents[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限查看此WhatsApp代理数据' });
    }
    
    res.status(200).json({ success: true, data: whatsappAgents[0] });
  } catch (error) {
    console.error('获取单个WhatsApp代理数据失败:', error);
    res.status(500).json({ success: false, error: '获取单个WhatsApp代理数据失败', details: error.message });
  }
});

// 创建新的WhatsApp代理数据
router.post('/', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { name, phone_number, is_active } = req.body;
    
    // 输入验证
    if (!name || !phone_number) {
      return res.status(400).json({ success: false, error: '缺少必要的字段' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查电话号码是否已存在
    const existingAgent = await select('whatsapp_agents', '*', [
      { type: 'eq', column: 'phone_number', value: phone_number }
    ]);
    if (existingAgent && existingAgent.length > 0) {
      return res.status(400).json({ success: false, error: '该电话号码的WhatsApp代理数据已存在' });
    }
    
    const newWhatsappAgent = await insert('whatsapp_agents', {
      name,
      phone_number,
      is_active: is_active !== undefined ? is_active : true,
      trader_uuid: user ? user.trader_uuid : null
    });
    
    res.status(201).json({ success: true, data: newWhatsappAgent });
  } catch (error) {
    console.error('创建WhatsApp代理数据失败:', error);
    res.status(500).json({ success: false, error: '创建WhatsApp代理数据失败', details: error.message });
  }
});

// 更新WhatsApp代理数据
router.put('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone_number, is_active } = req.body;
    
    // 检查数据是否存在
    const existingAgent = await select('whatsapp_agents', '*', [{ 'type': 'eq', 'column': 'id', 'value': id }]);
    if (!existingAgent || existingAgent.length === 0) {
      return res.status(404).json({ success: false, error: 'WhatsApp代理数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
    // 检查权限 - 只有管理员或记录所属者可以更新
    if (user && user.trader_uuid !== existingAgent[0].trader_uuid && user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '没有权限更新此WhatsApp代理数据' });
    }
    
    // 检查电话号码是否已存在其他记录
    if (phone_number && phone_number !== existingAgent[0].phone_number) {
      const duplicateAgent = await select('whatsapp_agents', '*', [
        { type: 'eq', column: 'phone_number', value: phone_number }
      ]);
      if (duplicateAgent && duplicateAgent.length > 0) {
        return res.status(400).json({ success: false, error: '该电话号码的WhatsApp代理数据已存在' });
      }
    }
    
    const updateData = {};
    
    if (name !== undefined) updateData.name = name;
    if (phone_number !== undefined) updateData.phone_number = phone_number;
    if (is_active !== undefined) updateData.is_active = is_active;
    
    const updatedAgent = await update('whatsapp_agents', updateData, [
      { type: 'eq', column: 'id', value: id },{ type: 'eq', column: 'trader_uuid', value: user.trader_uuid }
    ]);
    
    res.status(200).json({ success: true, data: updatedAgent });
  } catch (error) {
    console.error('更新WhatsApp代理数据失败:', error);
    res.status(500).json({ success: false, error: '更新WhatsApp代理数据失败', details: error.message });
  }
});

// 删除WhatsApp代理数据
router.delete('/:id', authenticateUser, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查数据是否存在
    const existingAgent = await select('whatsapp_agents', '*', [{ 'type': 'eq', 'column': 'id', 'value': id }]);
    if (!existingAgent || existingAgent.length === 0) {
      return res.status(404).json({ success: false, error: 'WhatsApp代理数据不存在' });
    }
    
    // 获取登录用户信息
    const user = await getUserFromSession(req);
    
     if (user.role !== 'superadmin') {
            conditions.push({ type: 'eq', column: 'trader_uuid', value: user.trader_uuid });
    }
    
    // 删除WhatsApp代理数据
    await del('whatsapp_agents', [
      { type: 'eq', column: 'id', value: id },{ type: 'eq', column: 'trader_uuid', value: user.trader_uuid }
    ]);
    
    res.status(200).json({ success: true, message: 'WhatsApp代理数据已成功删除' });
  } catch (error) {
    console.error('删除WhatsApp代理数据失败:', error);
    res.status(500).json({ success: false, error: '删除WhatsApp代理数据失败', details: error.message });
  }
});

module.exports = router;