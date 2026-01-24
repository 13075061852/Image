/**
 * 数据库逻辑 (IndexedDB)
 * 用于存储大容量图片数据，绕过 LocalStorage 的 5MB 限制
 */
let db;
const DB_NAME = "ImageManagerDB";
const STORE_NAME = "images";

const initDB = () => {
    return new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve();
        };
    });
};

// 状态管理
let allImages = [];
let selectedIds = new Set();
let currentFilter = 'all';
let currentTagFilters = []; // 当前标签筛选（支持多选）
let currentModeFilter = 'ALL'; // 当前模式过滤器 ('DSC', 'TGA', 'ALL')
let currentDetailId = null; // 当前编辑详情的图片ID
let confirmAction = null; // 当前待执行的确认操作
let confirmParams = null; // 确认操作的参数
let dragState = { // 拖动状态
    isDragging: false,
    element: null,
    globalIndex: null,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0
};

// 根据标签生成颜色
function getTagColor(tag) {
    // 创建一个简单的哈希函数来为每个标签生成一致的颜色
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
        hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // 使用哈希值生成HSL颜色，固定饱和度和亮度，只改变色相
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 50%)`;
}

// 去除文件扩展名的辅助函数
function removeFileExtension(name) {
    return name.replace(/\.[^/.]+$/, "");
}

// 检查图片名称是否包含指定后缀的函数
function hasSuffix(name, suffix) {
    const baseName = removeFileExtension(name);
    return baseName.toUpperCase().endsWith(suffix.toUpperCase());
}

// Toast 通知函数
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';
    
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // 3秒后自动消失
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// 加载数据
async function loadImages() {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
        allImages = request.result;
        renderCategories();
        renderGallery();
    };
}

// 检查是否存在相同名称的图片
function checkDuplicateImage(fileName) {
    return allImages.some(img => img.name === fileName);
}

// 等待图片列表加载完成
function waitForImagesLoaded() {
    return new Promise((resolve) => {
        if (allImages.length > 0) {
            resolve();
        } else {
            // 如果图片还未加载，延迟检查
            setTimeout(() => {
                if (allImages.length > 0) {
                    resolve();
                } else {
                    // 再次检查
                    setTimeout(resolve, 100);
                }
            }, 100);
        }
    });
}

// 保存图片
async function saveImage(file, category = '') {
    // 等待图片列表加载完成
    await waitForImagesLoaded();
    
    // 检查是否存在相同名称的图片
    if (checkDuplicateImage(file.name)) {
        // 如果存在相同名称的图片，询问用户是否覆盖
        if (confirm(`文件 "${file.name}" 已存在，是否覆盖？`)) {
            // 执行覆盖操作
            updateExistingImage(file, category);
        } else {
            // 用户选择不覆盖，显示提示信息
            showToast(`跳过上传：文件 "${file.name}" 已存在`, 'warning');
        }
    } else {
        // 文件名不存在，直接保存
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = {
                name: file.name,
                category: category || '',  // 使用传入的分类，或者默认为空
                tags: [],
                data: e.target.result,
                date: new Date().toLocaleString()
            };
            const transaction = db.transaction([STORE_NAME], "readwrite");
            transaction.objectStore(STORE_NAME).add(imageData);
            transaction.oncomplete = () => loadImages();
        };
        reader.readAsDataURL(file);
    }
}

// 更新已存在的图片
async function updateExistingImage(file, category = '') {
    const reader = new FileReader();
    reader.onload = (e) => {
        const newData = e.target.result;
        
        // 开始事务以查找并更新现有图片
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        
        // 查找同名图片
        const request = store.openCursor();
        request.onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor) {
                const item = cursor.value;
                if (item.name === file.name) {
                    // 更新图片数据
                    item.data = newData;
                    item.category = category || item.category; // 如果提供了新分类，则更新分类
                    item.date = new Date().toLocaleString(); // 更新日期
                    
                    // 更新数据库中的记录
                    cursor.update(item);
                    
                    // 完成后重新加载数据
                    transaction.oncomplete = () => {
                        loadImages();
                        showToast(`图片 "${file.name}" 已更新`, 'success');
                    };
                    return;
                }
                cursor.continue();
            }
        };
    };
    reader.readAsDataURL(file);
}

// 渲染分类
function renderCategories() {
    // 获取所有唯一的分类，包括那些没有图片的分类
    // 通过空分类记录和真实图片记录共同确定存在的分类
    const emptyCategoryRecords = allImages.filter(img => img.isEmptyCategory && img.name.startsWith('__EMPTY_IMAGE__')).map(img => img.category);
    const realCategories = allImages.filter(img => !img.isEmptyCategory).map(img => img.category);
    
    // 合并所有分类并去重
    const allCategories = [...new Set([...emptyCategoryRecords, ...realCategories])].filter(cat => cat !== undefined && cat !== 'all');
    
    const container = document.getElementById('category-list');
    
    // 为每个分类计算统计信息并生成HTML（不包括"全部"，因为它已在HTML中静态定义）
    const html = allCategories.map(cat => {
        const categoryImages = allImages.filter(img => img.category === cat && !img.isEmptyCategory);
        const categoryCount = categoryImages.length;
        const selectedCount = categoryImages.filter(img => selectedIds.has(img.id)).length;
        
        return `
            <div class="nav-item ${currentFilter === cat ? 'active' : ''}" onclick="filterCategory('${cat}')">
                <span>${cat}</span>
                <span class="stats">(${categoryCount}) <span class="selected-count">${selectedCount}</span></span>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
    
    // 更新"全部"分类的统计信息（静态定义的按钮）
    updateAllCategoryStats();
    
    // 渲染标签（在主界面上方）
    renderTags();
}

// 更新"全部"分类的统计信息
function updateAllCategoryStats() {
    const allImagesCount = allImages.filter(img => !img.isEmptyCategory).length;
    const allSelectedCount = Array.from(selectedIds).filter(id => {
        const img = allImages.find(i => i.id === id);
        return img && !img.isEmptyCategory;
    }).length;
    
    const allCategoryBtn = document.getElementById('all-category-btn');
    if (allCategoryBtn) {
        allCategoryBtn.innerHTML = `
            <span>全部</span>
            <span class="stats">(${allImagesCount}) <span class="selected-count">${allSelectedCount}</span></span>
        `;
        
        // 保持活动状态类
        if (currentFilter === 'all') {
            allCategoryBtn.classList.add('active');
        } else {
            allCategoryBtn.classList.remove('active');
        }
    }
}

// 渲染标签
function renderTags() {
    const tagContainer = document.getElementById('sub-category-container');
    if (!tagContainer) return;
        
    // 获取所有图片的标签，无论当前分类如何
    let allTags = [];
    if (currentFilter === 'all') {
        // 如果是全部分类，获取所有图片的标签
        allTags = [...new Set(allImages
            .filter(img => !img.isEmptyCategory && img.tags)
            .flatMap(img => img.tags)
        )].sort();
    } else {
        // 如果是特定分类，只获取该分类下的标签
        allTags = [...new Set(allImages
            .filter(img => !img.isEmptyCategory && img.category === currentFilter && img.tags)
            .flatMap(img => img.tags)
        )].sort();
    }
        
    if (allTags.length === 0) {
        // 如果没有标签，不显示标签导航
        tagContainer.innerHTML = '';
        return;
    }
        
    tagContainer.innerHTML = `
        <div style="padding-top: 16px; background: var(--card); display: flex; gap: 10px; overflow-x: auto; align-items: center;">
            <span style="color: var(--text-light); font-size: 14px; margin-right: 8px; font-weight: 500;"></span>
            <button class="btn ${currentTagFilters.length === 0 ? 'btn-primary' : 'btn-secondary'}" onclick="toggleTag('all')" style="padding: 8px 16px; font-size: 13px; min-height: 34px; display: inline-flex; align-items: center; border-radius: 20px; box-shadow: none;">全部</button>
            ${allTags.map(tag => `
                <button class="btn ${currentTagFilters.includes(tag) ? 'btn-primary' : 'btn-secondary'}" onclick="toggleTag('${tag}');" style="padding: 8px 16px; font-size: 13px; min-height: 34px; display: inline-flex; align-items: center; border-radius: 20px; box-shadow: none;">${tag}</button>
            `).join('')}
        </div>
    `;
}

// 渲染画廊
function renderGallery() {
    const container = document.getElementById('gallery');
    
    // 应用主分类和标签的过滤
    let filtered = allImages;
    
    // 过滤掉空分类记录
    filtered = filtered.filter(img => !img.isEmptyCategory);
    
    if (currentFilter !== 'all') {
        filtered = filtered.filter(img => img.category === currentFilter);
    }
    
    // 如果设置了标签过滤（支持多选）
    if (currentTagFilters.length > 0) {
        filtered = filtered.filter(img => {
            if (!img.tags || img.tags.length === 0) return false;
            // 图片必须包含所有选中的标签
            return currentTagFilters.every(tag => img.tags.includes(tag));
        });
    }
    
    // 应用模式过滤（注意：模式过滤在标签过滤之后应用）
    if (currentModeFilter && currentModeFilter !== 'ALL') {
        filtered = filtered.filter(img => hasSuffix(img.name, currentModeFilter));
    }
    
    container.innerHTML = filtered.map(img => {
        const tagsDisplay = img.tags && img.tags.length > 0 ? img.tags.join(', ') : '无标签';
        const categoryDisplay = img.category || '无分类';
        // 检测图片名称是否包含DSC或TGA后缀
        const suffix = hasSuffix(img.name, 'DSC') ? 'DSC' : 
                      hasSuffix(img.name, 'TGA') ? 'TGA' : '';
        return `
        <div class="img-card ${selectedIds.has(img.id) ? 'selected' : ''}" data-id="${img.id}" onclick="toggleSelect(${img.id})" ondblclick="openDetail(${img.id}, event)">
            <input type="checkbox" class="checkbox" ${selectedIds.has(img.id) ? 'checked' : ''}>
            ${suffix ? `<div class="mode-badge ${suffix.toLowerCase()}">${suffix}</div>` : ''}
            <img src="${img.data}" loading="lazy" draggable="false">
            <div class="img-info">
                <strong>${removeFileExtension(img.name)}</strong>
                <small>${categoryDisplay} | ${img.date}</small>
                <div class="img-tags">
                    ${(img.tags && img.tags.length > 0) ? img.tags.map(tag => `<span class="tag-badge" style="background-color: ${getTagColor(tag)}">${tag}</span>`).join(' ') : ''}
                </div>
            </div>
        </div>
    `}).join('');
    updateUI();
}

// 选择逻辑
function toggleSelect(id) {
    if (selectedIds.has(id)) {
        selectedIds.delete(id);
    } else {
        selectedIds.add(id);
    }
    
    // 更新单个卡片的选中状态 - 通过CSS类和复选框状态共同控制
    const card = document.querySelector(`.img-card[data-id="${id}"]`);
    if (card) {
        if (selectedIds.has(id)) {
            card.classList.add('selected');
            const checkbox = card.querySelector('.checkbox');
            if (checkbox) checkbox.checked = true;
        } else {
            card.classList.remove('selected');
            const checkbox = card.querySelector('.checkbox');
            if (checkbox) checkbox.checked = false;
        }
    }
    
    updateUI(); // 确保UI更新
    renderCategories(); // 重新渲染分类以更新统计信息
}

// 全选当前列表
function selectAllVisible() {
    let visible = allImages;
    
    // 过滤掉空分类记录
    visible = visible.filter(img => !img.isEmptyCategory);
    
    if (currentFilter !== 'all') {
        visible = visible.filter(img => img.category === currentFilter);
    }
    
    if (currentTagFilters.length > 0) {
        visible = visible.filter(img => {
            if (!img.tags || img.tags.length === 0) return false;
            return currentTagFilters.every(tag => img.tags.includes(tag));
        });
    }
    
    // 应用模式过滤
    if (currentModeFilter && currentModeFilter !== 'ALL') {
        visible = visible.filter(img => hasSuffix(img.name, currentModeFilter));
    }
    
    // 批量添加到选中集合
    visible.forEach(img => {
        if (img.id != null) {
            selectedIds.add(img.id);
        }
    });
    
    // 批量更新DOM - 只更新当前显示的卡片
    const cards = document.querySelectorAll('.img-card');
    cards.forEach(card => {
        const id = parseInt(card.getAttribute('data-id'));
        const img = visible.find(img => img.id === id);
        if (img) {
            card.classList.add('selected');
        }
    });
    
    updateUI(); // 确保UI更新
    renderCategories(); // 重新渲染分类以更新统计信息
}

// 取消全选
function clearSelection() {
    // 批量清除选中状态
    selectedIds.clear();
    
    // 批量更新DOM - 清除所有选中状态的卡片
    const selectedCards = document.querySelectorAll('.img-card.selected');
    selectedCards.forEach(card => {
        card.classList.remove('selected');
    });
    
    updateUI(); // 确保UI更新
    renderCategories(); // 重新渲染分类以更新统计信息
}

function updateUI() {
    // 更新全选按钮文本
    const toggleBtn = document.getElementById('toggle-select-btn');
    if (toggleBtn) {
        // 计算当前可见的图片数量
        let visible = allImages;
        // 过滤掉空分类记录
        visible = visible.filter(img => !img.isEmptyCategory);
        
        if (currentFilter !== 'all') {
            visible = visible.filter(img => img.category === currentFilter);
        }
        
        if (currentTagFilters.length > 0) {
            visible = visible.filter(img => {
                if (!img.tags || img.tags.length === 0) return false;
                return currentTagFilters.every(tag => img.tags.includes(tag));
            });
        }
        
        // 应用模式过滤
        if (currentModeFilter && currentModeFilter !== 'ALL') {
            visible = visible.filter(img => hasSuffix(img.name, currentModeFilter));
        }
        
        const visibleCount = visible.filter(img => img.id != null).length;
        
        // 计算当前模式下实际选中的图片数量（即同时满足过滤条件且被选中的图片）
        const selectedVisibleCount = visible.filter(img => selectedIds.has(img.id)).length;
        
        // 如果当前模式下选中的图片数量等于当前模式下可见的图片数量，显示"取消全选"，否则显示"全选"
        if (selectedVisibleCount === visibleCount && visibleCount > 0) {
            toggleBtn.innerText = '取消全选';
        } else {
            toggleBtn.innerText = '全选';
        }
    }
    
    // 更新模式切换按钮文本
    const modeToggleBtn = document.getElementById('mode-toggle-btn');
    if (modeToggleBtn) {
        modeToggleBtn.innerText = currentModeFilter;
    }
    
    // 更新移动设备模式切换按钮文本
    const mobileModeToggleBtn = document.getElementById('mobile-mode-toggle-btn');
    if (mobileModeToggleBtn) {
        mobileModeToggleBtn.innerText = currentModeFilter;
    }
    
    // 更新"全部"分类的统计信息
    updateAllCategoryStats();
}

// 切换模式过滤器
function toggleModeFilter() {
    if (currentModeFilter === 'DSC') {
        currentModeFilter = 'TGA';
    } else if (currentModeFilter === 'TGA') {
        currentModeFilter = 'ALL';
    } else { // ALL 或其他情况
        currentModeFilter = 'DSC';
    }
    renderGallery();
    updateUI();
}

// 切换响应式菜单
function toggleResponsiveMenu() {
    const menuPanel = document.getElementById('responsive-menu-panel');
    const isVisible = menuPanel.style.display === 'block';
    
    if (isVisible) {
        menuPanel.style.display = 'none';
    } else {
        // 在显示菜单前，确保它具有正确的样式
        menuPanel.style.display = 'block';
        menuPanel.style.position = 'absolute'; // 确保使用绝对定位
    }
}

// 点击页面其他地方关闭响应式菜单
document.addEventListener('click', function(event) {
    const menuPanel = document.getElementById('responsive-menu-panel');
    const menuButton = document.querySelector('.menu-toggle-btn');
    
    // 如果菜单面板是可见的，且点击的目标不在菜单面板内，也不在菜单按钮内，则关闭菜单
    if (menuPanel && menuPanel.style.display !== 'none' && 
        !menuPanel.contains(event.target) && 
        !menuButton.contains(event.target) && 
        event.target !== menuButton) {
        menuPanel.style.display = 'none';
    }
});

// 切换全选/取消全选
function toggleSelectAll() {
    // 计算当前可见的图片数量
    let visible = allImages;
    // 过滤掉空分类记录
    visible = visible.filter(img => !img.isEmptyCategory);
    
    if (currentFilter !== 'all') {
        visible = visible.filter(img => img.category === currentFilter);
        if (currentTagFilters.length > 0) {
            visible = visible.filter(img => {
                if (!img.tags || img.tags.length === 0) return false;
                return currentTagFilters.every(tag => img.tags.includes(tag));
            });
        }
    }
    
    // 应用模式过滤
    if (currentModeFilter && currentModeFilter !== 'ALL') {
        visible = visible.filter(img => hasSuffix(img.name, currentModeFilter));
    }
    
    const visibleCount = visible.filter(img => img.id != null).length;
    
    // 计算当前模式下实际选中的图片数量（即同时满足过滤条件且被选中的图片）
    const selectedVisibleCount = visible.filter(img => selectedIds.has(img.id)).length;
    
    // 如果当前模式下选中的图片数量等于当前模式下可见的图片数量，则取消全选，否则全选
    if (selectedVisibleCount === visibleCount && visibleCount > 0) {
        // 取消全选 - 批量操作
        visible.forEach(img => {
            if (img.id != null && selectedIds.has(img.id)) {
                selectedIds.delete(img.id);
            }
        });
        
        // 批量更新DOM - 只更新当前显示的相关卡片
        const cards = document.querySelectorAll('.img-card');
        cards.forEach(card => {
            const id = parseInt(card.getAttribute('data-id'));
            const img = visible.find(img => img.id === id);
            if (img) {
                card.classList.remove('selected');
            }
        });
        
        updateUI(); // 确保UI更新
        renderCategories(); // 重新渲染分类以更新统计信息
    } else {
        // 全选 - 批量操作
        visible.forEach(img => {
            if (img.id != null && !selectedIds.has(img.id)) {
                selectedIds.add(img.id);
            }
        });
        
        // 批量更新DOM - 只更新当前显示的相关卡片
        const cards = document.querySelectorAll('.img-card');
        cards.forEach(card => {
            const id = parseInt(card.getAttribute('data-id'));
            const img = visible.find(img => img.id === id);
            if (img) {
                card.classList.add('selected');
            }
        });
        
        updateUI(); // 确保UI更新
        renderCategories(); // 重新渲染分类以更新统计信息
    }
}

// 删除逻辑
function deleteSelected() {
    if (selectedIds.size === 0) return;
    confirmAction = 'deleteSelected';
    confirmParams = { count: selectedIds.size };
    document.getElementById('confirm-message').innerText = `确定要删除选中的 ${selectedIds.size} 张图片吗？`;
    document.getElementById('confirm-modal').style.display = 'flex';
}

// 打印选中的图片
function printSelected() {
    if (selectedIds.size === 0) {
        showToast('请先选择要打印的图片', 'warning');
        return;
    }

    // 获取选中的图片
    const selectedImages = allImages.filter(img => selectedIds.has(img.id) && !img.isEmptyCategory);
    
    if (selectedImages.length === 0) {
        showToast('没有有效的图片可供打印', 'warning');
        return;
    }

    // 创建打印窗口
    const printWindow = window.open('', '_blank');
    
    // 构建打印页面的HTML内容（每张图片单独一页）
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>打印图片 - ${selectedImages.length} 张</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 0;
                    background: white;
                }
                .page {
                    width: 100%;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    page-break-after: always;
                    padding: 20px;
                    box-sizing: border-box;
                }
                .page:last-child {
                    page-break-after: avoid;
                }
                .page img {
                    max-width: 95%;
                    max-height: 80vh;
                    object-fit: contain;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 10px;
                    box-sizing: border-box;
                }
                .page-info {
                    margin-top: 15px;
                    text-align: center;
                    font-size: 14px;
                    color: #555;
                    width: 100%;
                }
                .page-number {
                    position: fixed;
                    bottom: 10px;
                    right: 10px;
                    font-size: 12px;
                    color: #888;
                }
                @media print {
                    body {
                        background: white;
                    }
                    .page-number {
                        position: static;
                        display: block;
                        text-align: right;
                        margin-top: 10px;
                    }
                }
            </style>
        </head>
        <body>
            ${selectedImages.map((img, index) => `
                <div class="page">
                    <img src="${img.data}" alt="${removeFileExtension(img.name)}" />
                    <div class="page-info">
                        <div><strong>名称:</strong> ${removeFileExtension(img.name)}</div>
                        <div><strong>分类:</strong> ${img.category || '无分类'}</div>
                        <div><strong>日期:</strong> ${img.date}</div>
                        <div><strong>标签:</strong> ${(img.tags && img.tags.length > 0) ? img.tags.join(', ') : '无'}</div>
                    </div>
                    <div class="page-number">第 ${index + 1} 页，共 ${selectedImages.length} 页</div>
                </div>
            `).join('')}
            <script>
                // 打印完成后关闭窗口
                window.addEventListener('afterprint', function() {
                    window.close();
                });
                
                // 页面加载完成后自动打开打印对话框
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 500);
                };
            </script>
        </body>
        </html>
    `;
    
    // 写入内容到打印窗口
    printWindow.document.write(printContent);
    printWindow.document.close();
}

// 导出选中的图片
async function exportSelected() {
    if (selectedIds.size === 0) {
        showToast('请先选择要导出的图片', 'warning');
        return;
    }

    // 获取选中的图片
    const selectedImages = allImages.filter(img => selectedIds.has(img.id) && !img.isEmptyCategory);
    
    if (selectedImages.length === 0) {
        showToast('没有有效的图片可供导出', 'warning');
        return;
    }

    // 弹出导出选项对话框
    showExportOptions(selectedImages);
}

// 显示导出选项对话框
function showExportOptions(selectedImages) {
    // 创建对话框HTML
    const dialog = document.createElement('div');
    dialog.className = 'export-options-dialog';
    dialog.innerHTML = `
        <div class="export-options-content">
            <div class="export-options-header">
                <h3>导出选项</h3>
                <button class="export-options-close" onclick="closeExportOptions()">&times;</button>
            </div>
            <div class="export-options-body">
                <p>请选择导出方式 (${selectedImages.length} 张图片):</p>
                <div class="export-option export-option-zip">
                    <div class="export-option-icon">📦</div>
                    <div class="export-option-info">
                        <h4>打包下载</h4>
                        <p>将所有图片打包成ZIP压缩文件</p>
                    </div>
                </div>
                <div class="export-option export-option-individual">
                    <div class="export-option-icon">📁</div>
                    <div class="export-option-info">
                        <h4>单独下载</h4>
                        <p>每张图片单独下载</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 添加样式
    const style = document.createElement('style');
    style.id = 'export-options-style';
    style.textContent = `
        .export-options-dialog {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 3000;
            backdrop-filter: blur(5px);
        }
        
        .export-options-content {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            width: 90%;
            max-width: 500px;
            max-height: 80vh;
            overflow: hidden;
            animation: modalSlideIn 0.3s ease-out;
        }
        
        @keyframes modalSlideIn {
            from {
                opacity: 0;
                transform: scale(0.9) translateY(20px);
            }
            to {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
        }
        
        .export-options-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 24px 24px 0 24px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .export-options-header h3 {
            margin: 0;
            color: #1e293b;
            font-size: 20px;
            font-weight: 600;
        }
        
        .export-options-close {
            background: none;
            border: none;
            font-size: 28px;
            cursor: pointer;
            color: #64748b;
            padding: 0;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.2s;
        }
        
        .export-options-close:hover {
            background: #f1f5f9;
            color: #475569;
        }
        
        .export-options-body {
            padding: 24px;
        }
        
        .export-options-body p {
            margin: 0 0 20px 0;
            color: #64748b;
            font-size: 16px;
        }
        
        .export-option {
            display: flex;
            align-items: center;
            padding: 16px;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            margin-bottom: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .export-option:hover {
            border-color: #94a3b8;
            background: #f8fafc;
            transform: translateY(-2px);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .export-option-icon {
            font-size: 24px;
            margin-right: 16px;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .export-option-info h4 {
            margin: 0 0 4px 0;
            color: #1e293b;
            font-size: 16px;
            font-weight: 600;
        }
        
        .export-option-info p {
            margin: 0;
            color: #64748b;
            font-size: 14px;
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(dialog);
    
    // 添加事件监听器，传递数据
    const zipOption = dialog.querySelector('.export-option-zip');
    const individualOption = dialog.querySelector('.export-option-individual');
    
    // 将数据存储在闭包中
    const selectedImagesInfo = selectedImages.map(img => ({...img, data: undefined}));
    const imageDataString = selectedImages.map(img => img.data).join("|||");
    
    zipOption.addEventListener('click', () => {
        exportAsZip(selectedImagesInfo, imageDataString);
    });
    
    individualOption.addEventListener('click', () => {
        exportIndividually(selectedImagesInfo, imageDataString);
    });
}

// 关闭导出选项对话框
function closeExportOptions() {
    const dialog = document.querySelector('.export-options-dialog');
    const style = document.getElementById('export-options-style');
    
    if (dialog) dialog.remove();
    if (style) style.remove();
}

// 显示导入对话框
function showImportDialog() {
    // 创建对话框HTML
    const dialog = document.createElement('div');
    dialog.className = 'import-dialog';
    dialog.innerHTML = `
        <div class="import-content">
            <div class="import-header">
                <h3>导入数据</h3>
                <button class="import-close" onclick="closeImportDialog()">&times;</button>
            </div>
            <div class="import-body">
                <p>请选择要导入的ZIP文件：</p>
                <div class="file-upload-area" onclick="document.getElementById('import-file-input').click()">
                    <div class="file-upload-icon">📁</div>
                    <p class="file-upload-text">点击选择ZIP文件或拖拽文件到此处</p>
                    <input type="file" id="import-file-input" accept=".zip" style="display: none;" onchange="handleFileImport(event)">
                </div>
                <div class="import-options">
                    <label class="checkbox-label">
                        <input type="checkbox" id="import-overwrite-checkbox"> 覆盖同名图片
                    </label>
                </div>
            </div>
        </div>
    `;

    // 添加样式
    const style = document.createElement('style');
    style.id = 'import-dialog-style';
    style.textContent = `
        .import-dialog {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 3000;
            backdrop-filter: blur(5px);
        }
        
        .import-content {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            width: 90%;
            max-width: 500px;
            max-height: 80vh;
            overflow: hidden;
            animation: modalSlideIn 0.3s ease-out;
        }
        
        @keyframes modalSlideIn {
            from {
                opacity: 0;
                transform: scale(0.9) translateY(20px);
            }
            to {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
        }
        
        .import-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 24px 24px 0 24px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .import-header h3 {
            margin: 0;
            color: #1e293b;
            font-size: 20px;
            font-weight: 600;
        }
        
        .import-close {
            background: none;
            border: none;
            font-size: 28px;
            cursor: pointer;
            color: #64748b;
            padding: 0;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.2s;
        }
        
        .import-close:hover {
            background: #f1f5f9;
            color: #475569;
        }
        
        .import-body {
            padding: 24px;
        }
        
        .import-body p {
            margin: 0 0 20px 0;
            color: #64748b;
            font-size: 16px;
        }
        
        .file-upload-area {
            border: 2px dashed #cbd5e1;
            border-radius: 12px;
            padding: 40px 20px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
            margin-bottom: 20px;
        }
        
        .file-upload-area:hover {
            border-color: #94a3b8;
            background: #f8fafc;
        }
        
        .file-upload-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
        
        .file-upload-text {
            margin: 0;
            color: #64748b;
            font-size: 16px;
        }
        
        .import-options {
            margin-top: 20px;
        }
        
        .checkbox-label {
            display: flex;
            align-items: center;
            font-size: 14px;
            color: #475569;
        }
        
        .checkbox-label input {
            margin-right: 8px;
            transform: scale(1.2);
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(dialog);
    
    // 添加拖拽上传功能
    const uploadArea = dialog.querySelector('.file-upload-area');
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#3b82f6';
        uploadArea.style.backgroundColor = '#dbeafe';
    });
    
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#cbd5e1';
        uploadArea.style.backgroundColor = 'transparent';
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#cbd5e1';
        uploadArea.style.backgroundColor = 'transparent';
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].name.endsWith('.zip')) {
            handleZipFile(files[0]);
        } else {
            showToast('请选择ZIP格式的文件', 'error');
        }
    });
}

// 关闭导入对话框
function closeImportDialog() {
    const dialog = document.querySelector('.import-dialog');
    const style = document.getElementById('import-dialog-style');
    
    if (dialog) dialog.remove();
    if (style) style.remove();
}

// 处理文件导入事件
function handleFileImport(event) {
    const file = event.target.files[0];
    if (file && file.name.endsWith('.zip')) {
        handleZipFile(file);
    } else {
        showToast('请选择ZIP格式的文件', 'error');
    }
}

// 处理ZIP文件导入
async function handleZipFile(file) {
    showToast(`开始导入 ${file.name}...`, 'info');
    
    try {
        // 读取ZIP文件
        const zipContent = await JSZip.loadAsync(file);
        
        // 统计信息
        let totalFiles = 0;
        let importedFiles = 0;
        let skippedFiles = 0;
        
        // 遍历ZIP中的所有文件
        for (const [filename, zipEntry] of Object.entries(zipContent.files)) {
            // 忽略文件夹
            if (zipEntry.dir) continue;
            
            totalFiles++;
            
            // 提取分类名称（路径的第一部分）
            const parts = filename.split('/');
            let category = '';
            let actualFilename = filename;
            
            if (parts.length > 1) {
                category = parts[0];  // 第一部分作为分类
                actualFilename = parts.slice(1).join('/');  // 剩余部分作为文件名
            }
            
            // 检查是否为图片文件
            const ext = actualFilename.split('.').pop().toLowerCase();
            if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) {
                // 检查是否已存在同名文件
                const existingImage = allImages.find(img => img.name === actualFilename);
                
                if (existingImage && !document.getElementById('import-overwrite-checkbox').checked) {
                    skippedFiles++;
                    continue; // 跳过已存在的文件
                }
                
                // 读取文件内容
                const imageData = await zipEntry.async('base64');
                const base64Data = `data:image/${ext};base64,${imageData}`;
                
                // 创建图片对象
                const newImage = {
                    id: Date.now() + Math.random(), // 生成唯一ID
                    name: actualFilename,
                    data: base64Data,
                    category: category || '',
                    date: new Date().toLocaleDateString('zh-CN'),
                    tags: []
                };
                
                // 如果是新分类，添加到分类列表
                if (category && !allImages.some(img => img.category === category && !img.isEmptyCategory)) {
                    // 不需要显式添加分类，saveImage会处理
                }
                
                // 保存到数据库
                await saveImageToDB(newImage);
                
                // 更新内存中的图片列表
                allImages.push(newImage);
                
                importedFiles++;
            }
        }
        
        // 重新渲染界面
        renderGallery();
        renderCategories();
        
        showToast(`导入完成：成功导入 ${importedFiles} 个文件，跳过 ${skippedFiles} 个文件`, 'success');
        closeImportDialog();
        
    } catch (error) {
        console.error('导入失败:', error);
        showToast('导入失败，请重试', 'error');
        closeImportDialog();
    }
}

// 作为ZIP导出
async function exportAsZip(selectedImagesInfo, imageDataString) {
    // 重新构建完整图片数组（因为JSON序列化丢失了data URL）
    const selectedImages = [];
    const imageDataArray = imageDataString.split('|||');
    
    for (let i = 0; i < selectedImagesInfo.length; i++) {
        selectedImages.push({
            ...selectedImagesInfo[i],
            data: imageDataArray[i]
        });
    }
    
    showToast(`开始导出 ${selectedImages.length} 张图片...`, 'info');

    try {
        const zip = new JSZip();
        
        // 按分类组织图片
        const imagesByCategory = {};
        
        for (let i = 0; i < selectedImages.length; i++) {
            const img = selectedImages[i];
            const category = img.category || '未分类'; // 如果没有分类，默认为"未分类"
            
            if (!imagesByCategory[category]) {
                imagesByCategory[category] = [];
            }
            
            imagesByCategory[category].push(img);
        }
        
        // 为每个分类创建子文件夹并将图片放入
        for (const [category, categoryImages] of Object.entries(imagesByCategory)) {
            for (const img of categoryImages) {
                const imgData = img.data;
                
                // 提取文件扩展名
                const extension = img.name.split('.').pop().toLowerCase();
                
                // 从Data URL中提取二进制数据
                const base64Data = imgData.split(',')[1];
                const binaryData = atob(base64Data);
                const arrayBuffer = new Uint8Array(binaryData.length);
                
                for (let j = 0; j < binaryData.length; j++) {
                    arrayBuffer[j] = binaryData.charCodeAt(j);
                }
                
                // 添加图片到对应分类的文件夹中
                zip.file(`${category}/${removeFileExtension(img.name)}.${extension}`, arrayBuffer, { binary: true });
            }
        }

        // 生成ZIP文件
        const zipBlob = await zip.generateAsync({ type: 'blob' });

        // 创建下载链接
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `导出图片_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // 释放URL对象
        URL.revokeObjectURL(url);
        
        showToast(`成功导出 ${selectedImages.length} 张图片（按分类组织）`, 'success');
    } catch (error) {
        console.error('导出失败:', error);
        showToast('导出失败，请重试', 'error');
    } finally {
        closeExportOptions();
    }
}

// 单独导出每张图片
function exportIndividually(selectedImagesInfo, imageDataString) {
    // 重新构建完整图片数组（因为JSON序列化丢失了data URL）
    const selectedImages = [];
    const imageDataArray = imageDataString.split('|||');
    
    for (let i = 0; i < selectedImagesInfo.length; i++) {
        selectedImages.push({
            ...selectedImagesInfo[i],
            data: imageDataArray[i]
        });
    }
    
    showToast(`开始下载 ${selectedImages.length} 张图片...`, 'info');

    // 逐个下载图片
    selectedImages.forEach((img, index) => {
        setTimeout(() => {
            const a = document.createElement('a');
            a.href = img.data;
            a.download = img.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }, index * 100); // 间隔100毫秒下载，避免浏览器拦截
    });
    
    showToast(`已启动下载 ${selectedImages.length} 张图片`, 'success');
    closeExportOptions();
}

function filterCategory(cat) {
    currentFilter = cat;
    // 重置标签筛选
    currentTagFilters = [];
    document.getElementById('current-category').innerText = cat === 'all' ? '全部图片' : cat;
    
    // 更新"全部图片"按钮的选中状态
    const allBtn = document.getElementById('all-category-btn');
    if (allBtn) {
        if (cat === 'all') {
            allBtn.classList.add('active');
        } else {
            allBtn.classList.remove('active');
        }
    }
    
    // 切换分类时清除选中，或保留选中（此处选择保留）
    renderCategories();  // 这会调用 renderTags()
    renderGallery();
}

// 切换标签（单选）
function toggleTag(tag) {
    if (tag === 'all') {
        // 点击"全部"，清空所有标签筛选
        currentTagFilters = [];
    } else {
        // 单选模式，直接替换当前选中的标签
        currentTagFilters = [tag];
    }
    renderGallery();
    renderTags();
}

// 全新分类管理模块的JavaScript功能
// 显示分类管理模态窗口
function showCategoryManagementModal() {
    document.getElementById('category-management-modal').style.display = 'flex';
    loadImages().then(() => {
        renderCategoryManagementContent();
        setupCategoryManagementEvents();
    });
}

// 关闭分类管理模态窗口
function closeCategoryManagementModal() {
    document.getElementById('category-management-modal').style.display = 'none';
    
    // 刷新主界面分类列表以确保同步
    renderCategories();
}

// 渲染分类管理内容
function renderCategoryManagementContent() {
    renderCategoriesList();
    renderTagsListNew();
}

// 渲染主分类列表
function renderCategoriesList() {
    // 获取所有唯一的主分类
    const emptyCategoryRecords = allImages.filter(img => img.isEmptyCategory && img.name.startsWith('__EMPTY_IMAGE__')).map(img => img.category);
    const realCategories = allImages.filter(img => !img.isEmptyCategory).map(img => img.category);
    
    // 合并所有分类并去重，包含空字符串（无分类）
    const allMainCategories = [...new Set([...emptyCategoryRecords, ...realCategories])].filter(cat => cat !== undefined);
    
    const container = document.getElementById('categories-list');
    
    if (allMainCategories.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无主分类</p></div>';
        return;
    }
    
    container.innerHTML = allMainCategories.map(cat => {
        // 计算该分类下的图片数量（空分类也计算）
        const imageCount = allImages.filter(img => img.category === cat && !img.isEmptyCategory).length;
        const displayName = cat || '无分类';
        // 如果是"无分类"，不显示重命名按钮
        const canRename = cat !== '';
        
        return `
            <div class="item-row">
                <div class="item-info">
                    <div class="item-name">📁 ${displayName}</div>
                    <div class="item-meta">${imageCount} 张图片</div>
                </div>
                <div class="item-actions">
                    ${canRename ? `<button class="action-btn rename-btn" data-type="category" data-name="${cat}" onclick="prepareRename('${cat}', 'category')">✏️ 重命名</button>` : ''}
                    <button class="action-btn delete-btn" data-type="category" data-name="${cat || ''}" onclick="prepareDelete('${cat || ''}', 'category')">🗑️ 删除</button>
                </div>
            </div>
        `;
    }).join('');
}

// 渲染标签列表
function renderTagsListNew() {
    // 获取所有唯一的标签
    const allTags = [...new Set(allImages
        .filter(img => img.tags && img.tags.length > 0)
        .flatMap(img => img.tags)
    )].sort();
    
    const container = document.getElementById('tags-list');
    
    if (allTags.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无标签</p></div>';
        return;
    }
    
    container.innerHTML = allTags.map(tag => {
        // 计算该标签下的图片数量
        const imageCount = allImages.filter(img => img.tags && img.tags.includes(tag)).length;
        
        return `
            <div class="item-row">
                <div class="item-info">
                    <div class="item-name">🏷️ ${tag}</div>
                    <div class="item-meta">${imageCount} 张图片</div>
                </div>
                <div class="item-actions">
                    <button class="action-btn rename-btn" data-type="tag" data-name="${tag}" onclick="prepareRename('${tag}', 'tag')">✏️ 重命名</button>
                    <button class="action-btn delete-btn" data-type="tag" data-name="${tag}" onclick="prepareDelete('${tag}', 'tag')">🗑️ 删除</button>
                </div>
            </div>
        `;
    }).join('');
}

// 设置分类管理事件
function setupCategoryManagementEvents() {
    // 标签页切换
    document.querySelectorAll('.tab-link').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            // 更新标签页
            document.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // 显示对应面板
            document.querySelectorAll('.tab-pane-new').forEach(pane => pane.classList.remove('active'));
            document.getElementById(tabName).classList.add('active');
        });
    });
    
    // 关闭模态窗口
    const closeBtn = document.getElementById('close-category-modal');
    if (closeBtn) {
        closeBtn.removeEventListener('click', closeCategoryManagementModal); // 移除可能已存在的事件监听器
        closeBtn.addEventListener('click', closeCategoryManagementModal);
    }
    
    // 添加分类按钮
    const addCategoryBtn = document.getElementById('add-category-btn');
    if (addCategoryBtn) {
        addCategoryBtn.removeEventListener('click', handleAddCategoryClick); // 移除可能已存在的事件监听器
        addCategoryBtn.addEventListener('click', handleAddCategoryClick);
    }
    
    // 添加标签按钮
    const addTagBtn = document.getElementById('add-tag-btn');
    if (addTagBtn) {
        addTagBtn.removeEventListener('click', handleAddTagClick); // 移除可能已存在的事件监听器
        addTagBtn.addEventListener('click', handleAddTagClick);
    }
    
    // 回车添加分类
    const categoryInput = document.getElementById('new-category-input');
    if (categoryInput) {
        categoryInput.removeEventListener('keypress', handleCategoryKeyPress); // 移除可能已存在的事件监听器
        categoryInput.addEventListener('keypress', handleCategoryKeyPress);
    }
    
    // 回车添加标签
    const tagInput = document.getElementById('new-tag-input-modal');
    if (tagInput) {
        tagInput.removeEventListener('keypress', handleTagKeyPress); // 移除可能已存在的事件监听器
        tagInput.addEventListener('keypress', handleTagKeyPress);
    }
    
    setupDialogEvents();
}

// 处理添加分类按钮点击
function handleAddCategoryClick() {
    const input = document.getElementById('new-category-input');
    const categoryName = input.value.trim();
    
    if (!categoryName) {
        showToast('请输入分类名称', 'warning');
        return;
    }
    
    addCategory(categoryName);
    input.value = '';
}

// 处理添加标签按钮点击
function handleAddTagClick() {
    const input = document.getElementById('new-tag-input-modal');
    const tagName = input.value.trim();
    
    if (!tagName) {
        showToast('请输入标签名称', 'warning');
        return;
    }
    
    addTag(tagName);
    input.value = '';
}

// 处理分类输入框按键
function handleCategoryKeyPress(e) {
    if (e.key === 'Enter') {
        document.getElementById('add-category-btn').click();
    }
}

// 处理标签输入框按键
function handleTagKeyPress(e) {
    if (e.key === 'Enter') {
        document.getElementById('add-tag-btn').click();
    }
}

// 设置对话框事件
function setupDialogEvents() {
    // 重命名对话框事件
    document.getElementById('close-rename-dialog').addEventListener('click', closeRenameDialog);
    document.getElementById('cancel-rename').addEventListener('click', closeRenameDialog);
    document.getElementById('confirm-rename').addEventListener('click', executeRename);
    
    // 确认对话框事件
    document.getElementById('close-confirm-dialog').addEventListener('click', closeConfirmDialog);
    document.getElementById('cancel-confirm').addEventListener('click', closeConfirmDialog);
    document.getElementById('confirm-action').addEventListener('click', executeConfirmAction);
    
    // 重命名输入框回车事件
    document.getElementById('rename-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            executeRename();
        }
    });
}

// 添加分类
async function addCategory(name) {
    // 检查是否已存在
    const existingCategories = [...new Set(allImages.map(img => img.category).filter(cat => cat))];
    if (existingCategories.includes(name)) {
        showToast('该分类已存在', 'warning');
        return;
    }
    
    // 添加一个空分类记录（用于显示分类列表）
    const emptyCategoryRecord = {
        name: '__EMPTY_IMAGE__' + name,
        category: name,
        tags: [],
        data: '',
        date: new Date().toLocaleString(),
        isEmptyCategory: true
    };
    
    const transaction = db.transaction([STORE_NAME], "readwrite");
    transaction.objectStore(STORE_NAME).add(emptyCategoryRecord);
    
    transaction.oncomplete = async () => {
        await loadImages(); // 重新加载数据
        renderCategories(); // 刷新侧边栏分类列表
        
        // 强制更新分类管理弹窗内容（不管是否打开，都准备更新）
        renderCategoryManagementContent();
        
        showToast(`主分类 "${name}" 已添加`, 'success');
    };
}

// 添加标签
async function addTag(name) {
    // 检查是否已存在
    const existingTags = [...new Set(allImages
        .filter(img => img.tags)
        .flatMap(img => img.tags)
    )];
    if (existingTags.includes(name)) {
        showToast('该标签已存在', 'warning');
        return;
    }
    
    // 为了确保标签列表能被正确显示，我们需要在某个图片上添加标签，或者创建一个临时记录
    // 但实际上，标签只是在图片上使用的，所以这里只需提醒用户
    showToast(`标签 "${name}" 已添加，您可以在上传图片或编辑图片详情时使用此标签`, 'success');
    
    // 强制更新分类管理弹窗内容（不管是否打开，都准备更新）
    await loadImages();
    renderCategoryManagementContent();
}

// 准备重命名
let renameType = null;
let renameOldName = null;

function prepareRename(name, type) {
    renameType = type;
    renameOldName = name;
    
    document.getElementById('rename-input').value = name;
    document.getElementById('rename-dialog').style.display = 'flex';
    document.getElementById('rename-input').focus();
}

// 执行重命名
function executeRename() {
    const newName = document.getElementById('rename-input').value.trim();
    
    if (!newName) {
        showToast('请输入新名称', 'warning');
        return;
    }
    
    if (renameOldName === newName) {
        closeRenameDialog();
        return;
    }
    
    if (renameType === 'category') {
        renameCategory(renameOldName, newName);
    } else if (renameType === 'tag') {
        renameTagNew(renameOldName, newName);
    }
}

// 重命名分类
async function renameCategory(oldName, newName) {
    // 检查新名称是否已存在
    const existingCategories = [...new Set(allImages.map(img => img.category).filter(cat => cat))];
    if (existingCategories.includes(newName)) {
        showToast('该分类名称已存在', 'warning');
        return;
    }
    
    // 更新数据库中所有使用该分类的图片
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const objectStore = transaction.objectStore(STORE_NAME);
    
    objectStore.openCursor().onsuccess = async function(event) {
        const cursor = event.target.result;
        if (cursor) {
            const value = cursor.value;
            if (value.category === oldName) {
                value.category = newName;
                cursor.update(value);
            } else if (value.isEmptyCategory && value.category === oldName) {
                // 更新空分类记录
                value.category = newName;
                value.name = '__EMPTY_IMAGE__' + newName;
                cursor.update(value);
            }
            cursor.continue();
        } else {
            await loadImages(); // 重新加载数据
            renderCategories(); // 刷新侧边栏分类列表
            
            // 强制更新分类管理弹窗内容（不管是否打开，都准备更新）
            renderCategoryManagementContent();
            
            showToast(`已将分类 "${oldName}" 重命名为 "${newName}"`, 'success');
            closeRenameDialog();
        }
    };
}

// 重命名标签（新的实现）
async function renameTagNew(oldName, newName) {
    // 检查新名称是否已存在
    const existingTags = [...new Set(allImages
        .filter(img => img.tags)
        .flatMap(img => img.tags)
    )];
    if (existingTags.includes(newName)) {
        showToast('该标签名称已存在', 'warning');
        return;
    }
    
    // 更新数据库中所有使用该标签的图片
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const objectStore = transaction.objectStore(STORE_NAME);
    
    objectStore.openCursor().onsuccess = async function(event) {
        const cursor = event.target.result;
        if (cursor) {
            const value = cursor.value;
            if (value.tags && value.tags.includes(oldName)) {
                // 替换标签
                value.tags = value.tags.map(tag => tag === oldName ? newName : tag);
                cursor.update(value);
            }
            cursor.continue();
        } else {
            await loadImages(); // 重新加载数据
            
            // 强制更新分类管理弹窗内容（不管是否打开，都准备更新）
            renderCategoryManagementContent();
            
            showToast(`已将标签 "${oldName}" 重命名为 "${newName}"`, 'success');
            closeRenameDialog();
        }
    };
}

// 准备删除
let deleteType = null;
let deleteName = null;

function prepareDelete(name, type) {
    deleteType = type;
    deleteName = name;
    
    const displayName = type === 'category' ? (name || '无分类') : name;
    document.getElementById('confirm-message').textContent = 
        `确定要删除${type === 'category' ? '分类' : '标签'} "${displayName}" 吗？此操作不可撤销。`;
    document.getElementById('confirm-dialog').style.display = 'flex';
}

// 执行确认操作
function executeConfirmAction() {
    if (deleteType === 'category') {
        deleteCategory(deleteName);
    } else if (deleteType === 'tag') {
        deleteTagNew(deleteName);
    }
}

// 删除分类
async function deleteCategory(name) {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const objectStore = transaction.objectStore(STORE_NAME);
    
    objectStore.openCursor().onsuccess = async function(event) {
        const cursor = event.target.result;
        if (cursor) {
            const value = cursor.value;
            if (value.category === name) {
                if (value.isEmptyCategory) {
                    // 删除空分类记录
                    cursor.delete();
                } else {
                    // 将图片分类设为null（无分类）
                    value.category = null;
                    cursor.update(value);
                }
            }
            cursor.continue();
        } else {
            await loadImages(); // 重新加载数据
            renderCategories(); // 刷新侧边栏分类列表
            
            // 强制更新分类管理弹窗内容（不管是否打开，都准备更新）
            renderCategoryManagementContent();
            
            showToast(`分类 "${name || '无分类'}" 已删除`, 'success');
            closeConfirmDialog();
        }
    };
}

// 删除标签（新的实现）
async function deleteTagNew(name) {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const objectStore = transaction.objectStore(STORE_NAME);
    
    objectStore.openCursor().onsuccess = async function(event) {
        const cursor = event.target.result;
        if (cursor) {
            const value = cursor.value;
            if (value.tags && value.tags.includes(name)) {
                // 从标签数组中移除该标签
                value.tags = value.tags.filter(tag => tag !== name);
                cursor.update(value);
            }
            cursor.continue();
        } else {
            await loadImages(); // 重新加载数据
            
            // 强制更新分类管理弹窗内容（不管是否打开，都准备更新）
            renderCategoryManagementContent();
            
            showToast(`标签 "${name}" 已删除`, 'success');
            closeConfirmDialog();
        }
    };
}

// 关闭重命名对话框
function closeRenameDialog() {
    document.getElementById('rename-dialog').style.display = 'none';
    renameType = null;
    renameOldName = null;
    
    // 刷新分类管理内容以确保界面同步
    if(document.getElementById('category-management-modal').style.display === 'flex') {
        renderCategoryManagementContent();
    }
}

// 关闭确认对话框
function closeConfirmDialog() {
    document.getElementById('confirm-dialog').style.display = 'none';
    deleteType = null;
    deleteName = null;
    
    // 刷新分类管理内容以确保界面同步
    if(document.getElementById('category-management-modal').style.display === 'flex') {
        renderCategoryManagementContent();
    }
}

// 页面加载完成后初始化
window.onload = function() {
    initDB().then(() => {
        loadImages();
        
        // 添加文件上传事件监听器
        const fileInput = document.getElementById('fileInput');
        fileInput.addEventListener('change', function(e) {
            const files = e.target.files;
            if (files.length > 0) {
                for (let i = 0; i < files.length; i++) {
                    saveImage(files[i], currentFilter); // 传递当前分类
                }
                // 清空 input 以便下次可以选择相同的文件
                fileInput.value = '';
            }
        });
        
        // 添加拖拽上传事件监听器
        const gallery = document.getElementById('gallery');
        const mainDiv = document.getElementById('main');
        
        // 阻止浏览器默认的拖拽行为
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            gallery.addEventListener(eventName, preventDefaults, false);
            mainDiv.addEventListener(eventName, preventDefaults, false);
        });
        
        // 高亮拖拽区域
        ['dragenter', 'dragover'].forEach(eventName => {
            gallery.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            gallery.addEventListener(eventName, unhighlight, false);
        });
        
        // 处理文件拖拽释放
        gallery.addEventListener('drop', handleDrop, false);
        
        // 添加全局鼠标事件监听器用于对比页面的图片拖动
        document.addEventListener('mousemove', handleGlobalMouseMove);
        document.addEventListener('mouseup', handleGlobalMouseUp);
    });
}

// 全局鼠标移动事件处理器
function handleGlobalMouseMove(e) {
    if (!dragState.isDragging || !dragState.element) return;
    
    const imgEl = dragState.element;
    const globalIndex = dragState.globalIndex;
    
    const newX = e.clientX - dragState.startX + dragState.initialX;
    const newY = e.clientY - dragState.startY + dragState.initialY;
    
    // 获取图片容器的尺寸
    const containerRect = imgEl.parentElement.getBoundingClientRect();
    const imgRect = imgEl.getBoundingClientRect();
    
    // 计算容器和图片的实际尺寸
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    const imgNaturalWidth = imgEl.naturalWidth || imgRect.width * (imageZoomLevels[globalIndex] / 100);
    const imgNaturalHeight = imgEl.naturalHeight || imgRect.height * (imageZoomLevels[globalIndex] / 100);
    
    // 计算缩放后的图片尺寸
    const zoomFactor = imageZoomLevels[globalIndex] / 100;
    const scaledWidth = imgNaturalWidth * zoomFactor;
    const scaledHeight = imgNaturalHeight * zoomFactor;
    
    // 计算边界限制
    let boundedX = newX;
    let boundedY = newY;
    
    // 水平边界 - 确保图片不会完全脱离容器
    if (scaledWidth > containerWidth) {
        // 如果图片比容器宽，限制移动范围
        boundedX = Math.max(containerWidth - scaledWidth, Math.min(0, newX));
    } else {
        // 如果图片比容器窄，限制在容器中央附近（允许在一定范围内移动）
        boundedX = Math.max(containerWidth - scaledWidth, Math.min(0, newX));
    }
    
    // 垂直边界 - 确保图片不会完全脱离容器
    if (scaledHeight > containerHeight) {
        // 如果图片比容器高，限制移动范围
        boundedY = Math.max(containerHeight - scaledHeight, Math.min(0, newY));
    } else {
        // 如果图片比容器矮，限制在容器中央附近（允许在一定范围内移动）
        boundedY = Math.max(containerHeight - scaledHeight, Math.min(0, newY));
    }
    
    // 更新拖动状态
    dragState.currentX = boundedX;
    dragState.currentY = boundedY;
    
    // 更新图片样式
    imgEl.style.transform = `translate(${boundedX}px, ${boundedY}px) scale(${zoomFactor})`;
}

// 全局鼠标抬起事件处理器
function handleGlobalMouseUp() {
    if (dragState.isDragging && dragState.element) {
        dragState.element.style.cursor = 'grab';
        dragState.isDragging = false;
        dragState.element = null;
        dragState.globalIndex = null;
    }
}

// 阻止默认行为
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// 高亮拖拽区域
function highlight(e) {
    const target = e.target.closest('#gallery');
    if (target) {
        target.classList.add('drag-over');
    }
}

// 取消高亮
function unhighlight(e) {
    const target = e.target.closest('#gallery');
    if (target) {
        target.classList.remove('drag-over');
    }
}

// 处理拖拽释放
function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    // 检查是否有文件被拖入（外部文件拖入），而不是页面内的元素拖动
    if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            // 检查是否为图片文件
            if (files[i].type.startsWith('image/')) {
                saveImage(files[i], currentFilter); // 使用当前分类
            }
        }
    }
    
    // 移除高亮
    unhighlight(e);
}

// 对比功能 - 分页和布局管理
let currentPage = 0;
let compareImages = [];
let zoomIndex = 0; // 当前放大查看的图片索引（相对于 compareImages）
const IMAGES_PER_PAGE = 4;
let imageZoomLevels = {}; // 存储每张图片的缩放级别

function openCompare() {
    if (selectedIds.size === 0) return showToast("请先选择至少一张图片进行对比", 'warning');
    
    compareImages = allImages.filter(img => selectedIds.has(img.id));
    currentPage = 0;
    zoomIndex = 0; // 初始化缩放索引
    imageZoomLevels = {}; // 重置缩放级别
    renderComparePage();
    document.getElementById('compare-overlay').style.display = 'flex';
}

function closeCompare() {
    document.getElementById('compare-overlay').style.display = 'none';
    currentPage = 0;
}

// 对比页面翻页功能
function nextPage() {
    const totalPages = Math.ceil(compareImages.length / IMAGES_PER_PAGE);
    if (currentPage < totalPages - 1) {
        currentPage++;
        renderComparePage();
    }
}

function prevPage() {
    if (currentPage > 0) {
        currentPage--;
        renderComparePage();
    }
}

// 键盘快捷键支持
document.addEventListener('keydown', (e) => {
    const compareOverlay = document.getElementById('compare-overlay');
    const zoomOverlay = document.getElementById('zoom-overlay');
    const isCompareOpen = compareOverlay && compareOverlay.style.display === 'flex';
    const isZoomOpen = zoomOverlay && zoomOverlay.style.display === 'flex';

    // 如果放大层打开，优先处理放大层的快捷键
    if (isZoomOpen) {
        if (e.key === 'Escape') {
            e.preventDefault();
            zoomOverlay.classList.add('hidden');
            zoomOverlay.style.display = 'none';
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (zoomIndex > 0) {
                openZoomByIndex(zoomIndex - 1);
            }
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            if (zoomIndex < compareImages.length - 1) {
                openZoomByIndex(zoomIndex + 1);
            }
        }
        return;
    }

    if (isCompareOpen) {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            prevPage();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            nextPage();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeCompare();
        }
    }
});

function renderComparePage() {
    const container = document.getElementById('compare-container');
    const startIdx = currentPage * IMAGES_PER_PAGE;
    const endIdx = Math.min(startIdx + IMAGES_PER_PAGE, compareImages.length);
    const pageImages = compareImages.slice(startIdx, endIdx);
    const totalPages = Math.ceil(compareImages.length / IMAGES_PER_PAGE);
    
    // 根据当前页实际图片数量确定布局类名
    const layoutClass = 'layout-' + pageImages.length;
    
    // 创建网格容器
    const grid = document.createElement('div');
    grid.className = `compare-grid ${layoutClass}`;
    
    // 添加图片项
    grid.innerHTML = pageImages.map((img, idx) => {
        const globalIndex = startIdx + idx;
        const zoomLevel = imageZoomLevels[globalIndex] || 100;
        const categoryDisplay = img.category || '无分类';
        return `
        <div class="compare-item">
            <img 
                src="${img.data}" 
                alt="${img.name}" 
                data-index="${globalIndex}"
                data-zoom-level="${zoomLevel}"
                draggable="false"
                style="transform: scale(${zoomLevel / 100});"
                onerror="this.onerror=null;this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjhGOEY4Ii8+Cjx0ZXh0IHg9IjIwMCIgeT0iMTUwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBOb3QgRm91bmQ8L3RleHQ+Cjwvc3ZnPg==';">
        </div>
    `}).join('');
    
    // 清空容器并添加网格
    container.innerHTML = '';
    container.appendChild(grid);
    
    // 为当前页图片绑定滚轮缩放事件和拖动事件（移除点击事件，防止误触）
    setTimeout(() => {
        const imgs = grid.querySelectorAll('img');
        imgs.forEach((imgEl, idx) => {
            const globalIndex = startIdx + idx;
            
            // 滚轮事件 - 用于缩放图片
            imgEl.addEventListener('wheel', (e) => {
                e.preventDefault();
                
                const delta = e.deltaY > 0 ? -10 : 10;
                const currentZoom = imageZoomLevels[globalIndex] || 100;
                let newZoom = currentZoom + delta;
                
                // 限制缩放范围 50% - 300%
                newZoom = Math.max(50, Math.min(300, newZoom));
                
                // 更新缩放级别
                imageZoomLevels[globalIndex] = newZoom;
                
                // 重置位置，因为缩放后位置可能会变化
                if(dragState.globalIndex === globalIndex) {
                    dragState.initialX = 0;
                    dragState.initialY = 0;
                }
                
                // 更新图片样式
                imgEl.style.transform = `translate(${dragState.globalIndex === globalIndex ? dragState.currentX || 0 : 0}px, ${dragState.globalIndex === globalIndex ? dragState.currentY || 0 : 0}px) scale(${newZoom / 100})`;
            });
            
            // 鼠标按下事件 - 开始拖动
            imgEl.addEventListener('mousedown', (e) => {
                // 如果已经有其他图片正在被拖动，先结束之前的拖动
                if(dragState.isDragging && dragState.element !== imgEl) {
                    if(dragState.element) {
                        dragState.element.style.cursor = 'grab';
                    }
                }
                
                // 设置当前拖动状态
                dragState.isDragging = true;
                dragState.element = imgEl;
                dragState.globalIndex = globalIndex;
                dragState.startX = e.clientX;
                dragState.startY = e.clientY;
                dragState.initialX = dragState.currentX || 0;
                dragState.initialY = dragState.currentY || 0;
                
                imgEl.style.cursor = 'grabbing';
                e.preventDefault();
            });
        });
    }, 0);
}

// 放大预览功能
function openZoomByIndex(index) {
    if (!compareImages || !compareImages.length) return;
    if (index < 0 || index >= compareImages.length) return;
    zoomIndex = index;

    const overlay = document.getElementById('zoom-overlay');
    const img = document.getElementById('zoom-image');
    const text = document.getElementById('zoom-title');
    const list = document.getElementById('zoom-list');
    if (!overlay || !img || !text || !list) return;

    const current = compareImages[zoomIndex];
    img.src = current.data;
    img.alt = removeFileExtension(current.name || '');
    text.textContent = `${removeFileExtension(current.name || '')} (${current.category || ''})`;

    // 渲染左侧缩略图列表（带名称）
    list.innerHTML = compareImages.map((imgItem, idx) => `
        <div class="zoom-thumb ${idx === zoomIndex ? 'active' : ''}" onclick="setZoomIndex(${idx}, event)" title="${removeFileExtension(imgItem.name || '')}">
            <img src="${imgItem.data}" alt="${removeFileExtension(imgItem.name || '')}" draggable="false">
            <span>${removeFileExtension(imgItem.name || '')}</span>
        </div>
    `).join('');

    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
    
    // 为放大覆盖层添加滚轮事件监听器，用于切换图片
    overlay.onwheel = (e) => {
        e.preventDefault();
        if (e.deltaY < 0) {
            // 向上滚动，显示前一张图片
            if (zoomIndex > 0) {
                openZoomByIndex(zoomIndex - 1);
            }
        } else {
            // 向下滚动，显示后一张图片
            if (zoomIndex < compareImages.length - 1) {
                openZoomByIndex(zoomIndex + 1);
            }
        }
    };
}

function setZoomIndex(index, event) {
    if (event) {
        event.stopPropagation();
    }
    openZoomByIndex(index);
}

function closeZoom(event) {
    // 只有点击蒙层空白区域才关闭，避免点到图片本身也关闭
    if (event && event.target && !event.target.closest('.zoom-content')) {
        const overlay = document.getElementById('zoom-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.style.display = 'none';
        }
    }
}

// 切换放大视图
function toggleZoomView() {
    if (compareImages && compareImages.length > 0) {
        // 如果当前处于对比页面且有图片，打开放大视图
        openZoomByIndex(zoomIndex || 0);
    }
}

// 图片详情功能
function openDetail(id, event) {
    if (event) {
        event.stopPropagation();
    }
    
    const img = allImages.find(i => i.id === id);
    if (!img) return;
    
    currentDetailId = id;
    
    // 填充详情信息
    document.getElementById('detail-image').src = img.data;
    document.getElementById('detail-image').setAttribute('draggable', 'false');
    document.getElementById('detail-name').value = removeFileExtension(img.name || '');
    document.getElementById('detail-date').value = img.date || '';
    
    // 渲染标签列表
    renderDetailTags(img.tags || []);
    
    // 填充分类选项
    const categorySelect = document.getElementById('detail-category');
    
    // 获取所有主分类
    const allCategories = [...new Set(allImages.map(img => img.category).filter(cat => cat))];
    categorySelect.innerHTML = allCategories.map(cat => 
        `<option value="${cat}" ${cat === img.category ? 'selected' : ''}>${cat}</option>`
    ).join('');
    
    // 添加"无分类"选项
    categorySelect.innerHTML = `<option value="" ${!img.category ? 'selected' : ''}>无分类</option>` + categorySelect.innerHTML;
    

    
    // 显示弹窗
    document.getElementById('detail-overlay').style.display = 'flex';
}

// 渲染详情标签列表
function renderDetailTags(tags) {
    const container = document.getElementById('detail-tags-container');
    container.innerHTML = tags.map(tag => `
        <span style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 6px; font-size: 12px; font-weight: 500;">
            ${tag}
            <button type="button" onclick="removeTagFromDetail('${tag}')" style="background: none; border: none; color: white; cursor: pointer; font-size: 14px; line-height: 1; padding: 0; margin-left: 4px;">&times;</button>
        </span>
    `).join('');
}

// 添加标签到详情
function addTagToDetail() {
    const input = document.getElementById('detail-tags-input');
    const tag = input.value.trim();
    
    if (!tag) {
        showToast('请输入标签名称', 'warning');
        return;
    }
    
    const img = allImages.find(i => i.id === currentDetailId);
    if (!img) return;
    
    const currentTags = img.tags || [];
    if (currentTags.includes(tag)) {
        showToast('该标签已存在', 'warning');
        return;
    }
    
    currentTags.push(tag);
    img.tags = currentTags;
    
    input.value = '';
    renderDetailTags(currentTags);
}

// 从详情中移除标签
function removeTagFromDetail(tag) {
    const img = allImages.find(i => i.id === currentDetailId);
    if (!img) return;
    
    img.tags = (img.tags || []).filter(t => t !== tag);
    renderDetailTags(img.tags);
}

function saveDetail() {
    if (!currentDetailId) return;
    
    const img = allImages.find(i => i.id === currentDetailId);
    if (!img) return;
    
    // 更新图片信息
    img.category = document.getElementById('detail-category').value;
    
    // 标签已经在添加/删除时更新了，不需要再处理
    
    // 保存到数据库
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.put(img);
    
    transaction.oncomplete = () => {
        closeDetail();
        renderGallery();
        renderCategories();
        showToast('保存成功！', 'success');
    };
    
    transaction.onerror = () => {
        showToast('保存失败！', 'error');
    };
}

function closeDetail() {
    document.getElementById('detail-overlay').style.display = 'none';
    currentDetailId = null;
}

