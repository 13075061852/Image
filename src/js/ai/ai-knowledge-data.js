// 保存知识库
function saveKnowledgeBase(knowledgeBase) {
    try {
        localStorage.setItem('knowledgeBase', JSON.stringify(knowledgeBase));
        return true;
    } catch (error) {

        return false;
    }
}

// 添加知识库条目
function addKnowledgeEntry(entry) {
    const knowledgeBase = loadKnowledgeBase();
    const newEntry = {
        id: 'entry-' + Date.now(),
        title: entry.title,
        content: entry.content,
        tags: entry.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    knowledgeBase.entries.push(newEntry);
    return saveKnowledgeBase(knowledgeBase);
}

// 更新知识库条目
function updateKnowledgeEntry(entryId, updatedEntry) {
    const knowledgeBase = loadKnowledgeBase();
    const entryIndex = knowledgeBase.entries.findIndex(entry => entry.id === entryId);
    if (entryIndex !== -1) {
        knowledgeBase.entries[entryIndex] = {
            ...knowledgeBase.entries[entryIndex],
            ...updatedEntry,
            updatedAt: new Date().toISOString()
        };
        return saveKnowledgeBase(knowledgeBase);
    }
    return false;
}

// 删除知识库条目
function deleteKnowledgeEntry(entryId) {
    const knowledgeBase = loadKnowledgeBase();
    knowledgeBase.entries = knowledgeBase.entries.filter(entry => entry.id !== entryId);
    return saveKnowledgeBase(knowledgeBase);
}

// 搜索知识库
function searchKnowledgeBase(query) {
    const knowledgeBase = loadKnowledgeBase();
    const lowerQuery = query.toLowerCase();
    return knowledgeBase.entries.filter(entry => {
        const content = entry.title.toLowerCase() + ' ' +
            entry.content.toLowerCase() + ' ' +
            entry.tags.join(' ').toLowerCase();
        return content.includes(lowerQuery);
    });
}

// 获取相关知识库内容
function getRelevantKnowledge(userQuery, maxResults = 3) {
    const relevantEntries = searchKnowledgeBase(userQuery);
    return relevantEntries.slice(0, maxResults).map(entry => {
        return `【${entry.title}】\n${entry.content}`;
    }).join('\n\n');
}

// 优质回答管理

// 加载优质回答
function loadQualityAnswers() {
    try {
        const qualityAnswersData = localStorage.getItem('qualityAnswers');
        return qualityAnswersData ? JSON.parse(qualityAnswersData) : {
            id: 'default-qa',
            name: '优质回答库',
            description: '存储优质回答的数据库',
            entries: []
        };
    } catch (error) {

        return {
            id: 'default-qa',
            name: '优质回答库',
            description: '存储优质回答的数据库',
            entries: []
        };
    }
}

// 保存优质回答
function saveQualityAnswers(qualityAnswers) {
    try {
        localStorage.setItem('qualityAnswers', JSON.stringify(qualityAnswers));
        return true;
    } catch (error) {

        return false;
    }
}

// 添加优质回答
function addQualityAnswer(answer) {
    const qualityAnswers = loadQualityAnswers();
    const newAnswer = {
        id: 'qa-' + Date.now(),
        question: answer.question,
        content: answer.content,
        tags: answer.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    qualityAnswers.entries.push(newAnswer);
    return saveQualityAnswers(qualityAnswers);
}

// 更新优质回答
function updateQualityAnswer(answerId, updatedAnswer) {
    const qualityAnswers = loadQualityAnswers();
    const answerIndex = qualityAnswers.entries.findIndex(answer => answer.id === answerId);
    if (answerIndex !== -1) {
        qualityAnswers.entries[answerIndex] = {
            ...qualityAnswers.entries[answerIndex],
            ...updatedAnswer,
            updatedAt: new Date().toISOString()
        };
        return saveQualityAnswers(qualityAnswers);
    }
    return false;
}

// 删除优质回答
function deleteQualityAnswer(answerId) {
    const qualityAnswers = loadQualityAnswers();
    qualityAnswers.entries = qualityAnswers.entries.filter(answer => answer.id !== answerId);
    return saveQualityAnswers(qualityAnswers);
}

// 搜索优质回答
function scoreQualityAnswer(answer, query, tokens) {
    const question = (answer.question || '').toLowerCase();
    const content = (answer.content || '').toLowerCase();
    const tags = (answer.tags || []).join(' ').toLowerCase();
    const haystack = `${question} ${content} ${tags}`;

    let score = 0;
    if (query && haystack.includes(query)) score += 20;
    tokens.forEach(token => {
        if (question.includes(token)) score += 7;
        if (tags.includes(token)) score += 5;
        if (content.includes(token)) score += 2;
    });

    return score;
}

function searchQualityAnswers(query) {
    const qualityAnswers = loadQualityAnswers();
    const normalizedQuery = (query || '').toLowerCase().trim();
    const tokens = tokenizeKnowledgeQuery(normalizedQuery);

    return (qualityAnswers.entries || [])
        .map(answer => ({ answer, score: scoreQualityAnswer(answer, normalizedQuery, tokens) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.answer);
}

// 获取相关优质回答内容
function getRelevantQualityAnswers(userQuery, maxResults = 5) {
    const relevantAnswers = searchQualityAnswers(userQuery);
    return relevantAnswers.slice(0, maxResults).map(answer => {
        const tags = answer.tags && answer.tags.length ? `【标签】${answer.tags.join(', ')}` : '';
        return `【问题】${answer.question}\n${tags}\n【回答示范】${answer.content}`.trim();
    }).join('\n\n');
}

// 错误案例管理

// 加载错误案例
function loadErrorCases() {
    try {
        const errorCasesData = localStorage.getItem('errorCases');
        return errorCasesData ? JSON.parse(errorCasesData) : {
            id: 'default-ec',
            name: '错误案例库',
            description: '存储AI错误案例的数据库，用于自我纠错和学习',
            entries: []
        };
    } catch (error) {

        return {
            id: 'default-ec',
            name: '错误案例库',
            description: '存储AI错误案例的数据库，用于自我纠错和学习',
            entries: []
        };
    }
}

// 保存错误案例
function saveErrorCases(errorCases) {
    try {
        localStorage.setItem('errorCases', JSON.stringify(errorCases));
        return true;
    } catch (error) {

        return false;
    }
}

// 添加错误案例
function addErrorCase(errorCase) {
    const errorCases = loadErrorCases();
    const newCase = {
        id: 'ec-' + Date.now(),
        question: errorCase.question,
        wrongAnswer: errorCase.wrongAnswer,
        correctAnswer: errorCase.correctAnswer,
        errorReason: errorCase.errorReason,
        tags: errorCase.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    errorCases.entries.push(newCase);
    return saveErrorCases(errorCases);
}

// 更新错误案例
function updateErrorCase(caseId, updatedCase) {
    const errorCases = loadErrorCases();
    const caseIndex = errorCases.entries.findIndex(c => c.id === caseId);
    if (caseIndex !== -1) {
        errorCases.entries[caseIndex] = {
            ...errorCases.entries[caseIndex],
            ...updatedCase,
            updatedAt: new Date().toISOString()
        };
        return saveErrorCases(errorCases);
    }
    return false;
}

// 删除错误案例
function deleteErrorCase(caseId) {
    const errorCases = loadErrorCases();
    errorCases.entries = errorCases.entries.filter(c => c.id !== caseId);
    return saveErrorCases(errorCases);
}

// 搜索错误案例
function searchErrorCases(query) {
    const errorCases = loadErrorCases();
    const lowerQuery = query.toLowerCase();
    return errorCases.entries.filter(c => {
        const content = c.question.toLowerCase() + ' ' +
            c.wrongAnswer.toLowerCase() + ' ' +
            c.correctAnswer.toLowerCase() + ' ' +
            c.errorReason.toLowerCase() + ' ' +
            c.tags.join(' ').toLowerCase();
        return content.includes(lowerQuery);
    });
}

// 获取相关错误案例内容
function getRelevantErrorCases(userQuery, maxResults = 3) {
    const relevantCases = searchErrorCases(userQuery);
    return relevantCases.slice(0, maxResults).map(c => {
        return `【问题】${c.question}\n【错误回答】${c.wrongAnswer}\n【正确回答】${c.correctAnswer}\n【错误原因】${c.errorReason}`;
    }).join('\n\n');
}

// 初始化错误案例状态
let isErrorCasesEnabled = true;

function initErrorCasesStatus() {
    const savedECStatus = localStorage.getItem('errorCasesEnabled');
    if (savedECStatus !== null) {
        isErrorCasesEnabled = savedECStatus === 'true';
    }
    updateErrorCasesUI();
}

// 切换错误案例状态
function toggleErrorCases() {
    isErrorCasesEnabled = !isErrorCasesEnabled;
    localStorage.setItem('errorCasesEnabled', isErrorCasesEnabled.toString());
    updateErrorCasesUI();
    showToast(`错误案例已${isErrorCasesEnabled ? '启用' : '禁用'}`, 'success');
}

// 更新错误案例UI状态
function updateErrorCasesUI() {
    const errorCasesBtn = document.getElementById('error-cases-btn');
    if (errorCasesBtn) {
        if (isErrorCasesEnabled) {
            errorCasesBtn.textContent = '⚠️ 错误案例（启用）';
            errorCasesBtn.classList.add('active');
        } else {
            errorCasesBtn.textContent = '⚠️ 错误案例（禁用）';
            errorCasesBtn.classList.remove('active');
        }
    }

    // 更新AI分析窗口中的状态显示
    const errorCasesStatus = document.getElementById('error-cases-status');
    if (errorCasesStatus) {
        errorCasesStatus.textContent = isErrorCasesEnabled ? '启用' : '禁用';
    }

    const errorCasesToggle = document.getElementById('error-cases-toggle');
    if (errorCasesToggle) {
        if (isErrorCasesEnabled) {
            errorCasesToggle.style.background = 'rgba(255,255,255,0.3)';
            errorCasesToggle.style.fontWeight = '600';
        } else {
            errorCasesToggle.style.background = 'rgba(255,255,255,0.2)';
            errorCasesToggle.style.fontWeight = '400';
        }
    }
}

// 错误案例管理模态窗口

// 显示错误案例管理模态窗口
function showErrorCasesModal() {
    const modal = document.getElementById('error-cases-modal');
    if (modal) {
        modal.style.display = 'flex';
        // 加载错误案例
        loadErrorCasesList();
    }
}

// 关闭错误案例管理模态窗口
function closeErrorCasesModal() {
    const modal = document.getElementById('error-cases-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 显示添加错误案例模态窗口
function showAddErrorCaseModal() {
    const modal = document.getElementById('add-error-case-modal');
    if (modal) {
        // 清空表单
        document.getElementById('error-case-question').value = '';
        document.getElementById('error-case-wrong-answer').value = '';
        document.getElementById('error-case-correct-answer').value = '';
        document.getElementById('error-case-reason').value = '';
        document.getElementById('error-case-tags').value = '';
        document.getElementById('error-case-id').value = '';

        // 重置按钮文本
        const saveButton = modal.querySelector('.api-config-btn-save');
        if (saveButton) {
            saveButton.textContent = '保存';
        }

        const titleElement = document.getElementById('error-case-modal-title');
        if (titleElement) {
            titleElement.textContent = '添加错误案例';
        }

        modal.style.display = 'flex';
    }
}

// 关闭添加错误案例模态窗口
function closeAddErrorCaseModal() {
    const modal = document.getElementById('add-error-case-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 保存错误案例
function saveErrorCase() {
    const question = document.getElementById('error-case-question').value.trim();
    const wrongAnswer = document.getElementById('error-case-wrong-answer').value.trim();
    const correctAnswer = document.getElementById('error-case-correct-answer').value.trim();
    const errorReason = document.getElementById('error-case-reason').value.trim();
    const tagsInput = document.getElementById('error-case-tags').value.trim();
    const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    const caseId = document.getElementById('error-case-id').value.trim();

    if (!question || !wrongAnswer || !correctAnswer || !errorReason) {
        showToast('问题、错误回答、正确回答和错误原因不能为空', 'error');
        return;
    }

    // 显示加载状态
    showToast('正在保存错误案例...', 'info');

    if (caseId) {
        // 更新现有案例
        const updatedCase = {
            question: question,
            wrongAnswer: wrongAnswer,
            correctAnswer: correctAnswer,
            errorReason: errorReason,
            tags: tags
        };

        if (updateErrorCase(caseId, updatedCase)) {
            showToast('错误案例更新成功', 'success');
            closeAddErrorCaseModal();
            loadErrorCasesList();
        } else {
            showToast('错误案例更新失败', 'error');
        }
    } else {
        // 添加新案例
        const newCase = {
            question: question,
            wrongAnswer: wrongAnswer,
            correctAnswer: correctAnswer,
            errorReason: errorReason,
            tags: tags
        };

        if (addErrorCase(newCase)) {
            showToast('错误案例添加成功', 'success');
            closeAddErrorCaseModal();
            loadErrorCasesList();
        } else {
            showToast('错误案例添加失败', 'error');
        }
    }
}

// 加载错误案例列表
