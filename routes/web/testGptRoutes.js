const express = require('express');
const router = express.Router();

// 模拟GPT API的模板化响应
router.post('/test-gpt-template', async (req, res) => {
    try {
        console.log('[DEBUG] Testing GPT template response (simulated)...');
        
        // 模拟GPT的结构化响应
        const mockGptResponse = `【Stock Recommendations】

1. Stock Symbol: NVDA
   Company Name: NVIDIA Corporation
   Industry: AI Technology/Semiconductors
   Current Price: $875.50
   Market Cap: $2.15T
   P/E Ratio: 65.2
   52-week Change: +245%
   
   【Company Fundamentals】
   - Main Business: Leading AI chip manufacturer, data center GPUs, gaming graphics
   - Financial Performance: Strong revenue growth from AI data center demand
   - Competitive Advantages: Dominant market position in AI chips, CUDA ecosystem
   
   【Investment Advice】
   - Recommended Action: Buy
   - Target Price: $950
   - Stop Loss: $800
   - Suggested Position: 15%
   - Holding Period: 2-3 months
   
   【Risk Assessment】
   - Short-term Risks: High valuation, market volatility
   - Long-term Risks: Competition from AMD, regulatory concerns
   - Risk Level: High

2. Stock Symbol: MSFT
   Company Name: Microsoft Corporation
   Industry: AI Technology/Cloud Computing
   Current Price: $415.20
   Market Cap: $3.08T
   P/E Ratio: 32.8
   52-week Change: +58%
   
   【Company Fundamentals】
   - Main Business: Azure cloud services, Office 365, AI integration
   - Financial Performance: Consistent growth in cloud and AI segments
   - Competitive Advantages: Enterprise market dominance, OpenAI partnership
   
   【Investment Advice】
   - Recommended Action: Buy
   - Target Price: $450
   - Stop Loss: $380
   - Suggested Position: 20%
   - Holding Period: 3-6 months
   
   【Risk Assessment】
   - Short-term Risks: Market saturation in some segments
   - Long-term Risks: Regulatory scrutiny, competition
   - Risk Level: Medium

3. Stock Symbol: GOOGL
   Company Name: Alphabet Inc.
   Industry: AI Technology/Search & Advertising
   Current Price: $142.80
   Market Cap: $1.78T
   P/E Ratio: 25.4
   52-week Change: +42%
   
   【Company Fundamentals】
   - Main Business: Google Search, YouTube, Cloud AI services
   - Financial Performance: Strong ad revenue, growing cloud business
   - Competitive Advantages: Search monopoly, AI research leadership
   
   【Investment Advice】
   - Recommended Action: Buy
   - Target Price: $160
   - Stop Loss: $130
   - Suggested Position: 15%
   - Holding Period: 2-4 months
   
   【Risk Assessment】
   - Short-term Risks: Ad market sensitivity
   - Long-term Risks: Regulatory challenges, AI competition
   - Risk Level: Medium

【Overall Investment Strategy】
Based on your investment preferences, recommend:
- Position Allocation: 50% total allocation across 3 stocks (NVDA 15%, MSFT 20%, GOOGL 15%)
- Risk Management: Set stop-losses, diversify across different AI segments
- Trading Strategy: Focus on short-term momentum, monitor earnings and AI developments`;

        console.log('[DEBUG] Mock GPT response generated');
        console.log('[DEBUG] Response length:', mockGptResponse.length);
        
        return res.json({
            success: true,
            rawResponse: mockGptResponse,
            responseLength: mockGptResponse.length,
            timestamp: new Date().toISOString(),
            note: "This is a simulated response due to GPT API quota limits"
        });
        
    } catch (error) {
        console.error('Mock GPT API test failed:', error);
        return res.status(500).json({
            success: false,
            error: 'Mock GPT API call failed',
            details: error.message
        });
    }
});

module.exports = router;