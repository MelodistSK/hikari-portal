/**
 * HIKARI Mobile People App v3
 * kintoneモバイル環境完全対応版
 * 
 * ポイント:
 * - position: fixed を使用しない（kintoneモバイルで動作しないため）
 * - 画面遷移はコンテナ内のHTML書き換えで実現
 * - すべてのUIを単一コンテナ内で完結
 */

(function() {
  'use strict';

  // ========================================
  //  設定値
  // ========================================
  
  const CONFIG = {
    APP_ID: kintone.mobile.app.getId() || 6,
    
    FIELDS: {
      NAME: 'name',
      KANA_NAME: 'kananame',
      COMPANY: 'ルックアップ',
      POSITION: '役職',
      PHONE: '電話番号',
      EMAIL: 'メールアドレス',
      BIRTHDAY: 'birthday',
      PHOTO: '顔写真',
      INDUSTRY: '業種',
      RELATIONSHIP: 'お付き合い度合い',
      PERSONALITY: 'パーソナリティ評価',
      REFERRER: '紹介者',
      REFERRER_ID: '紹介者rid',
      REFERRER_LINK: '紹介者リンク',
      NOTES: 'shokai_memo',
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
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  
  let container = null;
  let allRecords = [];
  let filteredRecords = [];
  let currentSearch = '';
  let currentRelationshipFilter = 'all';
  let currentIndustryFilter = 'all';
  
  let industryOptions = [];
  let personalityOptions = [];
  let contactTypeOptions = [];
  let referrerOptions = [];
  
  let currentDetailRecord = null;
  let currentEditRecord = null;
  let photoFile = null;

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
  
  const loadFormOptions = async () => {
    try {
      const formFields = await kintone.api('/k/v1/app/form/fields', 'GET', {
        app: CONFIG.APP_ID
      });
      
      const industryField = formFields.properties[CONFIG.FIELDS.INDUSTRY];
      if (industryField && industryField.options) {
        industryOptions = Object.entries(industryField.options)
          .filter(([key]) => key !== '')
          .sort((a, b) => parseInt(a[1].index) - parseInt(b[1].index))
          .map(([key]) => key);
      }
      
      const personalityField = formFields.properties[CONFIG.FIELDS.PERSONALITY];
      if (personalityField && personalityField.options) {
        personalityOptions = Object.entries(personalityField.options)
          .filter(([key]) => key !== '')
          .sort((a, b) => parseInt(a[1].index) - parseInt(b[1].index))
          .map(([key]) => key);
      }
      
      const subtableField = formFields.properties[CONFIG.FIELDS.CONTACT_HISTORY];
      if (subtableField && subtableField.fields) {
        const contactTypeField = subtableField.fields[CONFIG.FIELDS.CONTACT_TYPE];
        if (contactTypeField && contactTypeField.options) {
          contactTypeOptions = Object.entries(contactTypeField.options)
            .filter(([key]) => key !== '')
            .sort((a, b) => parseInt(a[1].index) - parseInt(b[1].index))
            .map(([key]) => key);
        }
      }
      
    } catch (error) {
      console.error('フォーム設定の取得に失敗:', error);
    }
  };
  
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
      if (currentRelationshipFilter !== 'all') {
        const rel = Utils.getFieldValue(record, CONFIG.FIELDS.RELATIONSHIP);
        if (rel !== currentRelationshipFilter) return false;
      }
      
      if (currentIndustryFilter !== 'all') {
        const industry = Utils.getFieldValue(record, CONFIG.FIELDS.INDUSTRY);
        if (industry !== currentIndustryFilter) return false;
      }
      
      if (currentSearch) {
        const name = Utils.getFieldValue(record, CONFIG.FIELDS.NAME).toLowerCase();
        const kana = Utils.getFieldValue(record, CONFIG.FIELDS.KANA_NAME).toLowerCase();
        const company = Utils.getFieldValue(record, CONFIG.FIELDS.COMPANY).toLowerCase();
        const notes = Utils.getFieldValue(record, CONFIG.FIELDS.NOTES).toLowerCase();
        const search = currentSearch.toLowerCase();
        
        if (!name.includes(search) && !kana.includes(search) && !company.includes(search) && !notes.includes(search)) {
          return false;
        }
      }
      
      return true;
    });
  };

  // ========================================
  //  CSS（position: fixed を使わない）
  // ========================================
  
  const getStyles = () => `
    #hmp-root * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }
    
    #hmp-root {
      font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif;
      background: #1a1a2e;
      color: #f5f5f5;
      font-size: 14px;
      line-height: 1.5;
      min-height: 100vh;
      padding-bottom: 20px;
    }
    
    /* ヘッダー（sticky ではなく通常配置） */
    .hmp-header {
      background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%);
      padding: 14px 16px;
    }
    
    .hmp-header-title {
      color: #1a1a1a;
      font-size: 17px;
      font-weight: 700;
      text-align: center;
    }
    
    .hmp-header-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .hmp-header-btn {
      background: rgba(0,0,0,0.15);
      border: none;
      color: #1a1a1a;
      width: 36px;
      height: 36px;
      min-width: 36px;
      border-radius: 50%;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    
    .hmp-header-btn-text {
      background: rgba(0,0,0,0.15);
      border: none;
      color: #1a1a1a;
      padding: 8px 14px;
      border-radius: 18px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    
    .hmp-header-spacer {
      flex: 1;
    }
    
    /* 検索バー */
    .hmp-search-area {
      padding: 12px 16px;
      background: #1a1a2e;
    }
    
    .hmp-search-row {
      display: flex;
      gap: 8px;
    }
    
    .hmp-search-input {
      flex: 1;
      background: #2a2a4a;
      border: 1px solid #3a3a5a;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 15px;
      color: #f5f5f5;
    }
    
    .hmp-search-input::placeholder {
      color: #888;
    }
    
    .hmp-filter-btn {
      background: #2a2a4a;
      border: 1px solid #3a3a5a;
      color: #d4af37;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
    }
    
    .hmp-filter-btn.active {
      background: #d4af37;
      color: #1a1a1a;
      border-color: #d4af37;
    }
    
    /* カウント */
    .hmp-list-count {
      padding: 8px 16px;
      font-size: 12px;
      color: #888;
    }
    
    /* カードリスト */
    .hmp-list-body {
      padding: 0 12px;
    }
    
    .hmp-card {
      background: #252540;
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-left: 4px solid var(--rel-color, #6b7280);
      cursor: pointer;
    }
    
    .hmp-card:active {
      opacity: 0.8;
    }
    
    .hmp-card-avatar {
      width: 44px;
      height: 44px;
      min-width: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: 700;
      color: #fff;
      background-size: cover;
      background-position: center;
    }
    
    .hmp-card-info {
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }
    
    .hmp-card-name {
      font-size: 14px;
      font-weight: 600;
      color: #f5f5f5;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .hmp-card-company {
      font-size: 11px;
      color: #999;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }
    
    .hmp-card-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
      flex-wrap: wrap;
    }
    
    .hmp-card-badge {
      font-size: 9px;
      padding: 2px 6px;
      border-radius: 8px;
      font-weight: 600;
      color: #1a1a1a;
    }
    
    .hmp-card-contact {
      font-size: 10px;
      color: #888;
    }
    
    .hmp-card-arrow {
      color: #666;
      font-size: 16px;
      min-width: 16px;
    }
    
    /* 空表示 */
    .hmp-empty {
      text-align: center;
      padding: 40px 20px;
      color: #888;
    }
    
    .hmp-empty-icon {
      font-size: 40px;
      margin-bottom: 12px;
    }
    
    /* 新規追加ボタン（リストの最後に配置、fixed は使わない） */
    .hmp-add-card {
      background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%);
      border-radius: 10px;
      padding: 16px;
      margin: 16px 12px;
      text-align: center;
      color: #1a1a1a;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
    }
    
    .hmp-add-card:active {
      opacity: 0.8;
    }
    
    /* ========== フィルター画面 ========== */
    .hmp-filter-body {
      padding: 20px 16px;
    }
    
    .hmp-filter-section {
      margin-bottom: 20px;
    }
    
    .hmp-filter-label {
      font-size: 13px;
      color: #d4af37;
      margin-bottom: 8px;
      font-weight: 600;
    }
    
    .hmp-filter-select {
      width: 100%;
      background: #252540;
      border: 1px solid #3a3a5a;
      border-radius: 8px;
      padding: 12px 14px;
      font-size: 15px;
      color: #f5f5f5;
    }
    
    .hmp-filter-select option {
      background: #1a1a2e;
      color: #f5f5f5;
    }
    
    .hmp-filter-actions {
      display: flex;
      gap: 12px;
      margin-top: 30px;
    }
    
    .hmp-btn {
      flex: 1;
      padding: 14px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      text-align: center;
      cursor: pointer;
      border: none;
    }
    
    .hmp-btn-secondary {
      background: #252540;
      border: 1px solid #3a3a5a;
      color: #f5f5f5;
    }
    
    .hmp-btn-primary {
      background: linear-gradient(135deg, #d4af37, #b8941f);
      color: #1a1a1a;
    }
    
    /* ========== 詳細画面 ========== */
    .hmp-detail-body {
      padding: 16px;
    }
    
    .hmp-detail-profile {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 20px;
    }
    
    .hmp-detail-avatar {
      width: 64px;
      height: 64px;
      min-width: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: 700;
      color: #fff;
      background-size: cover;
      background-position: center;
    }
    
    .hmp-detail-info {
      flex: 1;
      min-width: 0;
    }
    
    .hmp-detail-name {
      font-size: 18px;
      font-weight: 700;
      color: #f5f5f5;
    }
    
    .hmp-detail-company {
      font-size: 12px;
      color: #999;
      margin-top: 4px;
    }
    
    .hmp-detail-badge {
      display: inline-block;
      font-size: 10px;
      padding: 3px 10px;
      border-radius: 10px;
      font-weight: 600;
      color: #1a1a1a;
      margin-top: 6px;
    }
    
    /* アクションボタン */
    .hmp-detail-actions {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    
    .hmp-action-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 12px 8px;
      border-radius: 10px;
      text-decoration: none;
      font-size: 11px;
      font-weight: 600;
    }
    
    .hmp-action-btn-phone {
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: #fff;
    }
    
    .hmp-action-btn-email {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: #fff;
    }
    
    .hmp-action-btn-disabled {
      background: #3a3a5a;
      color: #666;
      pointer-events: none;
    }
    
    .hmp-action-icon {
      font-size: 20px;
    }
    
    /* セクション */
    .hmp-section {
      margin-bottom: 20px;
    }
    
    .hmp-section-title {
      font-size: 13px;
      font-weight: 600;
      color: #d4af37;
      margin-bottom: 10px;
    }
    
    .hmp-info-row {
      display: flex;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    
    .hmp-info-label {
      font-size: 11px;
      color: #888;
      width: 70px;
      min-width: 70px;
    }
    
    .hmp-info-value {
      font-size: 13px;
      color: #f5f5f5;
      flex: 1;
      word-break: break-all;
    }
    
    /* タグ */
    .hmp-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    
    .hmp-tag {
      font-size: 10px;
      padding: 4px 8px;
      border-radius: 10px;
      background: rgba(139, 92, 246, 0.2);
      color: #a78bfa;
    }
    
    /* メモ */
    .hmp-memo-text {
      font-size: 13px;
      color: #ccc;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    
    /* 接点履歴 */
    .hmp-history-item {
      background: #252540;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 8px;
    }
    
    .hmp-history-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    
    .hmp-history-date {
      font-size: 12px;
      color: #d4af37;
      font-weight: 600;
    }
    
    .hmp-history-type {
      font-size: 9px;
      padding: 2px 6px;
      border-radius: 6px;
      background: rgba(212, 175, 55, 0.15);
      color: #d4af37;
    }
    
    .hmp-history-memo {
      font-size: 12px;
      color: #ccc;
      line-height: 1.4;
    }
    
    .hmp-history-empty {
      text-align: center;
      color: #666;
      padding: 16px;
      font-size: 12px;
    }
    
    /* 接点追加ボタン */
    .hmp-add-contact-btn {
      width: 100%;
      background: transparent;
      border: 1px dashed #3a3a5a;
      border-radius: 8px;
      padding: 12px;
      color: #d4af37;
      font-size: 13px;
      cursor: pointer;
      margin-top: 10px;
    }
    
    /* 接点フォーム */
    .hmp-contact-form {
      background: #252540;
      border-radius: 10px;
      padding: 14px;
      margin-top: 10px;
    }
    
    .hmp-form-row {
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
    }
    
    .hmp-form-group {
      flex: 1;
    }
    
    .hmp-form-label {
      font-size: 11px;
      color: #d4af37;
      margin-bottom: 4px;
      display: block;
    }
    
    .hmp-form-input,
    .hmp-form-select,
    .hmp-form-textarea {
      width: 100%;
      background: #1a1a2e;
      border: 1px solid #3a3a5a;
      border-radius: 6px;
      padding: 10px;
      font-size: 14px;
      color: #f5f5f5;
    }
    
    .hmp-form-textarea {
      min-height: 60px;
      resize: vertical;
    }
    
    .hmp-form-actions {
      display: flex;
      gap: 8px;
    }
    
    /* ========== 編集画面 ========== */
    .hmp-edit-body {
      padding: 16px;
    }
    
    .hmp-edit-photo {
      text-align: center;
      margin-bottom: 20px;
    }
    
    .hmp-edit-photo-preview {
      width: 70px;
      height: 70px;
      border-radius: 50%;
      background: #3a3a5a;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      color: #666;
      margin-bottom: 8px;
      background-size: cover;
      background-position: center;
      border: 2px solid rgba(212, 175, 55, 0.3);
    }
    
    .hmp-edit-photo-btn {
      display: block;
      margin: 0 auto;
      background: transparent;
      border: 1px solid rgba(212, 175, 55, 0.5);
      color: #d4af37;
      padding: 6px 14px;
      border-radius: 16px;
      font-size: 12px;
      cursor: pointer;
    }
    
    .hmp-edit-photo-input {
      display: none;
    }
    
    .hmp-edit-section {
      margin-bottom: 20px;
    }
    
    .hmp-edit-section-title {
      font-size: 12px;
      font-weight: 600;
      color: #d4af37;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(212, 175, 55, 0.2);
    }
    
    .hmp-edit-field {
      margin-bottom: 14px;
    }
    
    .hmp-edit-label {
      font-size: 11px;
      color: #888;
      margin-bottom: 4px;
      display: block;
    }
    
    .hmp-edit-label.required::after {
      content: ' *';
      color: #ef4444;
    }
    
    .hmp-edit-input,
    .hmp-edit-select,
    .hmp-edit-textarea {
      width: 100%;
      background: #252540;
      border: 1px solid #3a3a5a;
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 14px;
      color: #f5f5f5;
    }
    
    .hmp-edit-input:focus,
    .hmp-edit-select:focus,
    .hmp-edit-textarea:focus {
      outline: none;
      border-color: #d4af37;
    }
    
    .hmp-edit-textarea {
      min-height: 80px;
      resize: vertical;
    }
    
    .hmp-edit-select option {
      background: #1a1a2e;
      color: #f5f5f5;
    }
    
    /* 紹介者検索 */
    .hmp-referrer-container {
      position: relative;
    }
    
    .hmp-referrer-dropdown {
      background: #252540;
      border: 1px solid #3a3a5a;
      border-radius: 6px;
      margin-top: 4px;
      max-height: 150px;
      overflow-y: auto;
    }
    
    .hmp-referrer-item {
      padding: 10px 12px;
      border-bottom: 1px solid #3a3a5a;
      cursor: pointer;
    }
    
    .hmp-referrer-item:active {
      background: rgba(212, 175, 55, 0.1);
    }
    
    .hmp-referrer-name {
      font-size: 13px;
      color: #f5f5f5;
    }
    
    .hmp-referrer-company {
      font-size: 10px;
      color: #888;
    }
    
    /* チェックボックス */
    .hmp-checkbox-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    
    .hmp-checkbox-item {
      display: flex;
      align-items: center;
      gap: 4px;
      background: #252540;
      padding: 6px 10px;
      border-radius: 6px;
    }
    
    .hmp-checkbox-item input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: #d4af37;
    }
    
    .hmp-checkbox-item label {
      font-size: 12px;
      color: #f5f5f5;
    }
    
    /* 削除ボタン */
    .hmp-delete-btn {
      width: 100%;
      background: transparent;
      border: 1px solid #ef4444;
      color: #ef4444;
      padding: 12px;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      margin-top: 24px;
    }
    
    /* 重複警告 */
    .hmp-duplicate-warning {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #ef4444;
      padding: 10px;
      border-radius: 6px;
      font-size: 12px;
      margin-bottom: 14px;
    }
    
    /* ローディング */
    .hmp-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      gap: 14px;
    }
    
    .hmp-loading-spinner {
      width: 36px;
      height: 36px;
      border: 3px solid rgba(212, 175, 55, 0.2);
      border-top-color: #d4af37;
      border-radius: 50%;
      animation: hmp-spin 1s linear infinite;
    }
    
    @keyframes hmp-spin {
      to { transform: rotate(360deg); }
    }
    
    .hmp-loading-text {
      color: #d4af37;
      font-size: 13px;
    }
  `;

  // ========================================
  //  画面レンダリング：一覧
  // ========================================
  
  const renderListScreen = () => {
    const hasFilter = currentRelationshipFilter !== 'all' || currentIndustryFilter !== 'all';
    
    let cardsHtml = '';
    if (filteredRecords.length === 0) {
      cardsHtml = `
        <div class="hmp-empty">
          <div class="hmp-empty-icon">🔍</div>
          <div>該当する人脈がありません</div>
        </div>
      `;
    } else {
      cardsHtml = filteredRecords.map(record => {
        const id = Utils.getFieldValue(record, '$id');
        const name = Utils.getFieldValue(record, CONFIG.FIELDS.NAME);
        const company = Utils.getFieldValue(record, CONFIG.FIELDS.COMPANY);
        const position = Utils.getFieldValue(record, CONFIG.FIELDS.POSITION);
        const relationship = Utils.getFieldValue(record, CONFIG.FIELDS.RELATIONSHIP);
        let lastContact = Utils.getFieldValue(record, CONFIG.FIELDS.LAST_CONTACT);
        let lastContactType = Utils.getFieldValue(record, CONFIG.FIELDS.LAST_CONTACT_TYPE);
        const photo = Utils.getFieldValue(record, CONFIG.FIELDS.PHOTO);
        const color = Utils.getRelationshipColor(relationship);
        
        if (!lastContact) {
          const history = Utils.getFieldValue(record, CONFIG.FIELDS.CONTACT_HISTORY) || [];
          const valid = history.filter(r => r.value[CONFIG.FIELDS.CONTACT_DATE]?.value);
          if (valid.length > 0) {
            const sorted = valid.sort((a, b) => {
              const da = a.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '';
              const db = b.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '';
              return db.localeCompare(da);
            });
            lastContact = sorted[0].value[CONFIG.FIELDS.CONTACT_DATE]?.value;
            lastContactType = sorted[0].value[CONFIG.FIELDS.CONTACT_TYPE]?.value;
          }
        }
        
        const hasPhoto = photo && photo.length > 0;
        const fileKey = hasPhoto ? photo[0].fileKey : '';
        const cachedUrl = fileKey ? Utils._fileUrlCache[fileKey] : '';
        const photoStyle = cachedUrl ? `background-image:url('${cachedUrl}');color:transparent;` : '';
        
        const contactText = lastContact 
          ? `${lastContactType ? lastContactType + ' ' : ''}${Utils.formatDateShort(lastContact)}`
          : '接点なし';
        
        return `
          <div class="hmp-card" data-id="${id}" style="--rel-color:${color}">
            <div class="hmp-card-avatar" data-file-key="${fileKey}" style="background:${color};${photoStyle}">${Utils.getInitial(name)}</div>
            <div class="hmp-card-info">
              <div class="hmp-card-name">${Utils.escapeHtml(name)}</div>
              <div class="hmp-card-company">${Utils.escapeHtml(company)}${position ? ' / ' + Utils.escapeHtml(position) : ''}</div>
              <div class="hmp-card-meta">
                <span class="hmp-card-badge" style="background:${color}">${relationship || '未設定'}</span>
                <span class="hmp-card-contact">${contactText}</span>
              </div>
            </div>
            <div class="hmp-card-arrow">›</div>
          </div>
        `;
      }).join('');
    }
    
    container.innerHTML = `
      <style>${getStyles()}</style>
      <div id="hmp-root">
        <div class="hmp-header">
          <div class="hmp-header-title">👥 人脈管理</div>
        </div>
        
        <div class="hmp-search-area">
          <div class="hmp-search-row">
            <input type="search" class="hmp-search-input" id="hmp-search" placeholder="名前・会社名で検索..." value="${Utils.escapeHtml(currentSearch)}">
            <button class="hmp-filter-btn ${hasFilter ? 'active' : ''}" id="hmp-filter-btn">絞込</button>
          </div>
        </div>
        
        <div class="hmp-list-count">${filteredRecords.length}件</div>
        
        <div class="hmp-list-body">
          ${cardsHtml}
        </div>
        
        <div class="hmp-add-card" id="hmp-add-btn">＋ 新しい人脈を追加</div>
      </div>
    `;
    
    // イベント設定
    document.getElementById('hmp-search').addEventListener('input', (e) => {
      currentSearch = e.target.value;
      applyFilters();
      renderListScreen();
    });
    
    document.getElementById('hmp-filter-btn').addEventListener('click', () => {
      renderFilterScreen();
    });
    
    document.getElementById('hmp-add-btn').addEventListener('click', () => {
      photoFile = null;
      currentEditRecord = null;
      renderEditScreen(null);
    });
    
    container.querySelectorAll('.hmp-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const record = allRecords.find(r => Utils.getFieldValue(r, '$id') === id);
        if (record) renderDetailScreen(record);
      });
    });
    
    // 写真の遅延読み込み
    container.querySelectorAll('.hmp-card-avatar[data-file-key]').forEach(async (el) => {
      const key = el.dataset.fileKey;
      if (key && !Utils._fileUrlCache[key]) {
        const url = await Utils.getFileUrl(key);
        if (url) {
          el.style.backgroundImage = `url('${url}')`;
          el.style.color = 'transparent';
        }
      }
    });
  };

  // ========================================
  //  画面レンダリング：フィルター
  // ========================================
  
  const renderFilterScreen = () => {
    container.innerHTML = `
      <style>${getStyles()}</style>
      <div id="hmp-root">
        <div class="hmp-header">
          <div class="hmp-header-row">
            <button class="hmp-header-btn" id="hmp-back">←</button>
            <div class="hmp-header-spacer"></div>
            <div class="hmp-header-title">絞り込み</div>
            <div class="hmp-header-spacer"></div>
            <div style="width:36px"></div>
          </div>
        </div>
        
        <div class="hmp-filter-body">
          <div class="hmp-filter-section">
            <div class="hmp-filter-label">お付き合い度合い</div>
            <select class="hmp-filter-select" id="hmp-filter-relationship">
              <option value="all" ${currentRelationshipFilter === 'all' ? 'selected' : ''}>すべて</option>
              ${CONFIG.RELATIONSHIP_ORDER.map(rel => `<option value="${rel}" ${currentRelationshipFilter === rel ? 'selected' : ''}>${rel}</option>`).join('')}
            </select>
          </div>
          
          <div class="hmp-filter-section">
            <div class="hmp-filter-label">業種</div>
            <select class="hmp-filter-select" id="hmp-filter-industry">
              <option value="all" ${currentIndustryFilter === 'all' ? 'selected' : ''}>すべて</option>
              ${industryOptions.map(opt => `<option value="${opt}" ${currentIndustryFilter === opt ? 'selected' : ''}>${opt}</option>`).join('')}
            </select>
          </div>
          
          <div class="hmp-filter-actions">
            <button class="hmp-btn hmp-btn-secondary" id="hmp-filter-clear">クリア</button>
            <button class="hmp-btn hmp-btn-primary" id="hmp-filter-apply">適用</button>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('hmp-back').addEventListener('click', () => {
      renderListScreen();
    });
    
    document.getElementById('hmp-filter-clear').addEventListener('click', () => {
      document.getElementById('hmp-filter-relationship').value = 'all';
      document.getElementById('hmp-filter-industry').value = 'all';
    });
    
    document.getElementById('hmp-filter-apply').addEventListener('click', () => {
      currentRelationshipFilter = document.getElementById('hmp-filter-relationship').value;
      currentIndustryFilter = document.getElementById('hmp-filter-industry').value;
      applyFilters();
      renderListScreen();
    });
  };

  // ========================================
  //  画面レンダリング：詳細
  // ========================================
  
  const renderDetailScreen = async (record, showContactForm = false) => {
    currentDetailRecord = record;
    
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
    
    let photoUrl = '';
    if (photo && photo.length > 0) {
      photoUrl = await Utils.getFileUrl(photo[0].fileKey);
    }
    const photoStyle = photoUrl ? `background-image:url('${photoUrl}');color:transparent;` : '';
    
    const validHistory = contactHistory
      .filter(r => r.value[CONFIG.FIELDS.CONTACT_DATE]?.value)
      .sort((a, b) => {
        const da = a.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '';
        const db = b.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '';
        return db.localeCompare(da);
      });
    
    const historyHtml = validHistory.length > 0
      ? validHistory.map(r => {
          const date = r.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '';
          const type = r.value[CONFIG.FIELDS.CONTACT_TYPE]?.value || '';
          const memo = r.value[CONFIG.FIELDS.CONTACT_MEMO]?.value || '';
          return `
            <div class="hmp-history-item">
              <div class="hmp-history-top">
                <div class="hmp-history-date">${Utils.formatDate(date)}</div>
                ${type ? `<div class="hmp-history-type">${Utils.escapeHtml(type)}</div>` : ''}
              </div>
              ${memo ? `<div class="hmp-history-memo">${Utils.escapeHtml(memo)}</div>` : ''}
            </div>
          `;
        }).join('')
      : '<div class="hmp-history-empty">接点履歴がありません</div>';
    
    const contactFormHtml = showContactForm ? `
      <div class="hmp-contact-form" id="hmp-contact-form">
        <div class="hmp-form-row">
          <div class="hmp-form-group">
            <label class="hmp-form-label">接点日</label>
            <input type="date" class="hmp-form-input" id="hmp-contact-date" value="${Utils.getTodayString()}">
          </div>
          <div class="hmp-form-group">
            <label class="hmp-form-label">種別</label>
            <select class="hmp-form-select" id="hmp-contact-type">
              ${contactTypeOptions.map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="hmp-form-group">
          <label class="hmp-form-label">メモ</label>
          <textarea class="hmp-form-textarea" id="hmp-contact-memo" placeholder="接点の内容..."></textarea>
        </div>
        <div class="hmp-form-actions">
          <button class="hmp-btn hmp-btn-secondary" id="hmp-contact-cancel">キャンセル</button>
          <button class="hmp-btn hmp-btn-primary" id="hmp-contact-save">追加</button>
        </div>
      </div>
    ` : `<button class="hmp-add-contact-btn" id="hmp-add-contact-btn">+ 接点を追加</button>`;
    
    container.innerHTML = `
      <style>${getStyles()}</style>
      <div id="hmp-root">
        <div class="hmp-header">
          <div class="hmp-header-row">
            <button class="hmp-header-btn" id="hmp-back">←</button>
            <div class="hmp-header-spacer"></div>
            <div class="hmp-header-title">詳細</div>
            <div class="hmp-header-spacer"></div>
            <button class="hmp-header-btn-text" id="hmp-edit">編集</button>
          </div>
        </div>
        
        <div class="hmp-detail-body">
          <div class="hmp-detail-profile">
            <div class="hmp-detail-avatar" style="background:${color};${photoStyle}">${Utils.getInitial(name)}</div>
            <div class="hmp-detail-info">
              <div class="hmp-detail-name">${Utils.escapeHtml(name)}</div>
              <div class="hmp-detail-company">${Utils.escapeHtml(company)}${position ? ' / ' + Utils.escapeHtml(position) : ''}</div>
              <div class="hmp-detail-badge" style="background:${color}">${relationship || '未設定'}</div>
            </div>
          </div>
          
          <div class="hmp-detail-actions">
            <a href="${phone ? 'tel:' + phone : '#'}" class="hmp-action-btn ${phone ? 'hmp-action-btn-phone' : 'hmp-action-btn-disabled'}">
              <span class="hmp-action-icon">📞</span>
              <span>電話</span>
            </a>
            <a href="${email ? 'mailto:' + email : '#'}" class="hmp-action-btn ${email ? 'hmp-action-btn-email' : 'hmp-action-btn-disabled'}">
              <span class="hmp-action-icon">✉️</span>
              <span>メール</span>
            </a>
          </div>
          
          <div class="hmp-section">
            <div class="hmp-section-title">📋 基本情報</div>
            ${phone ? `<div class="hmp-info-row"><div class="hmp-info-label">電話</div><div class="hmp-info-value">${Utils.escapeHtml(phone)}</div></div>` : ''}
            ${email ? `<div class="hmp-info-row"><div class="hmp-info-label">メール</div><div class="hmp-info-value">${Utils.escapeHtml(email)}</div></div>` : ''}
            ${birthday ? `<div class="hmp-info-row"><div class="hmp-info-label">誕生日</div><div class="hmp-info-value">${Utils.formatDate(birthday)}</div></div>` : ''}
            ${industry ? `<div class="hmp-info-row"><div class="hmp-info-label">業種</div><div class="hmp-info-value">${Utils.escapeHtml(industry)}</div></div>` : ''}
            ${referrer ? `<div class="hmp-info-row"><div class="hmp-info-label">紹介者</div><div class="hmp-info-value">${Utils.escapeHtml(referrer)}</div></div>` : ''}
          </div>
          
          ${personality.length > 0 ? `
            <div class="hmp-section">
              <div class="hmp-section-title">✨ 個人特性</div>
              <div class="hmp-tags">${personality.map(p => `<span class="hmp-tag">${Utils.escapeHtml(p)}</span>`).join('')}</div>
            </div>
          ` : ''}
          
          ${notes ? `
            <div class="hmp-section">
              <div class="hmp-section-title">📝 メモ</div>
              <div class="hmp-memo-text">${Utils.escapeHtml(notes)}</div>
            </div>
          ` : ''}
          
          <div class="hmp-section">
            <div class="hmp-section-title">📅 接点履歴</div>
            <div id="hmp-history-list">${historyHtml}</div>
            ${contactFormHtml}
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('hmp-back').addEventListener('click', () => {
      renderListScreen();
    });
    
    document.getElementById('hmp-edit').addEventListener('click', () => {
      photoFile = null;
      renderEditScreen(record);
    });
    
    const addContactBtn = document.getElementById('hmp-add-contact-btn');
    if (addContactBtn) {
      addContactBtn.addEventListener('click', () => {
        renderDetailScreen(record, true);
      });
    }
    
    const contactCancel = document.getElementById('hmp-contact-cancel');
    if (contactCancel) {
      contactCancel.addEventListener('click', () => {
        renderDetailScreen(record, false);
      });
    }
    
    const contactSave = document.getElementById('hmp-contact-save');
    if (contactSave) {
      contactSave.addEventListener('click', async () => {
        await saveContact();
      });
    }
  };
  
  const saveContact = async () => {
    const id = Utils.getFieldValue(currentDetailRecord, '$id');
    const date = document.getElementById('hmp-contact-date').value;
    const type = document.getElementById('hmp-contact-type').value;
    const memo = document.getElementById('hmp-contact-memo').value;
    
    if (!date) {
      alert('接点日を入力してください');
      return;
    }
    
    try {
      const resp = await kintone.api('/k/v1/record', 'GET', { app: CONFIG.APP_ID, id });
      const history = resp.record[CONFIG.FIELDS.CONTACT_HISTORY]?.value || [];
      
      history.push({
        value: {
          [CONFIG.FIELDS.CONTACT_DATE]: { value: date },
          [CONFIG.FIELDS.CONTACT_TYPE]: { value: type },
          [CONFIG.FIELDS.CONTACT_MEMO]: { value: memo },
        }
      });
      
      const valid = history.filter(r => r.value[CONFIG.FIELDS.CONTACT_DATE]?.value);
      const sorted = valid.sort((a, b) => {
        const da = a.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '';
        const db = b.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '';
        return db.localeCompare(da);
      });
      
      const latestDate = sorted[0]?.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '';
      const latestType = sorted[0]?.value[CONFIG.FIELDS.CONTACT_TYPE]?.value || '';
      
      await kintone.api('/k/v1/record', 'PUT', {
        app: CONFIG.APP_ID,
        id,
        record: {
          [CONFIG.FIELDS.CONTACT_HISTORY]: { value: valid },
          [CONFIG.FIELDS.LAST_CONTACT]: { value: latestDate },
          [CONFIG.FIELDS.LAST_CONTACT_TYPE]: { value: latestType },
          [CONFIG.FIELDS.CONTACT_COUNT]: { value: String(valid.length) },
        }
      });
      
      allRecords = await fetchAllRecords();
      loadReferrerOptions();
      applyFilters();
      
      const updated = allRecords.find(r => Utils.getFieldValue(r, '$id') === id);
      if (updated) renderDetailScreen(updated, false);
      
    } catch (e) {
      console.error('接点追加エラー:', e);
      alert('接点の追加に失敗しました');
    }
  };

  // ========================================
  //  画面レンダリング：編集
  // ========================================
  
  const renderEditScreen = async (record) => {
    currentEditRecord = record;
    const isNew = !record;
    
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
    
    let photoUrl = '';
    if (photo && photo.length > 0) {
      photoUrl = await Utils.getFileUrl(photo[0].fileKey);
    }
    
    container.innerHTML = `
      <style>${getStyles()}</style>
      <div id="hmp-root">
        <div class="hmp-header">
          <div class="hmp-header-row">
            <button class="hmp-header-btn-text" id="hmp-cancel">キャンセル</button>
            <div class="hmp-header-spacer"></div>
            <div class="hmp-header-title">${isNew ? '新規追加' : '編集'}</div>
            <div class="hmp-header-spacer"></div>
            <button class="hmp-header-btn-text" id="hmp-save">保存</button>
          </div>
        </div>
        
        <div class="hmp-edit-body">
          <div class="hmp-edit-photo">
            <div class="hmp-edit-photo-preview" id="hmp-photo-preview" style="background:${color};${photoUrl ? `background-image:url('${photoUrl}');color:transparent;` : ''}">${photoUrl ? '' : '📷'}</div>
            <button class="hmp-edit-photo-btn" id="hmp-photo-btn">写真を変更</button>
            <input type="file" class="hmp-edit-photo-input" id="hmp-photo-input" accept="image/*">
          </div>
          
          <div id="hmp-duplicate-warning" class="hmp-duplicate-warning" style="display:none;">⚠️ 同姓同名の人脈が既に登録されています</div>
          
          <div class="hmp-edit-section">
            <div class="hmp-edit-section-title">基本情報</div>
            <div class="hmp-edit-field">
              <label class="hmp-edit-label required">名前</label>
              <input type="text" class="hmp-edit-input" id="hmp-edit-name" value="${Utils.escapeHtml(name)}">
            </div>
            <div class="hmp-edit-field">
              <label class="hmp-edit-label">ふりがな</label>
              <input type="text" class="hmp-edit-input" id="hmp-edit-kana" value="${Utils.escapeHtml(kanaName)}">
            </div>
            <div class="hmp-edit-field">
              <label class="hmp-edit-label">会社名</label>
              <input type="text" class="hmp-edit-input" id="hmp-edit-company" value="${Utils.escapeHtml(company)}">
            </div>
            <div class="hmp-edit-field">
              <label class="hmp-edit-label">役職</label>
              <input type="text" class="hmp-edit-input" id="hmp-edit-position" value="${Utils.escapeHtml(position)}">
            </div>
          </div>
          
          <div class="hmp-edit-section">
            <div class="hmp-edit-section-title">連絡先</div>
            <div class="hmp-edit-field">
              <label class="hmp-edit-label">電話番号</label>
              <input type="tel" class="hmp-edit-input" id="hmp-edit-phone" value="${Utils.escapeHtml(phone)}">
            </div>
            <div class="hmp-edit-field">
              <label class="hmp-edit-label">メールアドレス</label>
              <input type="email" class="hmp-edit-input" id="hmp-edit-email" value="${Utils.escapeHtml(email)}">
            </div>
            <div class="hmp-edit-field">
              <label class="hmp-edit-label">誕生日</label>
              <input type="date" class="hmp-edit-input" id="hmp-edit-birthday" value="${birthday}">
            </div>
          </div>
          
          <div class="hmp-edit-section">
            <div class="hmp-edit-section-title">分類</div>
            <div class="hmp-edit-field">
              <label class="hmp-edit-label">お付き合い度合い</label>
              <select class="hmp-edit-select" id="hmp-edit-relationship">
                <option value="">選択してください</option>
                ${CONFIG.RELATIONSHIP_ORDER.map(rel => `<option value="${rel}" ${relationship === rel ? 'selected' : ''}>${rel}</option>`).join('')}
              </select>
            </div>
            <div class="hmp-edit-field">
              <label class="hmp-edit-label">業種</label>
              <select class="hmp-edit-select" id="hmp-edit-industry">
                <option value="">選択してください</option>
                ${industryOptions.map(opt => `<option value="${opt}" ${industry === opt ? 'selected' : ''}>${opt}</option>`).join('')}
              </select>
            </div>
            <div class="hmp-edit-field">
              <label class="hmp-edit-label">紹介者</label>
              <div class="hmp-referrer-container">
                <input type="text" class="hmp-edit-input" id="hmp-edit-referrer" placeholder="紹介者名を入力..." value="${Utils.escapeHtml(referrer)}">
                <input type="hidden" id="hmp-edit-referrer-id" value="${referrerId}">
                <div class="hmp-referrer-dropdown" id="hmp-referrer-dropdown" style="display:none;"></div>
              </div>
            </div>
          </div>
          
          <div class="hmp-edit-section">
            <div class="hmp-edit-section-title">個人特性</div>
            <div class="hmp-checkbox-grid">
              ${personalityOptions.map(opt => `
                <div class="hmp-checkbox-item">
                  <input type="checkbox" name="hmp-personality" value="${opt}" id="hmp-p-${opt.replace(/\s/g, '_')}" ${personality.includes(opt) ? 'checked' : ''}>
                  <label for="hmp-p-${opt.replace(/\s/g, '_')}">${opt}</label>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="hmp-edit-section">
            <div class="hmp-edit-section-title">メモ</div>
            <textarea class="hmp-edit-textarea" id="hmp-edit-notes" placeholder="メモを入力...">${Utils.escapeHtml(notes)}</textarea>
          </div>
          
          ${!isNew ? '<button class="hmp-delete-btn" id="hmp-delete-btn">このデータを削除</button>' : ''}
        </div>
      </div>
    `;
    
    setupEditEvents(isNew);
  };
  
  const setupEditEvents = (isNew) => {
    document.getElementById('hmp-cancel').addEventListener('click', () => {
      photoFile = null;
      if (currentEditRecord) {
        renderDetailScreen(currentEditRecord);
      } else {
        renderListScreen();
      }
    });
    
    document.getElementById('hmp-save').addEventListener('click', saveRecord);
    
    document.getElementById('hmp-photo-btn').addEventListener('click', () => {
      document.getElementById('hmp-photo-input').click();
    });
    
    document.getElementById('hmp-photo-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        photoFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const preview = document.getElementById('hmp-photo-preview');
          preview.style.backgroundImage = `url('${ev.target.result}')`;
          preview.style.backgroundSize = 'cover';
          preview.style.backgroundPosition = 'center';
          preview.textContent = '';
        };
        reader.readAsDataURL(file);
      }
    });
    
    if (isNew) {
      let timeout = null;
      document.getElementById('hmp-edit-name').addEventListener('input', (e) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          const name = e.target.value.trim();
          const warning = document.getElementById('hmp-duplicate-warning');
          if (name.length >= 2) {
            const dup = allRecords.some(r => Utils.getFieldValue(r, CONFIG.FIELDS.NAME) === name);
            warning.style.display = dup ? 'block' : 'none';
          } else {
            warning.style.display = 'none';
          }
        }, 500);
      });
    }
    
    const refInput = document.getElementById('hmp-edit-referrer');
    const refDropdown = document.getElementById('hmp-referrer-dropdown');
    let refTimeout = null;
    
    refInput.addEventListener('input', (e) => {
      if (refTimeout) clearTimeout(refTimeout);
      refTimeout = setTimeout(() => {
        const query = e.target.value.trim().toLowerCase();
        if (query.length >= 2) {
          const matches = referrerOptions.filter(r => 
            r.name.toLowerCase().includes(query) || (r.company && r.company.toLowerCase().includes(query))
          ).slice(0, 8);
          
          if (matches.length > 0) {
            refDropdown.innerHTML = matches.map(r => `
              <div class="hmp-referrer-item" data-id="${r.id}" data-name="${Utils.escapeHtml(r.name)}">
                <div class="hmp-referrer-name">${Utils.escapeHtml(r.name)}</div>
                <div class="hmp-referrer-company">${Utils.escapeHtml(r.company || '')}</div>
              </div>
            `).join('');
            refDropdown.style.display = 'block';
            
            refDropdown.querySelectorAll('.hmp-referrer-item').forEach(item => {
              item.addEventListener('click', () => {
                refInput.value = item.dataset.name;
                document.getElementById('hmp-edit-referrer-id').value = item.dataset.id;
                refDropdown.style.display = 'none';
              });
            });
          } else {
            refDropdown.style.display = 'none';
          }
        } else {
          refDropdown.style.display = 'none';
        }
      }, 300);
    });
    
    refInput.addEventListener('blur', () => {
      setTimeout(() => refDropdown.style.display = 'none', 200);
    });
    
    const deleteBtn = document.getElementById('hmp-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', deleteRecord);
    }
  };
  
  const saveRecord = async () => {
    const isNew = !currentEditRecord;
    const name = document.getElementById('hmp-edit-name').value.trim();
    
    if (!name) {
      alert('名前を入力してください');
      return;
    }
    
    try {
      const data = {
        [CONFIG.FIELDS.NAME]: { value: name },
        [CONFIG.FIELDS.KANA_NAME]: { value: document.getElementById('hmp-edit-kana').value },
        [CONFIG.FIELDS.COMPANY]: { value: document.getElementById('hmp-edit-company').value },
        [CONFIG.FIELDS.POSITION]: { value: document.getElementById('hmp-edit-position').value },
        [CONFIG.FIELDS.PHONE]: { value: document.getElementById('hmp-edit-phone').value },
        [CONFIG.FIELDS.EMAIL]: { value: document.getElementById('hmp-edit-email').value },
        [CONFIG.FIELDS.BIRTHDAY]: { value: document.getElementById('hmp-edit-birthday').value },
        [CONFIG.FIELDS.RELATIONSHIP]: { value: document.getElementById('hmp-edit-relationship').value },
        [CONFIG.FIELDS.INDUSTRY]: { value: document.getElementById('hmp-edit-industry').value },
        [CONFIG.FIELDS.REFERRER]: { value: document.getElementById('hmp-edit-referrer').value },
        [CONFIG.FIELDS.REFERRER_ID]: { value: document.getElementById('hmp-edit-referrer-id').value },
        [CONFIG.FIELDS.NOTES]: { value: document.getElementById('hmp-edit-notes').value },
      };
      
      const refId = document.getElementById('hmp-edit-referrer-id').value;
      if (refId) {
        data[CONFIG.FIELDS.REFERRER_LINK] = { value: location.origin + '/k/' + CONFIG.APP_ID + '/show#record=' + refId };
      } else {
        data[CONFIG.FIELDS.REFERRER_LINK] = { value: '' };
      }
      
      const personalityChecks = document.querySelectorAll('input[name="hmp-personality"]:checked');
      data[CONFIG.FIELDS.PERSONALITY] = { value: Array.from(personalityChecks).map(cb => cb.value) };
      
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
        await kintone.api('/k/v1/record', 'POST', { app: CONFIG.APP_ID, record: data });
      } else {
        const id = Utils.getFieldValue(currentEditRecord, '$id');
        await kintone.api('/k/v1/record', 'PUT', { app: CONFIG.APP_ID, id, record: data });
      }
      
      photoFile = null;
      allRecords = await fetchAllRecords();
      loadReferrerOptions();
      applyFilters();
      
      renderListScreen();
      
    } catch (e) {
      console.error('保存エラー:', e);
      alert('保存に失敗しました: ' + (e.message || e));
    }
  };
  
  const deleteRecord = async () => {
    if (!confirm('本当にこのデータを削除しますか？')) return;
    
    try {
      const id = Utils.getFieldValue(currentEditRecord, '$id');
      await kintone.api('/k/v1/records', 'DELETE', { app: CONFIG.APP_ID, ids: [id] });
      
      allRecords = await fetchAllRecords();
      loadReferrerOptions();
      applyFilters();
      
      renderListScreen();
      
    } catch (e) {
      console.error('削除エラー:', e);
      alert('削除に失敗しました');
    }
  };

  // ========================================
  //  初期化
  // ========================================
  
  const init = async (el) => {
    console.log('🌟 HIKARI Mobile People v3 initializing...');
    container = el;
    
    container.innerHTML = `
      <style>${getStyles()}</style>
      <div id="hmp-root">
        <div class="hmp-loading">
          <div class="hmp-loading-spinner"></div>
          <div class="hmp-loading-text">データを読み込み中...</div>
        </div>
      </div>
    `;
    
    try {
      await loadFormOptions();
      allRecords = await fetchAllRecords();
      loadReferrerOptions();
      filteredRecords = [...allRecords];
      
      console.log(`✅ ${allRecords.length}件のデータを取得`);
      
      renderListScreen();
      
      console.log('✅ HIKARI Mobile People v3 initialized');
      
    } catch (error) {
      console.error('❌ 初期化エラー:', error);
      container.innerHTML = `
        <style>${getStyles()}</style>
        <div id="hmp-root">
          <div class="hmp-loading">
            <div style="font-size:40px;margin-bottom:14px;">⚠️</div>
            <div class="hmp-loading-text">データの取得に失敗しました</div>
          </div>
        </div>
      `;
    }
  };

  // ========================================
  //  イベント登録
  // ========================================
  
  kintone.events.on('mobile.app.record.index.show', (event) => {
    const el = kintone.mobile.app.getHeaderSpaceElement();
    if (!el) return event;
    
    // kintone標準UIを非表示
    const parent = el.parentElement;
    if (parent) {
      Array.from(parent.children).forEach(child => {
        if (child !== el) {
          child.style.display = 'none';
        }
      });
    }
    
    init(el);
    
    return event;
  });

})();
