/**
 * AI 功能模块（从 script.js 拆分）
 *
 * - 图片 AI 分析（含流式/非流式兜底）
 * - AI 对话（含流式/非流式兜底）
 * - 火山方舟 / 豆包 API 调用（Responses API）
 * - 输出文本格式化为 HTML（标题/条目/正文样式）
 * - API Key & 模型配置（localStorage）
 *
 * 依赖于全局变量/函数（由 script.js 提供）：
 * - `allImages`, `selectedIds`
 * - `showToast`, `removeFileExtension`
 */

// AI分析功能：当前对话历史（用于对话窗口）
let currentAIChat = [];
// 连续对话：上一轮 Responses 的 response_id（用于 previous_response_id）
let lastAIResponseId = '';

// ===== 入口：打开/关闭 AI 面板 =====

function openAIAnalysis() {
  if (typeof selectedIds === 'undefined' || !selectedIds || selectedIds.size === 0) {
    showToast('请先选择要分析的图片', 'warning');
    return;
  }

  currentAIChat = [];
  lastAIResponseId = '';

  document.getElementById('ai-analysis-overlay').style.display = 'flex';

  const selectedImages = (allImages || []).filter(img => selectedIds.has(img.id) && !img.isEmptyCategory);
  const aiImagesContainer = document.getElementById('ai-selected-images');
  aiImagesContainer.innerHTML = selectedImages.map(img => `
    <div class="ai-image-card">
      <img src="${img.data}" alt="${img.name}" class="ai-image-card-img" style="cursor: pointer;">
      <div class="ai-image-info">
        <div><strong>名称:</strong> ${removeFileExtension(img.name)}</div>
        <div><strong>分类:</strong> ${img.category || '无'}</div>
      </div>
    </div>
  `).join('');

  setupAIImageZoom();

  document.getElementById('ai-chat-messages').innerHTML = '';

  analyzeImageWithAI(selectedImages);
}

function closeAIAnalysis() {
  document.getElementById('ai-analysis-overlay').style.display = 'none';
  closeAIImageZoom();
}

function openAIImageZoom(src) {
  const overlay = document.getElementById('ai-image-zoom-overlay');
  const imgEl = document.getElementById('ai-image-zoom-img');
  if (!overlay || !imgEl) return;
  imgEl.src = src || '';
  overlay.style.display = 'flex';
}

function closeAIImageZoom() {
  const overlay = document.getElementById('ai-image-zoom-overlay');
  if (!overlay) return;
  overlay.style.display = 'none';
}

function setupAIImageZoom() {
  const container = document.getElementById('ai-selected-images');
  const overlay = document.getElementById('ai-image-zoom-overlay');
  const closeBtn = document.getElementById('ai-image-zoom-close');
  if (!container || !overlay) return;

  container.removeEventListener('click', _onAIImageClick);
  container.addEventListener('click', _onAIImageClick);

  if (closeBtn) {
    closeBtn.onclick = closeAIImageZoom;
  }
  overlay.onclick = function (e) {
    if (e.target === overlay) closeAIImageZoom();
  };
}

function _onAIImageClick(e) {
  const img = e.target.closest('.ai-image-card img');
  if (img && img.src) openAIImageZoom(img.src);
}

// ===== 图片分析 =====

async function analyzeImageWithAI(images) {
  const chatMessages = document.getElementById('ai-chat-messages');
  chatMessages.innerHTML = `
    <div class="ai-message">
      <div class="ai-message-header">
        <div class="ai-avatar">🤖</div>
        <div class="ai-name">AI 助手</div>
      </div>
      <div class="ai-message-content" id="ai-stream-image-analysis">正在分析图片，请稍候...</div>
    </div>
  `;

  const contentEl = document.getElementById('ai-stream-image-analysis');

  try {
    const imageDataList = (images || []).map(img => {
      const base64Data = String(img.data || '').split(',')[1] || '';
      return { name: img.name, base64: base64Data, category: img.category };
    });

    const config = getAPIConfig();
    if (!config.apiKey) {
      showToast('请先配置豆包API密钥', 'warning');
      contentEl.textContent = '请先在设置中配置豆包API密钥，以便进行图片分析。';
      return;
    }

    const apiKey = normalizeApiKey(config.apiKey);
    if (!apiKey) {
      showToast('API密钥无效，请重新配置', 'warning');
      contentEl.textContent = 'API密钥无效，请在设置中重新配置。';
      return;
    }

    const model = config.model || 'doubao-2.0';

    // ep- 端点：非流式（兼容性优先）
    if (/^ep-/i.test(model)) {
      const result = await callDoubaoAPI(imageDataList);
      const trimmed = String(result || '').trim();
      const html = trimmed.startsWith('<') ? trimmed : formatAITextAsHTML(trimmed);
      contentEl.innerHTML = html;

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      const plainText = tempDiv.textContent || tempDiv.innerText || '';
      currentAIChat.push({ role: 'assistant', content: plainText });
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return;
    }

    // 官方模型：流式输出
    await streamArkResponse({
      apiKey,
      body: {
        model,
        input: [
          {
            role: 'user',
            content: [
              ...imageDataList.map(img => ({
                type: 'input_image',
                image_url: `data:image/jpeg;base64,${img.base64}`
              })),
              { type: 'input_text', text: getImageAnalysisPrompt() }
            ]
          }
        ]
      },
      onDelta: (_, fullText) => {
        contentEl.innerHTML = formatAITextAsHTML(fullText);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      },
      onDone: (fullText) => {
        currentAIChat.push({ role: 'assistant', content: fullText });
        chatMessages.scrollTop = chatMessages.scrollHeight;
      },
      onError: (err) => {
        console.error('AI分析失败:', err);
        contentEl.textContent = `分析失败：${err.message || err}`;
      }
    });
  } catch (error) {
    console.error('AI分析失败:', error);
    contentEl.textContent = '分析失败，请稍后重试。';
  }
}

function getImageAnalysisPrompt() {
  return '请分析一下几张图片的信息，总结每张图片的详细介绍，以及每张图片之间的对比区别';
}

async function callDoubaoAPI(images) {
  const config = getAPIConfig();
  if (!config.apiKey) {
    showToast('请先配置豆包API密钥', 'warning');
    return `<p>请先在设置中配置豆包API密钥，以便进行图片分析。</p>`;
  }

  try {
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model || 'doubao-2.0',
        input: [
          {
            role: 'user',
            content: [
              ...images.map(img => ({
                type: 'input_image',
                image_url: `data:image/jpeg;base64,${img.base64}`
              })),
              { type: 'input_text', text: getImageAnalysisPrompt() }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      let errorText = '';
      try {
        const errorData = await response.json();
        errorText = errorData?.error?.message || errorData?.message || JSON.stringify(errorData);
      } catch (_) {
        errorText = await response.text();
      }
      throw new Error(errorText || 'API调用失败');
    }

    const data = await response.json();
    // 记录 response_id，供后续追问使用
    lastAIResponseId = String(data?.id || data?.response_id || data?.response?.id || lastAIResponseId || '');
    return extractArkResponseText(data) || '（未获取到模型输出文本）';
  } catch (error) {
    console.error('API调用失败:', error);
    return `<p>API调用失败：${error.message}</p><p>请检查API密钥是否正确，或稍后重试。</p>`;
  }
}

// ===== AI 对话 =====

async function sendAIMessage() {
  const input = document.getElementById('ai-input');
  const message = (input?.value || '').trim();
  if (!message) return;

  input.value = '';

  const chatMessages = document.getElementById('ai-chat-messages');
  chatMessages.innerHTML += `
    <div class="user-message">
      <div class="user-message-content">${escapeHTML(message)}</div>
    </div>
  `;

  currentAIChat.push({ role: 'user', content: message });

  // 为本次 AI 回复生成唯一 DOM id，避免选择器选错导致覆盖上一条回复
  const replyId = `ai-reply-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const aiMessageHtml = `
    <div class="ai-message">
      <div class="ai-message-header">
        <div class="ai-avatar">🤖</div>
        <div class="ai-name">AI 助手</div>
      </div>
      <div class="ai-message-content ai-stream-reply" id="${replyId}">正在思考...</div>
    </div>
  `;
  chatMessages.innerHTML += aiMessageHtml;
  const contentEl = document.getElementById(replyId);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const config = getAPIConfig();
    if (!config.apiKey) {
      showToast('请先配置豆包API密钥', 'warning');
      contentEl.textContent = '请先在设置中配置豆包API密钥，以便进行对话。';
      return;
    }

    const apiKey = normalizeApiKey(config.apiKey);
    if (!apiKey) {
      showToast('API密钥无效，请重新配置', 'warning');
      contentEl.textContent = 'API密钥无效，请在设置中重新配置。';
      return;
    }

    const model = config.model || 'doubao-2.0';

    // 将最近若干轮对话压缩成一段上下文文本，确保“有记忆”
    // 说明：部分模型/端点的 `previous_response_id` 在流式增量里不一定能稳定拿到 id，
    // 因此这里同时提供“文本上下文”兜底，避免出现“好像没记忆”的体验。
    const contextualUserText = buildContextualChatText(currentAIChat, message);

    // ep- 端点：非流式（避免卡死）
    if (/^ep-/i.test(model)) {
      const result = await callDoubaoAPIForChat(contextualUserText);
      const trimmed = String(result || '').trim();
      const html = trimmed.startsWith('<') ? trimmed : formatAITextAsHTML(trimmed);
      contentEl.innerHTML = html;

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      const plainText = tempDiv.textContent || tempDiv.innerText || '';
      currentAIChat.push({ role: 'assistant', content: plainText });
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return;
    }

    // 连续对话：优先用 previous_response_id 让服务端继承上下文，
    // 避免前端拼长历史触发参数校验或变慢。
    const inputForThisTurn = [
      { role: 'user', content: [{ type: 'input_text', text: contextualUserText }] }
    ];

    const body = { model, input: inputForThisTurn };
    if (lastAIResponseId) body.previous_response_id = lastAIResponseId;

    await streamArkResponse({
      apiKey,
      body,
      onDelta: (_, fullText) => {
        contentEl.innerHTML = formatAITextAsHTML(fullText);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      },
      onDone: (fullText) => {
        currentAIChat.push({ role: 'assistant', content: fullText });
        chatMessages.scrollTop = chatMessages.scrollHeight;
      },
      onError: (err) => {
        console.error('发送消息失败:', err);
        contentEl.textContent = `发送消息失败：${err.message || err}`;
      }
    });
  } catch (error) {
    console.error('发送消息失败:', error);
    contentEl.textContent = '发送消息失败，请稍后重试。';
  }
}

async function callDoubaoAPIForChat(userText) {
  const config = getAPIConfig();
  if (!config.apiKey) {
    showToast('请先配置豆包API密钥', 'warning');
    return `<p>请先在设置中配置豆包API密钥，以便进行对话。</p>`;
  }

  try {
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model || 'doubao-2.0',
        // 非流式也带上下文文本，确保连续对话
        input: [
          {
            role: 'user',
            content: [{ type: 'input_text', text: String(userText || '').trim() || '请回答用户刚才的问题。' }]
          }
        ],
        ...(lastAIResponseId ? { previous_response_id: lastAIResponseId } : {})
      })
    });

    if (!response.ok) {
      let errorText = '';
      try {
        const errorData = await response.json();
        errorText = errorData?.error?.message || errorData?.message || JSON.stringify(errorData);
      } catch (_) {
        errorText = await response.text();
      }
      throw new Error(errorText || 'API调用失败');
    }

    const data = await response.json();
    lastAIResponseId = String(data?.id || data?.response_id || data?.response?.id || lastAIResponseId || '');
    return extractArkResponseText(data) || '（未获取到模型输出文本）';
  } catch (error) {
    console.error('API调用失败:', error);
    return `<p>API调用失败：${error.message}</p><p>请检查API密钥是否正确，或稍后重试。</p>`;
  }
}

function arkInputFromChatHistory(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const lastUser = [...list].reverse().find(m => m && m.role === 'user');
  const target = lastUser || list[list.length - 1];
  const text = target ? String(target.content ?? '') : '';

  return [
    {
      role: 'user',
      content: [{ type: 'input_text', text: text || '请回答用户刚才的问题。' }]
    }
  ];
}

function buildContextualChatText(chatHistory, latestUserMessage) {
  const list = Array.isArray(chatHistory) ? chatHistory : [];
  const lastTurns = list.slice(-10); // 控制长度：最多取最近 10 条 role 记录
  const lines = [];

  for (const m of lastTurns) {
    if (!m || !m.role) continue;
    const role = m.role === 'assistant' ? 'AI' : (m.role === 'user' ? '用户' : m.role);
    const content = String(m.content ?? '').trim();
    if (!content) continue;
    lines.push(`${role}：${content}`);
  }

  const latest = String(latestUserMessage || '').trim();
  if (latest) {
    // 确保最后一行是本轮追问（避免仅有历史而缺少本次问题）
    if (!lines.length || !lines[lines.length - 1].startsWith('用户：') || !lines[lines.length - 1].endsWith(latest)) {
      lines.push(`用户：${latest}`);
    }
  }

  // 输出一个稳定的“带历史上下文”的问题文本
  if (!lines.length) return latest || '请回答用户的问题。';
  return `以下是对话历史（请结合上下文回答）：\n${lines.join('\n')}\n\n请回答用户最后一个问题，并保持前后口径一致。`;
}

// ===== Responses API：流式 SSE =====

async function streamArkResponse({ apiKey, body, onDelta, onDone, onError }) {
  try {
    const normalizedKey = normalizeApiKey(apiKey);
    if (!normalizedKey) throw new Error('API密钥无效，请重新配置');

    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${normalizedKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ...body, stream: true })
    });

    if (!response.ok) {
      let errorText = '';
      try {
        const errorData = await response.json();
        errorText = errorData?.error?.message || errorData?.message || JSON.stringify(errorData);
      } catch (_) {
        errorText = await response.text();
      }
      throw new Error(errorText || '请求失败');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';
    let capturedId = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data:')) continue;

        const payload = line.slice(5).trim();
        if (!payload) continue;

        if (payload === '[DONE]') {
          onDone?.(fullText);
          return;
        }

        try {
          const json = JSON.parse(payload);
          // 尝试捕获本次 response_id（不同版本字段可能不同）
          if (!capturedId) {
            const maybeId = json?.id || json?.response_id || json?.response?.id;
            if (typeof maybeId === 'string' && maybeId.trim()) {
              capturedId = maybeId.trim();
              lastAIResponseId = capturedId;
            }
          }
          const deltaText = extractArkDeltaText(json);
          if (deltaText) {
            fullText += deltaText;
            onDelta?.(deltaText, fullText);
          }
        } catch (e) {
          console.warn('解析 SSE 数据失败: ', e, payload);
        }
      }
    }

    onDone?.(fullText);
  } catch (err) {
    if (onError) onError(err);
    else console.error(err);
  }
}

function extractArkDeltaText(chunk) {
  if (!chunk) return '';
  if (chunk.output_text) {
    if (typeof chunk.output_text.delta === 'string' && chunk.output_text.delta) return chunk.output_text.delta;
    if (typeof chunk.output_text.text === 'string' && chunk.output_text.text) return chunk.output_text.text;
  }
  if (Array.isArray(chunk.output)) {
    const texts = [];
    for (const item of chunk.output) {
      const content = Array.isArray(item?.content) ? item.content : [];
      for (const c of content) {
        if (typeof c.delta === 'string' && c.delta) texts.push(c.delta);
        else if (typeof c.text === 'string' && c.text) texts.push(c.text);
      }
    }
    if (texts.length) return texts.join('');
  }
  return '';
}

// ===== 输出格式化 =====

function formatAITextAsHTML(rawText) {
  const text = preprocessAIText(rawText);
  if (!text) return '';

  const lines = text.split('\n');
  const htmlParts = [];

  const isHr = (l) => /^[-*_]{3,}$/.test(l.trim());
  const isMarkdownHeading = (l) => /^#{1,6}\s+/.test(l.trim());
  const isCnHeading = (l) => /^[一二三四五六七八九十]+、/.test(l.trim());
  const isNumberItem = (l) => /^\d+(\.|、)/.test(l.trim());
  const isUlItem = (l) => /^[-*•]\s+/.test(l.trim());
  const isTableRow = (l) => /^\|.*\|\s*$/.test(l.trim());
  const isTableSep = (l) => /^\|?\s*-{3,}\s*(\|\s*-{3,}\s*)+\|?\s*$/.test(l.trim());

  const parseTableRow = (row) =>
    row
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(cell => cell.trim());

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i] ?? '';
    const line = rawLine.trim();

    // 空行：保留段落分隔（不输出任何节点）
    if (!line) {
      i += 1;
      continue;
    }

    // 分隔线
    if (isHr(line)) {
      htmlParts.push('<hr class="ai-separator">');
      i += 1;
      continue;
    }

    // 表格：允许中间夹空行（AI 常会在表格行之间插入空行）
    if (isTableRow(line)) {
      // 找到下一条“非空行”
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j += 1;

      // 只有当下一条非空行是分隔行，才认为这是一个 Markdown 表格
      if (j < lines.length && isTableSep(lines[j].trim())) {
        const headerCells = parseTableRow(line);

        // 从分隔行下一行开始收集数据行，允许中间空行
        let k = j + 1;
        const bodyRows = [];
        while (k < lines.length) {
          const t = lines[k].trim();
          if (!t) {
            k += 1;
            continue;
          }
          if (!isTableRow(t)) break;
          bodyRows.push(parseTableRow(t));
          k += 1;
        }

        let tableHtml = '<table class="ai-table"><thead><tr>';
        tableHtml += headerCells.map(cell => '<th>' + renderInline(cell) + '</th>').join('');
        tableHtml += '</tr></thead><tbody>';
        for (const rowCells of bodyRows) {
          tableHtml += '<tr>' + rowCells.map(cell => '<td>' + renderInline(cell) + '</td>').join('') + '</tr>';
        }
        tableHtml += '</tbody></table>';
        htmlParts.push(tableHtml);
        i = k;
        continue;
      }
      // 不是表格就当普通文本走下方逻辑
    }

    // 无序列表：连续的 -/*/• 行合并成一个 ul
    if (isUlItem(line)) {
      const items = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        if (!t) break;
        if (!isUlItem(t)) break;
        items.push(t.replace(/^[-*•]\s+/, '').trim());
        i += 1;
      }
      htmlParts.push('<ul class="ai-list">' + items.map(it => '<li class="ai-list-item">' + renderInline(it) + '</li>').join('') + '</ul>');
      continue;
    }

    // 标题：Markdown # 或中文「一、」
    if (isMarkdownHeading(line)) {
      const clean = line.replace(/^#{1,6}\s+/, '').trim();
      htmlParts.push('<p class="ai-heading">' + renderInline(clean) + '</p>');
      i += 1;
      continue;
    }
    if (isCnHeading(line)) {
      htmlParts.push('<p class="ai-heading">' + renderInline(line) + '</p>');
      i += 1;
      continue;
    }

    // 编号条目
    if (isNumberItem(line)) {
      htmlParts.push('<p class="ai-item">' + renderInline(line) + '</p>');
      i += 1;
      continue;
    }

    // 普通文本
    htmlParts.push('<p class="ai-text">' + renderInline(line) + '</p>');
    i += 1;
  }

  return htmlParts.join('');
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 在完成基础 HTML 转义后，处理简单的行内 Markdown（加粗 / 行内代码）
function renderInline(str) {
  let s = escapeHTML(str);
  // **加粗**
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // `行内代码`
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

function preprocessAIText(rawText) {
  // 说明：模型有时会返回少量 HTML（最常见是 <br> 换行）。
  // 我们把它们先转换成纯文本换行，再走统一的文本解析/渲染流程。
  const t = String(rawText || '')
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .trim();
  if (!t) return '';
  // 常见错误：把分隔线和标题挤在同一行，如：--- ### 标题 1. ...
  // 处理成：
  // ---
  // ### 标题
  // 1. ...
  return t
    .replace(/^---\s*(#{1,6}\s+)/gm, '---\n$1')
    .replace(/^([-*_]{3,})\s*(#{1,6}\s+)/gm, '$1\n$2');
}

function extractArkResponseText(data) {
  if (!data) return '';
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();

  const output = Array.isArray(data.output) ? data.output : [];
  const texts = [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const c of content) {
      if (typeof c?.text === 'string' && c.text.trim()) texts.push(c.text.trim());
    }
  }
  if (texts.length) return texts.join('\n\n');

  const legacy = data?.choices?.[0]?.message?.content;
  if (typeof legacy === 'string' && legacy.trim()) return legacy.trim();

  return '';
}

// ===== API 配置（localStorage + 模态框）=====

function showAPIConfigModal() {
  loadAPIConfig();
  document.getElementById('api-config-modal').style.display = 'flex';
}

function closeAPIConfigModal() {
  document.getElementById('api-config-modal').style.display = 'none';
}

function loadAPIConfig() {
  const config = JSON.parse(localStorage.getItem('doubaoApiConfig') || '{}');
  if (config.apiKey) document.getElementById('doubao-api-key').value = config.apiKey;
  if (config.model) document.getElementById('doubao-api-model').value = config.model;
}

function saveAPIConfig() {
  const rawKey = document.getElementById('doubao-api-key').value;
  const apiKey = normalizeApiKey(rawKey);
  const model = document.getElementById('doubao-api-model').value;

  if (!apiKey) {
    showToast('请输入API密钥', 'warning');
    return;
  }

  localStorage.setItem('doubaoApiConfig', JSON.stringify({ apiKey, model }));
  showToast('API配置保存成功', 'success');
  closeAPIConfigModal();
}

function normalizeApiKey(value) {
  const str = String(value || '').trim();
  if (!str) return '';
  return str.replace(/^['"]+|['"]+$/g, '').trim();
}

function getAPIConfig() {
  const config = JSON.parse(localStorage.getItem('doubaoApiConfig') || '{}');
  if (config.apiKey) config.apiKey = normalizeApiKey(config.apiKey);
  if (config.model && /^doubao-smart-router/i.test(String(config.model))) {
    config.model = '';
  }
  return config;
}

// ===== DOM 绑定 =====

document.addEventListener('DOMContentLoaded', function () {
  const aiInput = document.getElementById('ai-input');
  if (aiInput) {
    aiInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') sendAIMessage();
    });
  }
  loadAPIConfig();
});

// ===== 导出到全局（供 HTML onclick 调用）=====
window.openAIAnalysis = openAIAnalysis;
window.closeAIAnalysis = closeAIAnalysis;
window.sendAIMessage = sendAIMessage;
window.showAPIConfigModal = showAPIConfigModal;
window.closeAPIConfigModal = closeAPIConfigModal;
window.saveAPIConfig = saveAPIConfig;

