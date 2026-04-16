const SPECIALIST_KB_VERSION = 'plastics-spectra-expert-v4';
const SPECIALIST_QA_VERSION = 'plastics-spectra-qa-v4';

function createDefaultSpecialistKnowledgeBase() {
    const now = new Date().toISOString();
    const entries = [
        {
            id: 'kb-dsc-core-principles',
            title: 'DSC判读核心原则',
            tags: ['DSC', '塑料', '热分析', '结晶', '玻璃化', '熔融'],
            content: `DSC分析塑料时，优先识别玻璃化转变温度(Tg)、冷结晶峰(Tcc)、熔融峰(Tm)与氧化/反应放热峰。
- Tg通常表现为基线台阶，不是尖锐峰。
- 半结晶聚合物常出现Tm，非晶聚合物通常没有明显熔融峰。
- 同一材料出现多个熔融峰，可能与晶型差异、重结晶、共混或加工热史有关。
- 仅凭一张DSC曲线不能精确给出配方比例，只能结合峰位、峰面积、已知材料数据库和其他谱图给出“可能物质 + 粗略占比区间”。`
        },
        {
            id: 'kb-tga-core-principles',
            title: 'TGA判读核心原则',
            tags: ['TGA', '塑料', '热重', '灰分', '填料', '分解'],
            content: `TGA重点看起始分解温度、最大失重速率区间、分段失重台阶与最终残炭/灰分。
- 单一步骤失重常提示主体树脂较单一。
- 多步骤失重通常提示共混、增塑剂/阻燃剂挥发、填料包覆体系或多组分材料。
- 高残余率可能对应玻纤、滑石粉、碳酸钙、阻燃体系或无机填料。
- 通过残余率可估算无机填料占比，但应明确说明这是基于热稳定假设的近似值。`
        },
        {
            id: 'kb-ftir-core-principles',
            title: '红外光谱(FTIR/IR)判读核心原则',
            tags: ['红外', 'FTIR', 'IR', '塑料', '官能团'],
            content: `红外判读先看特征吸收峰，再做材料排除法。
- 1710–1750 cm^-1 常见酯基C=O。
- 2230–2260 cm^-1 需关注腈基。
- 3200–3500 cm^-1 需关注N-H/O-H。
- 1600、1500、1410、870、720 cm^-1 组合常提示芳香环或碳酸盐填料。
- 红外适合判断官能团和主体树脂类型，不适合仅凭单张谱图精确计算所有添加剂比例。`
        },
        {
            id: 'kb-common-polymers',
            title: '常见塑料材料的典型图谱线索',
            tags: ['PET', 'PBT', 'PA6', 'PA66', 'PC', 'PP', 'PE', 'ABS', 'POM', 'DSC', 'TGA', '红外'],
            content: `常见塑料经验线索：
- PET：DSC常见Tg约70–85°C，Tm约245–260°C；IR常见酯基C=O与芳环特征。
- PBT：DSC常见Tm约220–235°C；IR也有酯基C=O，但结晶行为与PET不同。
- PA6：DSC常见Tm约215–225°C；IR有酰胺I/II带，吸湿影响明显。
- PA66：DSC常见Tm约250–265°C；IR同样有酰胺特征，但热行为高于PA6。
- PC：DSC常见明显Tg约145°C、无典型熔融峰；IR可见碳酸酯特征。
- PP：DSC常见Tm约160–170°C；TGA通常单步分解为主。
- PE：DSC常见Tm约110–135°C；不同密度PE峰位略有差异。
- ABS：DSC更关注Tg而非明显Tm；IR需结合腈基与苯环特征。
- POM：DSC常见高结晶熔融行为；热分解较集中。`
        },
        {
            id: 'kb-dsc-pbt-pet-blend-rules',
            title: 'PBT/PET 共混体系的 DSC 判读规则',
            tags: ['PBT', 'PET', '共混', 'DSC', '聚酯', '熔融峰'],
            content: `分析 PBT/PET 体系时，不能因为出现一个更强的低温熔融峰就直接只认定为 PBT 单一材料，必须先判断是否存在双聚酯共混的证据。
- 若同一张 DSC 中同时出现约220–235°C 与约245–260°C 两组相对独立的熔融/重结晶特征，应优先考虑 PBT/PET 共混，而不是单一 PBT。
- 约225°C 左右峰更常支持 PBT 结晶相，约250–260°C 左右峰更常支持 PET 结晶相。
- 如果高温峰较弱、峰面积较小或与肩峰相连，也不能直接忽略 PET；应表达为“PET 可能为次要组分或较低比例组分”。
- 若只看到 220–235°C 单峰，且没有 245–260°C 附近独立特征，才更倾向单一 PBT 或以 PBT 为绝对主相。
- 若只看到 245–260°C 单峰，且没有 220–235°C 附近独立特征，才更倾向单一 PET 或以 PET 为绝对主相。
- 遇到双峰、肩峰、分裂峰或升降温过程分别对应不同峰位时，必须把“共混”“共聚”“重结晶/热史影响”都列为候选解释，并按证据强弱排序。
- 输出时必须明确写出：更像单一材料、明显共混体系，还是现有证据不足以区分。`
        },
        {
            id: 'kb-fillers-additives',
            title: '填料、阻燃剂与添加剂识别原则',
            tags: ['填料', '阻燃剂', '玻纤', '碳酸钙', '滑石粉', 'TGA', '红外'],
            content: `配方推断时优先区分主体树脂与无机组分：
- TGA残余灰分高：优先怀疑玻纤、滑石粉、碳酸钙等无机填料。
- IR在1400/870/710 cm^-1附近明显特征：可怀疑碳酸钙。
- TGA前段低温失重：可能存在增塑剂、小分子助剂或水分。
- 阻燃体系常造成多阶段分解、残炭增加或特殊灰分表现。
- 未出现直接证据时，不要武断认定具体商品级添加剂。`
        },
        {
            id: 'kb-mixture-ratio-rules',
            title: '曲线推断物质与占比时的回答规范',
            tags: ['占比', '混配', '配方', '曲线分析', '专家规范'],
            content: `当用户要求“这条曲线最可能有哪些物质、占比大概多少”时，必须遵守：
- 先列证据：峰位/失重台阶/残余率/特征区间。
- 再列候选物质，并给出高/中/低置信度。
- 占比只能给“粗略区间”，如“主体树脂约60–80%”。
- 若缺少坐标、积分面积、基线、测试气氛或升温速率，必须主动说明不确定性。
- 单一图谱无法支持精确百分比时，禁止伪造到个位数甚至小数点的配方比例。`
        },
        {
            id: 'kb-dsc-composition-estimation',
            title: 'DSC 粗略估算主体树脂占比的计算思路',
            tags: ['DSC', '占比', '主成分', '计算', '熔融焓', '结晶焓'],
            content: `DSC 可用于“非常粗略”地估算半结晶主体树脂比例，但前提是材料类型已基本锁定，且只适合给区间，不适合给精确配方。
- 第一步：先判断是单一树脂、双树脂共混，还是证据不足；未完成这一步前，不要直接报比例。
- 第二步：记录各独立熔融峰/冷结晶峰对应的温区、峰顶温度与焓值(ΔHm、ΔHcc)。
- 第三步：对同一树脂的有效结晶焓，常用近似为 ΔHeff = ΔHm - ΔHcc；若存在多重熔融/重结晶，要先说明这是热史或晶型重排影响，比例只能更粗略。
- 第四步：若已知候选树脂的理论 100% 结晶熔融焓 ΔH0，可用 “树脂质量分数 ≈ ΔHeff / (ΔH0 × 该树脂在样品中的结晶度假设)” 做区间化估算。
- 因为真实结晶度通常未知，工程上更适合反推区间而不是单点值；同一树脂注塑料常只能给宽区间。
- 对双树脂共混，可比较各自独立峰区的有效焓占比，再结合各自 ΔH0 与结晶能力差异，给出主相/次相的大致范围。
- 若没有可靠积分、基线、二次升温数据或树脂类型不明，则禁止把 DSC 当作主成分定量的唯一依据。`
        },
        {
            id: 'kb-dsc-filler-toughener-limits',
            title: 'DSC 判断玻纤、矿物填料和增韧剂的边界',
            tags: ['DSC', '玻纤', '填料', '增韧剂', '限制', '边界'],
            content: `仅凭 DSC，通常不能直接确认玻纤含量、增韧剂种类或其精确比例，必须强调证据边界。
- 玻纤、滑石粉、碳酸钙等无机填料本身在 DSC 中通常不出现明确熔融峰；它们更多通过“稀释主体树脂焓值”“改变结晶速率/峰形”间接体现。
- 因此，DSC 只能提示“可能存在较高无机填料”或“焓值偏低、结晶行为受填料影响”，不能单凭 DSC 断言“含 30% 玻纤”。
- 玻纤判断应优先结合 TGA 灰分、灼烧残余、密度、显微切片或材料规格信息。
- 增韧剂/弹性体如果是低结晶或无定形相，在 DSC 中常没有清晰独立熔融峰；更多表现为主体树脂结晶度下降、Tg 台阶变化或低温弱转变。
- 若没有清晰 Tg 台阶、独立低温事件、FTIR 特征峰或冲击性能背景，不能仅凭 DSC 确认“存在增韧剂”。
- 更稳妥的表达应是“若样品确有增韧改性，其证据在这张 DSC 中并不充分，建议结合 FTIR、DMA、TGA 或灰分测试确认”。`
        }
    ];

    return {
        id: 'default-kb',
        version: SPECIALIST_KB_VERSION,
        name: '塑料图谱专家知识库',
        description: '聚焦 DSC、TGA、红外光谱在塑料领域中的判读、物质识别与粗略配方估算规则。',
        entries: entries.map(entry => ({ ...entry, createdAt: now, updatedAt: now }))
    };
}

function createDefaultSpecialistQualityAnswers() {
    const now = new Date().toISOString();
    return {
        id: 'default-qa',
        version: SPECIALIST_QA_VERSION,
        name: '塑料图谱优质回答库',
        description: '规范 AI 在塑料图谱分析中的回答结构、证据表达与不确定性管理。',
        entries: [
            {
                id: 'qa-spectrum-structure',
                question: '请分析这条塑料图谱最可能的物质和大概占比',
                content: `推荐回答结构：
1. 体系判断：先明确这是更像单一材料、共混体系，还是证据不足。
2. 结论摘要：主体树脂、次要组分、可能填料、置信度。
3. 证据分析：峰位/失重台阶/残余率/特征区间，并逐条对应候选物。
4. 候选物质与置信度：高/中/低，不能漏掉次峰支持的次要组分。
5. 粗略占比估计：主体树脂、次要树脂、填料、可能助剂。
6. 不确定性与建议：说明单谱图局限与补充测试建议。`,
                tags: ['塑料', '图谱', '占比', 'DSC', 'TGA', '红外'],
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'qa-blend-vs-single',
                question: '如何避免把共混体系误判成单一材料',
                content: `回答约束：
1. 先做“单一材料 / 共混体系 / 证据不足”判断，再给材料名称。
2. 只要存在第二组独立峰、肩峰、分裂峰或另一组特征区间，就必须讨论次要组分是否存在。
3. 不能因为主峰更强就省略次峰对应的材料，尤其是 PBT/PET、PA6/PA66 等易共混体系。
4. 若判断为共混，必须写出主相、次相和判断依据；若不能确认，也必须说明为什么不能确认。`,
                tags: ['共混', '单一材料', 'DSC', '回答规范', 'PBT', 'PET'],
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'qa-dsc-composition-estimation',
                question: 'DSC 怎么分析主成分和粗略占比',
                content: `回答规范：
1. 先给出材料体系判断，再讨论占比，不能跳过体系判断直接报比例。
2. 对 DSC 中每个独立熔融峰/冷结晶峰，分别说明它更支持哪类树脂。
3. 若提到占比，必须说明这是基于峰位、有效焓值和经验结晶度假设的粗略区间，不是实验室定量结果。
4. 若用户追问玻纤、矿物填料、增韧剂，应先说明 DSC 的证据边界：可提示可能性，但不能把 DSC 单独当成定量证据。
5. 推荐输出时把“能判断的树脂相”和“不能仅靠 DSC 确认的填料/助剂”分开写。`,
                tags: ['DSC', '主成分', '占比', '玻纤', '增韧剂', '回答规范'],
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'qa-example-dsc-single-polymer',
                question: '请示范一段专业的 DSC 单一材料判读回答',
                content: `体系判断：
这张 DSC 更像以单一半结晶树脂为主，而不是明显共混体系。

结论摘要：
主体树脂优先考虑 PBT，高置信度。当前图中没有足够强的第二组独立高温熔融特征，因此暂不支持把 PET 作为明确共混组分写入结论。

证据分析：
1. 主熔融峰位于约 220–230°C 区间，更符合 PBT 的典型熔融范围。
2. 曲线中若仅见单一主熔融事件，而无 245–260°C 附近独立峰，则对 PET 的支持不足。
3. 若同时存在结晶放热峰，应解释为结晶重排或热史影响，而不是直接当作第二树脂证据。

候选物质与置信度：
- PBT：高
- PET：低
- 其他聚酯共混物：低

粗略占比估计：
若按单一主体树脂处理，可表述为“PBT 为绝对主相，约 80–100% 的树脂相”；但总配方占比仍需结合 TGA/灰分判断。

不确定性与建议：
这只是基于 DSC 的树脂相判断；若要确认是否存在填料、玻纤或少量改性相，建议补充 TGA、FTIR 或材料规格信息。`,
                tags: ['DSC', '单一材料', 'PBT', '示范回答'],
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'qa-example-dsc-blend-polyester',
                question: '请示范一段专业的 PBT/PET 共混 DSC 判读回答',
                content: `体系判断：
这张 DSC 更像 PBT/PET 共混体系，而不是单一 PBT。

结论摘要：
主体树脂优先考虑 PBT，次要树脂考虑 PET。若 220–235°C 与 245–260°C 两组特征同时存在，应把 PET 明确写成候选次相，而不能因为高温峰较弱就省略。

证据分析：
1. 约 220–235°C 的主熔融事件支持 PBT 结晶相。
2. 约 245–260°C 的独立高温熔融峰支持 PET 结晶相。
3. 若还存在 190–210°C 一带结晶/重结晶事件，可解释为聚酯体系在升温过程中的结构重排，但这不影响“双树脂证据”优先级。

候选物质与置信度：
- PBT：高
- PET：中到高
- 其他聚酯共混解释：低到中

粗略占比估计：
仅基于 DSC，可保守写为“PBT 约 60–85%，PET 约 10–35%”。不要把这个区间写成实验室级定量配方。

不确定性与建议：
若需要进一步缩小比例区间，应结合二次升温积分、FTIR 和 TGA；若需要判断是否含玻纤或阻燃体系，DSC 单独不足以确认。`,
                tags: ['DSC', 'PBT', 'PET', '共混', '示范回答'],
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'qa-example-filler-boundary',
                question: '请示范一段关于玻纤和增韧剂边界的专业回答',
                content: `结论摘要：
基于这张 DSC，可以讨论主体树脂及其结晶行为，但不能把玻纤、矿物填料或增韧剂的存在与比例当作已确认事实。

规范回答方式：
1. 玻纤/矿物填料：
只能说“若样品含较高无机填料，可能导致单位质量焓值下降或峰形改变”，不能直接写成“含 30% 玻纤”。
2. 增韧剂：
只能说“若存在无定形增韧相，可能引起结晶度下降、峰变宽或 Tg 台阶变化”；若图中没有清晰低温转变或配套 FTIR/TGA 证据，就不能确认其存在。
3. 建议：
玻纤优先看 TGA 灰分或灼烧残余；增韧剂优先结合 FTIR、DMA、冲击性能或材料背景判断。

推荐措辞：
“这张 DSC 对树脂相判断较有帮助，但对玻纤和增韧剂的证据不足，当前只能提示可能性，不能单独据此定量或定性确认。”`,
                tags: ['DSC', '玻纤', '增韧剂', '边界', '示范回答'],
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'qa-example-insufficient-evidence',
                question: '请示范一段证据不足时的专业回答',
                content: `体系判断：
现有 DSC 证据不足以把样品明确归为单一材料或特定共混体系。

结论摘要：
可以提出若干候选树脂，但当前不支持把其中某一种写成确定结论。

证据分析：
1. 峰位与多个候选材料区间存在重叠。
2. 缺少可靠积分、清晰基线、二次升温数据或补充谱图。
3. 现有图像分辨率或标注信息不足，限制了进一步定量判断。

规范措辞：
- 可以说“更倾向于”“优先考虑”“不能排除”。
- 不要说“就是”“确定为”“占比为 23.7%”。

建议：
优先补充二次升温 DSC、TGA、FTIR 或已知配方背景，再缩小候选范围。`,
                tags: ['DSC', '证据不足', '谨慎表达', '示范回答'],
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'qa-knowledge-priority',
                question: '知识库和模型直觉冲突时怎么回答',
                content: `优先级规则：
1. 知识库已有明确结论时，优先遵守知识库。
2. 图谱证据不足时，必须明确说“现有证据不足”。
3. 可以提出备选假设，但必须标注为备选，不能覆盖知识库已有明确事实。`,
                tags: ['知识库', '规则', '约束'],
                createdAt: now,
                updatedAt: now
            }
        ]
    };
}

function upsertDefaultEntries(existingEntries = [], defaultEntries = []) {
    const existingMap = new Map(existingEntries.map(entry => [entry.id, entry]));
    defaultEntries.forEach(defaultEntry => {
        if (!existingMap.has(defaultEntry.id)) {
            existingMap.set(defaultEntry.id, defaultEntry);
        }
    });
    return Array.from(existingMap.values());
}

function ensureSpecialistKnowledgeAssets() {
    const defaultKb = createDefaultSpecialistKnowledgeBase();
    const savedKbRaw = localStorage.getItem('knowledgeBase');

    if (!savedKbRaw) {
        saveKnowledgeBase(defaultKb);
    } else {
        try {
            const savedKb = JSON.parse(savedKbRaw);
            if (!savedKb.version || savedKb.version !== SPECIALIST_KB_VERSION) {
                saveKnowledgeBase({
                    ...defaultKb,
                    ...savedKb,
                    version: SPECIALIST_KB_VERSION,
                    name: savedKb.name || defaultKb.name,
                    description: savedKb.description || defaultKb.description,
                    entries: upsertDefaultEntries(savedKb.entries || [], defaultKb.entries)
                });
            }
        } catch (error) {
            saveKnowledgeBase(defaultKb);
        }
    }

    const defaultQa = createDefaultSpecialistQualityAnswers();
    const savedQaRaw = localStorage.getItem('qualityAnswers');
    if (!savedQaRaw) {
        saveQualityAnswers(defaultQa);
    } else {
        try {
            const savedQa = JSON.parse(savedQaRaw);
            if (!savedQa.version || savedQa.version !== SPECIALIST_QA_VERSION) {
                saveQualityAnswers({
                    ...defaultQa,
                    ...savedQa,
                    version: SPECIALIST_QA_VERSION,
                    name: savedQa.name || defaultQa.name,
                    description: savedQa.description || defaultQa.description,
                    entries: upsertDefaultEntries(savedQa.entries || [], defaultQa.entries)
                });
            }
        } catch (error) {
            saveQualityAnswers(defaultQa);
        }
    }
}

function tokenizeKnowledgeQuery(query = '') {
    return Array.from(new Set(
        query
            .toLowerCase()
            .replace(/[^\u4e00-\u9fa5a-z0-9+\-./%\s]/g, ' ')
            .split(/\s+/)
            .map(token => token.trim())
            .filter(token => token.length >= 2)
    ));
}

function scoreKnowledgeEntry(entry, query, tokens) {
    const title = (entry.title || '').toLowerCase();
    const content = (entry.content || '').toLowerCase();
    const tags = (entry.tags || []).join(' ').toLowerCase();
    const haystack = `${title} ${content} ${tags}`;

    let score = 0;
    if (query && haystack.includes(query)) score += 20;
    tokens.forEach(token => {
        if (title.includes(token)) score += 6;
        if (tags.includes(token)) score += 5;
        if (content.includes(token)) score += 2;
    });
    return score;
}

function buildSpectraExpertSystemPrompt(userQuery, imageData, relevantKnowledge, relevantQualityAnswers, relevantErrorCases) {
    const imageCount = Array.isArray(imageData) ? imageData.length : 0;
    const isCurveTask = /(dsc|tga|ftir|红外|光谱|图谱|曲线|热重|热分析|谱图|峰|失重|熔融|玻璃化)/i.test(userQuery || '');

    let systemContent = `你是一名塑料材料图谱专家，专长于 DSC、TGA、红外光谱(FTIR/IR) 在塑料领域的判读、物质识别和粗略配方推断。

核心规则：
1. 知识库中的明确事实优先级高于模型直觉，禁止与知识库明确内容冲突。
2. 如果图谱证据不足，必须明确说“不足以确定”或“只能给出候选物质与粗略区间”。
3. 不允许编造精确配方比例、测试条件、峰面积、积分结果或商品牌号。
4. 回答必须围绕证据展开，不能只给结论不给理由。
5. 遇到多峰、肩峰、分裂峰、不同温区独立特征时，必须先判断是单一材料、共混体系，还是热史/重结晶导致的复杂峰形。
6. 不能因为某个主峰更强就忽略次峰对应的次要组分；如果存在第二组独立证据，必须讨论次要组分是否存在。
7. 当前任务涉及 ${imageCount} 张图片，请优先基于图像中的曲线/谱图信息分析。`;

    if (relevantKnowledge) systemContent += `\n\n## 必须遵守的知识库\n${relevantKnowledge}`;
    if (relevantQualityAnswers) systemContent += `\n\n## 回答风格参考\n${relevantQualityAnswers}`;
    if (relevantErrorCases) systemContent += `\n\n## 错误案例警示\n${relevantErrorCases}`;

    systemContent += `\n\n## 输出要求
- 直接回答，不要寒暄。
- 使用 Markdown。
- 优先输出“体系判断”“结论摘要”“证据分析”“候选物质与置信度”“粗略占比估计”“不确定性与建议”这几个部分。`;

    if (relevantQualityAnswers) {
        systemContent += `\n- 回答时要学习“回答风格参考”中的分析顺序、措辞边界和证据表达方式，但不要机械照抄示例内容。`;
    }

    if (isCurveTask) {
        systemContent += `
- 当用户要求判断“最可能存在的物质”时，至少列出 2-5 个候选，并标注高/中/低置信度。
- 当用户要求“占比大概是多少”时，只能给粗略区间，例如“主体树脂约 60-80%”，并说明估算依据。
- 若图中看得出残余灰分、分段失重、Tg/Tm/特征吸收峰，请逐条引用这些证据。
- 若没有坐标、峰值标注、测试气氛、升温速率或积分信息，必须提醒这会限制定量判断。
- 若存在两个或以上相互分离的熔融峰/重结晶峰/特征区间，必须先讨论是否为共混体系，不能直接按单一材料下结论。
- 对 PBT/PET 这类易共混体系，若同时出现约220–235°C 与约245–260°C 两组特征，必须明确讨论 PBT 与 PET 是否同时存在。
- 若用户追问主成分比例，必须把“树脂相粗略区间估算”和“玻纤/填料/增韧剂只能间接判断”分开回答。
- 若用户追问玻纤、矿物填料、增韧剂，必须明确说明 DSC 单独证据是否足够；不够时要直接写“不能仅凭这张 DSC 确认”。
- 禁止把单张 DSC/TGA/IR 图片分析包装成实验室级定量结论。`;
    }

    return systemContent;
}

function loadKnowledgeBase() {
    try {
        const knowledgeBaseData = localStorage.getItem('knowledgeBase');
        return knowledgeBaseData ? JSON.parse(knowledgeBaseData) : createDefaultSpecialistKnowledgeBase();
    } catch (error) {
        return createDefaultSpecialistKnowledgeBase();
    }
}

function searchKnowledgeBase(query) {
    const knowledgeBase = loadKnowledgeBase();
    const normalizedQuery = (query || '').toLowerCase().trim();
    const tokens = tokenizeKnowledgeQuery(normalizedQuery);

    return (knowledgeBase.entries || [])
        .map(entry => ({ entry, score: scoreKnowledgeEntry(entry, normalizedQuery, tokens) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.entry);
}

function getRelevantKnowledge(userQuery, maxResults = 5) {
    const relevantEntries = searchKnowledgeBase(userQuery);
    return relevantEntries.slice(0, maxResults).map(entry => {
        const tags = entry.tags && entry.tags.length ? `标签: ${entry.tags.join(', ')}` : '';
        return `【${entry.title}】\n${tags}\n${entry.content}`.trim();
    }).join('\n\n');
}

function loadQualityAnswers() {
    try {
        const qualityAnswersData = localStorage.getItem('qualityAnswers');
        return qualityAnswersData ? JSON.parse(qualityAnswersData) : createDefaultSpecialistQualityAnswers();
    } catch (error) {
        return createDefaultSpecialistQualityAnswers();
    }
}

async function callOpenRouterAPI(imageData, resultElement, existingMessages = []) {
    const config = getAPIConfig();

    const isVisionModel = supportsImageInput(config.model);
    if (!isVisionModel) {
        throw new Error('当前模型不支持图片输入，请在 API 配置中切换到支持视觉的模型。');
    }

    const messages = existingMessages.length > 0 ? [...existingMessages] : [];

    if (messages.length === 0) {
        messages.push({
            role: 'user',
            content: [
                { type: 'text', text: '请分析这张图。' }
            ]
        });
    } else {
        const lastMessage = messages[messages.length - 1];
        if (!lastMessage || lastMessage.role !== 'user') {
            messages.push({
                role: 'user',
                content: [{ type: 'text', text: '请结合图片继续分析。' }]
            });
        }
    }

    let lastUserMessage = null;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
            lastUserMessage = messages[i];
            break;
        }
    }

    if (!lastUserMessage) {
        lastUserMessage = { role: 'user', content: [{ type: 'text', text: '请分析这张图。' }] };
        messages.push(lastUserMessage);
    }

    if (!Array.isArray(lastUserMessage.content)) {
        lastUserMessage.content = [{ type: 'text', text: String(lastUserMessage.content || '') }];
    }

    const userQuery = lastUserMessage.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n')
        .trim();

    const relevantKnowledge = isKnowledgeBaseEnabled ? getRelevantKnowledge(userQuery) : '';
    const relevantQualityAnswers = isQualityAnswersEnabled ? getRelevantQualityAnswers(userQuery) : '';
    const relevantErrorCases = isErrorCasesEnabled ? getRelevantErrorCases(userQuery) : '';
    const systemContent = buildSpectraExpertSystemPrompt(userQuery, imageData, relevantKnowledge, relevantQualityAnswers, relevantErrorCases);

    messages.unshift({
        role: 'system',
        content: systemContent
    });

    for (const image of imageData) {
        lastUserMessage.content.push({
            type: 'image_url',
            image_url: { url: image.data }
        });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
            model: config.model,
            messages,
            stream: true
        })
    });

    if (!response.ok) {
        try {
            const errorData = await response.json();
            throw new Error(`API调用失败: ${response.status} ${response.statusText} - ${errorData.error?.message || '未知错误'}`);
        } catch (e) {
            throw new Error(`API调用失败: ${response.status} ${response.statusText}`);
        }
    }

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
            if (!line.startsWith('data: ')) continue;
            const data = line.substring(6);
            if (data === '[DONE]') {
                return fullResponse;
            }

            try {
                const json = JSON.parse(data);
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                    fullResponse += content;
                    resultElement.innerHTML = formatAIResponse(fullResponse);
                }
            } catch (error) {
                console.warn('流式响应解析失败', error);
            }
        }
    }

    return fullResponse;
}

function initAIAnalysis() {
    ensureSpecialistKnowledgeAssets();
    initAPIConfig();
    initAIAnalysisEvents();
}
