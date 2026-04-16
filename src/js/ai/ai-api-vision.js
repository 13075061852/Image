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
    // 仅允许明确支持图片输入的模型
    const isVisionModel = supportsImageInput(config.model);

    if (imageData.length > 0 && !isVisionModel) {
        throw new Error('当前选择的模型不支持图片输入，请切换到支持视觉的模型。');
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

    // 获取用户问题文本
    let userQuery = "";
    for (const item of lastUserMessage.content) {
        if (item.type === "text") {
            userQuery = item.text;
            break;
        }
    }

    // 构建系统消息内容
    let systemContent = "你是一个专业的AI助手，必须严格按照以下要求回答用户问题：\n\n";

    // 如果知识库启用，获取相关知识库内容
    if (isKnowledgeBaseEnabled) {
        const relevantKnowledge = getRelevantKnowledge(userQuery);
        if (relevantKnowledge) {
            systemContent += `## 知识库参考内容\n${relevantKnowledge}\n\n`;
            systemContent += "**重要要求**：你必须基于上述知识库内容回答用户问题，确保回答的准确性和专业性。\n\n";
        }
    }

    // 如果优质回答启用，获取相关优质回答内容
    if (isQualityAnswersEnabled) {
        const relevantQualityAnswers = getRelevantQualityAnswers(userQuery);
        if (relevantQualityAnswers) {
            systemContent += `## 优质回答参考\n${relevantQualityAnswers}\n\n`;
            systemContent += "**重要要求**：你必须参考上述优质回答的风格、结构和内容，确保回答质量与优质回答一致。\n\n";
        }
    }

    // 如果错误案例启用，获取相关错误案例内容
    if (isErrorCasesEnabled) {
        const relevantErrorCases = getRelevantErrorCases(userQuery);
        if (relevantErrorCases) {
            systemContent += `## 错误案例警示\n${relevantErrorCases}\n\n`;
            systemContent += "**重要要求**：你必须仔细分析上述错误案例，避免犯同样的错误。如果遇到类似问题，请参考正确回答的方式，确保不重复历史错误。\n\n";
        }
    }

    systemContent += "## 回答要求\n1. 必须结合知识库内容（如果有）回答问题\n2. 必须参考优质回答的风格和结构（如果有）\n3. 必须参考错误案例警示（如果有），避免重复错误\n4. 必须结合图片分析结果\n5. 回答要专业、准确、详细\n6. 使用Markdown格式输出，确保结构清晰\n7. 直接回答问题，不要有任何引言或开场白";

    // 如果启用了知识库、优质回答或错误案例，添加系统消息
    if (isKnowledgeBaseEnabled || isQualityAnswersEnabled || isErrorCasesEnabled) {
        // 创建系统消息，包含知识库、优质回答和错误案例内容
        messages.unshift({
            role: "system",
            content: systemContent
        });

        // 添加调试信息

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

        aiResult.innerHTML = `<p>分析失败：${error.message}</p>`;
        aiResult.classList.remove('loading');
    } finally {
        aiBtn.disabled = false;
    }
}

// 知识库管理

// 加载知识库
function loadKnowledgeBase() {
    try {
        const knowledgeBaseData = localStorage.getItem('knowledgeBase');
        return knowledgeBaseData ? JSON.parse(knowledgeBaseData) : {
            id: 'default-kb',
            name: '专业知识库',
            description: '存储专业领域知识的数据库',
            entries: []
        };
    } catch (error) {

        return {
            id: 'default-kb',
            name: '专业知识库',
            description: '存储专业领域知识的数据库',
            entries: []
        };
    }
}

