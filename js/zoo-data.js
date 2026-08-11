/**
 * ==================== 红山动物星球 · 核心数据 ====================
 *
 * 数据来源：
 *   - 动物身份 & 关系矩阵：《红山动物星球-全量动物关系矩阵》
 *   - 语言风格规则：《红山科普对话-语言风格匹配方案-应用版》
 *
 * 包含：
 *   1. ANIMAL_IDENTITIES — 9种可选游客动物身份
 *   2. VENUES — 24个可选场馆（含矩阵编码）
 *   3. RELATIONSHIP_MATRIX — 游客身份 × 展区 关系查询
 *   4. LANGUAGE_STYLES — L1-L5 语言风格规则
 *   5. ZooData — 统一查询接口
 */

// ==================== 1. 游客动物身份（9种） ====================
const ANIMAL_IDENTITIES = [
  { id: 'V1',  name: '细尾獴',   emoji: '🦊', code: 'V1',  category: '獴科',   habitat: '非洲干旱草原', diet: '虫食/肉食', homeVenue: 'Z9' },
  { id: 'V3',  name: '小熊猫',   emoji: '🐾', code: 'V3',  category: '小熊猫科', habitat: '亚洲高山森林', diet: '竹子/杂食', homeVenue: 'F2' },
  { id: 'V23', name: '川金丝猴', emoji: '🐒', code: 'V23', category: '疣猴科',  habitat: '中国西南',    diet: '杂食/叶',  homeVenue: 'F4' },
  { id: 'V27', name: '猕猴',     emoji: '🐵', code: 'V27', category: '猴科',    habitat: '亚洲广布',    diet: '杂食',     homeVenue: 'Z10' },
  { id: 'V5',  name: '雪豹',     emoji: '🐆', code: 'V5',  category: '猫科',    habitat: '中亚高山',    diet: '肉食',     homeVenue: 'Z5' },
  { id: 'V6',  name: '猎豹',     emoji: '🐆', code: 'V6',  category: '猫科',    habitat: '非洲草原',    diet: '肉食',     homeVenue: 'Z6' },
  { id: 'V7',  name: '狞猫',     emoji: '🐈', code: 'V7',  category: '猫科',    habitat: '非洲/亚洲',   diet: '肉食',     homeVenue: 'Z6' },
  { id: 'V10', name: '东北虎',   emoji: '🐯', code: 'V10', category: '猫科',    habitat: '亚洲森林',    diet: '肉食',     homeVenue: 'Z7' },
  { id: 'V11', name: '灰狼',     emoji: '🐺', code: 'V11', category: '犬科',    habitat: '北半球广布',  diet: '肉食(群猎)', homeVenue: 'Z3' }
];

// ==================== 2. 场馆列表（24个可选场馆） ====================
// code 对应关系矩阵中的展区编号
const VENUES = [
  { code: 'F8',  name: '唐家河',           animals: '川金丝猴、小熊猫、小麂' },
  { code: 'N5',  name: '澳洲袋鼠角',       animals: '岩大袋鼠' },
  { code: 'N1',  name: '非洲之歌',         animals: '细尾獴、耳廓狐' },
  { code: 'N6',  name: '狐猴之家',         animals: '环尾狐猴、褐美狐猴' },
  { code: 'F6',  name: '河马馆',           animals: '河马' },
  { code: 'X1',  name: '热带鸟馆',         animals: '犀鸟、红鹮、冠鹤' },
  { code: 'Z10', name: '猴山',             animals: '猕猴' },
  { code: 'F2',  name: '高黎贡',           animals: '小熊猫、长臂猿' },
  { code: 'F3',  name: '冈瓦纳',           animals: '白面僧面猴、水豚、火烈鸟' },
  { code: 'Z6',  name: '猫科星球',         animals: '猎豹、狞猫、美洲豹、薮猫' },
  { code: 'F5',  name: '猩猩馆',           animals: '红猩猩、黑猩猩' },
  { code: 'X1b', name: '犀鸟馆',           animals: '双角犀鸟、花冠皱盔犀鸟' },
  { code: 'X2',  name: '獐麂坡',           animals: '獐、麂' },
  { code: 'Z2',  name: '本土物种保育区',   animals: '扬子鳄、东方白鹳、貉' },
  { code: 'F1',  name: '考拉馆',           animals: '考拉家族' },
  { code: 'Z8',  name: '大象馆',           animals: '亚洲象' },
  { code: 'Z7',  name: '虎馆',             animals: '东北虎、孟加拉虎' },
  { code: 'Z4',  name: '熊馆',             animals: '棕熊、黑熊' },
  { code: 'Z5',  name: '中国猫科馆',       animals: '豹猫、雪豹、云豹、猞猁' },
  { code: 'Z3',  name: '狼馆',             animals: '灰狼' },
  { code: 'Z9',  name: '细尾獴馆',         animals: '细尾獴、耳廓狐' },
  { code: 'Z1',  name: '大熊猫区',         animals: '大熊猫' },
  { code: 'F4',  name: '亚洲灵长区',       animals: '红猩猩、川金丝猴、长臂猿' }
  // 注：Z11 长颈鹿馆因无坐标数据暂未纳入可选场馆
];

// ==================== 2.5 场馆坐标（经纬度） ====================
// 数据来源：桌面"场馆坐标.txt"
// 注意：已修正"非洲之歌"纬度笔误（38→32）、"公共厕所"分隔符（,→.）
// ENTRANCE 为南门起点；FACILITY_* 为快捷动作设施点
const VENUE_COORDS = {
  ENTRANCE:   { name: '红山森林动物园（南门）', lng: 118.801492, lat: 32.088742 }, // 起点
  F8:         { name: '唐家河',           lng: 118.800020, lat: 32.090856 },
  N5:         { name: '澳洲袋鼠角',       lng: 118.805705, lat: 32.088717 },
  N1:         { name: '非洲之歌',         lng: 118.801400, lat: 32.089421 }, // 已修正 38→32
  N6:         { name: '狐猴之家',         lng: 118.800229, lat: 32.092921 },
  F6:         { name: '河马馆',           lng: 118.804250, lat: 32.087944 },
  X1:         { name: '热带鸟馆',         lng: 118.800511, lat: 32.091846 },
  Z10:        { name: '猴山',             lng: 118.803399, lat: 32.091488 },
  F2:         { name: '高黎贡',           lng: 118.805660, lat: 32.091265 },
  F3:         { name: '冈瓦纳',           lng: 118.805218, lat: 32.089142 },
  Z6:         { name: '猫科星球',         lng: 118.805527, lat: 32.094258 },
  F5:         { name: '猩猩馆',           lng: 118.804479, lat: 32.088686 },
  X1b:        { name: '犀鸟馆',           lng: 118.799030, lat: 32.091107 },
  X2:         { name: '獐麂坡',           lng: 118.799578, lat: 32.091228 },
  Z2:         { name: '本土物种保育区',   lng: 118.801979, lat: 32.091594 },
  F1:         { name: '考拉馆',           lng: 118.804409, lat: 32.090646 },
  Z8:         { name: '大象馆',           lng: 118.804946, lat: 32.090911 },
  Z7:         { name: '虎馆',             lng: 118.804677, lat: 32.092662 },
  Z4:         { name: '熊馆',             lng: 118.806166, lat: 32.093533 },
  Z5:         { name: '中国猫科馆',       lng: 118.805395, lat: 32.092794 },
  Z3:         { name: '狼馆',             lng: 118.802808, lat: 32.092343 },
  Z9:         { name: '细尾獴馆',         lng: 118.802040, lat: 32.091093 },
  Z1:         { name: '大熊猫区',         lng: 118.801420, lat: 32.092888 },
  F4:         { name: '亚洲灵长区',       lng: 118.804559, lat: 32.089272 },
  // --- 设施点（用于快捷动作：餐厅/卫生间/市集） ---
  FACILITY_RESTAURANT: { name: '红山主题餐厅', lng: 118.804021, lat: 32.089745 },
  FACILITY_TOILET:     { name: '公共厕所（本土动物馆）', lng: 118.801220, lat: 32.091874 }, // 已修正 ,→.
  FACILITY_MARKET:     { name: '红山市集', lng: 118.800380, lat: 32.093750 }
};

// 地图边界（用于经纬度→图片像素转换，取场馆范围并外扩 8% 边距）
const MAP_BOUNDS = (function() {
  const pts = Object.values(VENUE_COORDS);
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  pts.forEach(p => {
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  });
  const padLng = (maxLng - minLng) * 0.08;
  const padLat = (maxLat - minLat) * 0.08;
  return { minLng: minLng - padLng, maxLng: maxLng + padLng, minLat: minLat - padLat, maxLat: maxLat + padLat };
})();

// ==================== 3. 关系矩阵查询 ====================
// 关系类型：天=天敌遭遇战 / 巡=狩猎巡猎 / 家=同类回家 / 亲=同科远亲 / 友=友好共存 / 中=中立跨大陆拜访
const RELATIONSHIP_MATRIX = {
  // --- 大红山片区 ---
  'Z1': { // 大熊猫馆
    'V3':  { type: '亲', tone: '远亲拜访：都吃竹子的"熊猫亲戚"', photo: '并肩站立、对比大小' },
    'V4':  { type: '家', tone: '回家：大熊猫馆是老家', photo: '拥抱、家族合影' },
    'V5':  { type: '中', tone: '跨栖息地：高山雪原 vs 竹林', photo: '好奇探头、合影留念' },
    'V11': { type: '中', tone: '跨栖息地', photo: '好奇探头、合影留念' },
    'default': { type: '中', tone: '跨大陆拜访', photo: '好奇探头、合影留念' }
  },
  'Z2': { // 本土物种保育区
    'V10': { type: '巡', tone: '狩猎场巡猎：顶级捕食者巡视本土猎物', photo: '俯身窥视、低吼示威' },
    'V5':  { type: '巡', tone: '狩猎场巡猎：猫科捕食者', photo: '俯身窥视' },
    'V6':  { type: '巡', tone: '狩猎场巡猎：猫科捕食者', photo: '俯身窥视' },
    'V7':  { type: '巡', tone: '狩猎场巡猎：猫科捕食者', photo: '俯身窥视' },
    'V11': { type: '巡', tone: '狩猎场巡猎：狼群捕食麂、獾', photo: '俯身窥视、低吼示威' },
    'V1':  { type: '中', tone: '跨栖息地拜访华东本土物种', photo: '好奇探头' },
    'default': { type: '中', tone: '跨大陆拜访', photo: '好奇探头、合影留念' }
  },
  'Z3': { // 狼谷
    'V1':  { type: '天', tone: '遭遇战：途经天敌领地', photo: '警觉匍匐、紧张竖耳' },
    'V10': { type: '巡', tone: '狩猎巡猎：虎压制狼', photo: '俯身窥视、低吼示威' },
    'V5':  { type: '亲', tone: '家族聚会：食肉目远亲', photo: '并肩站立' },
    'V6':  { type: '亲', tone: '家族聚会：食肉目远亲', photo: '并肩站立' },
    'V7':  { type: '亲', tone: '家族聚会：食肉目远亲', photo: '并肩站立' },
    'V11': { type: '家', tone: '回家：狼谷是老家', photo: '拥抱、碰鼻、家族合影' },
    'default': { type: '中', tone: '跨栖息地', photo: '好奇探头、合影留念' }
  },
  'Z4': { // 熊馆
    'V10': { type: '巡', tone: '狩猎巡猎：虎捕食黑熊', photo: '俯身窥视、低吼示威' },
    'V1':  { type: '天', tone: '遭遇战：熊杂食会捕小型兽', photo: '警觉匍匐、紧张竖耳' },
    'V11': { type: '亲', tone: '家族聚会：同食肉目', photo: '并肩站立' },
    'default': { type: '中', tone: '跨栖息地', photo: '好奇探头、合影留念' }
  },
  'Z5': { // 中国猫科馆
    'V1':  { type: '天', tone: '遭遇战：中小型猫科捕食獴', photo: '警觉匍匐、紧张竖耳' },
    'V3':  { type: '天', tone: '遭遇战：雪豹、金猫捕食小熊猫', photo: '警觉匍匐、贴地张望' },
    'V5':  { type: '家', tone: '回家：雪豹老家', photo: '拥抱、家族合影' },
    'V6':  { type: '亲', tone: '家族聚会：猫科大家族', photo: '并肩站立、模仿姿势' },
    'V7':  { type: '亲', tone: '家族聚会：猫科大家族', photo: '并肩站立、模仿姿势' },
    'V10': { type: '亲', tone: '家族聚会：同猫科·大型', photo: '并肩站立' },
    'V11': { type: '亲', tone: '家族聚会：同食肉目', photo: '并肩站立' },
    'V23': { type: '天', tone: '遭遇战：豹类捕食金丝猴', photo: '警觉匍匐' },
    'V27': { type: '天', tone: '遭遇战：猫科捕食猴', photo: '警觉匍匐' },
    'default': { type: '中', tone: '跨栖息地', photo: '好奇探头、合影留念' }
  },
  'Z6': { // 猫科星球
    'V1':  { type: '天', tone: '遭遇战：核心天敌区，猎豹为头号天敌', photo: '警觉匍匐、紧张竖耳、贴地张望' },
    'V3':  { type: '天', tone: '遭遇战', photo: '警觉匍匐、贴地张望' },
    'V5':  { type: '亲', tone: '家族聚会：同猫科', photo: '并肩站立、模仿姿势' },
    'V6':  { type: '家', tone: '回家', photo: '拥抱、碰鼻、家族合影' },
    'V7':  { type: '家', tone: '回家', photo: '拥抱、碰鼻、家族合影' },
    'V10': { type: '亲', tone: '家族聚会：同猫科·大型', photo: '并肩站立' },
    'V11': { type: '亲', tone: '家族聚会：同食肉目', photo: '并肩站立' },
    'V23': { type: '天', tone: '遭遇战：猫科捕食灵长类', photo: '警觉匍匐' },
    'V27': { type: '天', tone: '遭遇战：猫科捕食猴', photo: '警觉匍匐' },
    'default': { type: '中', tone: '跨栖息地', photo: '好奇探头、合影留念' }
  },
  'Z7': { // 虎馆
    'V1':  { type: '天', tone: '遭遇战：虎捕食小型兽', photo: '警觉匍匐、紧张竖耳' },
    'V3':  { type: '天', tone: '遭遇战', photo: '警觉匍匐' },
    'V5':  { type: '亲', tone: '家族聚会：同猫科', photo: '并肩站立' },
    'V6':  { type: '亲', tone: '家族聚会：同猫科', photo: '并肩站立' },
    'V7':  { type: '亲', tone: '家族聚会：同猫科', photo: '并肩站立' },
    'V10': { type: '家', tone: '回家', photo: '拥抱、家族合影' },
    'V11': { type: '天', tone: '反转遭遇战：狼是猎物方', photo: '警觉匍匐' },
    'V23': { type: '天', tone: '遭遇战：虎捕食猴', photo: '警觉匍匐' },
    'V27': { type: '天', tone: '遭遇战：虎捕食猴', photo: '警觉匍匐' },
    'default': { type: '中', tone: '跨栖息地', photo: '好奇探头、合影留念' }
  },
  'Z8': { // 亚洲象馆
    'V1':  { type: '中', tone: '跨栖息地拜访', photo: '好奇探头、合影留念' },
    'default': { type: '中', tone: '跨栖息地拜访', photo: '好奇探头、合影留念' }
  },
  'Z9': { // 细尾獴馆
    'V1':  { type: '家', tone: '回家：核心展区，回到部落', photo: '拥抱、碰鼻、家族合影' },
    'V5':  { type: '巡', tone: '狩猎巡猎：猫科捕食獴', photo: '俯身窥视' },
    'V6':  { type: '巡', tone: '狩猎巡猎：猫科捕食獴', photo: '俯身窥视' },
    'V7':  { type: '巡', tone: '狩猎巡猎：猫科捕食獴', photo: '俯身窥视' },
    'V10': { type: '巡', tone: '狩猎巡猎：虎捕食獴', photo: '俯身窥视' },
    'V11': { type: '巡', tone: '狩猎巡猎：狼捕食獴', photo: '俯身窥视、低吼示威' },
    'default': { type: '中', tone: '跨栖息地拜访', photo: '好奇探头、合影留念' }
  },
  'Z10': { // 猴山
    'V5':  { type: '巡', tone: '狩猎巡猎：猫科捕食猴', photo: '俯身窥视' },
    'V6':  { type: '巡', tone: '狩猎巡猎：猫科捕食猴', photo: '俯身窥视' },
    'V7':  { type: '巡', tone: '狩猎巡猎：猫科捕食猴', photo: '俯身窥视' },
    'V10': { type: '巡', tone: '狩猎巡猎：虎捕食猴', photo: '俯身窥视、低吼示威' },
    'V11': { type: '巡', tone: '狩猎巡猎：狼捕食猴', photo: '俯身窥视、低吼示威' },
    'V23': { type: '亲', tone: '家族聚会：灵长类远亲', photo: '并肩站立、碰鼻' },
    'V27': { type: '家', tone: '回家：猴山老家', photo: '拥抱、家族合影' },
    'default': { type: '中', tone: '跨栖息地', photo: '好奇探头、合影留念' }
  },
  'Z11': { // 长颈鹿馆
    'V1':  { type: '友', tone: '结识新朋友：草原邻居', photo: '一起张望、并肩站立' },
    'V5':  { type: '巡', tone: '狩猎巡猎：捕食长颈鹿幼崽', photo: '俯身窥视' },
    'V6':  { type: '巡', tone: '狩猎巡猎：捕食长颈鹿幼崽', photo: '俯身窥视' },
    'V7':  { type: '巡', tone: '狩猎巡猎：捕食长颈鹿幼崽', photo: '俯身窥视' },
    'V10': { type: '巡', tone: '狩猎巡猎：虎捕食长颈鹿幼崽', photo: '俯身窥视' },
    'V11': { type: '巡', tone: '狩猎巡猎：狼群捕食', photo: '俯身窥视、低吼示威' },
    'default': { type: '中', tone: '跨大陆拜访', photo: '好奇探头、合影留念' }
  },
  // --- 放牛山片区 ---
  'F1': { // 考拉馆
    'default': { type: '中', tone: '跨大陆拜访：澳洲慢生活邻居', photo: '好奇探头、合影留念' }
  },
  'F2': { // 高黎贡（含小熊猫馆）
    'V3':  { type: '家', tone: '回家：小熊猫空中栈道老家', photo: '拥抱、碰鼻、家族合影' },
    'V5':  { type: '巡', tone: '狩猎巡猎：雪豹捕食小熊猫', photo: '俯身窥视' },
    'V6':  { type: '巡', tone: '狩猎巡猎：猫科捕食小熊猫', photo: '俯身窥视' },
    'V7':  { type: '巡', tone: '狩猎巡猎：猫科捕食小熊猫', photo: '俯身窥视' },
    'V23': { type: '亲', tone: '家族聚会：同亚洲高山森林', photo: '并肩站立' },
    'V27': { type: '亲', tone: '家族聚会：同亚洲森林动物', photo: '并肩站立' },
    'default': { type: '中', tone: '跨栖息地', photo: '好奇探头、合影留念' }
  },
  'F3': { // 冈瓦纳
    'V23': { type: '亲', tone: '家族聚会：同灵长目', photo: '并肩站立、模仿姿势' },
    'V27': { type: '亲', tone: '家族聚会：同灵长目', photo: '并肩站立' },
    'default': { type: '中', tone: '跨大陆拜访南美雨林', photo: '好奇探头、合影留念' }
  },
  'F4': { // 亚洲灵长馆
    'V5':  { type: '巡', tone: '狩猎巡猎：猫科捕食灵长类', photo: '俯身窥视' },
    'V6':  { type: '巡', tone: '狩猎巡猎：猫科捕食灵长类', photo: '俯身窥视' },
    'V7':  { type: '巡', tone: '狩猎巡猎：猫科捕食灵长类', photo: '俯身窥视' },
    'V10': { type: '巡', tone: '狩猎巡猎：虎捕食灵长类', photo: '俯身窥视、低吼示威' },
    'V23': { type: '家', tone: '回家', photo: '拥抱、家族合影' },
    'V27': { type: '亲', tone: '家族聚会：同灵长目', photo: '并肩站立、碰鼻' },
    'default': { type: '中', tone: '跨栖息地', photo: '好奇探头、合影留念' }
  },
  'F5': { // 猩猩馆
    'V5':  { type: '巡', tone: '狩猎巡猎：猫科捕食灵长类', photo: '俯身窥视' },
    'V6':  { type: '巡', tone: '狩猎巡猎：猫科捕食灵长类', photo: '俯身窥视' },
    'V7':  { type: '巡', tone: '狩猎巡猎：猫科捕食灵长类', photo: '俯身窥视' },
    'V23': { type: '亲', tone: '家族聚会：同灵长目', photo: '并肩站立' },
    'V27': { type: '亲', tone: '家族聚会：同灵长目', photo: '并肩站立' },
    'default': { type: '中', tone: '跨栖息地', photo: '好奇探头、合影留念' }
  },
  'F6': { // 河马馆
    'default': { type: '中', tone: '跨栖息地', photo: '好奇探头、合影留念' }
  },
  'F8': { // 唐家河展区
    'V3':  { type: '家', tone: '回家：唐家河小熊猫', photo: '拥抱、家族合影' },
    'V5':  { type: '巡', tone: '狩猎场巡猎：雪豹捕食小麂', photo: '俯身窥视' },
    'V10': { type: '巡', tone: '狩猎场巡猎：虎捕食小麂、羚牛幼崽', photo: '俯身窥视、低吼示威' },
    'V11': { type: '亲', tone: '家族聚会：与豺同犬科', photo: '并肩站立' },
    'V23': { type: '家', tone: '回家：唐家河金丝猴', photo: '拥抱、家族合影' },
    'default': { type: '中', tone: '跨栖息地拜访中国西南', photo: '好奇探头、合影留念' }
  },
  // --- 小红山片区 ---
  'X1': { // 热带鸟馆（含犀鸟馆）
    'V1':  { type: '巡', tone: '狩猎场巡猎：小型兽捕食鸟/卵', photo: '俯身窥视' },
    'V5':  { type: '巡', tone: '狩猎场巡猎：猫科捕食鸟', photo: '俯身窥视' },
    'V6':  { type: '巡', tone: '狩猎场巡猎', photo: '俯身窥视' },
    'V7':  { type: '巡', tone: '狩猎场巡猎', photo: '俯身窥视' },
    'V10': { type: '巡', tone: '狩猎场巡猎', photo: '俯身窥视' },
    'V11': { type: '巡', tone: '狩猎场巡猎：狼捕食鸟', photo: '俯身窥视' },
    'default': { type: '中', tone: '跨栖息地拜访热带鸟', photo: '好奇探头、合影留念' }
  },
  'X1b': { // 犀鸟馆（归入热带鸟馆关系）
    'V1':  { type: '巡', tone: '狩猎场巡猎', photo: '俯身窥视' },
    'V5':  { type: '巡', tone: '狩猎场巡猎', photo: '俯身窥视' },
    'V6':  { type: '巡', tone: '狩猎场巡猎', photo: '俯身窥视' },
    'V7':  { type: '巡', tone: '狩猎场巡猎', photo: '俯身窥视' },
    'V10': { type: '巡', tone: '狩猎场巡猎', photo: '俯身窥视' },
    'V11': { type: '巡', tone: '狩猎场巡猎', photo: '俯身窥视' },
    'default': { type: '中', tone: '跨栖息地', photo: '好奇探头、合影留念' }
  },
  'X2': { // 獐麂坡
    'V5':  { type: '巡', tone: '狩猎巡猎：猫科捕食鹿科', photo: '俯身窥视' },
    'V6':  { type: '巡', tone: '狩猎巡猎：猫科捕食鹿科', photo: '俯身窥视' },
    'V7':  { type: '巡', tone: '狩猎巡猎：猫科捕食鹿科', photo: '俯身窥视' },
    'V10': { type: '巡', tone: '狩猎巡猎：虎捕食鹿', photo: '俯身窥视、低吼示威' },
    'V11': { type: '巡', tone: '狩猎巡猎：狼捕食鹿', photo: '俯身窥视、低吼示威' },
    'default': { type: '中', tone: '跨栖息地', photo: '好奇探头、合影留念' }
  },
  // --- 南门新区·非洲之歌 ---
  'N1': { // 迷你沙丘（非洲之歌代表）
    'V1':  { type: '家', tone: '回家：迷你沙丘老家', photo: '拥抱、碰鼻、家族合影' },
    'V5':  { type: '巡', tone: '狩猎巡猎：猫科捕食獴、狐', photo: '俯身窥视' },
    'V6':  { type: '巡', tone: '狩猎巡猎：猫科捕食獴、狐', photo: '俯身窥视' },
    'V7':  { type: '巡', tone: '狩猎巡猎：猫科捕食獴、狐', photo: '俯身窥视' },
    'V10': { type: '巡', tone: '狩猎巡猎：虎捕食獴、狐', photo: '俯身窥视' },
    'V11': { type: '巡', tone: '狩猎巡猎：狼捕食狐', photo: '俯身窥视、低吼示威' },
    'default': { type: '中', tone: '跨大陆拜访非洲沙漠', photo: '好奇探头、合影留念' }
  },
  'N5': { // 袋鼠角
    'default': { type: '中', tone: '跨大陆拜访澳洲荒原', photo: '好奇探头、合影留念' }
  },
  'N6': { // 狐猴之家（马岛客厅）
    'V5':  { type: '巡', tone: '狩猎巡猎：猫科捕食狐猴', photo: '俯身窥视' },
    'V6':  { type: '巡', tone: '狩猎巡猎：猫科捕食狐猴', photo: '俯身窥视' },
    'V7':  { type: '巡', tone: '狩猎巡猎：猫科捕食狐猴', photo: '俯身窥视' },
    'V10': { type: '巡', tone: '狩猎巡猎：虎捕食狐猴', photo: '俯身窥视' },
    'V11': { type: '巡', tone: '狩猎巡猎：狼捕食狐猴', photo: '俯身窥视、低吼示威' },
    'V23': { type: '亲', tone: '家族聚会：同灵长目', photo: '并肩站立' },
    'V27': { type: '亲', tone: '家族聚会：同灵长目', photo: '并肩站立' },
    'default': { type: '中', tone: '跨大陆拜访马达加斯加', photo: '好奇探头、合影留念' }
  }
};

// 关系类型 → 叙事基调映射
const RELATIONSHIP_TONES = {
  '天': { label: '天敌遭遇', mood: '紧张、警觉、匍匐避险', greetingTemplate: '嘘！小心！这里是天敌的领地，要保持安静，悄悄观察...' },
  '巡': { label: '狩猎巡猎', mood: '自信、试探、压制', greetingTemplate: '到了猎场！巡视一番，看看这里的猎物情况...' },
  '家': { label: '同类回家', mood: '亲切、兴奋、归属感', greetingTemplate: '到家了！欢迎回到老家，去见见家人吧！' },
  '亲': { label: '远亲拜访', mood: '亲切、对比、共鸣', greetingTemplate: '来拜访远亲啦！虽然种类不同，但同属一个大家族！' },
  '友': { label: '友好共存', mood: '好奇、友善、交流', greetingTemplate: '嘿，老邻居！在野外经常一起出没，来打个招呼吧！' },
  '中': { label: '跨大陆拜访', mood: '新奇、探索、对比', greetingTemplate: '哇，这里是个全新的世界！来探索一下...' }
};

// ==================== 4. 语言风格规则 L1-L5 ====================
const LANGUAGE_STYLES = {
  L1: {
    label: '学龄前（3-6岁）· 感官剧场',
    ageRange: [3, 6],
    vocab: '高频日常词为主，名词用叠音或拟声，避免专业术语；必须用术语时用比喻替代',
    maxSentenceLen: 8,
    abstraction: '万物有灵，赋予动物情绪与意图',
    structure: '感官描写 + 情绪词 + 单一动作；多用感叹、拟声、重复',
    interaction: '选择式提问，答对即肯定',
    emotion: '鼓励、惊叹、陪伴感，禁止否定与嘲笑',
    roleVoice: '以"小獴獴"等可爱自称，与用户平视同伴关系',
    openingTemplate: '嘘——我们到 {venue} 啦！你看那只 {animal} 在干嘛呀？',
    followUpTemplate: '哇，你看到啦！它身上有好多 {feature}，像不像 {metaphor}？',
    photoTemplate: '我们一起学它 {pose} 的样子，拍张照好不好？'
  },
  L2: {
    label: '低年级（7-9岁）· 侦探冒险',
    ageRange: [7, 9],
    vocab: '可引入动物名与少量通俗科普词，但需即用即释；禁止拉丁学名、英文缩写等非中文术语',
    maxSentenceLen: 15,
    abstraction: '可讲1层因果，避免多变量',
    structure: '提问引导观察 → 用户回应 → 角色化确认 + 知识延展',
    interaction: '开放式提问，赋予"小侦探/小哨兵"身份',
    emotion: '肯定发现、赋予胜任感',
    roleVoice: '保持动物身份，承担"向导+伙伴"角色',
    openingTemplate: '到达 {venue}！作为{animal}的{relation}，这里要小心。你看{venueAnimal}在做什么？',
    followUpTemplate: '观察得真仔细！你知道吗，{venueAnimal} {feature} 是因为 {reason}。',
    photoTemplate: '小哨兵，现在请摆出 {pose} 姿势，留下探险纪念！'
  },
  L3: {
    label: '高年级（10-12岁）· 博物探究',
    ageRange: [10, 12],
    vocab: '可使用"咬合力""领地""丰容"等通俗科普词，需配简短解释；禁止拉丁学名、英文缩写等非中文术语',
    maxSentenceLen: 25,
    abstraction: '可讲2层因果与分类逻辑',
    structure: '观察引导 → 分类对比 → 个体故事 → 福利理念',
    interaction: '探究式提问，允许用户推理',
    emotion: '尊重探索、平等协作',
    roleVoice: '动物身份 + "博物伙伴"，可展现族群智慧',
    openingTemplate: '我们到了 {venue}。这里住着 {animal}，你想先观察哪一只？',
    followUpTemplate: '好问题。其实这背后是 {mechanism}，我们可以这样理解……',
    photoTemplate: '你已经掌握了 {feature} 的特征，试着模仿它的 {pose} 姿势留念吧。'
  },
  L4: {
    label: '青少年（13-17岁）· 同行对谈',
    ageRange: [13, 17],
    vocab: '可使用"种群""食物链""栖息地"等通俗科普概念，需配简短解释；禁止拉丁学名、英文缩写等非中文术语',
    maxSentenceLen: 35,
    abstraction: '可讲系统级因果（生态位、协同进化、行为学机制）',
    structure: '观察 → 机制解释 → 保护议题 → 开放讨论',
    interaction: '思辨式提问，尊重独立判断',
    emotion: '平等、真诚、不回避复杂议题，避免说教',
    roleVoice: '动物身份作为"亲历者"提供视角，但允许跳出角色讨论',
    openingTemplate: '{venue} 到了。从{animal}的视角，这里是 {perspective1}；从生态视角，它又是 {perspective2}。你怎么看？',
    followUpTemplate: '这个现象背后的机制是 {mechanism}，但它也引出一个问题：{question}？',
    photoTemplate: '这张照片不只是打卡——它记录了你今天观察到的 {feature}。'
  },
  L5: {
    label: '成人（18岁+）· 专业科普导览',
    ageRange: [18, 120],
    vocab: '可使用完整科普术语体系，包括"生态位""协同进化""种群结构""行为丰容""环境富集""繁殖策略""天敌压力""警戒行为""领地标记""社会等级""遗传多样性""就地保护""迁地保护""旗舰物种""伞护种"等已普及的专业概念；禁止拉丁学名、英文缩写等非中文术语；允许引用数据、比例和研究结论，无需刻意简化',
    maxSentenceLen: 0, // 不设上限
    abstraction: '可讲行为学机制、生态系统因果链、种群数据、保护政策、伦理考量、进化逻辑多维',
    structure: '现场观察切入 → 行为学机制/生态原理 → 种群/保护层面的背景数据 → 红山具体做法与个体案例 → 延伸思考或可转述要点',
    interaction: '尊重用户已有专业背景，允许深度追问，提供可验证的信息来源线索',
    emotion: '专业、理性、有温度，绝不幼稚化、萌化；保持博物学家式的克制与好奇心',
    roleVoice: '动物身份仅作为参观视角的叙事线索，内容以客观科普为核心，不做拟人化独白',
    familyNote: '为带娃家长额外标注"可转述给孩子的简化版要点"',
    openingTemplate: '{venue} 馆。这里的核心物种是 {animal}，值得关注的几个行为学与生态学要点如下……',
    followUpTemplate: '你问到的 {topic}，背后的机制是 {mechanism}。红山在这方面的实践是 {practice}，背后的科学考量与行业背景是 {rationale}。',
    photoTemplate: '这张照片记录了今天在{venue}观察到的 {feature} 行为。如需转述给孩子，简化版可理解为：{simplified}。'
  }
};

// ==================== 5. 统一查询接口 ====================
const ZooData = {
  /** 获取所有可选动物身份 */
  getAnimalIdentities() {
    return ANIMAL_IDENTITIES;
  },

  /** 根据 code 获取动物身份 */
  getAnimalById(id) {
    return ANIMAL_IDENTITIES.find(a => a.id === id || a.code === id);
  },

  /** 获取所有可选场馆 */
  getVenues() {
    return VENUES;
  },

  /** 根据场馆名称获取场馆信息 */
  getVenueByName(name) {
    return VENUES.find(v => v.name === name);
  },

  /** 根据 code 获取场馆坐标 {lng, lat} */
  getVenueCoord(code) {
    return VENUE_COORDS[code] || null;
  },

  /** 获取南门起点坐标 */
  getEntranceCoord() {
    return VENUE_COORDS.ENTRANCE;
  },

  /**
   * Haversine 公式计算两个经纬度点之间的球面距离（米）
   * @param {{lng,lat}} c1 - 起点
   * @param {{lng,lat}} c2 - 终点
   * @returns {number} 距离（米）
   */
  calculateDistance(c1, c2) {
    const R = 6371000; // 地球半径（米）
    const toRad = (deg) => deg * Math.PI / 180;
    const dLng = toRad(c2.lng - c1.lng);
    const dLat = toRad(c2.lat - c1.lat);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(c1.lat)) * Math.cos(toRad(c2.lat)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 1.5); // 直线距离×1.5，模拟实际步行路径
  },

  /**
   * 步行时间预估（考虑携带儿童、游园慢速、山地起伏）
   * 速度取 2.5 km/h ≈ 41.7 m/min（成人正常 5km/h，携儿童游园约减半）
   * @param {number} distanceMeters - 距离（米）
   * @returns {number} 分钟数（向上取整）
   */
  estimateWalkTime(distanceMeters) {
    const speedPerMin = 2500 / 60; // 41.7 m/min
    return Math.max(1, Math.ceil(distanceMeters / speedPerMin));
  },

  /** 格式化距离显示 */
  formatDistance(meters) {
    if (meters < 1000) return `${meters} 米`;
    return `${(meters / 1000).toFixed(2)} 公里`;
  },

  /** 格式化时间显示 */
  formatTime(minutes) {
    if (minutes < 60) return `${minutes} 分钟`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`;
  },

  /**
   * 最近邻启发式算法规划最短路径（从南门出发，依次访问所有选中场馆）
   * @param {string[]} selectedCodes - 选中场馆的 code 数组
   * @returns {{route: Array, totalDistance: number, totalWalkTime: number, segments: Array}}
   *   route: 排序后的场馆 [{code, name, animals, distanceFromPrev, walkTimeFromPrev}]
   *   totalDistance: 总步行距离（米）
   *   totalWalkTime: 总步行时间（分钟）
   *   segments: 每段路径 [{from, to, distance, walkTime}]
   */
  planRoute(selectedCodes) {
    if (!selectedCodes || selectedCodes.length === 0) {
      return { route: [], totalDistance: 0, totalWalkTime: 0, segments: [] };
    }

    const venues = this.getVenues();
    const start = this.getEntranceCoord();
    const remaining = [...selectedCodes];
    const route = [];
    const segments = [];
    let totalDistance = 0;
    let totalWalkTime = 0;
    let currentCoord = start;
    let currentName = start.name;

    while (remaining.length > 0) {
      // 找最近的未访问场馆
      let nearestIdx = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const coord = this.getVenueCoord(remaining[i]);
        if (!coord) continue;
        const dist = this.calculateDistance(currentCoord, coord);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      }

      const code = remaining.splice(nearestIdx, 1)[0];
      const venue = venues.find(v => v.code === code);
      const coord = this.getVenueCoord(code);
      const walkTime = this.estimateWalkTime(nearestDist);

      route.push({
        code,
        name: venue ? venue.name : (coord ? coord.name : code),
        animals: venue ? venue.animals : '',
        distanceFromPrev: nearestDist,
        walkTimeFromPrev: walkTime
      });

      segments.push({
        from: currentName,
        to: venue ? venue.name : code,
        fromCode: currentCoord === start ? 'ENTRANCE' : route[route.length - 2].code,
        toCode: code,
        distance: nearestDist,
        walkTime
      });

      totalDistance += nearestDist;
      totalWalkTime += walkTime;
      currentCoord = coord;
      currentName = venue ? venue.name : code;
    }

    return { route, totalDistance, totalWalkTime, segments };
  },

  /**
   * 将经纬度坐标转换为地图图片上的百分比坐标（0-100）
   * 用于在地图缩略图上绘制标记点
   * @param {{lng,lat}} coord - 经纬度
   * @returns {{x:number, y:number}} 百分比坐标（0-100）
   */
  coordToMapPercent(coord) {
    const x = ((coord.lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * 100;
    // 纬度越大越靠北（图片上方），所以 y 要反转
    const y = (1 - (coord.lat - MAP_BOUNDS.minLat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * 100;
    return { x: Math.max(2, Math.min(98, x)), y: Math.max(2, Math.min(98, y)) };
  },

  /**
   * 查询游客身份与展区的关系
   * @param {string} animalCode - 游客身份编码（如 'V1'）
   * @param {string} venueCode - 展区编码（如 'Z6'）
   * @returns {{type, tone, photo, label, mood, greetingTemplate}}
   */
  getRelationship(animalCode, venueCode) {
    const venueRelations = RELATIONSHIP_MATRIX[venueCode] || {};
    const relation = venueRelations[animalCode] || venueRelations['default'] || { type: '中', tone: '跨大陆拜访', photo: '好奇探头、合影留念' };
    const toneInfo = RELATIONSHIP_TONES[relation.type] || RELATIONSHIP_TONES['中'];
    return { ...relation, ...toneInfo };
  },

  /**
   * 根据年龄数组确定语言风格等级
   * 当用户数量>1时，取所有年龄中最小值确定风格
   * @param {number[]} ages - 年龄数组
   * @returns {string} 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
   */
  getLanguageLevel(ages) {
    if (!ages || ages.length === 0) return 'L2'; // 默认L2低年级
    const minAge = Math.min(...ages);
    if (minAge <= 6) return 'L1';
    if (minAge <= 9) return 'L2';
    if (minAge <= 12) return 'L3';
    if (minAge <= 17) return 'L4';
    return 'L5';
  },

  /** 获取语言风格规则 */
  getLanguageStyle(level) {
    return LANGUAGE_STYLES[level] || LANGUAGE_STYLES['L2'];
  },

  /**
   * 生成场馆到达问候语
   * @param {string} animalCode - 游客身份编码
   * @param {string} venueCode - 展区编码
   * @param {string} languageLevel - 语言风格等级
   * @returns {string} 问候语
   */
  generateGreeting(animalCode, venueCode, languageLevel) {
    const animal = this.getAnimalById(animalCode);
    const venue = VENUES.find(v => v.code === venueCode);
    const relation = this.getRelationship(animalCode, venueCode);
    const style = this.getLanguageStyle(languageLevel);

    if (!animal || !venue) return relation.greetingTemplate;

    // 根据关系类型和语言风格生成问候语
    const animalName = animal.name;
    const venueName = venue.name;
    const venueAnimal = venue.animals.split('、')[0];

    let greeting = '';
    switch (relation.type) {
      case '天':
        if (languageLevel === 'L1') {
          greeting = `嘘——小声点！到${venueName}啦，这里住着${animalName}害怕的大动物。你看，${venueAnimal}在那边呢，悄悄蹲下好不好？`;
        } else if (languageLevel === 'L2') {
          greeting = `嘘！到达${venueName}！作为${animalName}，这里可是天敌的领地，要十万分小心。你看——${venueAnimal}在做什么？`;
        } else if (languageLevel === 'L3') {
          greeting = `${venueName}到了。对于${animalName}来说，这里是天敌领地——那种刻在基因里的警觉不是表演，是演化本能。你想先观察哪一只？`;
        } else if (languageLevel === 'L4') {
          greeting = `${venueName}到了。从${animalName}的视角，这里是刻在基因里的恐惧之地；从生态视角，这是食物链的必然。你怎么看这种捕食关系？`;
        } else {
          greeting = `${venueName}馆。这里的物种与${animalName}（${animal.category}）在野外构成捕食关系。作为${animalName}身份站在这里，那种警觉是演化留下的本能印记。有什么想深入了解的？`;
        }
        break;
      case '巡':
        if (languageLevel === 'L1') {
          greeting = `到${venueName}啦！这里有很多小动物，${animalName}是大老板，来看看它们在哪呀？`;
        } else if (languageLevel === 'L2') {
          greeting = `到达${venueName}！作为${animalName}，这里是狩猎场。你来当小侦探，找找看猎物藏在哪里？`;
        } else if (languageLevel === 'L3') {
          greeting = `${venueName}到了。作为${animalName}，这里是狩猎巡猎区。来观察一下这里的猎物生态——你想先看哪个区域？`;
        } else if (languageLevel === 'L4') {
          greeting = `${venueName}到了。从${animalName}的视角，这里是狩猎场；从生态视角，这是捕食者与猎物的协同进化现场。你怎么看？`;
        } else {
          greeting = `${venueName}馆。作为${animalName}身份，这里在野外是巡猎区域。可以从行为生态学角度观察这里的物种互动。有什么想了解的？`;
        }
        break;
      case '家':
        if (languageLevel === 'L1') {
          greeting = `到家啦！${venueName}是${animalName}的家！你看，那些是不是家人呀？`;
        } else if (languageLevel === 'L2') {
          greeting = `到达${venueName}！这里就是${animalName}的家啦！作为回家的小哨兵，快看看家人们在做什么？`;
        } else if (languageLevel === 'L3') {
          greeting = `${venueName}——这里就是${animalName}的家！回家感觉怎么样？来仔细观察一下家人的生活习性。`;
        } else if (languageLevel === 'L4') {
          greeting = `${venueName}到了。对${animalName}来说，这里就是"家"——一个在演化中形成的归属地。这种"回家"的感觉，从行为学上怎么解释？`;
        } else {
          greeting = `${venueName}馆。这里是${animalName}（${animal.scientificName || animal.category}）的"回家"展区。可以观察圈养环境下个体的行为谱与野外差异。有什么想深入了解的？`;
        }
        break;
      case '亲':
        if (languageLevel === 'L1') {
          greeting = `到${venueName}啦！这里的动物跟${animalName}是亲戚哦！你看它们长得像不像？`;
        } else if (languageLevel === 'L2') {
          greeting = `到达${venueName}！这里的动物跟${animalName}是远亲呢！作为小侦探，你能找出哪里像、哪里不一样吗？`;
        } else if (languageLevel === 'L3') {
          greeting = `${venueName}到了。这里住着${animalName}的远亲——虽然种类不同，但同属一个大家族。来做个对比观察吧！`;
        } else if (languageLevel === 'L4') {
          greeting = `${venueName}到了。这里的物种与${animalName}同属一科但不同种——这是演化和适应不同生态位的结果。你觉得这种亲缘关系体现在哪里？`;
        } else {
          greeting = `${venueName}馆。这里的物种与${animalName}（${animal.category}）同科不同种，是趋异演化的典型案例。可以从形态学和行为学角度做对比观察。`;
        }
        break;
      case '友':
        if (languageLevel === 'L1') {
          greeting = `到${venueName}啦！这里的动物跟${animalName}是好朋友，在野外经常一起玩！`;
        } else if (languageLevel === 'L2') {
          greeting = `到达${venueName}！这里的动物跟${animalName}在野外是邻居好朋友！你看它们在干嘛？`;
        } else if (languageLevel === 'L3') {
          greeting = `${venueName}到了。在野外，这里的动物与${animalName}共享同一栖息地，是友好共存的朋友。来观察它们的互动。`;
        } else if (languageLevel === 'L4') {
          greeting = `${venueName}到了。这里的物种与${animalName}在野外共享栖息地——这种共存关系背后有怎样的生态机制？`;
        } else {
          greeting = `${venueName}馆。这里的物种与${animalName}在野外属于同栖息地友好共存关系，是群落生态学的典型案例。`;
        }
        break;
      default: // 中
        if (languageLevel === 'L1') {
          greeting = `到${venueName}啦！这里有${animalName}从来没见过的动物，好新奇呀！`;
        } else if (languageLevel === 'L2') {
          greeting = `到达${venueName}！这里的动物跟${animalName}住在不同的大陆，是跨大陆的新朋友！来看看吧！`;
        } else if (languageLevel === 'L3') {
          greeting = `${venueName}到了。这里的动物与${animalName}分属不同大陆，来对比探索一下它们的差异。`;
        } else if (languageLevel === 'L4') {
          greeting = `${venueName}到了。这里的物种与${animalName}分属不同大陆——这种地理隔离如何影响了各自的演化路径？`;
        } else {
          greeting = `${venueName}馆。这里的物种与${animalName}（${animal.category}）分属不同生物地理区系，是趋同演化或平行演化的对比样本。`;
        }
    }
    return greeting;
  },

  /**
   * 生成预制气泡问题（根据关系类型）
   * @param {string} animalCode - 游客身份编码
   * @param {string} venueCode - 展区编码
   * @param {string} languageLevel - 语言风格等级
   * @returns {Array<{text, question}>}
   */
  generateQuickReplies(animalCode, venueCode, languageLevel) {
    const relation = this.getRelationship(animalCode, venueCode);
    const animal = this.getAnimalById(animalCode);
    const venue = VENUES.find(v => v.code === venueCode);
    if (!animal || !venue) return [];

    const venueAnimal = venue.animals.split('、')[0];
    const replies = [];

    switch (relation.type) {
      case '天':
        replies.push({ text: `${venueAnimal}怎么捕猎？`, question: `${venueAnimal}是怎么捕猎的？${animal.name}怎么躲避？` });
        replies.push({ text: '怎么防御？', question: `${animal.name}遇到天敌时怎么防御和保护自己？` });
        replies.push({ text: `${venueAnimal}的特征`, question: `${venueAnimal}有什么让${animal.name}害怕的特征？` });
        break;
      case '巡':
        replies.push({ text: '猎物有哪些？', question: `在${venue.name}，${animal.name}能找到哪些猎物？` });
        replies.push({ text: '怎么捕猎？', question: `${animal.name}是怎么捕猎的？跟野外有什么不同？` });
        replies.push({ text: '行为丰容', question: `饲养员怎么为${animal.name}做行为丰容？` });
        break;
      case '家':
        replies.push({ text: '家族故事', question: `${venue.name}的${animal.name}家族有什么故事？` });
        replies.push({ text: '生活习性', question: `${animal.name}在老家是怎么生活的？` });
        replies.push({ text: '挖洞/筑巢', question: `${animal.name}怎么建造自己的家？` });
        break;
      case '亲':
        replies.push({ text: '哪里像？', question: `${animal.name}和${venueAnimal}有什么相似之处？` });
        replies.push({ text: '哪里不同？', question: `${animal.name}和${venueAnimal}有什么不同？为什么会这样？` });
        replies.push({ text: '演化关系', question: `${animal.name}和这里的动物是怎么演化成不同种的？` });
        break;
      case '友':
        replies.push({ text: '怎么共存？', question: `${animal.name}和${venueAnimal}在野外怎么和平共处？` });
        replies.push({ text: '互相帮助吗？', question: `${animal.name}和这里的动物会互相帮助吗？` });
        replies.push({ text: '共同栖息地', question: `${animal.name}和${venueAnimal}的共同栖息地是什么样的？` });
        break;
      default: // 中
        replies.push({ text: `${venueAnimal}有什么特征？`, question: `${venueAnimal}有什么特别的地方？` });
        replies.push({ text: `${venueAnimal}从哪来？`, question: `${venueAnimal}的原产地在哪？跟${animal.name}的家乡有什么不同？` });
        replies.push({ text: '保护现状', question: `${venueAnimal}的保护现状怎么样？` });
    }

    return replies;
  },

  /**
   * 生成拍照引导文案
   * @param {string} animalCode
   * @param {string} venueCode
   * @param {string} languageLevel
   * @returns {string}
   */
  generatePhotoPrompt(animalCode, venueCode, languageLevel) {
    const relation = this.getRelationship(animalCode, venueCode);
    const style = this.getLanguageStyle(languageLevel);
    const animal = this.getAnimalById(animalCode);
    const venue = VENUES.find(v => v.code === venueCode);

    if (languageLevel === 'L1') {
      return `我们一起学${venue.animals.split('、')[0]}${relation.photo.split('、')[0]}的样子，摆个可爱的姿势吧！`;
    } else if (languageLevel === 'L2') {
      return `${animal.name}探险家，现在请摆出${relation.photo.split('、')[0]}姿势，留下探险纪念！`;
    } else if (languageLevel === 'L3') {
      return `你已经掌握了${animal.name}的特征，试着模仿${relation.photo}的姿势留念吧。`;
    } else if (languageLevel === 'L4') {
      return `这张照片不只是打卡——它记录了你今天在${venue.name}观察到的${relation.label}关系。`;
    } else {
      return `拍照打卡：${relation.photo}。这张照片可作为${animal.name}与${venue.name}物种关系的记录。`;
    }
  },

  /**
   * 生成拍照打卡的详细动作姿态描述
   * @param {string} animalCode - 游客身份编码
   * @param {string} venueCode - 展区编码
   * @param {string} languageLevel - 语言风格等级
   * @returns {{title: string, detail: string, emoji: string}}
   */
  generatePhotoPoseDetail(animalCode, venueCode, languageLevel) {
    const relation = this.getRelationship(animalCode, venueCode);
    const animal = this.getAnimalById(animalCode);
    const venue = VENUES.find(v => v.code === venueCode);
    if (!animal || !venue) return { title: relation.photo, detail: '', emoji: '📸' };

    const venueAnimal = venue.animals.split('、')[0];
    const photoBase = relation.photo || '合影留念';

    // 根据关系类型生成详细的动作姿态描述
    const poseDetails = {
      '天': {
        emoji: '😨',
        title: `警觉避险 · ${photoBase}`,
        detail: `${animal.name}遇到天敌${venueAnimal}啦！请摆出警觉避险的姿势：身体压低、贴地匍匐，眼睛警觉地盯着前方，耳朵竖起时刻留意动静。可以微微张大嘴巴，表现出紧张又小心的表情。双手握拳放在胸前，像随时准备逃跑的样子。这张照片记录了${animal.name}面对天敌时的生存本能！`
      },
      '巡': {
        emoji: '😼',
        title: `狩猎巡猎 · ${photoBase}`,
        detail: `${animal.name}作为捕食者来到猎场！请摆出巡视猎物的姿势：身体微微前倾，目光锐利地扫视前方，单手搭在眉骨上做"远眺"动作。可以微微弓起背，双腿分开与肩同宽，表现出自信和威严。嘴角带一丝"猎物尽在掌握"的微笑。这张照片展现了${animal.name}作为猎手的气场！`
      },
      '家': {
        emoji: '🥰',
        title: `回家团聚 · ${photoBase}`,
        detail: `${animal.name}回家啦！请摆出温馨团聚的姿势：张开双臂做"拥抱"动作，脸上绽放大大的笑容。可以侧身面向场馆，一只手指向里面的"家人"，另一只手放在胸口表示激动。身体微微前倾，表现出迫不及待想见到家人的心情。这张照片记录了${animal.name}回到老家的温暖时刻！`
      },
      '亲': {
        emoji: '🤝',
        title: `远亲相聚 · ${photoBase}`,
        detail: `${animal.name}来拜访远亲${venueAnimal}啦！请摆出"亲缘对比"的姿势：侧身站立，一只手搭在眉骨上做"远眺"动作看向场馆里的亲戚，另一只手指向自己做对比。可以微微歪头，表现出好奇和亲切。脸上带着"原来我们是一家"的会心微笑。这张照片记录了同科远亲的奇妙缘分！`
      },
      '友': {
        emoji: '😊',
        title: `友好共存 · ${photoBase}`,
        detail: `${animal.name}来见老邻居${venueAnimal}啦！请摆出友好打招呼的姿势：举起一只手做"挥手"动作，面带友善微笑。可以身体侧向场馆，做出"并肩前行"的姿态，仿佛要和邻居一起散步。另一只手可以叉腰，表现出轻松自在。这张照片记录了野外好邻居的友谊！`
      },
      '中': {
        emoji: '🤔',
        title: `跨大陆拜访 · ${photoBase}`,
        detail: `${animal.name}来到一个全新的世界！请摆出好奇探索的姿势：身体微微后仰，双手抱胸或托腮做"观察思考"状，眼睛睁大表现出新奇。可以歪头打量场馆里的异国动物，嘴巴微张成"O"形，表现出"哇，好神奇"的惊叹。这张照片记录了${animal.name}跨大陆拜访的探索时刻！`
      }
    };

    const detail = poseDetails[relation.type] || {
      emoji: '📸',
      title: photoBase,
      detail: `请在${venue.name}前摆出${photoBase}的姿势，拍一张探险留念照！`
    };

    // L1 学龄前简化描述
    if (languageLevel === 'L1') {
      return {
        emoji: detail.emoji,
        title: detail.title,
        detail: `${animal.name}来${venue.name}啦！试着学${photoBase.split('、')[0]}的样子，摆出可爱的姿势吧！`
      };
    }

    return detail;
  },

  /**
   * 内容过滤：判断用户问题类型
   * @param {string} question
   * @returns {{type: 'venue'|'restaurant'|'restroom'|'market'|'irrelevant', response?: string}}
   */
  filterContent(question) {
    const q = question.toLowerCase();

    // 餐厅/吃饭相关
    if (/餐厅|吃饭|午餐|晚餐|食物|觅食|饿了|吃饭|餐饮|补给/.test(q)) {
      return {
        type: 'restaurant',
        response: '附近有餐厅可以补给能量！让我为你找到最近的餐厅。作为动物身份，在野外觅食可是生存基本功——不过在红山，可以去人类餐厅休息补充体力。'
      };
    }

    // 卫生间相关
    if (/卫生间|厕所|洗手间|厕所|标记领地|排泄/.test(q)) {
      return {
        type: 'restroom',
        response: '最近的卫生间就在附近！说起来，动物们也会用排泄物来标记领地和传递信息，每只的气味都不同，就像"名片"一样。不过人类还是用卫生间更方便！'
      };
    }

    // 市集/购物相关
    if (/市集|商店|购物|纪念品|周边|买|商品/.test(q)) {
      return {
        type: 'market',
        response: '附近有市集可以逛逛！可以挑选一些纪念品带回家。不过在红山，最好的纪念品是你今天学到的知识和拍下的照片哦！'
      };
    }

    // 与动物/场馆相关（正常问题）
    if (/动物|场馆|猫科|狼|猴|獴|熊|鹿|鸟|象|考拉|熊猫|吃什么|怎么|为什么|习性|特征|行为|丰容|保护/.test(q)) {
      return { type: 'venue' };
    }

    // 无关问题
    return {
      type: 'irrelevant',
      response: '这个问题好像跟动物探险关系不大呢！还是专注于眼前的动物吧——你有什么关于这个场馆或动物想了解的吗？'
    };
  }
};
