/**
 * HIKARI Mobile People App
 * モバイル用人脈管理アプリ
 * 
 * 機能:
 * - 人脈一覧（カードリスト、検索、フィルター）
 * - 詳細表示（電話・メールアクション、接点履歴）
 * - 接点追加
 * - 編集（基本情報、写真、紹介者検索、個人特性）
 * - 新規追加
 */

(function() {
  'use strict';

  // ========================================
  //  設定値
  // ========================================
  
  const CONFIG = {
    APP_ID: 6,
    VIEW_ID: null,  // ★モバイル人脈用ビューID（後で設定）
    
    FIELDS: {
      NAME: 'name',
      KANA_NAME: 'kananame',
      COMPANY: 'ルックアップ',
      POSITION: '役職',
      PHONE: '電話番号',
      EMAIL: 'メールアドレス',
      BIRTHDAY: 'birthday',
      PHOTO: '顔写真',
      CARD_IMAGE: '名刺写真',
      INDUSTRY: '業種',
      RELATIONSHIP: 'お付き合い度合い',
      PERSONALITY: 'パーソナリティ評価',
      REFERRER: '紹介者',
      REFERRER_ID: '紹介者rid',
      REFERRER_LINK: '紹介者リンク',
      NOTES: 'shokai_memo',
      POSTAL_CODE: '郵便番号',
      ADDRESS: '住所',
      LAST_CONTACT: 'last_contact_date',
      LAST_CONTACT_TYPE: 'last_contact_type',
      CONTACT_COUNT: 'contact_count',
      CONTACT_HISTORY: 'contact_history',
      CONTACT_DATE: 'contact_date',
      CONTACT_TYPE: 'contact_type',
      CONTACT_MEMO: 'contact_memo',
    },
    
    RELATIONSHIP_ORDER: ['1.プライム', '2.パワー', '3.スタンダード', '4.フレンド', '5.コネクト'],
    
    RELATIONSHIP_COLORS: {
      '1.プライム': '#d4af37',
      '2.パワー': '#a855f7',
      '3.スタンダード': '#cd7f32',
      '4.フレンド': '#5b9bd5',
      '5.コネクト': '#6b7280',
    },
  };

  // ========================================
  //  ユーティリティ
  // ========================================
  
  const Utils = {
    getFieldValue: (record, fieldCode) => {
      const field = record[fieldCode];
      if (!field) return '';
      if (field.type === 'SUBTABLE') return field.value || [];
      if (field.type === 'FILE') return field.value || [];
      if (field.type === 'CHECK_BOX' || field.type === 'MULTI_SELECT') return field.value || [];
      return field.value || '';
    },
    
    escapeHtml: (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },
    
    formatDate: (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    },
    
    formatDateShort: (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    },
    
    getInitial: (name) => {
      if (!name) return '?';
      return name.charAt(0);
    },
    
    getRelationshipColor: (relationship) => {
      return CONFIG.RELATIONSHIP_COLORS[relationship] || '#6b7280';
    },
    
    getTodayString: () => {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    },
    
    _fileUrlCache: {},
    getFileUrl: async (fileKey) => {
      if (!fileKey) return null;
      if (Utils._fileUrlCache[fileKey]) return Utils._fileUrlCache[fileKey];
      
      try {
        const url = `/k/v1/file.json?fileKey=${fileKey}`;
        const blob = await fetch(url, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        }).then(r => r.blob());
        const objectUrl = URL.createObjectURL(blob);
        Utils._fileUrlCache[fileKey] = objectUrl;
        return objectUrl;
      } catch (e) {
        return null;
      }
    },
  };

  // ========================================
  //  グローバル変数
  // ========================================
  
  let allRecords = [];
  let filteredRecords = [];
  let currentSearch = '';
  let currentRelationshipFilter = 'all';
  let currentIndustryFilter = 'all';
  let currentReferrerFilter = '';
  
  let industryOptions = [];
  let personalityOptions = [];
  let contactTypeOptions = [];
  let referrerOptions = [];

  // ========================================
  //  データ取得
  // ========================================
  
  const fetchAllRecords = async () => {
    const records = [];
    let offset = 0;
    const limit = 500;
    
    while (true) {
      const resp = await kintone.api('/k/v1/records', 'GET', {
        app: CONFIG.APP_ID,
        query: `order by ${CONFIG.FIELDS.KANA_NAME} asc limit ${limit} offset ${offset}`,
      });
      records.push(...resp.records);
      if (resp.records.length < limit) break;
      offset += limit;
    }
    
    return records;
  };
  
  // フォーム設定から選択肢を取得
  const loadFormOptions = async () => {
    try {
      const formFields = await kintone.api('/k/v1/app/form/fields', 'GET', {
        app: CONFIG.APP_ID
      });
      
      // 業種
      const industryField = formFields.properties[CONFIG.FIELDS.INDUSTRY];
      if (industryField && industryField.type === 'DROP_DOWN') {
        industryOptions = industryField.options ? 
          Object.entries(industryField.options)
            .filter(([key]) => key !== '')
            .sort((a, b) => parseInt(a[1].index) - parseInt(b[1].index))
            .map(([key]) => key) : [];
      }
      
      // 個人特性
      const personalityField = formFields.properties[CONFIG.FIELDS.PERSONALITY];
      if (personalityField && personalityField.type === 'CHECK_BOX') {
        personalityOptions = personalityField.options ? 
          Object.entries(personalityField.options)
            .filter(([key]) => key !== '')
            .sort((a, b) => parseInt(a[1].index) - parseInt(b[1].index))
            .map(([key]) => key) : [];
      }
      
      // 接点種別（サブテーブル内）
      const subtableField = formFields.properties[CONFIG.FIELDS.CONTACT_HISTORY];
      if (subtableField && subtableField.type === 'SUBTABLE') {
        const contactTypeField = subtableField.fields[CONFIG.FIELDS.CONTACT_TYPE];
        if (contactTypeField && (contactTypeField.type === 'DROP_DOWN' || contactTypeField.type === 'RADIO_BUTTON')) {
          contactTypeOptions = contactTypeField.options ? 
            Object.entries(contactTypeField.options)
              .filter(([key]) => key !== '')
              .sort((a, b) => parseInt(a[1].index) - parseInt(b[1].index))
              .map(([key]) => key) : [];
        }
      }
      
    } catch (error) {
      console.error('フォーム設定の取得に失敗:', error);
    }
  };
  
  // 紹介者オプション更新
  const loadReferrerOptions = () => {
    referrerOptions = allRecords.map(record => ({
      id: Utils.getFieldValue(record, '$id'),
      name: Utils.getFieldValue(record, CONFIG.FIELDS.NAME),
      company: Utils.getFieldValue(record, CONFIG.FIELDS.COMPANY),
    })).filter(r => r.name);
    referrerOptions.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  };

  // ========================================
  //  フィルター
  // ========================================
  
  const applyFilters = () => {
    filteredRecords = allRecords.filter(record => {
      // お付き合い度合い
      if (currentRelationshipFilter !== 'all') {
        const rel = Utils.getFieldValue(record, CONFIG.FIELDS.RELATIONSHIP);
        if (rel !== currentRelationshipFilter) return false;
      }
      
      // 業種
      if (currentIndustryFilter !== 'all') {
        const industry = Utils.getFieldValue(record, CONFIG.FIELDS.INDUSTRY);
        if (industry !== currentIndustryFilter) return false;
      }
      
      // 紹介者
      if (currentReferrerFilter) {
        const referrer = Utils.getFieldValue(record, CONFIG.FIELDS.REFERRER).toLowerCase();
        const referrerId = Utils.getFieldValue(record, CONFIG.FIELDS.REFERRER_ID);
        const filterLower = currentReferrerFilter.toLowerCase();
        if (!referrer.includes(filterLower) && referrerId !== currentReferrerFilter) {
          return false;
        }
      }
      
      // テキスト検索
      if (currentSearch) {
        const name = Utils.getFieldValue(record, CONFIG.FIELDS.NAME).toLowerCase();
        const kana = Utils.getFieldValue(record, CONFIG.FIELDS.KANA_NAME).toLowerCase();
        const company = Utils.getFieldValue(record, CONFIG.FIELDS.COMPANY).toLowerCase();
        const notes = Utils.getFieldValue(record, CONFIG.FIELDS.NOTES).toLowerCase();
        
        const contactHistory = Utils.getFieldValue(record, CONFIG.FIELDS.CONTACT_HISTORY) || [];
        const contactMemos = contactHistory
          .map(row => (row.value[CONFIG.FIELDS.CONTACT_MEMO]?.value || '').toLowerCase())
          .join(' ');
        
        const search = currentSearch.toLowerCase();
        if (!name.includes(search) && 
            !kana.includes(search) && 
            !company.includes(search) && 
            !notes.includes(search) && 
            !contactMemos.includes(search)) {
          return false;
        }
      }
      
      return true;
    });
    
    renderList();
  };

  // ========================================
  //  スタイル
  // ========================================
  
  const injectStyles = () => {
    if (document.getElementById('hikari-mobile-people-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'hikari-mobile-people-styles';
    style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&display=swap');
    
    * { box-sizing: border-box; }
    
    /* kintone標準UIを非表示 */
    .gaia-argoui-app-toolbar,
    .gaia-argoui-app-index-toolbar,
    .gaia-argoui-app-index-pager,
    .gaia-argoui-app-index-footer,
    .recordlist-header-gaia,
    .contents-actionmenu-gaia {
      display: none !important;
    }
    
    .hikari-mobile-people {
      font-family: 'Noto Sans JP', sans-serif;
      background: linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 100%);
      min-height: 100vh;
      padding: 0;
      margin: -16px;
      color: #f7e7ce;
      padding-bottom: 100px;
    }
    
    /* ========== ヘッダー ========== */
    .hikari-mp-header {
      background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%);
      padding: 15px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    
    .hikari-mp-header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    
    .hikari-mp-title {
      font-size: 1.2rem;
      font-weight: 700;
      color: #0a0a0a;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .hikari-mp-count {
      font-size: 0.85rem;
      font-weight: 400;
    }
    
    .hikari-mp-filter-btn {
      background: rgba(0, 0, 0, 0.2);
      border: none;
      color: #0a0a0a;
      padding: 8px 15px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    
    .hikari-mp-filter-btn.active {
      background: #0a0a0a;
      color: #d4af37;
    }
    
    .hikari-mp-search {
      width: 100%;
      background: rgba(255,255,255,0.9);
      border: none;
      border-radius: 25px;
      padding: 12px 20px;
      font-size: 1rem;
      color: #333;
    }
    
    .hikari-mp-search::placeholder {
      color: #888;
    }
    
    /* ========== カードリスト ========== */
    .hikari-mp-list {
      padding: 15px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .hikari-mp-card {
      background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
      border: 1px solid rgba(212, 175, 55, 0.2);
      border-radius: 15px;
      padding: 15px;
      display: flex;
      align-items: center;
      gap: 15px;
      cursor: pointer;
      transition: all 0.2s ease;
      border-left: 4px solid var(--rel-color, #6b7280);
    }
    
    .hikari-mp-card:active {
      transform: scale(0.98);
      background: #252525;
    }
    
    .hikari-mp-card-avatar {
      width: 55px;
      height: 55px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.3rem;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
      background-size: cover;
      background-position: center;
    }
    
    .hikari-mp-card-info {
      flex: 1;
      min-width: 0;
    }
    
    .hikari-mp-card-name {
      font-size: 1rem;
      font-weight: 600;
      color: #f7e7ce;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .hikari-mp-card-company {
      font-size: 0.8rem;
      color: #888;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }
    
    .hikari-mp-card-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 6px;
    }
    
    .hikari-mp-card-rel {
      font-size: 0.7rem;
      padding: 2px 8px;
      border-radius: 10px;
      color: #0a0a0a;
      font-weight: 600;
    }
    
    .hikari-mp-card-contact {
      font-size: 0.75rem;
      color: #888;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .hikari-mp-card-contact-type {
      font-size: 0.7rem;
      padding: 2px 6px;
      border-radius: 8px;
      background: rgba(212, 175, 55, 0.15);
      color: #d4af37;
    }
    
    .hikari-mp-card-arrow {
      color: #666;
      font-size: 1.2rem;
    }
    
    .hikari-mp-empty {
      text-align: center;
      color: #888;
      padding: 40px 20px;
    }
    
    .hikari-mp-empty-icon {
      font-size: 3rem;
      margin-bottom: 15px;
    }
    
    /* ========== FAB（新規追加ボタン） ========== */
    .hikari-mp-fab {
      position: fixed;
      bottom: 25px;
      right: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%);
      border: none;
      color: #0a0a0a;
      font-size: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(212, 175, 55, 0.4);
      z-index: 50;
      cursor: pointer;
    }
    
    .hikari-mp-fab:active {
      transform: scale(0.9);
    }
    
    /* ========== フィルターパネル ========== */
    .hikari-mp-filter-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      z-index: 200;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
    }
    
    .hikari-mp-filter-overlay.active {
      opacity: 1;
      visibility: visible;
    }
    
    .hikari-mp-filter-panel {
      position: absolute;
      top: 0;
      right: 0;
      width: 85%;
      max-width: 320px;
      height: 100%;
      background: linear-gradient(180deg, #1a1a2e 0%, #0a0a0a 100%);
      transform: translateX(100%);
      transition: transform 0.3s ease;
      overflow-y: auto;
    }
    
    .hikari-mp-filter-overlay.active .hikari-mp-filter-panel {
      transform: translateX(0);
    }
    
    .hikari-mp-filter-header {
      background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%);
      padding: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .hikari-mp-filter-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: #0a0a0a;
    }
    
    .hikari-mp-filter-close {
      background: rgba(0, 0, 0, 0.2);
      border: none;
      color: #0a0a0a;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      font-size: 1.2rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .hikari-mp-filter-body {
      padding: 20px;
    }
    
    .hikari-mp-filter-section {
      margin-bottom: 25px;
    }
    
    .hikari-mp-filter-label {
      font-size: 0.85rem;
      color: #d4af37;
      margin-bottom: 10px;
      font-weight: 500;
    }
    
    .hikari-mp-filter-select {
      width: 100%;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(212, 175, 55, 0.3);
      border-radius: 10px;
      padding: 12px 15px;
      color: #f7e7ce;
      font-size: 0.95rem;
    }
    
    .hikari-mp-filter-select option {
      background: #1a1a1a;
      color: #f7e7ce;
    }
    
    .hikari-mp-filter-input {
      width: 100%;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(212, 175, 55, 0.3);
      border-radius: 10px;
      padding: 12px 15px;
      color: #f7e7ce;
      font-size: 0.95rem;
    }
    
    .hikari-mp-filter-input::placeholder {
      color: #666;
    }
    
    .hikari-mp-filter-actions {
      display: flex;
      gap: 10px;
      margin-top: 30px;
    }
    
    .hikari-mp-filter-btn-clear {
      flex: 1;
      background: transparent;
      border: 1px solid rgba(212, 175, 55, 0.3);
      color: #f7e7ce;
      padding: 12px;
      border-radius: 10px;
      font-size: 0.95rem;
    }
    
    .hikari-mp-filter-btn-apply {
      flex: 1;
      background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%);
      border: none;
      color: #0a0a0a;
      padding: 12px;
      border-radius: 10px;
      font-size: 0.95rem;
      font-weight: 600;
    }
    
    /* ========== 詳細モーダル ========== */
    .hikari-mp-detail-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.95);
      z-index: 300;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
      overflow-y: auto;
    }
    
    .hikari-mp-detail-overlay.active {
      opacity: 1;
      visibility: visible;
    }
    
    .hikari-mp-detail {
      min-height: 100%;
      background: linear-gradient(180deg, #1a1a2e 0%, #0a0a0a 100%);
    }
    
    .hikari-mp-detail-header {
      background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%);
      padding: 15px;
      display: flex;
      align-items: center;
      gap: 15px;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    
    .hikari-mp-detail-back {
      background: rgba(0, 0, 0, 0.2);
      border: none;
      color: #0a0a0a;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      font-size: 1.2rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .hikari-mp-detail-title {
      flex: 1;
      font-size: 1.1rem;
      font-weight: 700;
      color: #0a0a0a;
    }
    
    .hikari-mp-detail-edit {
      background: rgba(0, 0, 0, 0.2);
      border: none;
      color: #0a0a0a;
      padding: 8px 15px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 500;
    }
    
    .hikari-mp-detail-body {
      padding: 20px;
    }
    
    .hikari-mp-detail-profile {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 25px;
    }
    
    .hikari-mp-detail-avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      font-weight: 700;
      color: #fff;
      background-size: cover;
      background-position: center;
      flex-shrink: 0;
    }
    
    .hikari-mp-detail-info {
      flex: 1;
    }
    
    .hikari-mp-detail-name {
      font-size: 1.4rem;
      font-weight: 700;
      color: #f7e7ce;
    }
    
    .hikari-mp-detail-company {
      font-size: 0.9rem;
      color: #888;
      margin-top: 4px;
    }
    
    .hikari-mp-detail-rel {
      display: inline-block;
      font-size: 0.75rem;
      padding: 3px 10px;
      border-radius: 12px;
      color: #0a0a0a;
      font-weight: 600;
      margin-top: 8px;
    }
    
    /* アクションボタン */
    .hikari-mp-detail-actions {
      display: flex;
      gap: 12px;
      margin-bottom: 25px;
    }
    
    .hikari-mp-action-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 15px;
      border-radius: 15px;
      text-decoration: none;
      transition: all 0.2s ease;
    }
    
    .hikari-mp-action-btn:active {
      transform: scale(0.95);
    }
    
    .hikari-mp-action-btn.phone {
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: #fff;
    }
    
    .hikari-mp-action-btn.email {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: #fff;
    }
    
    .hikari-mp-action-btn.disabled {
      background: #333;
      color: #666;
      pointer-events: none;
    }
    
    .hikari-mp-action-icon {
      font-size: 1.5rem;
    }
    
    .hikari-mp-action-label {
      font-size: 0.8rem;
      font-weight: 500;
    }
    
    /* 情報セクション */
    .hikari-mp-detail-section {
      margin-bottom: 25px;
    }
    
    .hikari-mp-detail-section-title {
      font-size: 0.9rem;
      font-weight: 600;
      color: #d4af37;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .hikari-mp-detail-row {
      display: flex;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    
    .hikari-mp-detail-label {
      font-size: 0.8rem;
      color: #888;
      min-width: 80px;
    }
    
    .hikari-mp-detail-value {
      font-size: 0.9rem;
      color: #f7e7ce;
      flex: 1;
      word-break: break-all;
    }
    
    .hikari-mp-detail-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    
    .hikari-mp-detail-tag {
      font-size: 0.75rem;
      padding: 4px 10px;
      border-radius: 12px;
      background: rgba(139, 92, 246, 0.15);
      color: #a78bfa;
    }
    
    /* 接点履歴 */
    .hikari-mp-history-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    
    .hikari-mp-history-item {
      background: rgba(255,255,255,0.03);
      border-radius: 12px;
      padding: 12px;
    }
    
    .hikari-mp-history-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    
    .hikari-mp-history-date {
      font-size: 0.85rem;
      color: #d4af37;
      font-weight: 500;
    }
    
    .hikari-mp-history-type {
      font-size: 0.7rem;
      padding: 2px 8px;
      border-radius: 8px;
      background: rgba(212, 175, 55, 0.15);
      color: #d4af37;
    }
    
    .hikari-mp-history-memo {
      font-size: 0.85rem;
      color: #ccc;
      line-height: 1.5;
    }
    
    .hikari-mp-history-empty {
      text-align: center;
      color: #666;
      padding: 20px;
      font-size: 0.9rem;
    }
    
    /* 接点追加ボタン */
    .hikari-mp-add-history-btn {
      width: 100%;
      background: transparent;
      border: 2px dashed rgba(212, 175, 55, 0.3);
      border-radius: 12px;
      padding: 15px;
      color: #d4af37;
      font-size: 0.9rem;
      margin-top: 15px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    
    .hikari-mp-add-history-btn:active {
      background: rgba(212, 175, 55, 0.1);
    }
    
    /* 接点追加フォーム */
    .hikari-mp-history-form {
      background: rgba(212, 175, 55, 0.05);
      border: 1px solid rgba(212, 175, 55, 0.2);
      border-radius: 15px;
      padding: 15px;
      margin-top: 15px;
      display: none;
    }
    
    .hikari-mp-history-form.active {
      display: block;
    }
    
    .hikari-mp-history-form-row {
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
    }
    
    .hikari-mp-history-form-group {
      flex: 1;
    }
    
    .hikari-mp-history-form-group.full {
      flex: none;
      width: 100%;
    }
    
    .hikari-mp-history-form-label {
      font-size: 0.8rem;
      color: #d4af37;
      margin-bottom: 5px;
      display: block;
    }
    
    .hikari-mp-history-input,
    .hikari-mp-history-select,
    .hikari-mp-history-textarea {
      width: 100%;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(212, 175, 55, 0.3);
      border-radius: 8px;
      padding: 10px 12px;
      color: #f7e7ce;
      font-size: 0.9rem;
    }
    
    .hikari-mp-history-textarea {
      min-height: 80px;
      resize: vertical;
    }
    
    .hikari-mp-history-form-actions {
      display: flex;
      gap: 10px;
      margin-top: 12px;
    }
    
    .hikari-mp-history-btn-cancel {
      flex: 1;
      background: transparent;
      border: 1px solid rgba(255,255,255,0.2);
      color: #888;
      padding: 10px;
      border-radius: 8px;
      font-size: 0.9rem;
    }
    
    .hikari-mp-history-btn-save {
      flex: 1;
      background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%);
      border: none;
      color: #0a0a0a;
      padding: 10px;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
    }
    
    /* ========== 編集モーダル ========== */
    .hikari-mp-edit-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.95);
      z-index: 400;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
      overflow-y: auto;
    }
    
    .hikari-mp-edit-overlay.active {
      opacity: 1;
      visibility: visible;
    }
    
    .hikari-mp-edit {
      min-height: 100%;
      background: linear-gradient(180deg, #1a1a2e 0%, #0a0a0a 100%);
    }
    
    .hikari-mp-edit-header {
      background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%);
      padding: 15px;
      display: flex;
      align-items: center;
      gap: 15px;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    
    .hikari-mp-edit-cancel {
      background: rgba(0, 0, 0, 0.2);
      border: none;
      color: #0a0a0a;
      padding: 8px 15px;
      border-radius: 20px;
      font-size: 0.85rem;
    }
    
    .hikari-mp-edit-title {
      flex: 1;
      font-size: 1.1rem;
      font-weight: 700;
      color: #0a0a0a;
      text-align: center;
    }
    
    .hikari-mp-edit-save {
      background: #0a0a0a;
      border: none;
      color: #d4af37;
      padding: 8px 15px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    
    .hikari-mp-edit-body {
      padding: 20px;
    }
    
    /* 写真アップロード */
    .hikari-mp-edit-photo {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 25px;
    }
    
    .hikari-mp-edit-photo-preview {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: #333;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.5rem;
      color: #666;
      margin-bottom: 10px;
      background-size: cover;
      background-position: center;
      border: 3px solid rgba(212, 175, 55, 0.3);
    }
    
    .hikari-mp-edit-photo-btn {
      background: transparent;
      border: 1px solid rgba(212, 175, 55, 0.5);
      color: #d4af37;
      padding: 8px 20px;
      border-radius: 20px;
      font-size: 0.85rem;
    }
    
    .hikari-mp-edit-photo-input {
      display: none;
    }
    
    /* フォームフィールド */
    .hikari-mp-edit-section {
      margin-bottom: 20px;
    }
    
    .hikari-mp-edit-section-title {
      font-size: 0.85rem;
      font-weight: 600;
      color: #d4af37;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(212, 175, 55, 0.2);
    }
    
    .hikari-mp-edit-field {
      margin-bottom: 15px;
    }
    
    .hikari-mp-edit-label {
      font-size: 0.8rem;
      color: #888;
      margin-bottom: 6px;
      display: block;
    }
    
    .hikari-mp-edit-label.required::after {
      content: ' *';
      color: #ef4444;
    }
    
    .hikari-mp-edit-input,
    .hikari-mp-edit-select,
    .hikari-mp-edit-textarea {
      width: 100%;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(212, 175, 55, 0.3);
      border-radius: 10px;
      padding: 12px 15px;
      color: #f7e7ce;
      font-size: 0.95rem;
    }
    
    .hikari-mp-edit-input:focus,
    .hikari-mp-edit-select:focus,
    .hikari-mp-edit-textarea:focus {
      outline: none;
      border-color: #d4af37;
    }
    
    .hikari-mp-edit-textarea {
      min-height: 100px;
      resize: vertical;
    }
    
    .hikari-mp-edit-select option {
      background: #1a1a1a;
      color: #f7e7ce;
    }
    
    /* 紹介者検索 */
    .hikari-mp-referrer-container {
      position: relative;
    }
    
    .hikari-mp-referrer-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: linear-gradient(145deg, rgba(26, 26, 46, 0.98), rgba(16, 16, 35, 0.98));
      border: 1px solid rgba(212, 175, 55, 0.3);
      border-radius: 10px;
      max-height: 200px;
      overflow-y: auto;
      z-index: 100;
      display: none;
    }
    
    .hikari-mp-referrer-dropdown.active {
      display: block;
    }
    
    .hikari-mp-referrer-item {
      padding: 12px 15px;
      border-bottom: 1px solid rgba(212, 175, 55, 0.1);
    }
    
    .hikari-mp-referrer-item:active {
      background: rgba(212, 175, 55, 0.1);
    }
    
    .hikari-mp-referrer-name {
      font-size: 0.9rem;
      color: #f7e7ce;
    }
    
    .hikari-mp-referrer-company {
      font-size: 0.75rem;
      color: #888;
    }
    
    /* 個人特性チェックボックス */
    .hikari-mp-edit-checkbox-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    
    .hikari-mp-edit-checkbox-item {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255,255,255,0.03);
      padding: 8px 12px;
      border-radius: 8px;
    }
    
    .hikari-mp-edit-checkbox-item input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: #d4af37;
    }
    
    .hikari-mp-edit-checkbox-item label {
      font-size: 0.85rem;
      color: #f7e7ce;
    }
    
    /* 削除ボタン */
    .hikari-mp-edit-delete {
      width: 100%;
      background: transparent;
      border: 1px solid #ef4444;
      color: #ef4444;
      padding: 12px;
      border-radius: 10px;
      font-size: 0.9rem;
      margin-top: 30px;
    }
    
    /* 重複警告 */
    .hikari-mp-duplicate-warning {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #ef4444;
      padding: 10px 15px;
      border-radius: 10px;
      font-size: 0.85rem;
      margin-bottom: 15px;
      display: none;
    }
    
    .hikari-mp-duplicate-warning.show {
      display: block;
    }
    
    /* ========== ローディング ========== */
    .hikari-mp-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      gap: 20px;
    }
    
    .hikari-mp-loading-spinner {
      width: 50px;
      height: 50px;
      border: 3px solid rgba(212, 175, 55, 0.2);
      border-top-color: #d4af37;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .hikari-mp-loading-text {
      color: #d4af37;
      font-size: 0.9rem;
    }
    `;
    document.head.appendChild(style);
  };

  // ========================================
  //  レンダリング
  // ========================================
  
  const renderContainer = (mount) => {
    const hasActiveFilters = currentRelationshipFilter !== 'all' || 
                              currentIndustryFilter !== 'all' || 
                              currentReferrerFilter;
    
    mount.innerHTML = `
      <div class="hikari-mobile-people">
        <!-- ヘッダー -->
        <div class="hikari-mp-header">
          <div class="hikari-mp-header-top">
            <div class="hikari-mp-title">
              👥 人脈管理
              <span class="hikari-mp-count" id="hikari-mp-count">(${filteredRecords.length}人)</span>
            </div>
            <button class="hikari-mp-filter-btn ${hasActiveFilters ? 'active' : ''}" id="hikari-filter-btn">
              🔽 絞込
            </button>
          </div>
          <input type="search" class="hikari-mp-search" id="hikari-search" 
                 placeholder="🔍 名前・会社名・メモで検索..." value="${Utils.escapeHtml(currentSearch)}">
        </div>
        
        <!-- カードリスト -->
        <div class="hikari-mp-list" id="hikari-mp-list"></div>
        
        <!-- FAB -->
        <button class="hikari-mp-fab" id="hikari-fab">＋</button>
        
        <!-- フィルターパネル -->
        <div class="hikari-mp-filter-overlay" id="hikari-filter-overlay">
          <div class="hikari-mp-filter-panel">
            <div class="hikari-mp-filter-header">
              <div class="hikari-mp-filter-title">絞り込み</div>
              <button class="hikari-mp-filter-close" id="hikari-filter-close">×</button>
            </div>
            <div class="hikari-mp-filter-body">
              <div class="hikari-mp-filter-section">
                <div class="hikari-mp-filter-label">お付き合い度合い</div>
                <select class="hikari-mp-filter-select" id="filter-relationship">
                  <option value="all">すべて</option>
                  ${CONFIG.RELATIONSHIP_ORDER.map(rel => 
                    `<option value="${rel}" ${currentRelationshipFilter === rel ? 'selected' : ''}>${rel}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="hikari-mp-filter-section">
                <div class="hikari-mp-filter-label">業種</div>
                <select class="hikari-mp-filter-select" id="filter-industry">
                  <option value="all">すべて</option>
                  ${industryOptions.map(opt => 
                    `<option value="${opt}" ${currentIndustryFilter === opt ? 'selected' : ''}>${opt}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="hikari-mp-filter-section">
                <div class="hikari-mp-filter-label">紹介者</div>
                <input type="text" class="hikari-mp-filter-input" id="filter-referrer" 
                       placeholder="紹介者名で絞り込み..." value="${Utils.escapeHtml(currentReferrerFilter)}">
              </div>
              <div class="hikari-mp-filter-actions">
                <button class="hikari-mp-filter-btn-clear" id="filter-clear">クリア</button>
                <button class="hikari-mp-filter-btn-apply" id="filter-apply">適用</button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 詳細モーダル -->
        <div class="hikari-mp-detail-overlay" id="hikari-detail-overlay">
          <div class="hikari-mp-detail" id="hikari-detail"></div>
        </div>
        
        <!-- 編集モーダル -->
        <div class="hikari-mp-edit-overlay" id="hikari-edit-overlay">
          <div class="hikari-mp-edit" id="hikari-edit"></div>
        </div>
      </div>
    `;
    
    setupEventListeners();
    renderList();
  };
  
  const renderList = () => {
    const list = document.getElementById('hikari-mp-list');
    const countEl = document.getElementById('hikari-mp-count');
    
    if (!list) return;
    
    if (countEl) countEl.textContent = `(${filteredRecords.length}人)`;
    
    if (filteredRecords.length === 0) {
      list.innerHTML = `
        <div class="hikari-mp-empty">
          <div class="hikari-mp-empty-icon">🔍</div>
          <div>該当する人脈が見つかりません</div>
        </div>
      `;
      return;
    }
    
    list.innerHTML = filteredRecords.map(record => {
      const id = Utils.getFieldValue(record, '$id');
      const name = Utils.getFieldValue(record, CONFIG.FIELDS.NAME);
      const company = Utils.getFieldValue(record, CONFIG.FIELDS.COMPANY);
      const position = Utils.getFieldValue(record, CONFIG.FIELDS.POSITION);
      const relationship = Utils.getFieldValue(record, CONFIG.FIELDS.RELATIONSHIP);
      let lastContact = Utils.getFieldValue(record, CONFIG.FIELDS.LAST_CONTACT);
      let lastContactType = Utils.getFieldValue(record, CONFIG.FIELDS.LAST_CONTACT_TYPE);
      const photo = Utils.getFieldValue(record, CONFIG.FIELDS.PHOTO);
      const color = Utils.getRelationshipColor(relationship);
      
      // サブテーブルから最新接点取得
      if (!lastContact || !lastContactType) {
        const contactHistory = Utils.getFieldValue(record, CONFIG.FIELDS.CONTACT_HISTORY) || [];
        const validHistory = contactHistory.filter(row => row.value[CONFIG.FIELDS.CONTACT_DATE]?.value);
        if (validHistory.length > 0) {
          const sorted = validHistory.sort((a, b) => {
            const dateA = a.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '';
            const dateB = b.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '';
            return dateB.localeCompare(dateA);
          });
          if (!lastContact) lastContact = sorted[0].value[CONFIG.FIELDS.CONTACT_DATE]?.value || '';
          if (!lastContactType) lastContactType = sorted[0].value[CONFIG.FIELDS.CONTACT_TYPE]?.value || '';
        }
      }
      
      const hasPhoto = photo && photo.length > 0;
      const fileKey = hasPhoto ? photo[0].fileKey : '';
      const cachedUrl = fileKey ? Utils._fileUrlCache[fileKey] : '';
      const photoStyle = cachedUrl 
        ? `background-image: url('${cachedUrl}'); background-size: cover; background-position: center; color: transparent;`
        : '';
      
      return `
        <div class="hikari-mp-card" data-record-id="${id}" style="--rel-color: ${color}">
          <div class="hikari-mp-card-avatar" data-file-key="${fileKey}" style="background: ${color}; ${photoStyle}">
            ${Utils.getInitial(name)}
          </div>
          <div class="hikari-mp-card-info">
            <div class="hikari-mp-card-name">${Utils.escapeHtml(name)}</div>
            <div class="hikari-mp-card-company">${Utils.escapeHtml(company)}${position ? ' / ' + Utils.escapeHtml(position) : ''}</div>
            <div class="hikari-mp-card-meta">
              <span class="hikari-mp-card-rel" style="background: ${color}">${relationship || '未設定'}</span>
              <span class="hikari-mp-card-contact">
                ${lastContactType ? `<span class="hikari-mp-card-contact-type">${Utils.escapeHtml(lastContactType)}</span>` : ''}
                ${lastContact ? Utils.formatDateShort(lastContact) : '接点なし'}
              </span>
            </div>
          </div>
          <div class="hikari-mp-card-arrow">›</div>
        </div>
      `;
    }).join('');
    
    // カードクリックイベント
    list.querySelectorAll('.hikari-mp-card').forEach(card => {
      card.addEventListener('click', () => {
        const recordId = card.dataset.recordId;
        const record = allRecords.find(r => Utils.getFieldValue(r, '$id') === recordId);
        if (record) showDetailModal(record);
      });
    });
    
    // 写真を非同期読み込み
    list.querySelectorAll('.hikari-mp-card-avatar[data-file-key]').forEach(async (avatar) => {
      const fileKey = avatar.dataset.fileKey;
      if (fileKey && !Utils._fileUrlCache[fileKey]) {
        const url = await Utils.getFileUrl(fileKey);
        if (url) {
          avatar.style.backgroundImage = `url('${url}')`;
          avatar.style.backgroundSize = 'cover';
          avatar.style.backgroundPosition = 'center';
          avatar.style.color = 'transparent';
        }
      }
    });
  };

  // ========================================
  //  詳細モーダル
  // ========================================
  
  let currentDetailRecord = null;
  
  const showDetailModal = async (record) => {
    currentDetailRecord = record;
    
    const id = Utils.getFieldValue(record, '$id');
    const name = Utils.getFieldValue(record, CONFIG.FIELDS.NAME);
    const company = Utils.getFieldValue(record, CONFIG.FIELDS.COMPANY);
    const position = Utils.getFieldValue(record, CONFIG.FIELDS.POSITION);
    const phone = Utils.getFieldValue(record, CONFIG.FIELDS.PHONE);
    const email = Utils.getFieldValue(record, CONFIG.FIELDS.EMAIL);
    const relationship = Utils.getFieldValue(record, CONFIG.FIELDS.RELATIONSHIP);
    const industry = Utils.getFieldValue(record, CONFIG.FIELDS.INDUSTRY);
    const personality = Utils.getFieldValue(record, CONFIG.FIELDS.PERSONALITY) || [];
    const referrer = Utils.getFieldValue(record, CONFIG.FIELDS.REFERRER);
    const notes = Utils.getFieldValue(record, CONFIG.FIELDS.NOTES);
    const birthday = Utils.getFieldValue(record, CONFIG.FIELDS.BIRTHDAY);
    const photo = Utils.getFieldValue(record, CONFIG.FIELDS.PHOTO);
    const contactHistory = Utils.getFieldValue(record, CONFIG.FIELDS.CONTACT_HISTORY) || [];
    const color = Utils.getRelationshipColor(relationship);
    
    // 写真URL
    let photoUrl = '';
    if (photo && photo.length > 0) {
      photoUrl = await Utils.getFileUrl(photo[0].fileKey);
    }
    const photoStyle = photoUrl 
      ? `background-image: url('${photoUrl}'); color: transparent;` 
      : '';
    
    // 接点履歴（有効な行のみ、日付降順）
    const validHistory = contactHistory
      .filter(row => row.value[CONFIG.FIELDS.CONTACT_DATE]?.value)
      .sort((a, b) => {
        const dateA = a.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '';
        const dateB = b.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '';
        return dateB.localeCompare(dateA);
      });
    
    const historyHtml = validHistory.length > 0
      ? validHistory.map(row => {
          const date = row.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '';
          const type = row.value[CONFIG.FIELDS.CONTACT_TYPE]?.value || '';
          const memo = row.value[CONFIG.FIELDS.CONTACT_MEMO]?.value || '';
          return `
            <div class="hikari-mp-history-item">
              <div class="hikari-mp-history-top">
                <div class="hikari-mp-history-date">${Utils.formatDate(date)}</div>
                ${type ? `<div class="hikari-mp-history-type">${Utils.escapeHtml(type)}</div>` : ''}
              </div>
              ${memo ? `<div class="hikari-mp-history-memo">${Utils.escapeHtml(memo)}</div>` : ''}
            </div>
          `;
        }).join('')
      : '<div class="hikari-mp-history-empty">接点履歴がありません</div>';
    
    const detail = document.getElementById('hikari-detail');
    detail.innerHTML = `
      <div class="hikari-mp-detail-header">
        <button class="hikari-mp-detail-back" id="detail-back">←</button>
        <div class="hikari-mp-detail-title">詳細</div>
        <button class="hikari-mp-detail-edit" id="detail-edit">編集</button>
      </div>
      <div class="hikari-mp-detail-body">
        <!-- プロフィール -->
        <div class="hikari-mp-detail-profile">
          <div class="hikari-mp-detail-avatar" style="background: ${color}; ${photoStyle}">
            ${Utils.getInitial(name)}
          </div>
          <div class="hikari-mp-detail-info">
            <div class="hikari-mp-detail-name">${Utils.escapeHtml(name)}</div>
            <div class="hikari-mp-detail-company">${Utils.escapeHtml(company)}${position ? ' / ' + Utils.escapeHtml(position) : ''}</div>
            <div class="hikari-mp-detail-rel" style="background: ${color}">${relationship || '未設定'}</div>
          </div>
        </div>
        
        <!-- アクションボタン -->
        <div class="hikari-mp-detail-actions">
          <a href="${phone ? 'tel:' + phone : '#'}" class="hikari-mp-action-btn phone ${phone ? '' : 'disabled'}">
            <span class="hikari-mp-action-icon">📞</span>
            <span class="hikari-mp-action-label">電話</span>
          </a>
          <a href="${email ? 'mailto:' + email : '#'}" class="hikari-mp-action-btn email ${email ? '' : 'disabled'}">
            <span class="hikari-mp-action-icon">✉️</span>
            <span class="hikari-mp-action-label">メール</span>
          </a>
        </div>
        
        <!-- 基本情報 -->
        <div class="hikari-mp-detail-section">
          <div class="hikari-mp-detail-section-title">📋 基本情報</div>
          ${phone ? `
          <div class="hikari-mp-detail-row">
            <div class="hikari-mp-detail-label">電話番号</div>
            <div class="hikari-mp-detail-value">${Utils.escapeHtml(phone)}</div>
          </div>
          ` : ''}
          ${email ? `
          <div class="hikari-mp-detail-row">
            <div class="hikari-mp-detail-label">メール</div>
            <div class="hikari-mp-detail-value">${Utils.escapeHtml(email)}</div>
          </div>
          ` : ''}
          ${birthday ? `
          <div class="hikari-mp-detail-row">
            <div class="hikari-mp-detail-label">誕生日</div>
            <div class="hikari-mp-detail-value">${Utils.formatDate(birthday)}</div>
          </div>
          ` : ''}
          ${industry ? `
          <div class="hikari-mp-detail-row">
            <div class="hikari-mp-detail-label">業種</div>
            <div class="hikari-mp-detail-value">${Utils.escapeHtml(industry)}</div>
          </div>
          ` : ''}
          ${referrer ? `
          <div class="hikari-mp-detail-row">
            <div class="hikari-mp-detail-label">紹介者</div>
            <div class="hikari-mp-detail-value">${Utils.escapeHtml(referrer)}</div>
          </div>
          ` : ''}
        </div>
        
        <!-- 個人特性 -->
        ${personality.length > 0 ? `
        <div class="hikari-mp-detail-section">
          <div class="hikari-mp-detail-section-title">✨ 個人特性</div>
          <div class="hikari-mp-detail-tags">
            ${personality.map(p => `<span class="hikari-mp-detail-tag">${Utils.escapeHtml(p)}</span>`).join('')}
          </div>
        </div>
        ` : ''}
        
        <!-- メモ -->
        ${notes ? `
        <div class="hikari-mp-detail-section">
          <div class="hikari-mp-detail-section-title">📝 メモ</div>
          <div style="font-size: 0.9rem; color: #ccc; line-height: 1.6;">${Utils.escapeHtml(notes)}</div>
        </div>
        ` : ''}
        
        <!-- 接点履歴 -->
        <div class="hikari-mp-detail-section">
          <div class="hikari-mp-detail-section-title">📅 接点履歴</div>
          <div class="hikari-mp-history-list">
            ${historyHtml}
          </div>
          
          <button class="hikari-mp-add-history-btn" id="add-history-btn">
            ＋ 接点を追加
          </button>
          
          <div class="hikari-mp-history-form" id="history-form">
            <div class="hikari-mp-history-form-row">
              <div class="hikari-mp-history-form-group">
                <label class="hikari-mp-history-form-label">接点日</label>
                <input type="date" class="hikari-mp-history-input" id="new-contact-date" value="${Utils.getTodayString()}">
              </div>
              <div class="hikari-mp-history-form-group">
                <label class="hikari-mp-history-form-label">種別</label>
                <select class="hikari-mp-history-select" id="new-contact-type">
                  ${contactTypeOptions.map(t => `<option value="${t}">${t}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="hikari-mp-history-form-group full">
              <label class="hikari-mp-history-form-label">メモ</label>
              <textarea class="hikari-mp-history-textarea" id="new-contact-memo" placeholder="接点の内容を入力..."></textarea>
            </div>
            <div class="hikari-mp-history-form-actions">
              <button class="hikari-mp-history-btn-cancel" id="cancel-history">キャンセル</button>
              <button class="hikari-mp-history-btn-save" id="save-history">追加</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // イベント設定
    document.getElementById('detail-back').addEventListener('click', closeDetailModal);
    document.getElementById('detail-edit').addEventListener('click', () => {
      closeDetailModal();
      showEditModal(record);
    });
    
    // 接点追加
    document.getElementById('add-history-btn').addEventListener('click', () => {
      document.getElementById('history-form').classList.add('active');
    });
    
    document.getElementById('cancel-history').addEventListener('click', () => {
      document.getElementById('history-form').classList.remove('active');
    });
    
    document.getElementById('save-history').addEventListener('click', () => saveContactHistory(id));
    
    document.getElementById('hikari-detail-overlay').classList.add('active');
  };
  
  const closeDetailModal = () => {
    document.getElementById('hikari-detail-overlay').classList.remove('active');
    currentDetailRecord = null;
  };
  
  const saveContactHistory = async (recordId) => {
    const date = document.getElementById('new-contact-date').value;
    const type = document.getElementById('new-contact-type').value;
    const memo = document.getElementById('new-contact-memo').value;
    
    if (!date) {
      alert('接点日を入力してください');
      return;
    }
    
    try {
      // 現在のレコード取得
      const resp = await kintone.api('/k/v1/record', 'GET', {
        app: CONFIG.APP_ID,
        id: recordId
      });
      
      const currentHistory = resp.record[CONFIG.FIELDS.CONTACT_HISTORY]?.value || [];
      
      // 新しい接点を追加
      const newRow = {
        value: {
          [CONFIG.FIELDS.CONTACT_DATE]: { value: date },
          [CONFIG.FIELDS.CONTACT_TYPE]: { value: type },
          [CONFIG.FIELDS.CONTACT_MEMO]: { value: memo },
        }
      };
      
      currentHistory.push(newRow);
      
      // 有効な履歴のみ抽出
      const validHistory = currentHistory.filter(row => row.value[CONFIG.FIELDS.CONTACT_DATE]?.value);
      
      // 最新接点を計算
      const sorted = validHistory.sort((a, b) => {
        const dateA = a.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '';
        const dateB = b.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '';
        return dateB.localeCompare(dateA);
      });
      
      const latestDate = sorted[0]?.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '';
      const latestType = sorted[0]?.value[CONFIG.FIELDS.CONTACT_TYPE]?.value || '';
      
      // 更新
      await kintone.api('/k/v1/record', 'PUT', {
        app: CONFIG.APP_ID,
        id: recordId,
        record: {
          [CONFIG.FIELDS.CONTACT_HISTORY]: { value: validHistory },
          [CONFIG.FIELDS.LAST_CONTACT]: { value: latestDate },
          [CONFIG.FIELDS.LAST_CONTACT_TYPE]: { value: latestType },
          [CONFIG.FIELDS.CONTACT_COUNT]: { value: String(validHistory.length) },
        }
      });
      
      // データ再取得＆詳細再表示
      allRecords = await fetchAllRecords();
      loadReferrerOptions();
      applyFilters();
      
      const updatedRecord = allRecords.find(r => Utils.getFieldValue(r, '$id') === recordId);
      if (updatedRecord) {
        showDetailModal(updatedRecord);
      }
      
    } catch (error) {
      console.error('接点追加エラー:', error);
      alert('接点の追加に失敗しました');
    }
  };

  // ========================================
  //  編集モーダル
  // ========================================
  
  let currentEditRecord = null;
  let selectedReferrerId = '';
  let photoFile = null;
  
  const showEditModal = async (record) => {
    currentEditRecord = record;
    const isNew = !record;
    
    // フィールド値取得（新規の場合は空）
    const name = record ? Utils.getFieldValue(record, CONFIG.FIELDS.NAME) : '';
    const kanaName = record ? Utils.getFieldValue(record, CONFIG.FIELDS.KANA_NAME) : '';
    const company = record ? Utils.getFieldValue(record, CONFIG.FIELDS.COMPANY) : '';
    const position = record ? Utils.getFieldValue(record, CONFIG.FIELDS.POSITION) : '';
    const phone = record ? Utils.getFieldValue(record, CONFIG.FIELDS.PHONE) : '';
    const email = record ? Utils.getFieldValue(record, CONFIG.FIELDS.EMAIL) : '';
    const birthday = record ? Utils.getFieldValue(record, CONFIG.FIELDS.BIRTHDAY) : '';
    const relationship = record ? Utils.getFieldValue(record, CONFIG.FIELDS.RELATIONSHIP) : '';
    const industry = record ? Utils.getFieldValue(record, CONFIG.FIELDS.INDUSTRY) : '';
    const personality = record ? Utils.getFieldValue(record, CONFIG.FIELDS.PERSONALITY) || [] : [];
    const referrer = record ? Utils.getFieldValue(record, CONFIG.FIELDS.REFERRER) : '';
    const referrerId = record ? Utils.getFieldValue(record, CONFIG.FIELDS.REFERRER_ID) : '';
    const notes = record ? Utils.getFieldValue(record, CONFIG.FIELDS.NOTES) : '';
    const photo = record ? Utils.getFieldValue(record, CONFIG.FIELDS.PHOTO) : [];
    const color = Utils.getRelationshipColor(relationship);
    
    selectedReferrerId = referrerId;
    photoFile = null;
    
    // 写真URL
    let photoUrl = '';
    if (photo && photo.length > 0) {
      photoUrl = await Utils.getFileUrl(photo[0].fileKey);
    }
    const photoStyle = photoUrl ? `background-image: url('${photoUrl}'); color: transparent;` : '';
    
    const edit = document.getElementById('hikari-edit');
    edit.innerHTML = `
      <div class="hikari-mp-edit-header">
        <button class="hikari-mp-edit-cancel" id="edit-cancel">キャンセル</button>
        <div class="hikari-mp-edit-title">${isNew ? '新規追加' : '編集'}</div>
        <button class="hikari-mp-edit-save" id="edit-save">保存</button>
      </div>
      <div class="hikari-mp-edit-body">
        <!-- 写真 -->
        <div class="hikari-mp-edit-photo">
          <div class="hikari-mp-edit-photo-preview" id="photo-preview" style="background: ${color}; ${photoStyle}">
            ${photoUrl ? '' : '📷'}
          </div>
          <button class="hikari-mp-edit-photo-btn" id="photo-btn">写真を変更</button>
          <input type="file" class="hikari-mp-edit-photo-input" id="photo-input" accept="image/*" capture="environment">
        </div>
        
        <!-- 重複警告 -->
        <div class="hikari-mp-duplicate-warning" id="duplicate-warning">
          ⚠️ 同姓同名の人脈が既に登録されています
        </div>
        
        <!-- 基本情報 -->
        <div class="hikari-mp-edit-section">
          <div class="hikari-mp-edit-section-title">基本情報</div>
          
          <div class="hikari-mp-edit-field">
            <label class="hikari-mp-edit-label required">名前</label>
            <input type="text" class="hikari-mp-edit-input" id="edit-name" value="${Utils.escapeHtml(name)}">
          </div>
          
          <div class="hikari-mp-edit-field">
            <label class="hikari-mp-edit-label">ふりがな</label>
            <input type="text" class="hikari-mp-edit-input" id="edit-kana" value="${Utils.escapeHtml(kanaName)}">
          </div>
          
          <div class="hikari-mp-edit-field">
            <label class="hikari-mp-edit-label">会社名</label>
            <input type="text" class="hikari-mp-edit-input" id="edit-company" value="${Utils.escapeHtml(company)}">
          </div>
          
          <div class="hikari-mp-edit-field">
            <label class="hikari-mp-edit-label">役職</label>
            <input type="text" class="hikari-mp-edit-input" id="edit-position" value="${Utils.escapeHtml(position)}">
          </div>
        </div>
        
        <!-- 連絡先 -->
        <div class="hikari-mp-edit-section">
          <div class="hikari-mp-edit-section-title">連絡先</div>
          
          <div class="hikari-mp-edit-field">
            <label class="hikari-mp-edit-label">電話番号</label>
            <input type="tel" class="hikari-mp-edit-input" id="edit-phone" value="${Utils.escapeHtml(phone)}">
          </div>
          
          <div class="hikari-mp-edit-field">
            <label class="hikari-mp-edit-label">メールアドレス</label>
            <input type="email" class="hikari-mp-edit-input" id="edit-email" value="${Utils.escapeHtml(email)}">
          </div>
          
          <div class="hikari-mp-edit-field">
            <label class="hikari-mp-edit-label">誕生日</label>
            <input type="date" class="hikari-mp-edit-input" id="edit-birthday" value="${birthday}">
          </div>
        </div>
        
        <!-- 分類 -->
        <div class="hikari-mp-edit-section">
          <div class="hikari-mp-edit-section-title">分類</div>
          
          <div class="hikari-mp-edit-field">
            <label class="hikari-mp-edit-label">お付き合い度合い</label>
            <select class="hikari-mp-edit-select" id="edit-relationship">
              <option value="">選択してください</option>
              ${CONFIG.RELATIONSHIP_ORDER.map(rel => 
                `<option value="${rel}" ${relationship === rel ? 'selected' : ''}>${rel}</option>`
              ).join('')}
            </select>
          </div>
          
          <div class="hikari-mp-edit-field">
            <label class="hikari-mp-edit-label">業種</label>
            <select class="hikari-mp-edit-select" id="edit-industry">
              <option value="">選択してください</option>
              ${industryOptions.map(opt => 
                `<option value="${opt}" ${industry === opt ? 'selected' : ''}>${opt}</option>`
              ).join('')}
            </select>
          </div>
          
          <div class="hikari-mp-edit-field">
            <label class="hikari-mp-edit-label">紹介者</label>
            <div class="hikari-mp-referrer-container">
              <input type="text" class="hikari-mp-edit-input" id="edit-referrer" 
                     placeholder="紹介者名を入力して検索..." value="${Utils.escapeHtml(referrer)}">
              <input type="hidden" id="edit-referrer-id" value="${referrerId}">
              <div class="hikari-mp-referrer-dropdown" id="referrer-dropdown"></div>
            </div>
          </div>
        </div>
        
        <!-- 個人特性 -->
        <div class="hikari-mp-edit-section">
          <div class="hikari-mp-edit-section-title">個人特性</div>
          <div class="hikari-mp-edit-checkbox-grid">
            ${personalityOptions.map(opt => `
              <div class="hikari-mp-edit-checkbox-item">
                <input type="checkbox" name="personality" value="${opt}" id="personality-${opt}"
                       ${personality.includes(opt) ? 'checked' : ''}>
                <label for="personality-${opt}">${opt}</label>
              </div>
            `).join('')}
          </div>
        </div>
        
        <!-- メモ -->
        <div class="hikari-mp-edit-section">
          <div class="hikari-mp-edit-section-title">メモ</div>
          <textarea class="hikari-mp-edit-textarea" id="edit-notes" placeholder="メモを入力...">${Utils.escapeHtml(notes)}</textarea>
        </div>
        
        ${!isNew ? `
        <button class="hikari-mp-edit-delete" id="edit-delete">このデータを削除</button>
        ` : ''}
      </div>
    `;
    
    setupEditEventListeners(isNew);
    document.getElementById('hikari-edit-overlay').classList.add('active');
  };
  
  const setupEditEventListeners = (isNew) => {
    document.getElementById('edit-cancel').addEventListener('click', closeEditModal);
    document.getElementById('edit-save').addEventListener('click', () => saveRecord(isNew));
    
    // 写真
    document.getElementById('photo-btn').addEventListener('click', () => {
      document.getElementById('photo-input').click();
    });
    
    document.getElementById('photo-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        photoFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const preview = document.getElementById('photo-preview');
          preview.style.backgroundImage = `url('${ev.target.result}')`;
          preview.style.backgroundSize = 'cover';
          preview.style.backgroundPosition = 'center';
          preview.textContent = '';
        };
        reader.readAsDataURL(file);
      }
    });
    
    // 重複チェック（新規時のみ）
    if (isNew) {
      let dupTimeout = null;
      document.getElementById('edit-name').addEventListener('input', (e) => {
        if (dupTimeout) clearTimeout(dupTimeout);
        dupTimeout = setTimeout(async () => {
          const name = e.target.value.trim();
          if (name.length >= 2) {
            const isDup = await checkDuplicate(name);
            document.getElementById('duplicate-warning').classList.toggle('show', isDup);
          } else {
            document.getElementById('duplicate-warning').classList.remove('show');
          }
        }, 500);
      });
    }
    
    // 紹介者検索
    const referrerInput = document.getElementById('edit-referrer');
    const referrerDropdown = document.getElementById('referrer-dropdown');
    let refTimeout = null;
    
    referrerInput.addEventListener('input', (e) => {
      if (refTimeout) clearTimeout(refTimeout);
      refTimeout = setTimeout(() => {
        const query = e.target.value.trim().toLowerCase();
        if (query.length >= 2) {
          const matches = referrerOptions.filter(r => 
            r.name.toLowerCase().includes(query) || 
            (r.company && r.company.toLowerCase().includes(query))
          ).slice(0, 10);
          
          if (matches.length > 0) {
            referrerDropdown.innerHTML = matches.map(r => `
              <div class="hikari-mp-referrer-item" data-id="${r.id}" data-name="${Utils.escapeHtml(r.name)}">
                <div class="hikari-mp-referrer-name">${Utils.escapeHtml(r.name)}</div>
                <div class="hikari-mp-referrer-company">${Utils.escapeHtml(r.company || '')}</div>
              </div>
            `).join('');
            referrerDropdown.classList.add('active');
            
            referrerDropdown.querySelectorAll('.hikari-mp-referrer-item').forEach(item => {
              item.addEventListener('click', () => {
                referrerInput.value = item.dataset.name;
                document.getElementById('edit-referrer-id').value = item.dataset.id;
                selectedReferrerId = item.dataset.id;
                referrerDropdown.classList.remove('active');
              });
            });
          } else {
            referrerDropdown.classList.remove('active');
          }
        } else {
          referrerDropdown.classList.remove('active');
        }
      }, 300);
    });
    
    referrerInput.addEventListener('blur', () => {
      setTimeout(() => referrerDropdown.classList.remove('active'), 200);
    });
    
    // 削除
    if (!isNew) {
      document.getElementById('edit-delete').addEventListener('click', deleteRecord);
    }
  };
  
  const closeEditModal = () => {
    document.getElementById('hikari-edit-overlay').classList.remove('active');
    currentEditRecord = null;
    photoFile = null;
  };
  
  const checkDuplicate = async (name) => {
    try {
      const normalizedName = name.replace(/\s+/g, '');
      const resp = await kintone.api('/k/v1/records', 'GET', {
        app: CONFIG.APP_ID,
        query: `${CONFIG.FIELDS.NAME} = "${normalizedName}"`
      });
      return resp.records.length > 0;
    } catch (e) {
      return false;
    }
  };
  
  const saveRecord = async (isNew) => {
    const name = document.getElementById('edit-name').value.trim();
    if (!name) {
      alert('名前を入力してください');
      return;
    }
    
    try {
      // データ収集
      const data = {
        [CONFIG.FIELDS.NAME]: { value: name },
        [CONFIG.FIELDS.KANA_NAME]: { value: document.getElementById('edit-kana').value },
        [CONFIG.FIELDS.COMPANY]: { value: document.getElementById('edit-company').value },
        [CONFIG.FIELDS.POSITION]: { value: document.getElementById('edit-position').value },
        [CONFIG.FIELDS.PHONE]: { value: document.getElementById('edit-phone').value },
        [CONFIG.FIELDS.EMAIL]: { value: document.getElementById('edit-email').value },
        [CONFIG.FIELDS.BIRTHDAY]: { value: document.getElementById('edit-birthday').value },
        [CONFIG.FIELDS.RELATIONSHIP]: { value: document.getElementById('edit-relationship').value },
        [CONFIG.FIELDS.INDUSTRY]: { value: document.getElementById('edit-industry').value },
        [CONFIG.FIELDS.REFERRER]: { value: document.getElementById('edit-referrer').value },
        [CONFIG.FIELDS.REFERRER_ID]: { value: document.getElementById('edit-referrer-id').value },
        [CONFIG.FIELDS.NOTES]: { value: document.getElementById('edit-notes').value },
      };
      
      // 紹介者リンク
      const refId = document.getElementById('edit-referrer-id').value;
      if (refId) {
        const refLink = location.origin + '/k/' + CONFIG.APP_ID + '/show#record=' + refId;
        data[CONFIG.FIELDS.REFERRER_LINK] = { value: refLink };
      } else {
        data[CONFIG.FIELDS.REFERRER_LINK] = { value: '' };
      }
      
      // 個人特性
      const personalityChecks = document.querySelectorAll('input[name="personality"]:checked');
      const personalityValues = Array.from(personalityChecks).map(cb => cb.value);
      data[CONFIG.FIELDS.PERSONALITY] = { value: personalityValues };
      
      // 写真アップロード
      if (photoFile) {
        const formData = new FormData();
        formData.append('__REQUEST_TOKEN__', kintone.getRequestToken());
        formData.append('file', photoFile);
        
        const uploadResp = await fetch('/k/v1/file.json', {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          body: formData
        }).then(r => r.json());
        
        data[CONFIG.FIELDS.PHOTO] = { value: [{ fileKey: uploadResp.fileKey }] };
      }
      
      if (isNew) {
        await kintone.api('/k/v1/record', 'POST', {
          app: CONFIG.APP_ID,
          record: data
        });
      } else {
        const id = Utils.getFieldValue(currentEditRecord, '$id');
        await kintone.api('/k/v1/record', 'PUT', {
          app: CONFIG.APP_ID,
          id: id,
          record: data
        });
      }
      
      // データ再取得
      allRecords = await fetchAllRecords();
      loadReferrerOptions();
      applyFilters();
      
      closeEditModal();
      
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました: ' + (error.message || error));
    }
  };
  
  const deleteRecord = async () => {
    if (!confirm('本当にこのデータを削除しますか？')) return;
    
    try {
      const id = Utils.getFieldValue(currentEditRecord, '$id');
      await kintone.api('/k/v1/records', 'DELETE', {
        app: CONFIG.APP_ID,
        ids: [id]
      });
      
      allRecords = await fetchAllRecords();
      loadReferrerOptions();
      applyFilters();
      
      closeEditModal();
      
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました');
    }
  };

  // ========================================
  //  イベント設定
  // ========================================
  
  const setupEventListeners = () => {
    // 検索
    document.getElementById('hikari-search').addEventListener('input', (e) => {
      currentSearch = e.target.value;
      applyFilters();
    });
    
    // フィルターパネル開閉
    document.getElementById('hikari-filter-btn').addEventListener('click', () => {
      document.getElementById('hikari-filter-overlay').classList.add('active');
    });
    
    document.getElementById('hikari-filter-close').addEventListener('click', () => {
      document.getElementById('hikari-filter-overlay').classList.remove('active');
    });
    
    document.getElementById('hikari-filter-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'hikari-filter-overlay') {
        document.getElementById('hikari-filter-overlay').classList.remove('active');
      }
    });
    
    // フィルタークリア
    document.getElementById('filter-clear').addEventListener('click', () => {
      document.getElementById('filter-relationship').value = 'all';
      document.getElementById('filter-industry').value = 'all';
      document.getElementById('filter-referrer').value = '';
      currentRelationshipFilter = 'all';
      currentIndustryFilter = 'all';
      currentReferrerFilter = '';
      applyFilters();
      updateFilterBtnState();
    });
    
    // フィルター適用
    document.getElementById('filter-apply').addEventListener('click', () => {
      currentRelationshipFilter = document.getElementById('filter-relationship').value;
      currentIndustryFilter = document.getElementById('filter-industry').value;
      currentReferrerFilter = document.getElementById('filter-referrer').value;
      applyFilters();
      updateFilterBtnState();
      document.getElementById('hikari-filter-overlay').classList.remove('active');
    });
    
    // FAB
    document.getElementById('hikari-fab').addEventListener('click', () => {
      showEditModal(null);
    });
  };
  
  const updateFilterBtnState = () => {
    const btn = document.getElementById('hikari-filter-btn');
    const hasActive = currentRelationshipFilter !== 'all' || 
                      currentIndustryFilter !== 'all' || 
                      currentReferrerFilter;
    btn.classList.toggle('active', hasActive);
  };

  // ========================================
  //  初期化
  // ========================================
  
  const init = async (mount) => {
    console.log('🌟 HIKARI Mobile People initializing...');
    
    injectStyles();
    
    // ローディング
    mount.innerHTML = `
      <div class="hikari-mobile-people">
        <div class="hikari-mp-loading">
          <div class="hikari-mp-loading-spinner"></div>
          <div class="hikari-mp-loading-text">データを読み込み中...</div>
        </div>
      </div>
    `;
    
    try {
      // データ取得
      await loadFormOptions();
      allRecords = await fetchAllRecords();
      loadReferrerOptions();
      filteredRecords = [...allRecords];
      
      console.log(`✅ ${allRecords.length}件のデータを取得`);
      
      // 描画
      renderContainer(mount);
      
      console.log('✅ HIKARI Mobile People initialized');
      
    } catch (error) {
      console.error('❌ 初期化エラー:', error);
      mount.innerHTML = `
        <div class="hikari-mobile-people">
          <div class="hikari-mp-loading">
            <div style="color: #ef4444; font-size: 2rem;">⚠️</div>
            <div class="hikari-mp-loading-text">データの取得に失敗しました</div>
          </div>
        </div>
      `;
    }
  };

  // ========================================
  //  イベント登録
  // ========================================
  
  kintone.events.on('mobile.app.record.index.show', (event) => {
    // ★VIEW_IDを設定した場合は条件を追加
    // if (event.viewId !== CONFIG.VIEW_ID) return event;
    
    const mount = kintone.mobile.app.getHeaderSpaceElement();
    if (mount) {
      init(mount);
    }
    
    return event;
  });

})();
