const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { uploadFile } = require('../config/supabase');

// 配置内存存储引擎
const storage = multer.memoryStorage();

// 创建multer实例
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 限制文件大小为100MB
  },
  fileFilter: (req, file, cb) => {
    // 检查文件类型是否在允许的范围内
    let allowedTypes = [];
    
    if (req.originalUrl.includes('images')) {
      allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    } else if (req.originalUrl.includes('videos')) {
      allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/mkv', 'video/webm'];
    } else if (req.originalUrl.includes('documents')) {
      allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip',
        'application/x-rar-compressed'
      ];
    }
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

// 图片上传接口
router.post('/images', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有文件被上传' });
    }
    
    // 生成唯一的文件名
    const fileExtension = req.file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    
    // 上传文件到Supabase存储
    const result = await uploadFile('images', fileName, req.file.buffer, req.file.mimetype);
    
    // 返回文件URL和其他信息
    res.status(201).json({
      success: true,
      data: {
        url: result.url,
        path: result.path,
        fileName: fileName,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('图片上传失败:', error);
    res.status(500).json({
      success: false,
      error: '图片上传失败',
      details: error.message
    });
  }
});

// 视频上传接口
router.post('/videos', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有文件被上传' });
    }
    
    // 生成唯一的文件名
    const fileExtension = req.file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    
    // 上传文件到Supabase存储
    const result = await uploadFile('videos', fileName, req.file.buffer, req.file.mimetype);
    
    // 返回文件URL和其他信息
    res.status(201).json({
      success: true,
      data: {
        url: result.url,
        path: result.path,
        fileName: fileName,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('视频上传失败:', error);
    res.status(500).json({
      success: false,
      error: '视频上传失败',
      details: error.message
    });
  }
});

// 批量图片上传接口
router.post('/images/batch', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '没有文件被上传' });
    }
    
    // 批量上传文件
    const uploadPromises = req.files.map(async (file) => {
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `${uuidv4()}.${fileExtension}`;
      
      const result = await uploadFile('images', fileName, file.buffer, file.mimetype);
      
      return {
        url: result.url,
        path: result.path,
        fileName: fileName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size
      };
    });
    
    // 等待所有上传完成
    const results = await Promise.all(uploadPromises);
    
    res.status(201).json({
      success: true,
      data: results,
      total: results.length
    });
  } catch (error) {
    console.error('批量图片上传失败:', error);
    res.status(500).json({
      success: false,
      error: '批量图片上传失败',
      details: error.message
    });
  }
});

// 文档文件上传接口
router.post('/documents', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有文件被上传' });
    }
    
    // 生成唯一的文件名
    const fileExtension = req.file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    
    // 上传文件到Supabase存储
    const result = await uploadFile('documents', fileName, req.file.buffer, req.file.mimetype);
    
    // 返回文件URL和其他信息
    res.status(201).json({
      success: true,
      data: {
        url: result.url,
        path: result.path,
        fileName: fileName,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('文档文件上传失败:', error);
    res.status(500).json({
      success: false,
      error: '文档文件上传失败',
      details: error.message
    });
  }
});

module.exports = router;