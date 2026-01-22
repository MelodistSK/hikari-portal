/**
 * HIKARI Mobile People App v5
 * kintone CSS競合対策版
 */

(function() {
  'use strict';

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
      return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
    },
    
    formatDateShort: (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return (d.getMonth() + 1) + '/' + d.getDate();
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
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },
    
    _fileUrlCache: {},
    getFileUrl: async (fileKey) => {
      if (!fileKey) return null;
      if (Utils._fileUrlCache[fileKey]) return Utils._fileUrlCache[fileKey];
      
      try {
        const url = '/k/v1/file.json?fileKey=' + fileKey;
        const blob = await fetch(url, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        }).then(function(r) { return r.blob(); });
        const objectUrl = URL.createObjectURL(blob);
        Utils._fileUrlCache[fileKey] = objectUrl;
        return objectUrl;
      } catch (e) {
        return null;
      }
    },
  };

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

  // kintone標準UI非表示
  const hideKintoneUI = () => {
    const style = document.createElement('style');
    style.id = 'hmp-hide-kintone';
    style.textContent = `
      .gaia-mobile-v2-viewpanel-viewlist,
      .gaia-mobile-v2-app-index-toolbar,
      .gaia-mobile-v2-recordlist,
      .gaia-mobile-v2-viewpanel-recordlist,
      .ocean-mobile-ui-app-index-toolbar,
      .ocean-ui-mobile-appindex-toolbar,
      .gaia-mobile-v2-viewpanel,
      .gaia-argoui-app-index-toolbar,
      .gaia-argoui-app-toolbar,
      [class*="recordlist"],
      [class*="app-index-pager"],
      [class*="app-index-toolbar"] {
        display: none !important;
      }
    `;
    if (!document.getElementById('hmp-hide-kintone')) {
      document.head.appendChild(style);
    }
  };

  const fetchAllRecords = async () => {
    const records = [];
    let offset = 0;
    const limit = 500;
    
    while (true) {
      const resp = await kintone.api('/k/v1/records', 'GET', {
        app: CONFIG.APP_ID,
        query: 'order by ' + CONFIG.FIELDS.KANA_NAME + ' asc limit ' + limit + ' offset ' + offset,
      });
      records.push.apply(records, resp.records);
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
          .filter(function(entry) { return entry[0] !== ''; })
          .sort(function(a, b) { return parseInt(a[1].index) - parseInt(b[1].index); })
          .map(function(entry) { return entry[0]; });
      }
      
      const personalityField = formFields.properties[CONFIG.FIELDS.PERSONALITY];
      if (personalityField && personalityField.options) {
        personalityOptions = Object.entries(personalityField.options)
          .filter(function(entry) { return entry[0] !== ''; })
          .sort(function(a, b) { return parseInt(a[1].index) - parseInt(b[1].index); })
          .map(function(entry) { return entry[0]; });
      }
      
      const subtableField = formFields.properties[CONFIG.FIELDS.CONTACT_HISTORY];
      if (subtableField && subtableField.fields) {
        const contactTypeField = subtableField.fields[CONFIG.FIELDS.CONTACT_TYPE];
        if (contactTypeField && contactTypeField.options) {
          contactTypeOptions = Object.entries(contactTypeField.options)
            .filter(function(entry) { return entry[0] !== ''; })
            .sort(function(a, b) { return parseInt(a[1].index) - parseInt(b[1].index); })
            .map(function(entry) { return entry[0]; });
        }
      }
      
    } catch (error) {
      console.error('フォーム設定の取得に失敗:', error);
    }
  };
  
  const loadReferrerOptions = () => {
    referrerOptions = allRecords.map(function(record) {
      return {
        id: Utils.getFieldValue(record, '$id'),
        name: Utils.getFieldValue(record, CONFIG.FIELDS.NAME),
        company: Utils.getFieldValue(record, CONFIG.FIELDS.COMPANY),
      };
    }).filter(function(r) { return r.name; });
    referrerOptions.sort(function(a, b) { return a.name.localeCompare(b.name, 'ja'); });
  };

  const applyFilters = () => {
    filteredRecords = allRecords.filter(function(record) {
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
        
        if (name.indexOf(search) === -1 && kana.indexOf(search) === -1 && company.indexOf(search) === -1 && notes.indexOf(search) === -1) {
          return false;
        }
      }
      
      return true;
    });
  };

  // CSS - すべてに !important を付けて競合を防ぐ
  const getStyles = () => {
    return '\
    #hmp-root, #hmp-root * {\
      box-sizing: border-box !important;\
      margin: 0 !important;\
      padding: 0 !important;\
      -webkit-tap-highlight-color: transparent !important;\
      font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif !important;\
    }\
    \
    #hmp-root {\
      background: #1a1a2e !important;\
      color: #f5f5f5 !important;\
      font-size: 14px !important;\
      line-height: 1.5 !important;\
      min-height: 100vh !important;\
      width: 100% !important;\
      padding-bottom: 20px !important;\
    }\
    \
    .hmp-header {\
      background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%) !important;\
      padding: 12px !important;\
      width: 100% !important;\
      display: block !important;\
    }\
    \
    .hmp-header-title {\
      color: #1a1a1a !important;\
      font-size: 16px !important;\
      font-weight: 700 !important;\
      text-align: center !important;\
      display: block !important;\
    }\
    \
    .hmp-header-row {\
      display: flex !important;\
      align-items: center !important;\
      gap: 8px !important;\
      width: 100% !important;\
    }\
    \
    .hmp-header-btn {\
      background: rgba(0,0,0,0.15) !important;\
      border: none !important;\
      color: #1a1a1a !important;\
      width: 32px !important;\
      height: 32px !important;\
      min-width: 32px !important;\
      max-width: 32px !important;\
      border-radius: 50% !important;\
      font-size: 14px !important;\
      display: flex !important;\
      align-items: center !important;\
      justify-content: center !important;\
      cursor: pointer !important;\
      flex-shrink: 0 !important;\
    }\
    \
    .hmp-header-btn-text {\
      background: rgba(0,0,0,0.15) !important;\
      border: none !important;\
      color: #1a1a1a !important;\
      padding: 6px 12px !important;\
      border-radius: 16px !important;\
      font-size: 12px !important;\
      font-weight: 600 !important;\
      cursor: pointer !important;\
      white-space: nowrap !important;\
      flex-shrink: 0 !important;\
    }\
    \
    .hmp-header-spacer {\
      flex: 1 1 auto !important;\
      min-width: 0 !important;\
    }\
    \
    .hmp-search-area {\
      padding: 10px 12px !important;\
      background: #1a1a2e !important;\
      width: 100% !important;\
      display: block !important;\
    }\
    \
    .hmp-search-row {\
      display: flex !important;\
      gap: 8px !important;\
      width: 100% !important;\
      align-items: center !important;\
    }\
    \
    .hmp-search-input {\
      flex: 1 1 auto !important;\
      min-width: 0 !important;\
      width: auto !important;\
      background: #2a2a4a !important;\
      border: 1px solid #3a3a5a !important;\
      border-radius: 6px !important;\
      padding: 8px 10px !important;\
      font-size: 14px !important;\
      color: #f5f5f5 !important;\
      outline: none !important;\
    }\
    \
    .hmp-search-input::placeholder {\
      color: #888 !important;\
    }\
    \
    .hmp-filter-btn {\
      background: #2a2a4a !important;\
      border: 1px solid #3a3a5a !important;\
      color: #d4af37 !important;\
      padding: 8px 12px !important;\
      border-radius: 6px !important;\
      font-size: 12px !important;\
      font-weight: 600 !important;\
      white-space: nowrap !important;\
      cursor: pointer !important;\
      flex-shrink: 0 !important;\
    }\
    \
    .hmp-filter-btn.active {\
      background: #d4af37 !important;\
      color: #1a1a1a !important;\
      border-color: #d4af37 !important;\
    }\
    \
    .hmp-list-count {\
      padding: 6px 12px !important;\
      font-size: 11px !important;\
      color: #888 !important;\
      display: block !important;\
    }\
    \
    .hmp-list-body {\
      padding: 0 10px !important;\
      display: block !important;\
    }\
    \
    .hmp-card {\
      background: #252540 !important;\
      border-radius: 8px !important;\
      padding: 10px !important;\
      margin-bottom: 6px !important;\
      display: flex !important;\
      align-items: center !important;\
      gap: 10px !important;\
      border-left: 3px solid var(--rel-color, #6b7280) !important;\
      cursor: pointer !important;\
      width: 100% !important;\
    }\
    \
    .hmp-card:active {\
      opacity: 0.8 !important;\
    }\
    \
    .hmp-card-avatar {\
      width: 40px !important;\
      height: 40px !important;\
      min-width: 40px !important;\
      max-width: 40px !important;\
      border-radius: 50% !important;\
      display: flex !important;\
      align-items: center !important;\
      justify-content: center !important;\
      font-size: 14px !important;\
      font-weight: 700 !important;\
      color: #fff !important;\
      background-size: cover !important;\
      background-position: center !important;\
      flex-shrink: 0 !important;\
    }\
    \
    .hmp-card-info {\
      flex: 1 1 auto !important;\
      min-width: 0 !important;\
      overflow: hidden !important;\
    }\
    \
    .hmp-card-name {\
      font-size: 13px !important;\
      font-weight: 600 !important;\
      color: #f5f5f5 !important;\
      white-space: nowrap !important;\
      overflow: hidden !important;\
      text-overflow: ellipsis !important;\
      display: block !important;\
    }\
    \
    .hmp-card-company {\
      font-size: 10px !important;\
      color: #999 !important;\
      white-space: nowrap !important;\
      overflow: hidden !important;\
      text-overflow: ellipsis !important;\
      margin-top: 1px !important;\
      display: block !important;\
    }\
    \
    .hmp-card-meta {\
      display: flex !important;\
      align-items: center !important;\
      gap: 4px !important;\
      margin-top: 3px !important;\
      flex-wrap: wrap !important;\
    }\
    \
    .hmp-card-badge {\
      font-size: 9px !important;\
      padding: 1px 5px !important;\
      border-radius: 6px !important;\
      font-weight: 600 !important;\
      color: #1a1a1a !important;\
      display: inline-block !important;\
    }\
    \
    .hmp-card-contact {\
      font-size: 9px !important;\
      color: #888 !important;\
    }\
    \
    .hmp-card-arrow {\
      color: #666 !important;\
      font-size: 14px !important;\
      min-width: 14px !important;\
      flex-shrink: 0 !important;\
    }\
    \
    .hmp-empty {\
      text-align: center !important;\
      padding: 30px 16px !important;\
      color: #888 !important;\
    }\
    \
    .hmp-empty-icon {\
      font-size: 32px !important;\
      margin-bottom: 10px !important;\
      display: block !important;\
    }\
    \
    .hmp-add-card {\
      background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%) !important;\
      border-radius: 8px !important;\
      padding: 14px !important;\
      margin: 12px 10px !important;\
      text-align: center !important;\
      color: #1a1a1a !important;\
      font-size: 14px !important;\
      font-weight: 600 !important;\
      cursor: pointer !important;\
      display: block !important;\
    }\
    \
    .hmp-filter-body {\
      padding: 16px 12px !important;\
      display: block !important;\
    }\
    \
    .hmp-filter-section {\
      margin-bottom: 16px !important;\
      display: block !important;\
    }\
    \
    .hmp-filter-label {\
      font-size: 12px !important;\
      color: #d4af37 !important;\
      margin-bottom: 6px !important;\
      font-weight: 600 !important;\
      display: block !important;\
    }\
    \
    .hmp-filter-select {\
      width: 100% !important;\
      background: #252540 !important;\
      border: 1px solid #3a3a5a !important;\
      border-radius: 6px !important;\
      padding: 10px 12px !important;\
      font-size: 14px !important;\
      color: #f5f5f5 !important;\
      display: block !important;\
    }\
    \
    .hmp-filter-select option {\
      background: #1a1a2e !important;\
      color: #f5f5f5 !important;\
    }\
    \
    .hmp-filter-actions {\
      display: flex !important;\
      gap: 10px !important;\
      margin-top: 24px !important;\
    }\
    \
    .hmp-btn {\
      flex: 1 1 0 !important;\
      padding: 12px !important;\
      border-radius: 6px !important;\
      font-size: 14px !important;\
      font-weight: 600 !important;\
      text-align: center !important;\
      cursor: pointer !important;\
      border: none !important;\
      display: block !important;\
    }\
    \
    .hmp-btn-secondary {\
      background: #252540 !important;\
      border: 1px solid #3a3a5a !important;\
      color: #f5f5f5 !important;\
    }\
    \
    .hmp-btn-primary {\
      background: linear-gradient(135deg, #d4af37, #b8941f) !important;\
      color: #1a1a1a !important;\
    }\
    \
    .hmp-detail-body {\
      padding: 12px !important;\
      display: block !important;\
    }\
    \
    .hmp-detail-profile {\
      display: flex !important;\
      align-items: center !important;\
      gap: 12px !important;\
      margin-bottom: 16px !important;\
      width: 100% !important;\
    }\
    \
    .hmp-detail-avatar {\
      width: 56px !important;\
      height: 56px !important;\
      min-width: 56px !important;\
      max-width: 56px !important;\
      border-radius: 50% !important;\
      display: flex !important;\
      align-items: center !important;\
      justify-content: center !important;\
      font-size: 20px !important;\
      font-weight: 700 !important;\
      color: #fff !important;\
      background-size: cover !important;\
      background-position: center !important;\
      flex-shrink: 0 !important;\
    }\
    \
    .hmp-detail-info {\
      flex: 1 1 auto !important;\
      min-width: 0 !important;\
      overflow: hidden !important;\
    }\
    \
    .hmp-detail-name {\
      font-size: 16px !important;\
      font-weight: 700 !important;\
      color: #f5f5f5 !important;\
      display: block !important;\
    }\
    \
    .hmp-detail-company {\
      font-size: 11px !important;\
      color: #999 !important;\
      margin-top: 2px !important;\
      display: block !important;\
    }\
    \
    .hmp-detail-badge {\
      display: inline-block !important;\
      font-size: 10px !important;\
      padding: 2px 8px !important;\
      border-radius: 8px !important;\
      font-weight: 600 !important;\
      color: #1a1a1a !important;\
      margin-top: 4px !important;\
    }\
    \
    .hmp-detail-actions {\
      display: flex !important;\
      gap: 8px !important;\
      margin-bottom: 16px !important;\
      width: 100% !important;\
    }\
    \
    .hmp-action-btn {\
      flex: 1 1 0 !important;\
      display: flex !important;\
      align-items: center !important;\
      justify-content: center !important;\
      gap: 6px !important;\
      padding: 10px 8px !important;\
      border-radius: 8px !important;\
      text-decoration: none !important;\
      font-size: 12px !important;\
      font-weight: 600 !important;\
    }\
    \
    .hmp-action-btn-phone {\
      background: #22c55e !important;\
      color: #fff !important;\
    }\
    \
    .hmp-action-btn-email {\
      background: #3b82f6 !important;\
      color: #fff !important;\
    }\
    \
    .hmp-action-btn-disabled {\
      background: #3a3a5a !important;\
      color: #666 !important;\
      pointer-events: none !important;\
    }\
    \
    .hmp-action-icon {\
      font-size: 16px !important;\
    }\
    \
    .hmp-section {\
      margin-bottom: 16px !important;\
      display: block !important;\
    }\
    \
    .hmp-section-title {\
      font-size: 12px !important;\
      font-weight: 600 !important;\
      color: #d4af37 !important;\
      margin-bottom: 8px !important;\
      display: block !important;\
    }\
    \
    .hmp-info-row {\
      display: flex !important;\
      padding: 6px 0 !important;\
      border-bottom: 1px solid rgba(255,255,255,0.05) !important;\
      width: 100% !important;\
    }\
    \
    .hmp-info-label {\
      font-size: 10px !important;\
      color: #888 !important;\
      width: 60px !important;\
      min-width: 60px !important;\
      flex-shrink: 0 !important;\
    }\
    \
    .hmp-info-value {\
      font-size: 12px !important;\
      color: #f5f5f5 !important;\
      flex: 1 1 auto !important;\
      word-break: break-all !important;\
    }\
    \
    .hmp-tags {\
      display: flex !important;\
      flex-wrap: wrap !important;\
      gap: 4px !important;\
    }\
    \
    .hmp-tag {\
      font-size: 10px !important;\
      padding: 3px 6px !important;\
      border-radius: 8px !important;\
      background: rgba(139, 92, 246, 0.2) !important;\
      color: #a78bfa !important;\
      display: inline-block !important;\
    }\
    \
    .hmp-memo-text {\
      font-size: 12px !important;\
      color: #ccc !important;\
      line-height: 1.5 !important;\
      white-space: pre-wrap !important;\
    }\
    \
    .hmp-history-item {\
      background: #252540 !important;\
      border-radius: 6px !important;\
      padding: 8px !important;\
      margin-bottom: 6px !important;\
      display: block !important;\
    }\
    \
    .hmp-history-top {\
      display: flex !important;\
      justify-content: space-between !important;\
      align-items: center !important;\
      margin-bottom: 2px !important;\
    }\
    \
    .hmp-history-date {\
      font-size: 11px !important;\
      color: #d4af37 !important;\
      font-weight: 600 !important;\
    }\
    \
    .hmp-history-type {\
      font-size: 9px !important;\
      padding: 1px 5px !important;\
      border-radius: 4px !important;\
      background: rgba(212, 175, 55, 0.15) !important;\
      color: #d4af37 !important;\
      display: inline-block !important;\
    }\
    \
    .hmp-history-memo {\
      font-size: 11px !important;\
      color: #ccc !important;\
      line-height: 1.4 !important;\
    }\
    \
    .hmp-history-empty {\
      text-align: center !important;\
      color: #666 !important;\
      padding: 12px !important;\
      font-size: 11px !important;\
    }\
    \
    .hmp-add-contact-btn {\
      width: 100% !important;\
      background: transparent !important;\
      border: 1px dashed #3a3a5a !important;\
      border-radius: 6px !important;\
      padding: 10px !important;\
      color: #d4af37 !important;\
      font-size: 12px !important;\
      cursor: pointer !important;\
      margin-top: 8px !important;\
      display: block !important;\
      text-align: center !important;\
    }\
    \
    .hmp-contact-form {\
      background: #252540 !important;\
      border-radius: 8px !important;\
      padding: 12px !important;\
      margin-top: 8px !important;\
      display: block !important;\
    }\
    \
    .hmp-form-row {\
      display: flex !important;\
      gap: 8px !important;\
      margin-bottom: 10px !important;\
    }\
    \
    .hmp-form-group {\
      flex: 1 1 0 !important;\
      display: block !important;\
    }\
    \
    .hmp-form-label {\
      font-size: 10px !important;\
      color: #d4af37 !important;\
      margin-bottom: 4px !important;\
      display: block !important;\
    }\
    \
    .hmp-form-input,\
    .hmp-form-select,\
    .hmp-form-textarea {\
      width: 100% !important;\
      background: #1a1a2e !important;\
      border: 1px solid #3a3a5a !important;\
      border-radius: 4px !important;\
      padding: 8px !important;\
      font-size: 13px !important;\
      color: #f5f5f5 !important;\
      display: block !important;\
    }\
    \
    .hmp-form-textarea {\
      min-height: 50px !important;\
      resize: vertical !important;\
    }\
    \
    .hmp-form-actions {\
      display: flex !important;\
      gap: 8px !important;\
    }\
    \
    .hmp-edit-body {\
      padding: 12px !important;\
      display: block !important;\
    }\
    \
    .hmp-edit-photo {\
      text-align: center !important;\
      margin-bottom: 16px !important;\
      display: block !important;\
    }\
    \
    .hmp-edit-photo-preview {\
      width: 60px !important;\
      height: 60px !important;\
      border-radius: 50% !important;\
      background: #3a3a5a !important;\
      display: inline-flex !important;\
      align-items: center !important;\
      justify-content: center !important;\
      font-size: 24px !important;\
      color: #666 !important;\
      margin-bottom: 6px !important;\
      background-size: cover !important;\
      background-position: center !important;\
      border: 2px solid rgba(212, 175, 55, 0.3) !important;\
    }\
    \
    .hmp-edit-photo-btn {\
      display: block !important;\
      margin: 0 auto !important;\
      background: transparent !important;\
      border: 1px solid rgba(212, 175, 55, 0.5) !important;\
      color: #d4af37 !important;\
      padding: 5px 12px !important;\
      border-radius: 12px !important;\
      font-size: 11px !important;\
      cursor: pointer !important;\
    }\
    \
    .hmp-edit-photo-input {\
      display: none !important;\
    }\
    \
    .hmp-edit-section {\
      margin-bottom: 16px !important;\
      display: block !important;\
    }\
    \
    .hmp-edit-section-title {\
      font-size: 11px !important;\
      font-weight: 600 !important;\
      color: #d4af37 !important;\
      margin-bottom: 8px !important;\
      padding-bottom: 4px !important;\
      border-bottom: 1px solid rgba(212, 175, 55, 0.2) !important;\
      display: block !important;\
    }\
    \
    .hmp-edit-field {\
      margin-bottom: 12px !important;\
      display: block !important;\
    }\
    \
    .hmp-edit-label {\
      font-size: 10px !important;\
      color: #888 !important;\
      margin-bottom: 4px !important;\
      display: block !important;\
    }\
    \
    .hmp-edit-label.required::after {\
      content: " *" !important;\
      color: #ef4444 !important;\
    }\
    \
    .hmp-edit-input,\
    .hmp-edit-select,\
    .hmp-edit-textarea {\
      width: 100% !important;\
      background: #252540 !important;\
      border: 1px solid #3a3a5a !important;\
      border-radius: 4px !important;\
      padding: 8px 10px !important;\
      font-size: 13px !important;\
      color: #f5f5f5 !important;\
      display: block !important;\
    }\
    \
    .hmp-edit-input:focus,\
    .hmp-edit-select:focus,\
    .hmp-edit-textarea:focus {\
      outline: none !important;\
      border-color: #d4af37 !important;\
    }\
    \
    .hmp-edit-textarea {\
      min-height: 60px !important;\
      resize: vertical !important;\
    }\
    \
    .hmp-edit-select option {\
      background: #1a1a2e !important;\
      color: #f5f5f5 !important;\
    }\
    \
    .hmp-referrer-container {\
      position: relative !important;\
      display: block !important;\
    }\
    \
    .hmp-referrer-dropdown {\
      background: #252540 !important;\
      border: 1px solid #3a3a5a !important;\
      border-radius: 4px !important;\
      margin-top: 4px !important;\
      max-height: 120px !important;\
      overflow-y: auto !important;\
    }\
    \
    .hmp-referrer-item {\
      padding: 8px 10px !important;\
      border-bottom: 1px solid #3a3a5a !important;\
      cursor: pointer !important;\
      display: block !important;\
    }\
    \
    .hmp-referrer-name {\
      font-size: 12px !important;\
      color: #f5f5f5 !important;\
    }\
    \
    .hmp-referrer-company {\
      font-size: 9px !important;\
      color: #888 !important;\
    }\
    \
    .hmp-checkbox-grid {\
      display: flex !important;\
      flex-wrap: wrap !important;\
      gap: 4px !important;\
    }\
    \
    .hmp-checkbox-item {\
      display: flex !important;\
      align-items: center !important;\
      gap: 4px !important;\
      background: #252540 !important;\
      padding: 4px 8px !important;\
      border-radius: 4px !important;\
    }\
    \
    .hmp-checkbox-item input[type="checkbox"] {\
      width: 14px !important;\
      height: 14px !important;\
      accent-color: #d4af37 !important;\
    }\
    \
    .hmp-checkbox-item label {\
      font-size: 11px !important;\
      color: #f5f5f5 !important;\
    }\
    \
    .hmp-delete-btn {\
      width: 100% !important;\
      background: transparent !important;\
      border: 1px solid #ef4444 !important;\
      color: #ef4444 !important;\
      padding: 10px !important;\
      border-radius: 6px !important;\
      font-size: 12px !important;\
      cursor: pointer !important;\
      margin-top: 20px !important;\
      display: block !important;\
      text-align: center !important;\
    }\
    \
    .hmp-duplicate-warning {\
      background: rgba(239, 68, 68, 0.1) !important;\
      border: 1px solid rgba(239, 68, 68, 0.3) !important;\
      color: #ef4444 !important;\
      padding: 8px !important;\
      border-radius: 4px !important;\
      font-size: 11px !important;\
      margin-bottom: 12px !important;\
      display: block !important;\
    }\
    \
    .hmp-loading {\
      display: flex !important;\
      flex-direction: column !important;\
      align-items: center !important;\
      justify-content: center !important;\
      padding: 50px 16px !important;\
      gap: 12px !important;\
    }\
    \
    .hmp-loading-spinner {\
      width: 32px !important;\
      height: 32px !important;\
      border: 3px solid rgba(212, 175, 55, 0.2) !important;\
      border-top-color: #d4af37 !important;\
      border-radius: 50% !important;\
      animation: hmp-spin 1s linear infinite !important;\
    }\
    \
    @keyframes hmp-spin {\
      to { transform: rotate(360deg); }\
    }\
    \
    .hmp-loading-text {\
      color: #d4af37 !important;\
      font-size: 12px !important;\
    }\
    ';
  };

  // 一覧画面
  const renderListScreen = () => {
    const hasFilter = currentRelationshipFilter !== 'all' || currentIndustryFilter !== 'all';
    
    let cardsHtml = '';
    if (filteredRecords.length === 0) {
      cardsHtml = '<div class="hmp-empty"><div class="hmp-empty-icon">🔍</div><div>該当する人脈がありません</div></div>';
    } else {
      cardsHtml = filteredRecords.map(function(record) {
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
          const valid = history.filter(function(r) { return r.value[CONFIG.FIELDS.CONTACT_DATE] && r.value[CONFIG.FIELDS.CONTACT_DATE].value; });
          if (valid.length > 0) {
            const sorted = valid.sort(function(a, b) {
              const da = a.value[CONFIG.FIELDS.CONTACT_DATE] ? a.value[CONFIG.FIELDS.CONTACT_DATE].value : '';
              const db = b.value[CONFIG.FIELDS.CONTACT_DATE] ? b.value[CONFIG.FIELDS.CONTACT_DATE].value : '';
              return db.localeCompare(da);
            });
            lastContact = sorted[0].value[CONFIG.FIELDS.CONTACT_DATE] ? sorted[0].value[CONFIG.FIELDS.CONTACT_DATE].value : '';
            lastContactType = sorted[0].value[CONFIG.FIELDS.CONTACT_TYPE] ? sorted[0].value[CONFIG.FIELDS.CONTACT_TYPE].value : '';
          }
        }
        
        const hasPhoto = photo && photo.length > 0;
        const fileKey = hasPhoto ? photo[0].fileKey : '';
        const cachedUrl = fileKey ? Utils._fileUrlCache[fileKey] : '';
        const photoStyle = cachedUrl ? 'background-image:url(' + cachedUrl + ');color:transparent;' : '';
        
        const contactText = lastContact 
          ? (lastContactType ? lastContactType + ' ' : '') + Utils.formatDateShort(lastContact)
          : '接点なし';
        
        return '<div class="hmp-card" data-id="' + id + '" style="--rel-color:' + color + '">' +
          '<div class="hmp-card-avatar" data-file-key="' + fileKey + '" style="background:' + color + ';' + photoStyle + '">' + Utils.getInitial(name) + '</div>' +
          '<div class="hmp-card-info">' +
            '<div class="hmp-card-name">' + Utils.escapeHtml(name) + '</div>' +
            '<div class="hmp-card-company">' + Utils.escapeHtml(company) + (position ? ' / ' + Utils.escapeHtml(position) : '') + '</div>' +
            '<div class="hmp-card-meta">' +
              '<span class="hmp-card-badge" style="background:' + color + '">' + (relationship || '未設定') + '</span>' +
              '<span class="hmp-card-contact">' + contactText + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="hmp-card-arrow">›</div>' +
        '</div>';
      }).join('');
    }
    
    container.innerHTML = '<style>' + getStyles() + '</style>' +
      '<div id="hmp-root">' +
        '<div class="hmp-header">' +
          '<div class="hmp-header-title">人脈管理</div>' +
        '</div>' +
        '<div class="hmp-search-area">' +
          '<div class="hmp-search-row">' +
            '<input type="search" class="hmp-search-input" id="hmp-search" placeholder="名前・会社名で検索..." value="' + Utils.escapeHtml(currentSearch) + '">' +
            '<button class="hmp-filter-btn ' + (hasFilter ? 'active' : '') + '" id="hmp-filter-btn">絞込</button>' +
          '</div>' +
        '</div>' +
        '<div class="hmp-list-count">' + filteredRecords.length + '件</div>' +
        '<div class="hmp-list-body">' + cardsHtml + '</div>' +
        '<div class="hmp-add-card" id="hmp-add-btn">＋ 新しい人脈を追加</div>' +
      '</div>';
    
    document.getElementById('hmp-search').addEventListener('input', function(e) {
      currentSearch = e.target.value;
      applyFilters();
      renderListScreen();
    });
    
    document.getElementById('hmp-filter-btn').addEventListener('click', function() {
      renderFilterScreen();
    });
    
    document.getElementById('hmp-add-btn').addEventListener('click', function() {
      photoFile = null;
      currentEditRecord = null;
      renderEditScreen(null);
    });
    
    var cards = container.querySelectorAll('.hmp-card');
    for (var i = 0; i < cards.length; i++) {
      (function(card) {
        card.addEventListener('click', function() {
          const id = card.getAttribute('data-id');
          const record = allRecords.find(function(r) { return Utils.getFieldValue(r, '$id') === id; });
          if (record) renderDetailScreen(record);
        });
      })(cards[i]);
    }
    
    var avatars = container.querySelectorAll('.hmp-card-avatar[data-file-key]');
    for (var j = 0; j < avatars.length; j++) {
      (function(el) {
        const key = el.getAttribute('data-file-key');
        if (key && !Utils._fileUrlCache[key]) {
          Utils.getFileUrl(key).then(function(url) {
            if (url) {
              el.style.backgroundImage = 'url(' + url + ')';
              el.style.color = 'transparent';
            }
          });
        }
      })(avatars[j]);
    }
  };

  // フィルター画面
  const renderFilterScreen = () => {
    let relOptions = '<option value="all"' + (currentRelationshipFilter === 'all' ? ' selected' : '') + '>すべて</option>';
    for (var i = 0; i < CONFIG.RELATIONSHIP_ORDER.length; i++) {
      const rel = CONFIG.RELATIONSHIP_ORDER[i];
      relOptions += '<option value="' + rel + '"' + (currentRelationshipFilter === rel ? ' selected' : '') + '>' + rel + '</option>';
    }
    
    let indOptions = '<option value="all"' + (currentIndustryFilter === 'all' ? ' selected' : '') + '>すべて</option>';
    for (var j = 0; j < industryOptions.length; j++) {
      const opt = industryOptions[j];
      indOptions += '<option value="' + opt + '"' + (currentIndustryFilter === opt ? ' selected' : '') + '>' + opt + '</option>';
    }
    
    container.innerHTML = '<style>' + getStyles() + '</style>' +
      '<div id="hmp-root">' +
        '<div class="hmp-header">' +
          '<div class="hmp-header-row">' +
            '<button class="hmp-header-btn" id="hmp-back">←</button>' +
            '<div class="hmp-header-spacer"></div>' +
            '<div class="hmp-header-title">絞り込み</div>' +
            '<div class="hmp-header-spacer"></div>' +
            '<div style="width:32px"></div>' +
          '</div>' +
        '</div>' +
        '<div class="hmp-filter-body">' +
          '<div class="hmp-filter-section">' +
            '<div class="hmp-filter-label">お付き合い度合い</div>' +
            '<select class="hmp-filter-select" id="hmp-filter-relationship">' + relOptions + '</select>' +
          '</div>' +
          '<div class="hmp-filter-section">' +
            '<div class="hmp-filter-label">業種</div>' +
            '<select class="hmp-filter-select" id="hmp-filter-industry">' + indOptions + '</select>' +
          '</div>' +
          '<div class="hmp-filter-actions">' +
            '<button class="hmp-btn hmp-btn-secondary" id="hmp-filter-clear">クリア</button>' +
            '<button class="hmp-btn hmp-btn-primary" id="hmp-filter-apply">適用</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    
    document.getElementById('hmp-back').addEventListener('click', function() {
      renderListScreen();
    });
    
    document.getElementById('hmp-filter-clear').addEventListener('click', function() {
      document.getElementById('hmp-filter-relationship').value = 'all';
      document.getElementById('hmp-filter-industry').value = 'all';
    });
    
    document.getElementById('hmp-filter-apply').addEventListener('click', function() {
      currentRelationshipFilter = document.getElementById('hmp-filter-relationship').value;
      currentIndustryFilter = document.getElementById('hmp-filter-industry').value;
      applyFilters();
      renderListScreen();
    });
  };

  // 詳細画面
  const renderDetailScreen = async (record, showContactForm) => {
    currentDetailRecord = record;
    showContactForm = showContactForm || false;
    
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
    const photoStyle = photoUrl ? 'background-image:url(' + photoUrl + ');color:transparent;' : '';
    
    const validHistory = contactHistory
      .filter(function(r) { return r.value[CONFIG.FIELDS.CONTACT_DATE] && r.value[CONFIG.FIELDS.CONTACT_DATE].value; })
      .sort(function(a, b) {
        const da = a.value[CONFIG.FIELDS.CONTACT_DATE] ? a.value[CONFIG.FIELDS.CONTACT_DATE].value : '';
        const db = b.value[CONFIG.FIELDS.CONTACT_DATE] ? b.value[CONFIG.FIELDS.CONTACT_DATE].value : '';
        return db.localeCompare(da);
      });
    
    let historyHtml = validHistory.length > 0
      ? validHistory.map(function(r) {
          const date = r.value[CONFIG.FIELDS.CONTACT_DATE] ? r.value[CONFIG.FIELDS.CONTACT_DATE].value : '';
          const type = r.value[CONFIG.FIELDS.CONTACT_TYPE] ? r.value[CONFIG.FIELDS.CONTACT_TYPE].value : '';
          const memo = r.value[CONFIG.FIELDS.CONTACT_MEMO] ? r.value[CONFIG.FIELDS.CONTACT_MEMO].value : '';
          return '<div class="hmp-history-item">' +
            '<div class="hmp-history-top">' +
              '<div class="hmp-history-date">' + Utils.formatDate(date) + '</div>' +
              (type ? '<div class="hmp-history-type">' + Utils.escapeHtml(type) + '</div>' : '') +
            '</div>' +
            (memo ? '<div class="hmp-history-memo">' + Utils.escapeHtml(memo) + '</div>' : '') +
          '</div>';
        }).join('')
      : '<div class="hmp-history-empty">接点履歴がありません</div>';
    
    let contactTypeOpts = '';
    for (var i = 0; i < contactTypeOptions.length; i++) {
      contactTypeOpts += '<option value="' + contactTypeOptions[i] + '">' + contactTypeOptions[i] + '</option>';
    }
    
    const contactFormHtml = showContactForm 
      ? '<div class="hmp-contact-form">' +
          '<div class="hmp-form-row">' +
            '<div class="hmp-form-group">' +
              '<label class="hmp-form-label">接点日</label>' +
              '<input type="date" class="hmp-form-input" id="hmp-contact-date" value="' + Utils.getTodayString() + '">' +
            '</div>' +
            '<div class="hmp-form-group">' +
              '<label class="hmp-form-label">種別</label>' +
              '<select class="hmp-form-select" id="hmp-contact-type">' + contactTypeOpts + '</select>' +
            '</div>' +
          '</div>' +
          '<div class="hmp-form-group">' +
            '<label class="hmp-form-label">メモ</label>' +
            '<textarea class="hmp-form-textarea" id="hmp-contact-memo" placeholder="接点の内容..."></textarea>' +
          '</div>' +
          '<div class="hmp-form-actions">' +
            '<button class="hmp-btn hmp-btn-secondary" id="hmp-contact-cancel">キャンセル</button>' +
            '<button class="hmp-btn hmp-btn-primary" id="hmp-contact-save">追加</button>' +
          '</div>' +
        '</div>'
      : '<button class="hmp-add-contact-btn" id="hmp-add-contact-btn">+ 接点を追加</button>';
    
    let infoHtml = '';
    if (phone) infoHtml += '<div class="hmp-info-row"><div class="hmp-info-label">電話</div><div class="hmp-info-value">' + Utils.escapeHtml(phone) + '</div></div>';
    if (email) infoHtml += '<div class="hmp-info-row"><div class="hmp-info-label">メール</div><div class="hmp-info-value">' + Utils.escapeHtml(email) + '</div></div>';
    if (birthday) infoHtml += '<div class="hmp-info-row"><div class="hmp-info-label">誕生日</div><div class="hmp-info-value">' + Utils.formatDate(birthday) + '</div></div>';
    if (industry) infoHtml += '<div class="hmp-info-row"><div class="hmp-info-label">業種</div><div class="hmp-info-value">' + Utils.escapeHtml(industry) + '</div></div>';
    if (referrer) infoHtml += '<div class="hmp-info-row"><div class="hmp-info-label">紹介者</div><div class="hmp-info-value">' + Utils.escapeHtml(referrer) + '</div></div>';
    
    let personalityHtml = '';
    if (personality.length > 0) {
      personalityHtml = '<div class="hmp-section"><div class="hmp-section-title">個人特性</div><div class="hmp-tags">';
      for (var j = 0; j < personality.length; j++) {
        personalityHtml += '<span class="hmp-tag">' + Utils.escapeHtml(personality[j]) + '</span>';
      }
      personalityHtml += '</div></div>';
    }
    
    let notesHtml = '';
    if (notes) {
      notesHtml = '<div class="hmp-section"><div class="hmp-section-title">メモ</div><div class="hmp-memo-text">' + Utils.escapeHtml(notes) + '</div></div>';
    }
    
    container.innerHTML = '<style>' + getStyles() + '</style>' +
      '<div id="hmp-root">' +
        '<div class="hmp-header">' +
          '<div class="hmp-header-row">' +
            '<button class="hmp-header-btn" id="hmp-back">←</button>' +
            '<div class="hmp-header-spacer"></div>' +
            '<div class="hmp-header-title">詳細</div>' +
            '<div class="hmp-header-spacer"></div>' +
            '<button class="hmp-header-btn-text" id="hmp-edit">編集</button>' +
          '</div>' +
        '</div>' +
        '<div class="hmp-detail-body">' +
          '<div class="hmp-detail-profile">' +
            '<div class="hmp-detail-avatar" style="background:' + color + ';' + photoStyle + '">' + Utils.getInitial(name) + '</div>' +
            '<div class="hmp-detail-info">' +
              '<div class="hmp-detail-name">' + Utils.escapeHtml(name) + '</div>' +
              '<div class="hmp-detail-company">' + Utils.escapeHtml(company) + (position ? ' / ' + Utils.escapeHtml(position) : '') + '</div>' +
              '<div class="hmp-detail-badge" style="background:' + color + '">' + (relationship || '未設定') + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="hmp-detail-actions">' +
            '<a href="' + (phone ? 'tel:' + phone : '#') + '" class="hmp-action-btn ' + (phone ? 'hmp-action-btn-phone' : 'hmp-action-btn-disabled') + '">' +
              '<span class="hmp-action-icon">📞</span>' +
              '<span>電話</span>' +
            '</a>' +
            '<a href="' + (email ? 'mailto:' + email : '#') + '" class="hmp-action-btn ' + (email ? 'hmp-action-btn-email' : 'hmp-action-btn-disabled') + '">' +
              '<span class="hmp-action-icon">✉️</span>' +
              '<span>メール</span>' +
            '</a>' +
          '</div>' +
          '<div class="hmp-section">' +
            '<div class="hmp-section-title">基本情報</div>' +
            infoHtml +
          '</div>' +
          personalityHtml +
          notesHtml +
          '<div class="hmp-section">' +
            '<div class="hmp-section-title">接点履歴</div>' +
            historyHtml +
            contactFormHtml +
          '</div>' +
        '</div>' +
      '</div>';
    
    document.getElementById('hmp-back').addEventListener('click', function() {
      renderListScreen();
    });
    
    document.getElementById('hmp-edit').addEventListener('click', function() {
      photoFile = null;
      renderEditScreen(record);
    });
    
    const addContactBtn = document.getElementById('hmp-add-contact-btn');
    if (addContactBtn) {
      addContactBtn.addEventListener('click', function() {
        renderDetailScreen(record, true);
      });
    }
    
    const contactCancel = document.getElementById('hmp-contact-cancel');
    if (contactCancel) {
      contactCancel.addEventListener('click', function() {
        renderDetailScreen(record, false);
      });
    }
    
    const contactSave = document.getElementById('hmp-contact-save');
    if (contactSave) {
      contactSave.addEventListener('click', function() {
        saveContact();
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
      const resp = await kintone.api('/k/v1/record', 'GET', { app: CONFIG.APP_ID, id: id });
      const history = resp.record[CONFIG.FIELDS.CONTACT_HISTORY] ? resp.record[CONFIG.FIELDS.CONTACT_HISTORY].value : [];
      
      const newEntry = { value: {} };
      newEntry.value[CONFIG.FIELDS.CONTACT_DATE] = { value: date };
      newEntry.value[CONFIG.FIELDS.CONTACT_TYPE] = { value: type };
      newEntry.value[CONFIG.FIELDS.CONTACT_MEMO] = { value: memo };
      history.push(newEntry);
      
      const valid = history.filter(function(r) { return r.value[CONFIG.FIELDS.CONTACT_DATE] && r.value[CONFIG.FIELDS.CONTACT_DATE].value; });
      const sorted = valid.sort(function(a, b) {
        const da = a.value[CONFIG.FIELDS.CONTACT_DATE] ? a.value[CONFIG.FIELDS.CONTACT_DATE].value : '';
        const db = b.value[CONFIG.FIELDS.CONTACT_DATE] ? b.value[CONFIG.FIELDS.CONTACT_DATE].value : '';
        return db.localeCompare(da);
      });
      
      const latestDate = sorted[0] && sorted[0].value[CONFIG.FIELDS.CONTACT_DATE] ? sorted[0].value[CONFIG.FIELDS.CONTACT_DATE].value : '';
      const latestType = sorted[0] && sorted[0].value[CONFIG.FIELDS.CONTACT_TYPE] ? sorted[0].value[CONFIG.FIELDS.CONTACT_TYPE].value : '';
      
      const updateRecord = {};
      updateRecord[CONFIG.FIELDS.CONTACT_HISTORY] = { value: valid };
      updateRecord[CONFIG.FIELDS.LAST_CONTACT] = { value: latestDate };
      updateRecord[CONFIG.FIELDS.LAST_CONTACT_TYPE] = { value: latestType };
      updateRecord[CONFIG.FIELDS.CONTACT_COUNT] = { value: String(valid.length) };
      
      await kintone.api('/k/v1/record', 'PUT', {
        app: CONFIG.APP_ID,
        id: id,
        record: updateRecord
      });
      
      allRecords = await fetchAllRecords();
      loadReferrerOptions();
      applyFilters();
      
      const updated = allRecords.find(function(r) { return Utils.getFieldValue(r, '$id') === id; });
      if (updated) renderDetailScreen(updated, false);
      
    } catch (e) {
      console.error('接点追加エラー:', e);
      alert('接点の追加に失敗しました');
    }
  };

  // 編集画面
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
    
    let relOpts = '<option value="">選択してください</option>';
    for (var i = 0; i < CONFIG.RELATIONSHIP_ORDER.length; i++) {
      const rel = CONFIG.RELATIONSHIP_ORDER[i];
      relOpts += '<option value="' + rel + '"' + (relationship === rel ? ' selected' : '') + '>' + rel + '</option>';
    }
    
    let indOpts = '<option value="">選択してください</option>';
    for (var j = 0; j < industryOptions.length; j++) {
      const opt = industryOptions[j];
      indOpts += '<option value="' + opt + '"' + (industry === opt ? ' selected' : '') + '>' + opt + '</option>';
    }
    
    let persHtml = '';
    for (var k = 0; k < personalityOptions.length; k++) {
      const opt = personalityOptions[k];
      const checked = personality.indexOf(opt) !== -1 ? ' checked' : '';
      const safeId = opt.replace(/\s/g, '_');
      persHtml += '<div class="hmp-checkbox-item">' +
        '<input type="checkbox" name="hmp-personality" value="' + opt + '" id="hmp-p-' + safeId + '"' + checked + '>' +
        '<label for="hmp-p-' + safeId + '">' + opt + '</label>' +
      '</div>';
    }
    
    container.innerHTML = '<style>' + getStyles() + '</style>' +
      '<div id="hmp-root">' +
        '<div class="hmp-header">' +
          '<div class="hmp-header-row">' +
            '<button class="hmp-header-btn-text" id="hmp-cancel">キャンセル</button>' +
            '<div class="hmp-header-spacer"></div>' +
            '<div class="hmp-header-title">' + (isNew ? '新規追加' : '編集') + '</div>' +
            '<div class="hmp-header-spacer"></div>' +
            '<button class="hmp-header-btn-text" id="hmp-save">保存</button>' +
          '</div>' +
        '</div>' +
        '<div class="hmp-edit-body">' +
          '<div class="hmp-edit-photo">' +
            '<div class="hmp-edit-photo-preview" id="hmp-photo-preview" style="background:' + color + ';' + (photoUrl ? 'background-image:url(' + photoUrl + ');color:transparent;' : '') + '">' + (photoUrl ? '' : '📷') + '</div>' +
            '<button class="hmp-edit-photo-btn" id="hmp-photo-btn">写真を変更</button>' +
            '<input type="file" class="hmp-edit-photo-input" id="hmp-photo-input" accept="image/*">' +
          '</div>' +
          '<div id="hmp-duplicate-warning" class="hmp-duplicate-warning" style="display:none;">⚠️ 同姓同名の人脈が既に登録されています</div>' +
          '<div class="hmp-edit-section">' +
            '<div class="hmp-edit-section-title">基本情報</div>' +
            '<div class="hmp-edit-field"><label class="hmp-edit-label required">名前</label><input type="text" class="hmp-edit-input" id="hmp-edit-name" value="' + Utils.escapeHtml(name) + '"></div>' +
            '<div class="hmp-edit-field"><label class="hmp-edit-label">ふりがな</label><input type="text" class="hmp-edit-input" id="hmp-edit-kana" value="' + Utils.escapeHtml(kanaName) + '"></div>' +
            '<div class="hmp-edit-field"><label class="hmp-edit-label">会社名</label><input type="text" class="hmp-edit-input" id="hmp-edit-company" value="' + Utils.escapeHtml(company) + '"></div>' +
            '<div class="hmp-edit-field"><label class="hmp-edit-label">役職</label><input type="text" class="hmp-edit-input" id="hmp-edit-position" value="' + Utils.escapeHtml(position) + '"></div>' +
          '</div>' +
          '<div class="hmp-edit-section">' +
            '<div class="hmp-edit-section-title">連絡先</div>' +
            '<div class="hmp-edit-field"><label class="hmp-edit-label">電話番号</label><input type="tel" class="hmp-edit-input" id="hmp-edit-phone" value="' + Utils.escapeHtml(phone) + '"></div>' +
            '<div class="hmp-edit-field"><label class="hmp-edit-label">メールアドレス</label><input type="email" class="hmp-edit-input" id="hmp-edit-email" value="' + Utils.escapeHtml(email) + '"></div>' +
            '<div class="hmp-edit-field"><label class="hmp-edit-label">誕生日</label><input type="date" class="hmp-edit-input" id="hmp-edit-birthday" value="' + birthday + '"></div>' +
          '</div>' +
          '<div class="hmp-edit-section">' +
            '<div class="hmp-edit-section-title">分類</div>' +
            '<div class="hmp-edit-field"><label class="hmp-edit-label">お付き合い度合い</label><select class="hmp-edit-select" id="hmp-edit-relationship">' + relOpts + '</select></div>' +
            '<div class="hmp-edit-field"><label class="hmp-edit-label">業種</label><select class="hmp-edit-select" id="hmp-edit-industry">' + indOpts + '</select></div>' +
            '<div class="hmp-edit-field">' +
              '<label class="hmp-edit-label">紹介者</label>' +
              '<div class="hmp-referrer-container">' +
                '<input type="text" class="hmp-edit-input" id="hmp-edit-referrer" placeholder="紹介者名を入力..." value="' + Utils.escapeHtml(referrer) + '">' +
                '<input type="hidden" id="hmp-edit-referrer-id" value="' + referrerId + '">' +
                '<div class="hmp-referrer-dropdown" id="hmp-referrer-dropdown" style="display:none;"></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="hmp-edit-section">' +
            '<div class="hmp-edit-section-title">個人特性</div>' +
            '<div class="hmp-checkbox-grid">' + persHtml + '</div>' +
          '</div>' +
          '<div class="hmp-edit-section">' +
            '<div class="hmp-edit-section-title">メモ</div>' +
            '<textarea class="hmp-edit-textarea" id="hmp-edit-notes" placeholder="メモを入力...">' + Utils.escapeHtml(notes) + '</textarea>' +
          '</div>' +
          (isNew ? '' : '<button class="hmp-delete-btn" id="hmp-delete-btn">このデータを削除</button>') +
        '</div>' +
      '</div>';
    
    setupEditEvents(isNew);
  };
  
  const setupEditEvents = (isNew) => {
    document.getElementById('hmp-cancel').addEventListener('click', function() {
      photoFile = null;
      if (currentEditRecord) {
        renderDetailScreen(currentEditRecord);
      } else {
        renderListScreen();
      }
    });
    
    document.getElementById('hmp-save').addEventListener('click', function() {
      saveRecord();
    });
    
    document.getElementById('hmp-photo-btn').addEventListener('click', function() {
      document.getElementById('hmp-photo-input').click();
    });
    
    document.getElementById('hmp-photo-input').addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        photoFile = file;
        const reader = new FileReader();
        reader.onload = function(ev) {
          const preview = document.getElementById('hmp-photo-preview');
          preview.style.backgroundImage = 'url(' + ev.target.result + ')';
          preview.style.backgroundSize = 'cover';
          preview.style.backgroundPosition = 'center';
          preview.textContent = '';
        };
        reader.readAsDataURL(file);
      }
    });
    
    if (isNew) {
      let timeout = null;
      document.getElementById('hmp-edit-name').addEventListener('input', function(e) {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(function() {
          const name = e.target.value.trim();
          const warning = document.getElementById('hmp-duplicate-warning');
          if (name.length >= 2) {
            const dup = allRecords.some(function(r) { return Utils.getFieldValue(r, CONFIG.FIELDS.NAME) === name; });
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
    
    refInput.addEventListener('input', function(e) {
      if (refTimeout) clearTimeout(refTimeout);
      refTimeout = setTimeout(function() {
        const query = e.target.value.trim().toLowerCase();
        if (query.length >= 2) {
          const matches = referrerOptions.filter(function(r) {
            return r.name.toLowerCase().indexOf(query) !== -1 || (r.company && r.company.toLowerCase().indexOf(query) !== -1);
          }).slice(0, 8);
          
          if (matches.length > 0) {
            let html = '';
            for (var i = 0; i < matches.length; i++) {
              const r = matches[i];
              html += '<div class="hmp-referrer-item" data-id="' + r.id + '" data-name="' + Utils.escapeHtml(r.name) + '">' +
                '<div class="hmp-referrer-name">' + Utils.escapeHtml(r.name) + '</div>' +
                '<div class="hmp-referrer-company">' + Utils.escapeHtml(r.company || '') + '</div>' +
              '</div>';
            }
            refDropdown.innerHTML = html;
            refDropdown.style.display = 'block';
            
            const items = refDropdown.querySelectorAll('.hmp-referrer-item');
            for (var j = 0; j < items.length; j++) {
              (function(item) {
                item.addEventListener('click', function() {
                  refInput.value = item.getAttribute('data-name');
                  document.getElementById('hmp-edit-referrer-id').value = item.getAttribute('data-id');
                  refDropdown.style.display = 'none';
                });
              })(items[j]);
            }
          } else {
            refDropdown.style.display = 'none';
          }
        } else {
          refDropdown.style.display = 'none';
        }
      }, 300);
    });
    
    refInput.addEventListener('blur', function() {
      setTimeout(function() { refDropdown.style.display = 'none'; }, 200);
    });
    
    const deleteBtn = document.getElementById('hmp-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function() {
        deleteRecord();
      });
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
      const data = {};
      data[CONFIG.FIELDS.NAME] = { value: name };
      data[CONFIG.FIELDS.KANA_NAME] = { value: document.getElementById('hmp-edit-kana').value };
      data[CONFIG.FIELDS.COMPANY] = { value: document.getElementById('hmp-edit-company').value };
      data[CONFIG.FIELDS.POSITION] = { value: document.getElementById('hmp-edit-position').value };
      data[CONFIG.FIELDS.PHONE] = { value: document.getElementById('hmp-edit-phone').value };
      data[CONFIG.FIELDS.EMAIL] = { value: document.getElementById('hmp-edit-email').value };
      data[CONFIG.FIELDS.BIRTHDAY] = { value: document.getElementById('hmp-edit-birthday').value };
      data[CONFIG.FIELDS.RELATIONSHIP] = { value: document.getElementById('hmp-edit-relationship').value };
      data[CONFIG.FIELDS.INDUSTRY] = { value: document.getElementById('hmp-edit-industry').value };
      data[CONFIG.FIELDS.REFERRER] = { value: document.getElementById('hmp-edit-referrer').value };
      data[CONFIG.FIELDS.REFERRER_ID] = { value: document.getElementById('hmp-edit-referrer-id').value };
      data[CONFIG.FIELDS.NOTES] = { value: document.getElementById('hmp-edit-notes').value };
      
      const refId = document.getElementById('hmp-edit-referrer-id').value;
      if (refId) {
        data[CONFIG.FIELDS.REFERRER_LINK] = { value: location.origin + '/k/' + CONFIG.APP_ID + '/show#record=' + refId };
      } else {
        data[CONFIG.FIELDS.REFERRER_LINK] = { value: '' };
      }
      
      const personalityChecks = document.querySelectorAll('input[name="hmp-personality"]:checked');
      const persValues = [];
      for (var i = 0; i < personalityChecks.length; i++) {
        persValues.push(personalityChecks[i].value);
      }
      data[CONFIG.FIELDS.PERSONALITY] = { value: persValues };
      
      if (photoFile) {
        const formData = new FormData();
        formData.append('__REQUEST_TOKEN__', kintone.getRequestToken());
        formData.append('file', photoFile);
        
        const uploadResp = await fetch('/k/v1/file.json', {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          body: formData
        }).then(function(r) { return r.json(); });
        
        data[CONFIG.FIELDS.PHOTO] = { value: [{ fileKey: uploadResp.fileKey }] };
      }
      
      if (isNew) {
        await kintone.api('/k/v1/record', 'POST', { app: CONFIG.APP_ID, record: data });
      } else {
        const id = Utils.getFieldValue(currentEditRecord, '$id');
        await kintone.api('/k/v1/record', 'PUT', { app: CONFIG.APP_ID, id: id, record: data });
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

  const init = async (el) => {
    console.log('🌟 HIKARI Mobile People v5 initializing...');
    
    hideKintoneUI();
    
    container = el;
    
    container.innerHTML = '<style>' + getStyles() + '</style>' +
      '<div id="hmp-root">' +
        '<div class="hmp-loading">' +
          '<div class="hmp-loading-spinner"></div>' +
          '<div class="hmp-loading-text">データを読み込み中...</div>' +
        '</div>' +
      '</div>';
    
    try {
      await loadFormOptions();
      allRecords = await fetchAllRecords();
      loadReferrerOptions();
      filteredRecords = allRecords.slice();
      
      console.log('✅ ' + allRecords.length + '件のデータを取得');
      
      renderListScreen();
      
      console.log('✅ HIKARI Mobile People v5 initialized');
      
    } catch (error) {
      console.error('❌ 初期化エラー:', error);
      container.innerHTML = '<style>' + getStyles() + '</style>' +
        '<div id="hmp-root">' +
          '<div class="hmp-loading">' +
            '<div style="font-size:32px;margin-bottom:12px;">⚠️</div>' +
            '<div class="hmp-loading-text">データの取得に失敗しました</div>' +
          '</div>' +
        '</div>';
    }
  };

  kintone.events.on('mobile.app.record.index.show', function(event) {
    const el = kintone.mobile.app.getHeaderSpaceElement();
    if (!el) return event;
    
    init(el);
    
    return event;
  });

})();
