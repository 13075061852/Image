// AI功能相关代码

// 全局变量
let currentConversation = null; // 当前对话
let currentSelectedImages = []; // 当前选中的图片

// 对话历史相关函数
function getConversationList() {
    console.log('Getting conversation list from localStorage...');
    const conversations = localStorage.getItem('ai-conversations');
    console.log('Raw conversations data:', conversations);
    const parsed = conversations ? JSON.parse(conversations) : [];
    console.log('Parsed conversations:', parsed);
    return parsed;
}

// 保存对话历史
function saveConversationHistory(conversation) {
    console.log('Saving conversation history:', conversation);
    const conversations = getConversationList();
    const existingIndex = conversations.findIndex(c => c.id === conversation.id);
    
    if (existingIndex !== -1) {
        console.log('Updating existing conversation at index:', existingIndex);
        conversations[existingIndex] = conversation;
    } else {
        console.log('Adding new conversation');
        conversations.unshift(conversation);
    }
    
    console.log('Saving to localStorage:', conversations);
    localStorage.setItem('ai-conversations', JSON.stringify(conversations));
    console.log('Conversation saved successfully');
}

// 加载对话历史
function loadConversationHistory(conversationId) {
    console.log('Loading conversation history for ID:', conversationId);
    const conversations = getConversationList();
    console.log('All conversations:', conversations);
    const conversation = conversations.find(c => c.id === conversationId);
    console.log('Found conversation:', conversation);
    return conversation;
}

// 删除对话历史
function deleteConversationHistory(conversationId) {
    const conversations = getConversationList();
    const filteredConversations = conversations.filter(c => c.id !== conversationId);
    localStorage.setItem('ai-conversations', JSON.stringify(filteredConversations));
}

// 创建新对话
function createNewConversation(images = []) {
    console.log('Creating new conversation with images:', images.length);
    const conversation = {
        id: Date.now().toString(),
        title: '新对话',
        messages: [],
        images: images.map(img => ({
            id: img.id,
            name: img.name,
            data: img.data,
            category: img.category
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    console.log('Created new conversation:', conversation);
    saveConversationHistory(conversation);
    console.log('New conversation saved');
    return conversation;
}

// 更新对话标题
function updateConversationTitle(conversationId, title) {
    const conversation = loadConversationHistory(conversationId);
    if (conversation) {
        conversation.title = title;
        conversation.updatedAt = new Date().toISOString();
        saveConversationHistory(conversation);
    }
}

// API配置相关函数

// 保存API配置
function saveAPIConfig() {
    const apiKeyInput = document.getElementById('openrouter-api-key');
    const modelSelect = document.getElementById('openrouter-api-model');
    
    if (!apiKeyInput || !modelSelect) {
        showToast('API配置界面未找到', 'error');
        return;
    }
    
    const config = {
        apiKey: apiKeyInput.value,
        model: modelSelect.value
    };

    localStorage.setItem('ai-api-config', JSON.stringify(config));
    showToast('API配置已保存', 'success');
    
    // 如果API密钥已设置，获取模型列表
    if (config.apiKey) {
        fetchModels(config.apiKey);
    }
    
    closeAPIConfigModal();
}

// 加载API配置
function loadAPIConfig() {
    const config = getAPIConfig();
    if (config) {
        const apiKeyInput = document.getElementById('openrouter-api-key');
        const modelSelect = document.getElementById('openrouter-api-model');
        if (apiKeyInput) {
            apiKeyInput.value = config.apiKey || '';
        }
        if (modelSelect) {
            modelSelect.value = config.model || 'openai/gpt-4o';
        }
        
        // 如果API密钥已设置，获取模型列表
        if (config.apiKey) {
            fetchModels(config.apiKey);
        }
        
        // 初始化自定义下拉菜单
        initCustomSelect();
    }
}

// 从OpenRouter API获取模型列表
async function fetchModels(apiKey) {
    const selectValue = document.getElementById('custom-select-value');
    const selectOptions = document.getElementById('custom-select-options');
    const hiddenInput = document.getElementById('openrouter-api-model');
    
    if (!selectValue || !selectOptions || !hiddenInput) return;
    
    selectValue.textContent = '加载模型列表中...';

    try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch models');
        }

        const data = await response.json();
        const models = data.data || [];

        selectOptions.innerHTML = '';
        
        const groupedModels = {};
        models.forEach(model => {
            const provider = model.id.split('/')[0] || 'other';
            if (!groupedModels[provider]) {
                groupedModels[provider] = [];
            }
            groupedModels[provider].push(model);
        });

        // 自定义排序逻辑，将千问模型(qwen)和deepseek模型排在最前面
        const sortedProviders = Object.keys(groupedModels).sort((a, b) => {
            // 千问模型排在最前面
            if (a.toLowerCase().includes('qwen')) return -1;
            if (b.toLowerCase().includes('qwen')) return 1;
            // deepseek模型排在第二
            if (a.toLowerCase().includes('deepseek')) return -1;
            if (b.toLowerCase().includes('deepseek')) return 1;
            // 其他模型按字母顺序排序
            return a.localeCompare(b);
        });
        
        sortedProviders.forEach(provider => {
            const optgroup = document.createElement('div');
            optgroup.className = 'custom-select-optgroup';
            optgroup.textContent = provider.toUpperCase();
            selectOptions.appendChild(optgroup);
            
            groupedModels[provider]
                .sort((a, b) => {
                    // 首先判断两个模型是否支持图片
                    const visionModels = [
                        'vision', 'gpt-4o', 'gpt-4-turbo', 'gpt-4-vision',
                        'claude-3', 'gemini-1.5', 'gemini-2.0', 'gemini-exp',
                        'llava', 'cogvlm', 'qwen-vl', 'internvl', 'pixtral'
                    ];
                    
                    const isVisionA = visionModels.some(vm => 
                        a.id.toLowerCase().includes(vm) || 
                        a.name.toLowerCase().includes(vm)
                    );
                    
                    const isVisionB = visionModels.some(vm => 
                        b.id.toLowerCase().includes(vm) || 
                        b.name.toLowerCase().includes(vm)
                    );
                    
                    // 支持图片的模型排在前面
                    if (isVisionA && !isVisionB) return -1;
                    if (!isVisionA && isVisionB) return 1;
                    
                    // 千问模型内部按名称排序
                    if (provider.toLowerCase().includes('qwen')) {
                        return a.name.localeCompare(b.name);
                    }
                    // deepseek模型内部按名称排序
                    if (provider.toLowerCase().includes('deepseek')) {
                        return a.name.localeCompare(b.name);
                    }
                    // 其他模型按名称排序
                    return a.name.localeCompare(b.name);
                })
                .forEach(model => {
                    const option = document.createElement('div');
                    option.className = 'custom-select-option';
                    option.dataset.value = model.id;
                    const pricing = model.pricing;
                    let priceInfo = '';
                    if (pricing) {
                        const promptPrice = parseFloat(pricing.prompt || 0) * 1000000;
                        const completionPrice = parseFloat(pricing.completion || 0) * 1000000;
                        if (promptPrice > 0 || completionPrice > 0) {
                            priceInfo = ` ($${promptPrice.toFixed(2)}/${completionPrice.toFixed(2)}/M)`;
                        } else {
                            priceInfo = ' (免费)';
                        }
                    }
                    let visionBadge = '';
                    const visionModels = [
                        'vision', 'gpt-4o', 'gpt-4-turbo', 'gpt-4-vision',
                        'claude-3', 'gemini-1.5', 'gemini-2.0', 'gemini-exp',
                        'llava', 'cogvlm', 'qwen-vl', 'internvl', 'pixtral'
                    ];
                    const isVisionModel = visionModels.some(vm => 
                        model.id.toLowerCase().includes(vm) || 
                        model.name.toLowerCase().includes(vm)
                    );
                    if (isVisionModel) {
                        visionBadge = ' 👁️';
                    }
                    option.textContent = model.name + priceInfo + visionBadge;
                    option.dataset.info = model.description || '';
                    option.dataset.vision = isVisionModel ? 'true' : 'false';
                    
                    // 添加点击事件
                    option.addEventListener('click', function() {
                        selectCustomOption(model.id, option.textContent);
                    });
                    
                    selectOptions.appendChild(option);
                });
        });

        const savedConfig = getAPIConfig();
        let selectedModel = null;
        
        if (savedConfig.model) {
            selectedModel = models.find(model => model.id === savedConfig.model);
        }
        
        if (!selectedModel) {
            selectedModel = models.find(model => model.id === 'openai/gpt-4o-mini');
        }
        
        if (selectedModel) {
            const pricing = selectedModel.pricing;
            let priceInfo = '';
            if (pricing) {
                const promptPrice = parseFloat(pricing.prompt || 0) * 1000000;
                const completionPrice = parseFloat(pricing.completion || 0) * 1000000;
                if (promptPrice > 0 || completionPrice > 0) {
                    priceInfo = ` ($${promptPrice.toFixed(2)}/${completionPrice.toFixed(2)}/M)`;
                } else {
                    priceInfo = ' (免费)';
                }
            }
            let visionBadge = '';
            const visionModels = [
                'vision', 'gpt-4o', 'gpt-4-turbo', 'gpt-4-vision',
                'claude-3', 'gemini-1.5', 'gemini-2.0', 'gemini-exp',
                'llava', 'cogvlm', 'qwen-vl', 'internvl', 'pixtral'
            ];
            const isVisionModel = visionModels.some(vm => 
                selectedModel.id.toLowerCase().includes(vm) || 
                selectedModel.name.toLowerCase().includes(vm)
            );
            if (isVisionModel) {
                visionBadge = ' 👁️';
            }
            const modelName = selectedModel.name + priceInfo + visionBadge;
            selectValue.textContent = modelName;
            hiddenInput.value = selectedModel.id;
        }

        updateModelChips();
        checkModelAvailability(hiddenInput.value, apiKey);

    } catch (error) {
        console.error('Error fetching models:', error);
        selectValue.textContent = '加载失败，请检查 API Key';
        hiddenInput.value = '';
    }
}

// 初始化自定义下拉菜单
function initCustomSelect() {
    console.log('Initializing custom select...');
    const customSelect = document.getElementById('custom-model-select');
    const selectValue = document.getElementById('custom-select-value');
    const selectDropdown = document.getElementById('custom-select-dropdown');
    
    console.log('Elements found:', {
        customSelect: !!customSelect,
        selectValue: !!selectValue,
        selectDropdown: !!selectDropdown
    });
    
    if (!customSelect || !selectValue || !selectDropdown) {
        console.error('Custom select elements not found');
        return;
    }
    
    // 点击外部关闭下拉菜单
    document.addEventListener('click', function(e) {
        // 检查点击的元素是否在自定义下拉菜单内部
        if (!customSelect.contains(e.target)) {
            selectDropdown.style.display = 'none';
        }
    });
    
    console.log('Custom select initialized successfully');
}

// 切换自定义下拉菜单的显示状态
function toggleCustomSelect() {
    console.log('Toggling custom select...');
    const selectDropdown = document.getElementById('custom-select-dropdown');
    if (selectDropdown) {
        console.log('Current display state:', selectDropdown.style.display);
        selectDropdown.style.display = selectDropdown.style.display === 'block' ? 'none' : 'block';
        console.log('New display state:', selectDropdown.style.display);
    } else {
        console.error('Select dropdown not found');
    }
}

// 关闭自定义下拉菜单
function closeCustomSelect() {
    const selectDropdown = document.getElementById('custom-select-dropdown');
    if (selectDropdown) {
        selectDropdown.style.display = 'none';
    }
}

// 选择自定义下拉菜单的选项
function selectCustomOption(modelId, modelName) {
    const selectValue = document.getElementById('custom-select-value');
    const hiddenInput = document.getElementById('openrouter-api-model');
    const selectDropdown = document.getElementById('custom-select-dropdown');
    
    if (selectValue && hiddenInput) {
        selectValue.textContent = modelName;
        hiddenInput.value = modelId;
        updateModelChips();
        checkModelAvailability(modelId);
    }
    
    if (selectDropdown) {
        selectDropdown.style.display = 'none';
    }
}

// 选择模型
function selectModel(modelId) {
    const hiddenInput = document.getElementById('openrouter-api-model');
    const selectValue = document.getElementById('custom-select-value');
    const selectOptions = document.getElementById('custom-select-options');
    
    if (!hiddenInput || !selectValue) return;
    
    const option = selectOptions ? selectOptions.querySelector(`.custom-select-option[data-value="${modelId}"]`) : null;
    if (option) {
        hiddenInput.value = modelId;
        selectValue.textContent = option.textContent;
        updateModelChips();
        checkModelAvailability(modelId);
    } else {
        showToast(`模型 ${modelId} 正在加载中，请稍后再试`, 'info');
    }
}

// 更新模型芯片状态
function updateModelChips() {
    const hiddenInput = document.getElementById('openrouter-api-model');
    if (!hiddenInput) return;
    
    const currentModel = hiddenInput.value;
    document.querySelectorAll('.model-chip').forEach(chip => {
        const chipModel = chip.getAttribute('onclick').match(/'([^']+)'/)?.[1];
        if (chipModel === currentModel) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
}

// 检查模型可用性
async function checkModelAvailability(modelId, apiKey = null) {
    if (!modelId) return;
    
    const config = getAPIConfig();
    const key = apiKey || config.apiKey;
    if (!key) return;
    
    showModelStatus('checking', '检测模型可用性...');

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
                'HTTP-Referer': window.location.href,
                'X-Title': 'Image Manager'
            },
            body: JSON.stringify({
                model: modelId,
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 1,
                stream: false
            })
        });

        if (response.ok) {
            showModelStatus('available', '模型可用', '可以正常使用此模型');
        } else {
            const errorData = await response.json();
            const errorMsg = errorData.error?.message || '';
            
            if (errorMsg.includes('not available in your region') || errorMsg.includes('region')) {
                showModelStatus('unavailable', '地区不可用', '此模型在你所在地区受限，请选择其他模型');
            } else if (errorMsg.includes('insufficient') || errorMsg.includes('quota') || errorMsg.includes('credits')) {
                showModelStatus('unavailable', '余额不足', '请充值后使用此模型');
            } else if (errorMsg.includes('rate limit')) {
                showModelStatus('unavailable', '请求限制', '请求过于频繁，请稍后再试');
            } else {
                showModelStatus('unavailable', '模型不可用', errorMsg);
            }
        }
    } catch (error) {
        showModelStatus('unavailable', '检测失败', error.message);
    }
}

// 显示模型状态
function showModelStatus(status, text, detail = '') {
    const statusDiv = document.getElementById('model-status');
    const iconSpan = document.getElementById('model-status-icon');
    const textDiv = document.getElementById('model-status-text');
    const detailDiv = document.getElementById('model-status-detail');

    if (!statusDiv || !iconSpan || !textDiv || !detailDiv) return;

    statusDiv.style.display = 'flex';
    statusDiv.className = `model-status ${status}`;

    if (status === 'checking') {
        iconSpan.innerHTML = '<div class="spinner"></div>';
    } else if (status === 'available') {
        iconSpan.innerHTML = '✓';
    } else if (status === 'unavailable') {
        iconSpan.innerHTML = '✕';
    }

    textDiv.textContent = text;
    detailDiv.textContent = detail;
    detailDiv.style.display = detail ? 'block' : 'none';
}

// 隐藏模型状态
function hideModelStatus() {
    const statusDiv = document.getElementById('model-status');
    if (statusDiv) {
        statusDiv.style.display = 'none';
    }
}

// 获取API配置
function getAPIConfig() {
    const configStr = localStorage.getItem('ai-api-config');
    return configStr ? JSON.parse(configStr) : {
        apiKey: '',
        model: 'openai/gpt-4o'
    };
}

// 调用AI API进行图片分析（流式输出）
async function callAIAnalysis(imageData, resultElement) {
    const config = getAPIConfig();
    if (!config.apiKey) {
        throw new Error('请先配置API密钥');
    }

    // 获取对话历史
    const messages = [];
    const messagesContainer = document.getElementById('ai-chat-messages');
    if (messagesContainer) {
        const messageElements = messagesContainer.querySelectorAll('.ai-message');
        messageElements.forEach((element, index) => {
            // 排除正在输入的消息
            const isUser = element.classList.contains('ai-user');
            const contentElement = isUser ? element.querySelector('div:first-child') : element.querySelector('div:last-child');
            if (contentElement) {
                messages.push({
                    role: isUser ? 'user' : 'assistant',
                    content: contentElement.textContent.trim()
                });
            }
        });
    }

    // 调用OpenRouter API并返回完整响应
    const fullResponse = await callOpenRouterAPI(imageData, resultElement, messages);
    return fullResponse;
}

// 调用OpenRouter API（流式输出）
async function callOpenRouterAPI(imageData, resultElement, existingMessages = []) {
    const config = getAPIConfig();
    
    // 验证模型是否支持图像分析
    const visionModels = [
        'openai/gpt-4o', 'openai/gpt-4o-mini', 'openai/gpt-4-turbo', 'openai/gpt-4-vision',
        'anthropic/claude-3-opus-20240229', 'anthropic/claude-3.5-sonnet',
        'deepseek-ai/deepseek-vl-7b-chat',
        'google/gemini-1.5-flash', 'google/gemini-1.5-pro', 'google/gemini-2.0-flash-exp:free',
        'llava', 'cogvlm', 'qwen-vl', 'internvl', 'pixtral'
    ];
    
    // 检查模型是否在支持列表中，或者模型ID包含视觉相关关键词
    const isVisionModel = visionModels.includes(config.model) || 
        config.model.toLowerCase().includes('vision') ||
        config.model.toLowerCase().includes('vl') ||
        config.model.toLowerCase().includes('gemini') ||
        config.model.toLowerCase().includes('claude-3') ||
        config.model.toLowerCase().includes('gpt-4o');
    
    if (imageData.length > 0 && !isVisionModel) {
        throw new Error('当前选择的模型不支持图像分析，请选择支持视觉的模型如OpenAI GPT-4o或DeepSeek VL');
    }
    
    // 准备请求数据
    const messages = existingMessages.length > 0 ? [...existingMessages] : [];
    
    // 如果没有对话历史，添加初始消息
    if (messages.length === 0) {
        messages.push({
            role: "user",
            content: [
                {
                    type: "text",
                    text: "请解析如下几张图片的内容，单独解析和分析汇总、比较，使用Markdown格式输出"
                }
            ]
        });
    } else {
        // 检查最后一条消息是否是用户消息
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role === 'user') {
            // 保留用户的最后一条消息，添加图片数据
            if (!lastMessage.content || typeof lastMessage.content === 'string') {
                // 如果最后一条消息是纯文本，将其转换为对象格式并添加图片
                lastMessage.content = [
                    {
                        type: "text",
                        text: lastMessage.content || "请分析这张图片"
                    }
                ];
            }
        } else {
            // 如果最后一条消息是AI消息，添加新的用户消息
            messages.push({
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "请解析如下几张图片的内容，单独解析和分析汇总、比较，使用Markdown格式输出"
                    }
                ]
            });
        }
    }

    // 添加图片数据到最后一条用户消息
    let lastUserMessage = null;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
            lastUserMessage = messages[i];
            break;
        }
    }
    
    if (!lastUserMessage) {
        // 如果没有用户消息，创建一个新的
        lastUserMessage = {
            role: "user",
            content: [
                {
                    type: "text",
                    text: "请解析如下几张图片的内容，单独解析和分析汇总、比较，使用Markdown格式输出"
                }
            ]
        };
        messages.push(lastUserMessage);
    }
    
    // 确保content是数组格式
    if (!lastUserMessage.content || typeof lastUserMessage.content === 'string') {
        lastUserMessage.content = [
            {
                type: "text",
                text: lastUserMessage.content || "请分析这张图片"
            }
        ];
    }
    
    // 添加图片数据
    for (const image of imageData) {
        lastUserMessage.content.push({
            type: "image_url",
            image_url: {
                url: image.data
            }
        });
    }

    // 流式请求
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
            model: config.model,
            messages: messages,
            stream: true
        })
    });

    if (!response.ok) {
        // 尝试获取详细的错误信息
        try {
            const errorData = await response.json();
            throw new Error(`API调用失败: ${response.status} ${response.statusText} - ${errorData.error?.message || '未知错误'}`);
        } catch (e) {
            throw new Error(`API调用失败: ${response.status} ${response.statusText}`);
        }
    }

    // 处理流式响应
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    resultElement.innerHTML = '';
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.substring(6);
                if (data === '[DONE]') {
                    return fullResponse;
                }
                try {
                    const json = JSON.parse(data);
                    if (json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content) {
                        const content = json.choices[0].delta.content;
                        fullResponse += content;
                        // 实时更新显示，但使用textContent以避免格式问题
                        resultElement.textContent = fullResponse;
                    }
                } catch (e) {
                    console.error('解析流式数据失败:', e);
                }
            }
        }
    }

    return fullResponse;
}

// 分析放大视图中的图片（使用流式输出）
async function analyzeZoomImage() {
    if (!compareImages || !compareImages.length || zoomIndex < 0 || zoomIndex >= compareImages.length) {
        showToast('没有可分析的图片', 'warning');
        return;
    }
    
    const currentImage = compareImages[zoomIndex];
    const aiBtn = document.getElementById('zoom-ai-btn');
    const aiResult = document.getElementById('zoom-ai-result');
    
    // 显示加载状态
    aiBtn.disabled = true;
    aiResult.innerHTML = '<div class="loading">正在分析图片，请稍候...</div>';
    aiResult.classList.add('loading');
    
    try {
        // 准备图片数据
        const imageData = [{
            name: currentImage.name,
            data: currentImage.data,
            category: currentImage.category
        }];
        
        // 调用AI API（流式输出）
        const fullResponse = await callAIAnalysis(imageData, aiResult);
        // 格式化AI返回的结果
        if (fullResponse && aiResult) {
            aiResult.innerHTML = formatAIResponse(fullResponse);
        }
        aiResult.classList.remove('loading');
    } catch (error) {
        console.error('AI分析失败:', error);
        aiResult.innerHTML = `<p>分析失败：${error.message}</p>`;
        aiResult.classList.remove('loading');
    } finally {
        aiBtn.disabled = false;
    }
}

// 初始化API配置
function initAPIConfig() {
    loadAPIConfig();
}

// 显示API配置模态窗口
function showAPIConfigModal() {
    const apiConfigModal = document.getElementById('api-config-modal');
    if (apiConfigModal) {
        apiConfigModal.style.display = 'flex';
        // 延迟调用loadAPIConfig，确保模态窗口已经显示，DOM元素已经加载
        setTimeout(() => {
            loadAPIConfig();
        }, 100);
    } else {
        showToast('API配置窗口未找到', 'error');
    }
}

// 关闭API配置模态窗口
function closeAPIConfigModal() {
    const apiConfigModal = document.getElementById('api-config-modal');
    if (apiConfigModal) {
        apiConfigModal.style.display = 'none';
    }
}

// AI分析窗口相关函数

// 打开AI分析窗口
function openAIAnalysis() {
    // 获取选中的图片
    const selectedImages = allImages.filter(img => selectedIds.has(img.id) && !img.isEmptyCategory);

    const config = getAPIConfig();
    if (!config.apiKey) {
        showToast('请先配置API密钥', 'warning');
        const apiConfigModal = document.getElementById('api-config-modal');
        if (apiConfigModal) {
            apiConfigModal.style.display = 'flex';
        }
        return;
    }

    // 显示分析窗口
    const aiAnalysisOverlay = document.getElementById('ai-analysis-overlay');
    if (!aiAnalysisOverlay) {
        showToast('AI分析窗口未找到', 'error');
        return;
    }
    aiAnalysisOverlay.style.display = 'block';

    // 更新模型名称显示
    const modelInfoElement = document.querySelector('#ai-analysis-overlay p');
    if (modelInfoElement) {
        const config = getAPIConfig();
        modelInfoElement.textContent = `基于 ${config.model} 模型，提供专业的图片分析和对话`;
    }

    // 加载对话列表
    loadConversationList();
    
    // 初始化搜索功能
    initConversationSearch();

    if (!selectedImages || selectedImages.length === 0) {
        // 不选择图片进入，默认选择第一个历史对话
        const conversations = getConversationList();
        if (conversations.length > 0) {
            // 选择第一个对话
            selectConversation(conversations[0].id);
        } else {
            // 没有历史对话，显示空状态
            const aiChatMessages = document.getElementById('ai-chat-messages');
            if (aiChatMessages) {
                aiChatMessages.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 40px;">
                        <div style="font-size: 64px; margin-bottom: 24px;">🤖</div>
                        <h3 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 600; color: #1e293b;">欢迎使用AI智能分析</h3>
                        <p style="margin: 0 0 32px 0; font-size: 16px; color: #64748b; max-width: 400px; line-height: 1.6;">
                            请先选择要分析的图片，然后开始新的对话。
                        </p>
                    </div>
                `;
            }
            
            // 清空图片显示
            const aiImageCount = document.getElementById('ai-image-count');
            if (aiImageCount) {
                aiImageCount.textContent = '0张';
            }
            
            const imagesContainer = document.getElementById('ai-selected-images');
            if (imagesContainer) {
                imagesContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #94a3b8; font-size: 14px;">
                        暂无选中的图片
                    </div>
                `;
            }
        }
    } else {
        // 选择图片进入，新建一个对话但不发送消息
        // 保存当前选中的图片到全局变量
        currentSelectedImages = selectedImages;
        
        // 生成对话标题（由图片名称拼接而成）
        const imageNames = selectedImages.map(img => removeFileExtension(img.name));
        let conversationTitle = imageNames.join('、');
        // 如果标题太长，显示不下就用...显示
        if (conversationTitle.length > 20) {
            conversationTitle = conversationTitle.substring(0, 20) + '...';
        }
        
        // 创建新对话
        const newConversation = {
            id: Date.now().toString(),
            title: conversationTitle,
            messages: [],
            images: selectedImages.map(img => ({
                id: img.id,
                name: img.name,
                data: img.data,
                category: img.category
            })),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // 保存新对话
        saveConversationHistory(newConversation);
        
        // 选择新创建的对话
        currentConversation = newConversation;
        selectConversation(newConversation.id);
        
        // 重新加载对话列表
        loadConversationList();
    }
}

// 关闭AI分析窗口
function closeAIAnalysis() {
    const aiAnalysisOverlay = document.getElementById('ai-analysis-overlay');
    if (aiAnalysisOverlay) {
        aiAnalysisOverlay.style.display = 'none';
    }
}

// 加载对话列表
function loadConversationList(searchKeyword = '') {
    console.log('Loading conversation list...');
    const conversationItems = document.getElementById('ai-conversation-items');
    if (!conversationItems) {
        console.log('ai-conversation-items element not found');
        return;
    }
    
    let conversations = getConversationList();
    
    // 应用搜索过滤
    if (searchKeyword) {
        const keyword = searchKeyword.toLowerCase();
        conversations = conversations.filter(conv => 
            conv.title.toLowerCase().includes(keyword) ||
            (conv.messages && conv.messages.some(msg => 
                msg.content.toLowerCase().includes(keyword)
            ))
        );
    }
    
    console.log('Retrieved conversations:', conversations);
    console.log('Conversation count:', conversations.length);
    
    if (conversations.length === 0) {
        console.log('No conversations found, showing empty state');
        conversationItems.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 14px;">
                ${searchKeyword ? '未找到匹配的对话' : '暂无对话历史'}
            </div>
        `;
        return;
    }
    
    console.log('Rendering conversation list...');
    conversationItems.innerHTML = conversations.map(conv => {
        const imageCount = conv.images ? conv.images.length : 0;
        return `
        <div class="conversation-item" data-id="${conv.id}" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: white; border-radius: 8px; cursor: pointer; transition: all 0.2s; border: 2px solid transparent;" onclick="selectConversation('${conv.id}')">
            <div style="flex: 1; min-width: 0;">
                <div style="font-size: 14px; font-weight: 500; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${conv.title}</div>
                <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #94a3b8; margin-top: 4px;">
                    ${new Date(conv.updatedAt).toLocaleDateString()}
                    ${imageCount > 0 ? `<span style="font-size: 12px; font-weight: normal; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 10px;">${imageCount}张图片</span>` : ''}
                </div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <button onclick="event.stopPropagation(); renameConversation('${conv.id}')" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px; font-size: 14px; transition: color 0.2s;" title="重命名对话">
                    ✏️
                </button>
                <button onclick="event.stopPropagation(); deleteConversationFromUI('${conv.id}')" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px; font-size: 16px; transition: color 0.2s;" title="删除对话">
                    ×
                </button>
            </div>
        </div>
        `;
    }).join('');
    console.log('Conversation list rendered successfully');
}

// 初始化搜索功能
function initConversationSearch() {
    const searchInput = document.getElementById('ai-conversation-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            loadConversationList(this.value);
        });
    }
}

// 选择对话
function selectConversation(conversationId) {
    console.log('Selecting conversation:', conversationId);
    const conversation = loadConversationHistory(conversationId);
    if (!conversation) {
        showToast('对话未找到', 'error');
        return;
    }
    
    console.log('Loaded conversation:', conversation);
    console.log('Messages count:', conversation.messages ? conversation.messages.length : 0);
    console.log('Images count:', conversation.images ? conversation.images.length : 0);
    
    currentConversation = conversation;
    
    // 更新对话列表的高亮状态
    document.querySelectorAll('.conversation-item').forEach(item => {
        if (item.dataset.id === conversationId) {
            item.style.borderColor = '#6366f1';
            item.style.background = 'rgba(99, 102, 241, 0.05)';
        } else {
            item.style.borderColor = 'transparent';
            item.style.background = 'white';
        }
    });
    
    // 显示对话消息
    const aiChatMessages = document.getElementById('ai-chat-messages');
    if (aiChatMessages) {
        // 清空之前的消息
        aiChatMessages.innerHTML = '';
        
        if (!conversation.messages || conversation.messages.length === 0) {
            console.log('No messages found, showing empty state');
            aiChatMessages.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 40px;">
                    <div style="font-size: 64px; margin-bottom: 24px;">💬</div>
                    <h3 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 600; color: #1e293b;">请开始您的对话</h3>
                    <p style="margin: 0 0 32px 0; font-size: 16px; color: #64748b; max-width: 400px; line-height: 1.6;">
                        这是一个新的对话，请输入您的问题开始对话。
                    </p>
                </div>
            `;
        } else {
            console.log('Rendering', conversation.messages.length, 'messages');
            const messagesHtml = conversation.messages.map((msg, index) => {
                console.log(`Rendering message ${index}:`, msg);
                if (msg.role === 'user') {
                    return `
                        <div class="ai-message ai-user" style="display: flex; gap: 12px; justify-content: flex-end; margin-bottom: 20px;">
                            <div style="flex: 1; padding: 12px 16px; background: #dbeafe; color: #000000; border-radius: 18px 18px 4px 18px; font-size: 14px; line-height: 1.6; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15); border: 1px solid #3b82f6;">
                                ${escapeHtml(msg.content)}
                            </div>
                        </div>
                    `;
                } else {
                    const messageId = `ai-message-${index}`;
                    return `
                        <div class="ai-message ai-assistant" style="display: flex; gap: 12px; justify-content: flex-start; margin-bottom: 20px;">
                            <div style="flex: 1; padding: 12px 16px; background: #f8fafc; color: #1e293b; border-radius: 18px 18px 18px 4px; font-size: 14px; line-height: 1.6; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                                <div id="${messageId}-content">${formatAIResponse(msg.content)}</div>
                                <div style="display: flex; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
                                    <button onclick="copyAIMessage('${messageId}')" style="padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; color: #475569; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                        </svg>
                                        复制
                                    </button>
                                    <button onclick="downloadAIMessageAsPDF('${messageId}')" style="padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; color: #475569; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                            <polyline points="7 10 12 15 17 10"></polyline>
                                            <line x1="12" y1="15" x2="12" y2="3"></line>
                                        </svg>
                                        下载PDF
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }
            }).join('');
            
            aiChatMessages.innerHTML = messagesHtml;
            console.log('Messages HTML length:', messagesHtml.length);
            
            // 滚动到底部
            aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
        }
    }
    
    // 显示对话的图片
    const conversationImages = conversation.images || [];
    
    // 更新图片数量显示
    const aiImageCount = document.getElementById('ai-image-count');
    if (aiImageCount) {
        aiImageCount.textContent = `${conversationImages.length}张`;
    }
    
    // 显示选中的图片
          const imagesContainer = document.getElementById('ai-selected-images');
          if (imagesContainer) {
              // 修改容器样式，设置为flex row wrap布局
              imagesContainer.style.display = 'flex';
              imagesContainer.style.flexDirection = 'row';
              imagesContainer.style.flexWrap = 'wrap';
              imagesContainer.style.gap = '16px';
              imagesContainer.style.alignContent = 'flex-start'; // 确保内容从顶部开始排列
              
              // 添加响应式样式，当宽度缩减到270px时，显示一张图片
              const styleId = 'ai-images-responsive-style';
              let styleElement = document.getElementById(styleId);
              if (!styleElement) {
                  styleElement = document.createElement('style');
                  styleElement.id = styleId;
                  document.head.appendChild(styleElement);
              }
              styleElement.textContent = `
                  @media (max-width: 270px) {
                      #ai-selected-images > div {
                          width: 100% !important;
                      }
                  }
              `;
              
              imagesContainer.innerHTML = conversationImages.map((img, index) => `
                  <div style="display: flex; flex-direction: column; gap: 12px; background: white; padding: 16px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: all 0.3s; width: calc(50% - 8px);">
                      <div style="position: relative; cursor: pointer; border-radius: 8px; overflow: hidden; border: 2px solid #e2e8f0; transition: all 0.3s; height: 120px;" onclick="zoomAIImage('${img.data}')">
                          <img src="${img.data}" alt="${img.name}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s;">
                          <div style="position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">${index + 1}</div>
                          <div style="position: absolute; top: 8px; right: 8px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px;">${img.category || '未分类'}</div>
                      </div>
                      <div style="font-size: 14px; color: #334155; line-height: 1.4;">
                          <div style="font-weight: 600; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${removeFileExtension(img.name)}</div>
                      </div>
                  </div>
              `).join('');
          }
}

// HTML转义函数
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 开始新的分析
function startNewAnalysis() {
    if (!currentSelectedImages || currentSelectedImages.length === 0) {
        showToast('没有可分析的图片', 'warning');
        return;
    }
    
    // 创建新对话
    currentConversation = createNewConversation(currentSelectedImages);
    
    // 更新对话列表
    loadConversationList();
    
    // 选择新创建的对话
    selectConversation(currentConversation.id);
    
    // 开始分析图片
    analyzeImageWithAI(currentSelectedImages);
}

// 从UI创建新对话
function createNewConversationFromUI() {
    // 创建新对话，即使没有图片
    currentConversation = createNewConversation(currentSelectedImages || []);
    
    // 更新对话列表
    loadConversationList();
    
    // 选择新创建的对话
    selectConversation(currentConversation.id);
}

// 从UI删除对话
function deleteConversationFromUI(conversationId) {
    if (confirm('确定要删除这个对话吗？')) {
        // 在删除前获取对话列表，找到被删除对话的位置
        const conversationsBeforeDelete = getConversationList();
        const deletedIndex = conversationsBeforeDelete.findIndex(conv => conv.id === conversationId);
        
        deleteConversationHistory(conversationId);
        
        // 如果删除的是当前对话，清空聊天消息
        if (currentConversation && currentConversation.id === conversationId) {
            currentConversation = null;
            const aiChatMessages = document.getElementById('ai-chat-messages');
            if (aiChatMessages) {
                aiChatMessages.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 40px;">
                        <div style="font-size: 64px; margin-bottom: 24px;">🤖</div>
                        <h3 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 600; color: #1e293b;">欢迎使用AI智能分析</h3>
                        <p style="margin: 0 0 32px 0; font-size: 16px; color: #64748b; max-width: 400px; line-height: 1.6;">
                            选择左侧的对话历史继续之前的对话，或点击"新对话"开始新的分析。
                        </p>
                    </div>
                `;
            }
        }
        
        // 更新对话列表
        loadConversationList();
        
        // 获取剩余的对话列表
        const remainingConversations = getConversationList();
        
        if (remainingConversations.length > 0) {
            // 尝试聚焦到下一个对话，如果不存在则聚焦到上一个
            let conversationToFocus = null;
            if (deletedIndex < remainingConversations.length) {
                // 有下一个对话，聚焦到下一个
                conversationToFocus = remainingConversations[deletedIndex];
            } else if (remainingConversations.length > 0) {
                // 没有下一个对话，聚焦到最后一个
                conversationToFocus = remainingConversations[remainingConversations.length - 1];
            }
            
            // 聚焦到找到的对话
            if (conversationToFocus) {
                selectConversation(conversationToFocus.id);
            }
        } else {
            // 如果删除的是最后一个对话，清除选中的图片区域内的信息
            const aiImageCount = document.getElementById('ai-image-count');
            if (aiImageCount) {
                aiImageCount.textContent = '0张';
            }
            
            const imagesContainer = document.getElementById('ai-selected-images');
            if (imagesContainer) {
                imagesContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #94a3b8; font-size: 14px;">
                        暂无选中的图片
                    </div>
                `;
            }
        }
        
        showToast('对话已删除', 'success');
    }
}

// 重命名对话
function renameConversation(conversationId) {
    const conversation = loadConversationHistory(conversationId);
    if (!conversation) {
        showToast('对话未找到', 'error');
        return;
    }
    
    const newTitle = prompt('请输入新的对话标题：', conversation.title);
    if (newTitle && newTitle.trim()) {
        conversation.title = newTitle.trim();
        conversation.updatedAt = new Date().toISOString();
        saveConversationHistory(conversation);
        loadConversationList();
        showToast('对话已重命名', 'success');
    }
}

// 放大AI分析窗口中的图片
function zoomAIImage(imageData) {
    const aiImageZoomImg = document.getElementById('ai-image-zoom-img');
    const aiImageZoomOverlay = document.getElementById('ai-image-zoom-overlay');
    if (aiImageZoomImg && aiImageZoomOverlay) {
        aiImageZoomImg.src = imageData;
        aiImageZoomOverlay.style.display = 'flex';
    }
}

// 关闭图片放大层
function closeAIImageZoom() {
    const aiImageZoomOverlay = document.getElementById('ai-image-zoom-overlay');
    if (aiImageZoomOverlay) {
        aiImageZoomOverlay.style.display = 'none';
    }
}

// 格式化AI返回的文本为结构化HTML
function formatAIResponse(text) {
    if (!text) return '';
    
    // 使用marked库解析Markdown
    if (typeof marked !== 'undefined') {
        // 配置marked选项
        marked.setOptions({
            breaks: true,
            gfm: true
        });
        
        // 解析Markdown并返回HTML
        const html = marked.parse(text);
        return html;
    }
    
    // 如果marked库不可用，使用备用格式化方法
    let formattedText = text.replace(/\n/g, '<br>');
    
    // 处理标题（### 标题）
    formattedText = formattedText.replace(/^### (.*?)$/gm, '<h3 style="margin: 16px 0 8px 0; font-size: 18px; font-weight: 600; color: #1e293b;">$1</h3>');
    formattedText = formattedText.replace(/^#### (.*?)$/gm, '<h4 style="margin: 14px 0 6px 0; font-size: 16px; font-weight: 600; color: #334155;">$1</h4>');
    
    // 处理列表
    formattedText = formattedText.replace(/^- (.*?)$/gm, '<div style="margin: 4px 0; padding-left: 20px; position: relative;"><span style="position: absolute; left: 0; top: 6px; width: 6px; height: 6px; background: #6366f1; border-radius: 50%;"></span>$1</div>');
    formattedText = formattedText.replace(/^\d+\. (.*?)$/gm, '<div style="margin: 4px 0; padding-left: 24px; position: relative;"><span style="position: absolute; left: 0; top: 2px; font-size: 14px; font-weight: 500; color: #6366f1;">$&</span></div>');
    
    // 处理粗体
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 600; color: #1e293b;">$1</strong>');
    
    // 处理段落
    formattedText = formattedText.replace(/(<br>){2,}/g, '</p><p style="margin: 8px 0; line-height: 1.6;">');
    formattedText = '<p style="margin: 8px 0; line-height: 1.6;">' + formattedText + '</p>';
    
    // 移除多余的空段落
    formattedText = formattedText.replace(/<p[^>]*><\/p>/g, '');
    
    return formattedText;
}

// 分析图片
async function analyzeImageWithAI(selectedImages) {
    const messagesContainer = document.getElementById('ai-chat-messages');
    const sendBtn = document.getElementById('ai-send-btn');
    const input = document.getElementById('ai-input');

    if (!messagesContainer || !sendBtn || !input) {
        showToast('AI分析窗口元素未找到', 'error');
        return;
    }

    // 保存当前对话ID，确保结果保存到正确的对话中
    const currentConversationId = currentConversation ? currentConversation.id : null;

    // 清空消息容器
    messagesContainer.innerHTML = '';

    // 显示AI正在分析的消息
    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'ai-message ai-assistant';
    loadingMessage.style.cssText = `
        display: flex;
        gap: 12px;
        justify-content: flex-start;
        animation: pulse 1.5s infinite;
        margin-bottom: 20px;
    `;
    loadingMessage.innerHTML = `
        <div style="flex: 1; padding: 12px 16px; background: #f8fafc; border-radius: 18px 18px 18px 4px; font-size: 14px; line-height: 1.6; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
            <div style="display: flex; gap: 10px;">
                <div style="width: 10px; height: 10px; border-radius: 50%; background: #94a3b8; animation: pulse 1.5s infinite;"></div>
                <div style="width: 10px; height: 10px; border-radius: 50%; background: #94a3b8; animation: pulse 1.5s infinite; animation-delay: 0.2s;"></div>
                <div style="width: 10px; height: 10px; border-radius: 50%; background: #94a3b8; animation: pulse 1.5s infinite; animation-delay: 0.4s;"></div>
            </div>
        </div>
    `;
    messagesContainer.appendChild(loadingMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // 禁用输入和发送按钮
    sendBtn.disabled = true;
    input.disabled = true;

    try {
        // 准备图片数据
        const imageData = selectedImages.map(img => ({
            name: img.name,
            data: img.data,
            category: img.category
        }));

        // 创建AI回复元素
        const aiResponseElement = document.createElement('div');
        aiResponseElement.className = 'ai-message ai-assistant';
        aiResponseElement.style.cssText = `
            display: flex;
            gap: 12px;
            justify-content: flex-start;
            margin-bottom: 20px;
        `;
        const messageId = `ai-message-${Date.now()}`;
        aiResponseElement.innerHTML = `
            <div style="flex: 1; padding: 12px 16px; background: #f8fafc; color: #1e293b; border-radius: 18px 18px 18px 4px; font-size: 14px; line-height: 1.6; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                <div id="${messageId}-content"></div>
                <div id="${messageId}-actions" style="display: none; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
                    <button onclick="copyAIMessage('${messageId}')" style="padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; color: #475569; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        复制
                    </button>
                    <button onclick="downloadAIMessageAsPDF('${messageId}')" style="padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; color: #475569; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        下载PDF
                    </button>
                </div>
            </div>
        `;

        // 移除加载消息，添加AI回复元素
        messagesContainer.removeChild(loadingMessage);
        messagesContainer.appendChild(aiResponseElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // 调用AI API（流式输出）
        const resultElement = aiResponseElement.querySelector(`#${messageId}-content`);
        const actionsElement = aiResponseElement.querySelector(`#${messageId}-actions`);
        const fullResponse = await callAIAnalysis(imageData, resultElement);
        
        // 格式化AI返回的结果
        if (fullResponse && resultElement) {
            resultElement.innerHTML = formatAIResponse(fullResponse);
            if (actionsElement) {
                actionsElement.style.display = 'flex';
            }
            
            // 保存对话历史
            if (currentConversationId) {
                // 加载原始对话
                const originalConversation = loadConversationHistory(currentConversationId);
                if (originalConversation) {
                    // 添加AI回复
                    originalConversation.messages.push({
                        role: 'assistant',
                        content: fullResponse
                    });
                    
                    // 更新对话标题（如果是第一条消息）
                    if (originalConversation.title === '新对话') {
                        originalConversation.title = '图片分析结果';
                    }
                    
                    // 更新时间戳
                    originalConversation.updatedAt = new Date().toISOString();
                    
                    // 保存到localStorage
                    saveConversationHistory(originalConversation);
                    
                    // 更新对话列表
                    loadConversationList();
                    
                    // 如果当前显示的是原始对话，更新显示
                    if (currentConversation && currentConversation.id === currentConversationId) {
                        currentConversation = originalConversation;
                        selectConversation(currentConversationId);
                    }
                }
            }
        }
    } catch (error) {
        console.error('AI分析失败:', error);
        messagesContainer.innerHTML = `
            <div class="ai-message ai-assistant" style="display: flex; gap: 12px; justify-content: flex-start; margin-bottom: 20px;">
                <div style="flex: 1; padding: 12px 16px; background: #fef2f2; color: #b91c1c; border-radius: 18px 18px 18px 4px; font-size: 14px; line-height: 1.6; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #fecaca;">
                    <h4 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">分析失败</h4>
                    <p style="margin: 0 0 12px 0; line-height: 1.6;">${error.message}</p>
                    <p style="margin: 0; font-size: 14px; opacity: 0.8;">请检查API配置是否正确，或稍后重试。</p>
                </div>
            </div>
        `;
    } finally {
        // 启用输入和发送按钮
        sendBtn.disabled = false;
        input.disabled = false;
        input.focus();
    }
}

// 发送AI消息
async function sendAIMessage() {
    const input = document.getElementById('ai-input');
    const message = input?.value.trim();
    
    if (!message) return;
    
    // 检查是否有当前对话
    if (!currentConversation) {
        showToast('请先选择或创建一个对话', 'warning');
        return;
    }

    const messagesContainer = document.getElementById('ai-chat-messages');
    const sendBtn = document.getElementById('ai-send-btn');

    if (!messagesContainer || !sendBtn) {
        showToast('AI分析窗口元素未找到', 'error');
        return;
    }

    // 保存当前对话ID，确保结果保存到正确的对话中
    const currentConversationId = currentConversation.id;

    // 清空对话框内的提示信息，只显示用户和AI的对话信息
    messagesContainer.innerHTML = '';

    // 显示用户消息
    const userMessage = document.createElement('div');
    userMessage.className = 'ai-message ai-user';
    userMessage.style.cssText = `
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-bottom: 20px;
    `;
    userMessage.innerHTML = `
        <div style="flex: 1; padding: 12px 16px; background: #dbeafe; color: #000000; border-radius: 18px 18px 4px 18px; font-size: 14px; line-height: 1.6; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15); border: 1px solid #3b82f6;">
            ${message}
        </div>
    `;
    messagesContainer.appendChild(userMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // 清空输入
    if (input) {
        input.value = '';
    }

    // 显示AI正在回复的消息
    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'ai-message ai-assistant';
    loadingMessage.style.cssText = `
        display: flex;
        gap: 12px;
        justify-content: flex-start;
        animation: pulse 1.5s infinite;
        margin-bottom: 20px;
    `;
    loadingMessage.innerHTML = `
        <div style="flex: 1; padding: 12px 16px; background: #f8fafc; border-radius: 18px 18px 18px 4px; font-size: 14px; line-height: 1.6; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
            <div style="display: flex; gap: 10px;">
                <div style="width: 10px; height: 10px; border-radius: 50%; background: #94a3b8; animation: pulse 1.5s infinite;"></div>
                <div style="width: 10px; height: 10px; border-radius: 50%; background: #94a3b8; animation: pulse 1.5s infinite; animation-delay: 0.2s;"></div>
                <div style="width: 10px; height: 10px; border-radius: 50%; background: #94a3b8; animation: pulse 1.5s infinite; animation-delay: 0.4s;"></div>
            </div>
        </div>
    `;
    messagesContainer.appendChild(loadingMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // 禁用输入和发送按钮
    sendBtn.disabled = true;
    if (input) {
        input.disabled = true;
    }

    try {
        // 创建AI回复元素
        const aiResponseElement = document.createElement('div');
        aiResponseElement.className = 'ai-message ai-assistant';
        aiResponseElement.style.cssText = `
            display: flex;
            gap: 12px;
            justify-content: flex-start;
            margin-bottom: 20px;
        `;
        const messageId = `ai-message-${Date.now()}`;
        aiResponseElement.innerHTML = `
            <div style="flex: 1; padding: 12px 16px; background: #f8fafc; color: #1e293b; border-radius: 18px 18px 18px 4px; font-size: 14px; line-height: 1.6; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                <div id="${messageId}-content"></div>
                <div id="${messageId}-actions" style="display: none; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
                    <button onclick="copyAIMessage('${messageId}')" style="padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; color: #475569; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        复制
                    </button>
                    <button onclick="downloadAIMessageAsPDF('${messageId}')" style="padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; color: #475569; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        下载PDF
                    </button>
                </div>
            </div>
        `;

        // 移除加载消息，添加AI回复元素
        messagesContainer.removeChild(loadingMessage);
        messagesContainer.appendChild(aiResponseElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // 准备请求数据
        const config = getAPIConfig();
        
        // 获取历史消息
        const messages = [];
        const messageElements = messagesContainer.querySelectorAll('.ai-message');
        
        messageElements.forEach((element, index) => {
            if (index < messageElements.length - 1) { // 排除当前正在输入的消息
                const isUser = element.classList.contains('ai-user');
                const contentElement = isUser ? element.querySelector('div:first-child') : element.querySelector('div:last-child');
                if (contentElement) {
                    messages.push({
                        role: isUser ? 'user' : 'assistant',
                        content: contentElement.textContent.trim()
                    });
                }
            }
        });

        // 调用AI API（流式输出）
        const resultElement = aiResponseElement.querySelector(`#${messageId}-content`);
        const actionsElement = aiResponseElement.querySelector(`#${messageId}-actions`);
        
        // 获取当前对话的图片信息
        const conversationImages = currentConversation.images || [];
        console.log('Current conversation images:', conversationImages.length);
        
        // 检查是否是第一次对话（没有消息历史）
        const isFirstMessage = !currentConversation.messages || currentConversation.messages.length === 0;
        console.log('Is first message:', isFirstMessage);
        
        // 只有在第一次对话时才上传图片信息，后续对话基于该图片继续聊天
        const imagesToSend = isFirstMessage ? conversationImages : [];
        console.log('Images to send:', imagesToSend.length);
        
        const fullResponse = await callOpenRouterAPI(imagesToSend, resultElement, messages);
        
        // 格式化AI返回的结果
        console.log('Full response received:', fullResponse ? 'yes' : 'no');
        console.log('Current conversation:', currentConversation);
        if (fullResponse && resultElement) {
            resultElement.innerHTML = formatAIResponse(fullResponse);
            
            // 保存对话历史
            if (currentConversationId) {
                console.log('Saving conversation history...');
                
                // 加载原始对话
                const originalConversation = loadConversationHistory(currentConversationId);
                if (originalConversation) {
                    console.log('Original conversation found:', originalConversation.id);
                    console.log('Messages before:', originalConversation.messages);
                    
                    // 添加用户消息
                    originalConversation.messages.push({
                        role: 'user',
                        content: message
                    });
                    
                    // 添加AI回复
                    originalConversation.messages.push({
                        role: 'assistant',
                        content: fullResponse
                    });
                    
                    console.log('Messages after:', originalConversation.messages);
                    
                    // 更新对话标题（如果是第一条消息）
                    if (originalConversation.title === '新对话') {
                        originalConversation.title = message.substring(0, 20) + (message.length > 20 ? '...' : '');
                    }
                    
                    // 更新时间戳
                    originalConversation.updatedAt = new Date().toISOString();
                    
                    // 保存到localStorage
                    saveConversationHistory(originalConversation);
                    console.log('Conversation saved to localStorage');
                    
                    // 更新对话列表
                    loadConversationList();
                    
                    // 如果当前显示的是原始对话，更新显示
                    if (currentConversation && currentConversation.id === currentConversationId) {
                        currentConversation = originalConversation;
                    }
                }
            } else {
                console.log('No current conversation to save to');
            }
        } else {
            console.log('Cannot save: fullResponse or resultElement is missing');
        }
    } catch (error) {
        console.error('AI回复失败:', error);
        messagesContainer.innerHTML += `
            <div class="ai-message ai-assistant" style="display: flex; gap: 12px; justify-content: flex-start; margin-bottom: 20px;">
                <div style="flex: 1; padding: 12px 16px; background: #fef2f2; color: #b91c1c; border-radius: 18px 18px 18px 4px; font-size: 14px; line-height: 1.6; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #fecaca;">
                    <h4 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">回复失败</h4>
                    <p style="margin: 0 0 12px 0; line-height: 1.6;">${error.message}</p>
                    <p style="margin: 0; font-size: 14px; opacity: 0.8;">请检查API配置是否正确，或稍后重试。</p>
                </div>
            </div>
        `;
    } finally {
        // 启用输入和发送按钮
        sendBtn.disabled = false;
        if (input) {
            input.disabled = false;
            input.focus();
        }
    }
}

// 为AI分析窗口添加键盘事件
function initAIAnalysisEvents() {
    // 回车键发送消息
    const aiInput = document.getElementById('ai-input');
    if (aiInput) {
        aiInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendAIMessage();
            }
        });
    }

    // 关闭图片放大层
    const aiImageZoomClose = document.getElementById('ai-image-zoom-close');
    if (aiImageZoomClose) {
        aiImageZoomClose.addEventListener('click', closeAIImageZoom);
    }

    // 点击放大层背景关闭
    const aiImageZoomOverlay = document.getElementById('ai-image-zoom-overlay');
    if (aiImageZoomOverlay) {
        aiImageZoomOverlay.addEventListener('click', function(e) {
            if (e.target === this) {
                closeAIImageZoom();
            }
        });
    }
}

// 复制AI消息内容
function copyAIMessage(messageId) {
    const contentElement = document.getElementById(`${messageId}-content`);
    if (!contentElement) {
        showToast('消息内容未找到', 'error');
        return;
    }
    
    const text = contentElement.innerText || contentElement.textContent;
    navigator.clipboard.writeText(text).then(() => {
        showToast('已复制到剪贴板', 'success');
    }).catch(err => {
        console.error('复制失败:', err);
        showToast('复制失败', 'error');
    });
}

// 下载AI消息为PDF
function downloadAIMessageAsPDF(messageId) {
    const contentElement = document.getElementById(`${messageId}-content`);
    if (!contentElement) {
        showToast('消息内容未找到', 'error');
        return;
    }
    
    try {
        // 检查html2canvas是否可用
        if (typeof html2canvas === 'undefined') {
            console.error('html2canvas库未加载');
            showToast('PDF库加载失败，请刷新页面重试', 'error');
            return;
        }
        
        // 检查jspdf是否可用
        if (typeof window.jspdf === 'undefined') {
            console.error('jspdf库未加载');
            showToast('PDF库加载失败，请刷新页面重试', 'error');
            return;
        }
        
        const { jsPDF } = window.jspdf;
        
        showToast('正在生成PDF，请稍候...', 'info');
        
        // 创建临时容器来渲染内容
        const tempContainer = document.createElement('div');
        tempContainer.style.cssText = `
            position: fixed;
            top: -9999px;
            left: -9999px;
            width: 794px;
            padding: 40px;
            background: white;
            font-family: 'Microsoft YaHei', 'SimHei', Arial, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #1e293b;
        `;
        
        // 复制内容到临时容器
        tempContainer.innerHTML = contentElement.innerHTML;
        document.body.appendChild(tempContainer);
        
        // 使用html2canvas转换为canvas
        html2canvas(tempContainer, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        }).then(canvas => {
            // 创建PDF文档
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 210;
            const pageHeight = 297;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            let heightLeft = imgHeight;
            let position = 0;
            
            // 添加图片到PDF
            doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
            
            // 如果内容超过一页，添加新页面
            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                doc.addPage();
                doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }
            
            // 清理临时容器
            document.body.removeChild(tempContainer);
            
            // 保存PDF
            const fileName = `AI回复_${new Date().toLocaleString('zh-CN').replace(/[\/\s:]/g, '-')}.pdf`;
            doc.save(fileName);
            showToast('PDF下载成功', 'success');
        }).catch(error => {
            console.error('PDF生成失败:', error);
            document.body.removeChild(tempContainer);
            showToast('PDF生成失败', 'error');
        });
    } catch (error) {
        console.error('PDF下载失败:', error);
        showToast('PDF下载失败', 'error');
    }
}

// 解析Markdown内容为pdfmake格式
function parseMarkdownToPdfMake(markdown) {
    const content = [];
    const lines = markdown.split('\n');
    let currentList = null;
    let currentCode = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // 处理代码块
        if (line.startsWith('```')) {
            if (currentCode) {
                // 结束代码块
                content.push({
                    text: currentCode.join('\n'),
                    style: 'code'
                });
                currentCode = null;
            } else {
                // 开始代码块
                currentCode = [];
            }
            continue;
        }
        
        if (currentCode) {
            currentCode.push(line);
            continue;
        }
        
        // 处理标题
        if (line.startsWith('### ')) {
            if (currentList) {
                content.push({ ul: currentList, style: 'list' });
                currentList = null;
            }
            content.push({
                text: line.substring(4),
                style: 'heading3'
            });
            continue;
        }
        
        if (line.startsWith('#### ')) {
            if (currentList) {
                content.push({ ul: currentList, style: 'list' });
                currentList = null;
            }
            content.push({
                text: line.substring(5),
                style: 'heading2'
            });
            continue;
        }
        
        // 处理列表
        if (line.startsWith('- ')) {
            if (!currentList) {
                currentList = [];
            }
            currentList.push(line.substring(2));
            continue;
        }
        
        // 处理数字列表
        const numberedMatch = line.match(/^(\d+)\. (.+)$/);
        if (numberedMatch) {
            if (!currentList) {
                currentList = [];
            }
            currentList.push(numberedMatch[2]);
            continue;
        }
        
        // 结束列表
        if (currentList && line === '') {
            content.push({ ul: currentList, style: 'list' });
            currentList = null;
            continue;
        }
        
        // 处理普通文本
        if (line !== '') {
            if (currentList) {
                content.push({ ul: currentList, style: 'list' });
                currentList = null;
            }
            
            // 处理粗体
            let text = line;
            const boldMatches = text.match(/\*\*(.*?)\*\*/g);
            if (boldMatches) {
                const textParts = [];
                let lastIndex = 0;
                boldMatches.forEach(match => {
                    const matchIndex = text.indexOf(match);
                    if (matchIndex > lastIndex) {
                        textParts.push(text.substring(lastIndex, matchIndex));
                    }
                    textParts.push({
                        text: match.substring(2, match.length - 2),
                        bold: true
                    });
                    lastIndex = matchIndex + match.length;
                });
                if (lastIndex < text.length) {
                    textParts.push(text.substring(lastIndex));
                }
                content.push({ text: textParts, style: 'normal' });
            } else {
                content.push({ text: text, style: 'normal' });
            }
        }
    }
    
    // 处理未结束的列表
    if (currentList) {
        content.push({ ul: currentList, style: 'list' });
    }
    
    return content;
}

// 解析HTML内容为pdfmake格式
function parseHtmlToPdfMake(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const content = [];
    
    function processNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text) {
                content.push({ text: text });
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            
            switch (tagName) {
                case 'h1':
                case 'h2':
                case 'h3':
                case 'h4':
                case 'h5':
                case 'h6':
                    const headingText = node.textContent.trim();
                    if (headingText) {
                        content.push({
                            text: headingText,
                            style: 'heading',
                            fontSize: tagName === 'h1' ? 16 : tagName === 'h2' ? 14 : tagName === 'h3' ? 12 : 10
                        });
                    }
                    break;
                    
                case 'p':
                    const paragraphChildren = [];
                    processChildren(node, paragraphChildren);
                    if (paragraphChildren.length > 0) {
                        content.push({
                            text: paragraphChildren,
                            style: 'normal',
                            margin: [0, 5, 0, 5]
                        });
                    }
                    break;
                    
                case 'strong':
                case 'b':
                    const boldChildren = [];
                    processChildren(node, boldChildren);
                    if (boldChildren.length > 0) {
                        content.push({ text: boldChildren, bold: true });
                    }
                    break;
                    
                case 'em':
                case 'i':
                    const italicChildren = [];
                    processChildren(node, italicChildren);
                    if (italicChildren.length > 0) {
                        content.push({ text: italicChildren, italics: true });
                    }
                    break;
                    
                case 'u':
                    const underlineChildren = [];
                    processChildren(node, underlineChildren);
                    if (underlineChildren.length > 0) {
                        content.push({ text: underlineChildren, decoration: 'underline' });
                    }
                    break;
                    
                case 'code':
                    const codeText = node.textContent.trim();
                    if (codeText) {
                        content.push({
                            text: codeText,
                            style: 'code',
                            background: '#f3f4f6'
                        });
                    }
                    break;
                    
                case 'pre':
                    const preText = node.textContent.trim();
                    if (preText) {
                        content.push({
                            text: preText,
                            style: 'code',
                            background: '#f3f4f6',
                            margin: [0, 8, 0, 8]
                        });
                    }
                    break;
                    
                case 'ul':
                case 'ol':
                    const listItems = [];
                    node.querySelectorAll('li').forEach(li => {
                        const itemChildren = [];
                        processChildren(li, itemChildren);
                        if (itemChildren.length > 0) {
                            listItems.push(itemChildren);
                        }
                    });
                    if (listItems.length > 0) {
                        content.push({
                            ul: listItems,
                            style: 'normal',
                            margin: [0, 5, 0, 5]
                        });
                    }
                    break;
                    
                case 'table':
                    const tableBody = [];
                    const tableRows = node.querySelectorAll('tr');
                    tableRows.forEach(row => {
                        const cells = [];
                        row.querySelectorAll('td, th').forEach(cell => {
                            const cellChildren = [];
                            processChildren(cell, cellChildren);
                            if (cellChildren.length > 0) {
                                cells.push({
                                    text: cellChildren,
                                    style: cell.tagName.toLowerCase() === 'th' ? 'tableHeader' : 'normal'
                                });
                            }
                        });
                        if (cells.length > 0) {
                            tableBody.push(cells);
                        }
                    });
                    if (tableBody.length > 0) {
                        content.push({
                            table: {
                                body: tableBody
                            },
                            style: 'table',
                            layout: 'lightHorizontalLines'
                        });
                    }
                    break;
                    
                case 'br':
                    content.push({ text: '' });
                    break;
                    
                case 'hr':
                    content.push({
                        canvas: [
                            {
                                type: 'line',
                                x1: 0,
                                y1: 0,
                                x2: 515,
                                y2: 0,
                                lineWidth: 1,
                                lineColor: '#e5e7eb'
                            }
                        ],
                        margin: [0, 10, 0, 10]
                    });
                    break;
                    
                default:
                    processChildren(node, content);
            }
        }
    }
    
    function processChildren(parentNode, targetArray) {
        parentNode.childNodes.forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent.trim();
                if (text) {
                    targetArray.push({ text: text });
                }
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const tagName = child.tagName.toLowerCase();
                
                switch (tagName) {
                    case 'strong':
                    case 'b':
                        const boldChildren = [];
                        processChildren(child, boldChildren);
                        if (boldChildren.length > 0) {
                            targetArray.push({ text: boldChildren, bold: true });
                        }
                        break;
                        
                    case 'em':
                    case 'i':
                        const italicChildren = [];
                        processChildren(child, italicChildren);
                        if (italicChildren.length > 0) {
                            targetArray.push({ text: italicChildren, italics: true });
                        }
                        break;
                        
                    case 'u':
                        const underlineChildren = [];
                        processChildren(child, underlineChildren);
                        if (underlineChildren.length > 0) {
                            targetArray.push({ text: underlineChildren, decoration: 'underline' });
                        }
                        break;
                        
                    case 'code':
                        const codeText = child.textContent.trim();
                        if (codeText) {
                            targetArray.push({
                                text: codeText,
                                background: '#f3f4f6',
                                fontSize: 9
                            });
                        }
                        break;
                        
                    case 'br':
                        targetArray.push({ text: '' });
                        break;
                        
                    default:
                        processChildren(child, targetArray);
                }
            }
        });
    }
    
    processNode(doc.body);
    return content;
}

// 初始化AI分析功能
function initAIAnalysis() {
    initAPIConfig();
    initAIAnalysisEvents();
}
