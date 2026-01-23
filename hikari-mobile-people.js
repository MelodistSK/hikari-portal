/**
 * HIKARI Mobile People App v10
 * PC版と同等品質・構造のモバイル版
 * 
 * 機能:
 * - カード一覧表示
 * - 詳細・編集・新規モーダル（画面遷移方式）
 * - 写真タップで拡大表示
 * - 紹介者ルックアップ（検索・選択）
 * - 接点履歴管理
 * - 重複チェック
 * - SNS・住所・名刺写真対応
 */

(function() {
  'use strict';

  // ========================================
  //  設定
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
      POSTAL_CODE: '郵便番号',
      ADDRESS: '住所',
      HP: 'HP',
      FACEBOOK: 'Facebook',
      INSTAGRAM: 'Instagram',
      REFERRER: '紹介者',
      REFERRER_ID: '紹介者rid',
      REFERRER_LINK: '紹介者リンク',
      RELATIONSHIP: 'お付き合い度合い',
      LAST_CONTACT: 'last_contact_date',
      LAST_CONTACT_TYPE: 'last_contact_type',
      CONTACT_COUNT: 'contact_count',
      BIRTHDAY: 'birthday',
      NOTES: 'shokai_memo',
      PHOTO: '顔写真',
      BUSINESS_CARD: '名刺写真',
      INDUSTRY: '業種',
      PERSONALITY: 'パーソナリティ評価',
      // サブテーブル
      CONTACT_HISTORY: 'contact_history',
      CONTACT_DATE: 'contact_date',
      CONTACT_TYPE: 'contact_type',
      CONTACT_MEMO: 'contact_memo',
    },
    RELATIONSHIP_COLORS: {
      '1.プライム': '#d4af37',
      '2.パワー': '#a855f7',
      '3.スタンダード': '#cd7f32',
      '4.フレンド': '#5b9bd5',
      '5.コネクト': '#6b7280',
    },
    RELATIONSHIP_ORDER: ['1.プライム', '2.パワー', '3.スタンダード', '4.フレンド', '5.コネクト'],
  };

  // ========================================
  //  状態管理
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
  let currentRecord = null;
  let editRecord = null;
  let selectedPhotoFile = null;
  let selectedBusinessCardFile = null;

  // ========================================
  //  ユーティリティ
  // ========================================
  
  const Utils = {
    getFieldValue: (record, fieldCode) => {
      const field = record[fieldCode];
      if (!field) return '';
      if (field.type === 'USER_SELECT' || field.type === 'ORGANIZATION_SELECT' || field.type === 'GROUP_SELECT') {
        return field.value.map(v => v.name || v.code).join(', ');
      }
      if (field.type === 'FILE') {
        return field.value || [];
      }
      if (field.type === 'SUBTABLE') {
        return field.value || [];
      }
      if (field.type === 'CHECK_BOX' || field.type === 'MULTI_SELECT') {
        return field.value || [];
      }
      return field.value || '';
    },
    
    getInitial: (name) => {
      if (!name) return '?';
      return name.charAt(0);
    },
    
    formatDate: (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}`;
    },
    
    formatDateShort: (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${d.getMonth()+1}/${d.getDate()}`;
    },
    
    getTodayString: () => {
      const d = new Date();
      const m = d.getMonth() + 1;
      const day = d.getDate();
      return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
    },
    
    getRelationshipColor: (rel) => {
      return CONFIG.RELATIONSHIP_COLORS[rel] || '#6b7280';
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
    
    // 添付ファイルのBlobURLを取得（キャッシュ付き）
    _fileUrlCache: {},
    getFileUrl: async (fileKey) => {
      if (!fileKey) return null;
      
      // キャッシュにあればそれを返す
      if (Utils._fileUrlCache[fileKey]) {
        return Utils._fileUrlCache[fileKey];
      }
      
      try {
        const url = '/k/v1/file.json?fileKey=' + fileKey;
        const resp = await fetch(url, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (!resp.ok) return null;
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        // キャッシュに保存
        Utils._fileUrlCache[fileKey] = blobUrl;
        
        return blobUrl;
      } catch (e) {
        console.error('ファイル取得エラー:', e);
        return null;
      }
    },
    
    // 写真拡大表示
    showPhotoModal: async (fileKey) => {
      if (!fileKey) return;
      
      // モーダル作成
      const modal = document.createElement('div');
      modal.className = 'hmp-photo-modal';
      modal.innerHTML = `
        <div class="hmp-photo-modal-loading">読み込み中...</div>
      `;
      
      document.body.appendChild(modal);
      
      // フェードイン
      requestAnimationFrame(() => {
        modal.classList.add('active');
      });
      
      // 画像取得
      try {
        const url = '/k/v1/file.json?fileKey=' + fileKey;
        const resp = await fetch(url, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (!resp.ok) throw new Error('取得失敗');
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        modal.innerHTML = `
          <button class="hmp-photo-modal-close">&times;</button>
          <img src="${blobUrl}" alt="拡大写真">
        `;
        
        const closeModal = () => {
          modal.classList.remove('active');
          setTimeout(() => {
            modal.remove();
            URL.revokeObjectURL(blobUrl);
          }, 300);
        };
        
        // 閉じるボタン
        modal.querySelector('.hmp-photo-modal-close').addEventListener('click', (e) => {
          e.stopPropagation();
          closeModal();
        });
        
        // 画像クリックでも閉じる
        modal.querySelector('img').addEventListener('click', (e) => {
          e.stopPropagation();
          closeModal();
        });
        
        // 背景クリックで閉じる
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            closeModal();
          }
        });
        
      } catch (e) {
        console.error('写真取得エラー:', e);
        modal.innerHTML = `<div class="hmp-photo-modal-error">画像の読み込みに失敗しました</div>`;
        setTimeout(() => modal.remove(), 2000);
      }
    },
  };

  // ========================================
  //  スタイル注入
  // ========================================
  
  const injectStyles = () => {
    if (document.getElementById('hmp-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'hmp-styles';
    style.textContent = `
    /* ========================================
       kintone標準UI非表示（強化版）
       ======================================== */
    .gaia-mobile-v2-viewpanel-viewtab,
    .gaia-mobile-v2-viewpanel-pager,
    .gaia-mobile-v2-viewpanel-viewlist,
    .gaia-mobile-v2-viewpanel-recordlist,
    .gaia-mobile-v2-app-index-pager,
    .gaia-mobile-v2-app-index-toolbar,
    .gaia-mobile-v2-app-index-addbutton,
    .gaia-mobile-v2-app-addbutton,
    .gaia-mobile-v2-app-toolbar-gaia,
    .gaia-mobile-v2-app-index-view,
    .gaia-mobile-v2-buttonarea,
    .gaia-mobile-v2-messagepanel,
    .gaia-mobile-v2-app-pager,
    .recordlist-gaia,
    .gaia-mobile-v2-recordlist,
    .gaia-mobile-v2-record-single-show,
    .recordlist-wrapper-gaia,
    .gaia-mobile-v2-app-record-viewtab-container,
    .gaia-mobile-v2-view-list-record,
    .gaia-mobile-v2-app-indexHeader {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      overflow: hidden !important;
      position: absolute !important;
      left: -9999px !important;
    }
    
    /* ========================================
       基本コンテナ
       ======================================== */
    .hmp-container {
      display: block;
      min-height: 100vh;
      background: #1a1a2e;
      font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif;
      color: #f5f5f5;
      font-size: 14px;
      line-height: 1.5;
      padding-bottom: 20px;
      box-sizing: border-box;
    }
    
    .hmp-container *,
    .hmp-container *::before,
    .hmp-container *::after {
      box-sizing: border-box;
    }
    
    /* ========================================
       ヘッダー
       ======================================== */
    .hmp-header {
      background: linear-gradient(135deg, #d4af37, #b8941f);
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .hmp-header-title {
      flex: 1;
      text-align: center;
      font-size: 16px;
      font-weight: 700;
      color: #1a1a1a;
    }
    
    .hmp-header-btn {
      background: rgba(0, 0, 0, 0.15);
      border: none;
      color: #1a1a1a;
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .hmp-header-btn:hover {
      background: rgba(0, 0, 0, 0.25);
    }
    
    .hmp-header-btn-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }
    
    /* ========================================
       検索バー
       ======================================== */
    .hmp-search-bar {
      padding: 10px 12px;
      display: flex;
      gap: 8px;
    }
    
    .hmp-search-input {
      flex: 1;
      min-width: 0;
      background: #2a2a4a;
      border: 1px solid #3a3a5a;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 14px;
      color: #f5f5f5;
      outline: none;
      transition: border-color 0.2s;
    }
    
    .hmp-search-input:focus {
      border-color: #d4af37;
    }
    
    .hmp-search-input::placeholder {
      color: #888;
    }
    
    .hmp-filter-btn {
      background: #2a2a4a;
      border: 1px solid #3a3a5a;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 600;
      color: #d4af37;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .hmp-filter-btn.active {
      background: #d4af37;
      color: #1a1a1a;
    }
    
    /* ========================================
       件数表示
       ======================================== */
    .hmp-count {
      padding: 6px 12px;
      font-size: 11px;
      color: #888;
    }
    
    /* ========================================
       カード一覧
       ======================================== */
    .hmp-list {
      padding: 0 10px;
    }
    
    .hmp-card {
      background: #252540;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-left: 3px solid #6b7280;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }
    
    .hmp-card:hover {
      background: #2d2d50;
    }
    
    .hmp-card:active {
      transform: scale(0.98);
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
    
    .hmp-card-content {
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
    
    .hmp-card-memo {
      font-size: 10px;
      color: #666;
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
    }
    
    .hmp-card-badge {
      font-size: 9px;
      padding: 2px 6px;
      border-radius: 8px;
      font-weight: 600;
      color: #1a1a1a;
    }
    
    .hmp-card-contact {
      font-size: 9px;
      color: #888;
    }
    
    .hmp-card-arrow {
      color: #666;
      font-size: 14px;
    }
    
    /* ========================================
       空状態
       ======================================== */
    .hmp-empty {
      text-align: center;
      padding: 40px 20px;
      color: #888;
    }
    
    .hmp-empty-icon {
      font-size: 40px;
      margin-bottom: 12px;
    }
    
    .hmp-empty-text {
      font-size: 13px;
    }
    
    /* ========================================
       追加ボタン
       ======================================== */
    .hmp-add-btn {
      background: linear-gradient(135deg, #d4af37, #b8941f);
      border-radius: 8px;
      padding: 14px;
      margin: 12px 10px;
      text-align: center;
      color: #1a1a1a;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.1s, box-shadow 0.2s;
    }
    
    .hmp-add-btn:hover {
      box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
    }
    
    .hmp-add-btn:active {
      transform: scale(0.98);
    }
    
    /* ========================================
       ローディング
       ======================================== */
    .hmp-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      gap: 16px;
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
    
    /* ========================================
       詳細画面
       ======================================== */
    .hmp-detail {
      padding: 16px 12px;
    }
    
    .hmp-detail-profile {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
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
      cursor: pointer;
      transition: transform 0.2s;
    }
    
    .hmp-detail-avatar:hover {
      transform: scale(1.05);
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
      margin-top: 2px;
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
    
    /* ========================================
       アクションボタン
       ======================================== */
    .hmp-action-buttons {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    
    .hmp-action-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 12px 8px;
      border-radius: 8px;
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      transition: transform 0.1s;
    }
    
    .hmp-action-btn:active {
      transform: scale(0.95);
    }
    
    .hmp-action-btn-phone {
      background: #22c55e;
      color: #fff;
    }
    
    .hmp-action-btn-phone.disabled {
      background: #3a3a5a;
      color: #666;
    }
    
    .hmp-action-btn-email {
      background: #3b82f6;
      color: #fff;
    }
    
    .hmp-action-btn-email.disabled {
      background: #3a3a5a;
      color: #666;
    }
    
    /* ========================================
       セクション
       ======================================== */
    .hmp-section {
      margin-bottom: 16px;
    }
    
    .hmp-section-title {
      font-size: 12px;
      font-weight: 600;
      color: #d4af37;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid rgba(212, 175, 55, 0.2);
    }
    
    .hmp-section-row {
      display: flex;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .hmp-section-label {
      font-size: 11px;
      color: #888;
      width: 70px;
      flex-shrink: 0;
    }
    
    .hmp-section-value {
      font-size: 12px;
      color: #f5f5f5;
      flex: 1;
      word-break: break-all;
    }
    
    .hmp-section-link {
      color: #3b82f6;
      text-decoration: none;
    }
    
    .hmp-section-link:hover {
      text-decoration: underline;
    }
    
    .hmp-referrer-link {
      color: #d4af37;
      text-decoration: underline;
      cursor: pointer;
    }
    
    /* ========================================
       個人特性タグ
       ======================================== */
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
    
    /* ========================================
       メモ
       ======================================== */
    .hmp-memo {
      font-size: 12px;
      color: #ccc;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    
    /* ========================================
       名刺
       ======================================== */
    .hmp-business-card {
      background: #252540;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
      cursor: pointer;
      transition: transform 0.2s;
    }
    
    .hmp-business-card:hover {
      transform: scale(1.02);
    }
    
    .hmp-business-card img {
      max-width: 100%;
      border-radius: 4px;
    }
    
    /* ========================================
       接点履歴
       ======================================== */
    .hmp-history-item {
      background: #252540;
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 6px;
    }
    
    .hmp-history-header {
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
      border-radius: 4px;
      background: rgba(212, 175, 55, 0.15);
      color: #d4af37;
    }
    
    .hmp-history-memo {
      font-size: 11px;
      color: #ccc;
      line-height: 1.5;
    }
    
    .hmp-history-empty {
      text-align: center;
      color: #666;
      padding: 16px;
      font-size: 12px;
    }
    
    .hmp-history-add-btn {
      width: 100%;
      background: transparent;
      border: 1px dashed #3a3a5a;
      border-radius: 6px;
      padding: 12px;
      color: #d4af37;
      font-size: 12px;
      cursor: pointer;
      margin-top: 8px;
      transition: border-color 0.2s;
    }
    
    .hmp-history-add-btn:hover {
      border-color: #d4af37;
    }
    
    /* ========================================
       フィルター画面
       ======================================== */
    .hmp-filter-content {
      padding: 16px 12px;
    }
    
    .hmp-filter-group {
      margin-bottom: 16px;
    }
    
    .hmp-filter-label {
      font-size: 12px;
      color: #d4af37;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    .hmp-filter-select {
      width: 100%;
      background: #252540;
      border: 1px solid #3a3a5a;
      border-radius: 6px;
      padding: 12px;
      font-size: 14px;
      color: #f5f5f5;
      outline: none;
    }
    
    .hmp-filter-actions {
      display: flex;
      gap: 10px;
      margin-top: 24px;
    }
    
    .hmp-filter-btn-clear {
      flex: 1;
      padding: 12px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      background: #252540;
      border: 1px solid #3a3a5a;
      color: #f5f5f5;
      cursor: pointer;
    }
    
    .hmp-filter-btn-apply {
      flex: 1;
      padding: 12px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      background: linear-gradient(135deg, #d4af37, #b8941f);
      border: none;
      color: #1a1a1a;
      cursor: pointer;
    }
    
    /* ========================================
       編集画面
       ======================================== */
    .hmp-edit-content {
      padding: 12px;
    }
    
    .hmp-edit-photo {
      text-align: center;
      margin-bottom: 16px;
    }
    
    .hmp-edit-photo-preview {
      width: 72px;
      height: 72px;
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
      background: transparent;
      border: 1px solid rgba(212, 175, 55, 0.5);
      color: #d4af37;
      padding: 6px 14px;
      border-radius: 14px;
      font-size: 11px;
      cursor: pointer;
    }
    
    .hmp-edit-section {
      margin-bottom: 20px;
    }
    
    .hmp-edit-section-title {
      font-size: 12px;
      font-weight: 600;
      color: #d4af37;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(212, 175, 55, 0.2);
    }
    
    .hmp-edit-group {
      margin-bottom: 14px;
    }
    
    .hmp-edit-label {
      font-size: 11px;
      color: #888;
      margin-bottom: 6px;
    }
    
    .hmp-edit-required {
      color: #ef4444;
    }
    
    .hmp-edit-input {
      width: 100%;
      background: #252540;
      border: 1px solid #3a3a5a;
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 14px;
      color: #f5f5f5;
      outline: none;
      transition: border-color 0.2s;
    }
    
    .hmp-edit-input:focus {
      border-color: #d4af37;
    }
    
    .hmp-edit-input::placeholder {
      color: #666;
    }
    
    .hmp-edit-textarea {
      min-height: 80px;
      resize: vertical;
    }
    
    .hmp-edit-select {
      width: 100%;
      background: #252540;
      border: 1px solid #3a3a5a;
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 14px;
      color: #f5f5f5;
      outline: none;
    }
    
    /* ========================================
       紹介者検索
       ======================================== */
    .hmp-referrer-container {
      position: relative;
    }
    
    .hmp-referrer-clear {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #888;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      font-size: 14px;
      cursor: pointer;
      display: none;
    }
    
    .hmp-referrer-clear.show {
      display: block;
    }
    
    .hmp-referrer-dropdown {
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: #252540;
      border: 1px solid #3a3a5a;
      border-top: none;
      border-radius: 0 0 6px 6px;
      max-height: 200px;
      overflow-y: auto;
      z-index: 100;
    }
    
    .hmp-referrer-dropdown.active {
      display: block;
    }
    
    .hmp-referrer-item {
      padding: 10px 12px;
      border-bottom: 1px solid #3a3a5a;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .hmp-referrer-item:last-child {
      border-bottom: none;
    }
    
    .hmp-referrer-item:hover {
      background: #2d2d50;
    }
    
    .hmp-referrer-item-name {
      font-size: 13px;
      color: #f5f5f5;
    }
    
    .hmp-referrer-item-company {
      font-size: 10px;
      color: #888;
      margin-top: 2px;
    }
    
    .hmp-referrer-no-results {
      padding: 16px;
      text-align: center;
      color: #888;
      font-size: 12px;
    }
    
    /* ========================================
       重複警告
       ======================================== */
    .hmp-duplicate-warning {
      display: none;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 12px;
      font-size: 12px;
      color: #ef4444;
    }
    
    .hmp-duplicate-warning.show {
      display: block;
    }
    
    /* ========================================
       個人特性チェックボックス
       ======================================== */
    .hmp-personality-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    
    .hmp-personality-item {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #252540;
      padding: 6px 10px;
      border-radius: 6px;
    }
    
    .hmp-personality-item input {
      width: 16px;
      height: 16px;
    }
    
    .hmp-personality-item label {
      font-size: 12px;
      color: #f5f5f5;
    }
    
    /* ========================================
       名刺写真編集
       ======================================== */
    .hmp-bc-preview {
      background: #252540;
      border-radius: 6px;
      padding: 16px;
      text-align: center;
      margin-bottom: 8px;
    }
    
    .hmp-bc-preview img {
      max-width: 100%;
      border-radius: 4px;
    }
    
    .hmp-bc-placeholder {
      font-size: 12px;
      color: #666;
    }
    
    .hmp-bc-add-btn {
      width: 100%;
      background: transparent;
      border: 1px dashed #3a3a5a;
      border-radius: 6px;
      padding: 10px;
      color: #888;
      font-size: 12px;
      cursor: pointer;
    }
    
    /* ========================================
       削除ボタン
       ======================================== */
    .hmp-delete-btn {
      width: 100%;
      background: transparent;
      border: 1px solid #ef4444;
      color: #ef4444;
      padding: 12px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      margin-top: 24px;
      transition: background 0.2s;
    }
    
    .hmp-delete-btn:hover {
      background: rgba(239, 68, 68, 0.1);
    }
    
    /* ========================================
       接点追加フォーム
       ======================================== */
    .hmp-contact-form {
      padding: 12px;
    }
    
    .hmp-contact-group {
      margin-bottom: 14px;
    }
    
    .hmp-contact-label {
      font-size: 11px;
      color: #d4af37;
      margin-bottom: 6px;
    }
    
    /* ========================================
       写真モーダル
       ======================================== */
    .hmp-photo-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.95);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s;
    }
    
    .hmp-photo-modal.active {
      opacity: 1;
    }
    
    .hmp-photo-modal img {
      max-width: 95%;
      max-height: 90%;
      object-fit: contain;
      border-radius: 8px;
    }
    
    .hmp-photo-modal-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #fff;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      font-size: 28px;
      cursor: pointer;
      z-index: 10;
    }
    
    .hmp-photo-modal-loading {
      color: #d4af37;
      font-size: 14px;
    }
    
    .hmp-photo-modal-error {
      color: #ef4444;
      font-size: 14px;
    }
    `;
    
    document.head.appendChild(style);
  };

  // ========================================
  //  データ取得
  // ========================================
  
  const fetchAllRecords = async () => {
    const records = [];
    let offset = 0;
    
    while (true) {
      const resp = await kintone.api('/k/v1/records', 'GET', {
        app: CONFIG.APP_ID,
        query: `order by ${CONFIG.FIELDS.KANA_NAME} asc limit 500 offset ${offset}`,
      });
      
      records.push(...resp.records);
      
      if (resp.records.length < 500) break;
      offset += 500;
    }
    
    return records;
  };

  // ========================================
  //  フォームオプション読み込み
  // ========================================
  
  const loadFormOptions = async () => {
    try {
      const resp = await kintone.api('/k/v1/app/form/fields', 'GET', { app: CONFIG.APP_ID });
      
      // 業種
      const industryField = resp.properties[CONFIG.FIELDS.INDUSTRY];
      if (industryField && industryField.options) {
        industryOptions = Object.keys(industryField.options)
          .filter(k => k)
          .sort((a, b) => parseInt(industryField.options[a].index) - parseInt(industryField.options[b].index));
      }
      
      // 個人特性
      const personalityField = resp.properties[CONFIG.FIELDS.PERSONALITY];
      if (personalityField && personalityField.options) {
        personalityOptions = Object.keys(personalityField.options)
          .filter(k => k)
          .sort((a, b) => parseInt(personalityField.options[a].index) - parseInt(personalityField.options[b].index));
      }
      
      // 接点種別（サブテーブル内）
      const subtableField = resp.properties[CONFIG.FIELDS.CONTACT_HISTORY];
      if (subtableField && subtableField.fields) {
        const contactTypeField = subtableField.fields[CONFIG.FIELDS.CONTACT_TYPE];
        if (contactTypeField && contactTypeField.options) {
          contactTypeOptions = Object.keys(contactTypeField.options)
            .filter(k => k)
            .sort((a, b) => parseInt(contactTypeField.options[a].index) - parseInt(contactTypeField.options[b].index));
        }
      }
    } catch (e) {
      console.error('フォームオプション読み込みエラー:', e);
    }
  };

  // ========================================
  //  紹介者オプション読み込み
  // ========================================
  
  const loadReferrerOptions = () => {
    referrerOptions = allRecords
      .map(r => ({
        id: Utils.getFieldValue(r, '$id'),
        name: Utils.getFieldValue(r, CONFIG.FIELDS.NAME),
        company: Utils.getFieldValue(r, CONFIG.FIELDS.COMPANY),
      }))
      .filter(r => r.name);
  };

  // ========================================
  //  重複チェック
  // ========================================
  
  const isDuplicateName = (name, excludeId = null) => {
    if (!name) return false;
    const lower = name.toLowerCase().trim();
    return allRecords.some(r => {
      const n = Utils.getFieldValue(r, CONFIG.FIELDS.NAME);
      const id = Utils.getFieldValue(r, '$id');
      if (excludeId && id === excludeId) return false;
      return n && n.toLowerCase().trim() === lower;
    });
  };

  // ========================================
  //  フィルター適用
  // ========================================
  
  const applyFilters = () => {
    filteredRecords = allRecords.filter(r => {
      // お付き合い度合い
      if (currentRelationshipFilter !== 'all') {
        if (Utils.getFieldValue(r, CONFIG.FIELDS.RELATIONSHIP) !== currentRelationshipFilter) {
          return false;
        }
      }
      
      // 業種
      if (currentIndustryFilter !== 'all') {
        if (Utils.getFieldValue(r, CONFIG.FIELDS.INDUSTRY) !== currentIndustryFilter) {
          return false;
        }
      }
      
      // 検索
      if (currentSearch) {
        const s = currentSearch.toLowerCase();
        const name = Utils.getFieldValue(r, CONFIG.FIELDS.NAME).toLowerCase();
        const kana = Utils.getFieldValue(r, CONFIG.FIELDS.KANA_NAME).toLowerCase();
        const company = Utils.getFieldValue(r, CONFIG.FIELDS.COMPANY).toLowerCase();
        const notes = Utils.getFieldValue(r, CONFIG.FIELDS.NOTES).toLowerCase();
        
        // サブテーブルのメモも検索
        const history = Utils.getFieldValue(r, CONFIG.FIELDS.CONTACT_HISTORY) || [];
        const historyMemo = history
          .map(h => (h.value[CONFIG.FIELDS.CONTACT_MEMO]?.value || '').toLowerCase())
          .join(' ');
        
        if (!name.includes(s) && !kana.includes(s) && !company.includes(s) && !notes.includes(s) && !historyMemo.includes(s)) {
          return false;
        }
      }
      
      return true;
    });
  };

  // ========================================
  //  一覧画面描画
  // ========================================
  
  const renderList = () => {
    const hasFilter = currentRelationshipFilter !== 'all' || currentIndustryFilter !== 'all';
    
    container.innerHTML = `
      <div class="hmp-container">
        <div class="hmp-header">
          <div class="hmp-header-title">人脈管理</div>
        </div>
        
        <div class="hmp-search-bar">
          <input type="search" class="hmp-search-input" id="hmp-search" 
            placeholder="名前・会社名・メモで検索..." value="${Utils.escapeHtml(currentSearch)}">
          <button class="hmp-filter-btn ${hasFilter ? 'active' : ''}" id="hmp-filter-btn">絞込</button>
        </div>
        
        <div class="hmp-count">${filteredRecords.length}件</div>
        
        <div class="hmp-list" id="hmp-list">
          ${filteredRecords.length === 0 ? `
            <div class="hmp-empty">
              <div class="hmp-empty-icon">🔍</div>
              <div class="hmp-empty-text">該当する人脈がありません</div>
            </div>
          ` : filteredRecords.map(r => {
            const id = Utils.getFieldValue(r, '$id');
            const name = Utils.getFieldValue(r, CONFIG.FIELDS.NAME);
            const company = Utils.getFieldValue(r, CONFIG.FIELDS.COMPANY);
            const position = Utils.getFieldValue(r, CONFIG.FIELDS.POSITION);
            const rel = Utils.getFieldValue(r, CONFIG.FIELDS.RELATIONSHIP);
            const color = Utils.getRelationshipColor(rel);
            const lastContact = Utils.getFieldValue(r, CONFIG.FIELDS.LAST_CONTACT);
            const lastType = Utils.getFieldValue(r, CONFIG.FIELDS.LAST_CONTACT_TYPE);
            const notes = Utils.getFieldValue(r, CONFIG.FIELDS.NOTES);
            const photo = Utils.getFieldValue(r, CONFIG.FIELDS.PHOTO);
            const fileKey = photo && photo.length > 0 ? photo[0].fileKey : '';
            const cached = fileKey ? Utils._fileUrlCache[fileKey] : '';
            const contactText = lastContact 
              ? `${lastType ? lastType + ' ' : ''}${Utils.formatDateShort(lastContact)}`
              : '接点なし';
            const shortNotes = notes ? (notes.length > 25 ? notes.substring(0, 25) + '...' : notes) : '';
            
            return `
              <div class="hmp-card" data-id="${id}" style="border-left-color: ${color}">
                <div class="hmp-card-avatar" data-key="${fileKey}" 
                  style="background-color: ${color}; ${cached ? `background-image: url('${cached}'); color: transparent;` : ''}">
                  ${Utils.getInitial(name)}
                </div>
                <div class="hmp-card-content">
                  <div class="hmp-card-name">${Utils.escapeHtml(name)}</div>
                  <div class="hmp-card-company">${Utils.escapeHtml(company)}${position ? ' / ' + Utils.escapeHtml(position) : ''}</div>
                  ${shortNotes ? `<div class="hmp-card-memo">${Utils.escapeHtml(shortNotes)}</div>` : ''}
                  <div class="hmp-card-meta">
                    <span class="hmp-card-badge" style="background-color: ${color}">${rel || '未設定'}</span>
                    <span class="hmp-card-contact">${contactText}</span>
                  </div>
                </div>
                <div class="hmp-card-arrow">›</div>
              </div>
            `;
          }).join('')}
        </div>
        
        <div class="hmp-add-btn" id="hmp-add-btn">＋ 新しい人脈を追加</div>
      </div>
    `;
    
    // イベント設定
    document.getElementById('hmp-search').addEventListener('input', (e) => {
      currentSearch = e.target.value;
      applyFilters();
      renderList();
    });
    
    document.getElementById('hmp-filter-btn').addEventListener('click', () => {
      renderFilter();
    });
    
    document.getElementById('hmp-add-btn').addEventListener('click', () => {
      selectedPhotoFile = null;
      selectedBusinessCardFile = null;
      editRecord = null;
      renderEdit(null);
    });
    
    // カードクリック
    document.querySelectorAll('.hmp-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const record = allRecords.find(r => Utils.getFieldValue(r, '$id') === id);
        if (record) renderDetail(record);
      });
    });
    
    // 画像遅延読み込み
    document.querySelectorAll('.hmp-card-avatar').forEach(async (el) => {
      const key = el.dataset.key;
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
  //  フィルター画面描画
  // ========================================
  
  const renderFilter = () => {
    container.innerHTML = `
      <div class="hmp-container">
        <div class="hmp-header">
          <button class="hmp-header-btn hmp-header-btn-icon" id="hmp-back">←</button>
          <div class="hmp-header-title">絞り込み</div>
          <div style="width: 32px;"></div>
        </div>
        
        <div class="hmp-filter-content">
          <div class="hmp-filter-group">
            <div class="hmp-filter-label">お付き合い度合い</div>
            <select class="hmp-filter-select" id="hmp-rel-filter">
              <option value="all" ${currentRelationshipFilter === 'all' ? 'selected' : ''}>すべて</option>
              ${CONFIG.RELATIONSHIP_ORDER.map(rel => `
                <option value="${rel}" ${currentRelationshipFilter === rel ? 'selected' : ''}>${rel}</option>
              `).join('')}
            </select>
          </div>
          
          <div class="hmp-filter-group">
            <div class="hmp-filter-label">業種</div>
            <select class="hmp-filter-select" id="hmp-ind-filter">
              <option value="all" ${currentIndustryFilter === 'all' ? 'selected' : ''}>すべて</option>
              ${industryOptions.map(opt => `
                <option value="${opt}" ${currentIndustryFilter === opt ? 'selected' : ''}>${opt}</option>
              `).join('')}
            </select>
          </div>
          
          <div class="hmp-filter-actions">
            <button class="hmp-filter-btn-clear" id="hmp-filter-clear">クリア</button>
            <button class="hmp-filter-btn-apply" id="hmp-filter-apply">適用</button>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('hmp-back').addEventListener('click', () => renderList());
    
    document.getElementById('hmp-filter-clear').addEventListener('click', () => {
      document.getElementById('hmp-rel-filter').value = 'all';
      document.getElementById('hmp-ind-filter').value = 'all';
    });
    
    document.getElementById('hmp-filter-apply').addEventListener('click', () => {
      currentRelationshipFilter = document.getElementById('hmp-rel-filter').value;
      currentIndustryFilter = document.getElementById('hmp-ind-filter').value;
      applyFilters();
      renderList();
    });
  };


  // ========================================
  //  詳細画面描画
  // ========================================
  
  const renderDetail = async (record) => {
    currentRecord = record;
    
    const id = Utils.getFieldValue(record, '$id');
    const name = Utils.getFieldValue(record, CONFIG.FIELDS.NAME);
    const company = Utils.getFieldValue(record, CONFIG.FIELDS.COMPANY);
    const position = Utils.getFieldValue(record, CONFIG.FIELDS.POSITION);
    const phone = Utils.getFieldValue(record, CONFIG.FIELDS.PHONE);
    const email = Utils.getFieldValue(record, CONFIG.FIELDS.EMAIL);
    const postalCode = Utils.getFieldValue(record, CONFIG.FIELDS.POSTAL_CODE);
    const address = Utils.getFieldValue(record, CONFIG.FIELDS.ADDRESS);
    const hp = Utils.getFieldValue(record, CONFIG.FIELDS.HP);
    const facebook = Utils.getFieldValue(record, CONFIG.FIELDS.FACEBOOK);
    const instagram = Utils.getFieldValue(record, CONFIG.FIELDS.INSTAGRAM);
    const rel = Utils.getFieldValue(record, CONFIG.FIELDS.RELATIONSHIP);
    const industry = Utils.getFieldValue(record, CONFIG.FIELDS.INDUSTRY);
    const personality = Utils.getFieldValue(record, CONFIG.FIELDS.PERSONALITY) || [];
    const referrer = Utils.getFieldValue(record, CONFIG.FIELDS.REFERRER);
    const referrerId = Utils.getFieldValue(record, CONFIG.FIELDS.REFERRER_ID);
    const notes = Utils.getFieldValue(record, CONFIG.FIELDS.NOTES);
    const birthday = Utils.getFieldValue(record, CONFIG.FIELDS.BIRTHDAY);
    const photo = Utils.getFieldValue(record, CONFIG.FIELDS.PHOTO);
    const businessCard = Utils.getFieldValue(record, CONFIG.FIELDS.BUSINESS_CARD);
    const history = Utils.getFieldValue(record, CONFIG.FIELDS.CONTACT_HISTORY) || [];
    const color = Utils.getRelationshipColor(rel);
    const fileKey = photo && photo.length > 0 ? photo[0].fileKey : '';
    const bcFileKey = businessCard && businessCard.length > 0 ? businessCard[0].fileKey : '';
    const cached = fileKey ? Utils._fileUrlCache[fileKey] : '';
    
    // 有効な接点履歴（日付があるもの）
    const validHistory = history
      .filter(h => h.value[CONFIG.FIELDS.CONTACT_DATE]?.value)
      .sort((a, b) => (b.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '').localeCompare(a.value[CONFIG.FIELDS.CONTACT_DATE]?.value || ''));
    
    container.innerHTML = `
      <div class="hmp-container">
        <div class="hmp-header">
          <button class="hmp-header-btn hmp-header-btn-icon" id="hmp-back">←</button>
          <div class="hmp-header-title">詳細</div>
          <button class="hmp-header-btn" id="hmp-edit-btn">編集</button>
        </div>
        
        <div class="hmp-detail">
          <!-- プロフィール -->
          <div class="hmp-detail-profile">
            <div class="hmp-detail-avatar" id="hmp-avatar" data-key="${fileKey}"
              style="background-color: ${color}; ${cached ? `background-image: url('${cached}'); color: transparent;` : ''}">
              ${Utils.getInitial(name)}
            </div>
            <div class="hmp-detail-info">
              <div class="hmp-detail-name">${Utils.escapeHtml(name)}</div>
              <div class="hmp-detail-company">${Utils.escapeHtml(company)}${position ? ' / ' + Utils.escapeHtml(position) : ''}</div>
              <div class="hmp-detail-badge" style="background-color: ${color}">${rel || '未設定'}</div>
            </div>
          </div>
          
          <!-- アクションボタン -->
          <div class="hmp-action-buttons">
            <a href="${phone ? 'tel:' + phone : 'javascript:void(0)'}" 
              class="hmp-action-btn hmp-action-btn-phone ${phone ? '' : 'disabled'}">
              <span>📞</span><span>電話</span>
            </a>
            <a href="${email ? 'mailto:' + email : 'javascript:void(0)'}" 
              class="hmp-action-btn hmp-action-btn-email ${email ? '' : 'disabled'}">
              <span>✉️</span><span>メール</span>
            </a>
          </div>
          
          <!-- 基本情報 -->
          <div class="hmp-section">
            <div class="hmp-section-title">基本情報</div>
            ${phone ? `
              <div class="hmp-section-row">
                <div class="hmp-section-label">電話</div>
                <div class="hmp-section-value">${Utils.escapeHtml(phone)}</div>
              </div>
            ` : ''}
            ${email ? `
              <div class="hmp-section-row">
                <div class="hmp-section-label">メール</div>
                <div class="hmp-section-value">${Utils.escapeHtml(email)}</div>
              </div>
            ` : ''}
            ${birthday ? `
              <div class="hmp-section-row">
                <div class="hmp-section-label">誕生日</div>
                <div class="hmp-section-value">${Utils.formatDate(birthday)}</div>
              </div>
            ` : ''}
            ${(postalCode || address) ? `
              <div class="hmp-section-row">
                <div class="hmp-section-label">住所</div>
                <div class="hmp-section-value">${postalCode ? '〒' + Utils.escapeHtml(postalCode) + ' ' : ''}${Utils.escapeHtml(address)}</div>
              </div>
            ` : ''}
            ${industry ? `
              <div class="hmp-section-row">
                <div class="hmp-section-label">業種</div>
                <div class="hmp-section-value">${Utils.escapeHtml(industry)}</div>
              </div>
            ` : ''}
            ${referrer ? `
              <div class="hmp-section-row">
                <div class="hmp-section-label">紹介者</div>
                <div class="hmp-section-value">
                  ${referrerId 
                    ? `<span class="hmp-referrer-link" id="hmp-referrer-link" data-id="${referrerId}">${Utils.escapeHtml(referrer)}</span>`
                    : Utils.escapeHtml(referrer)
                  }
                </div>
              </div>
            ` : ''}
          </div>
          
          <!-- SNS・Web -->
          ${(hp || facebook || instagram) ? `
            <div class="hmp-section">
              <div class="hmp-section-title">SNS・Web</div>
              ${hp ? `
                <div class="hmp-section-row">
                  <div class="hmp-section-label">HP</div>
                  <div class="hmp-section-value">
                    <a href="${Utils.escapeHtml(hp)}" target="_blank" class="hmp-section-link">${Utils.escapeHtml(hp)}</a>
                  </div>
                </div>
              ` : ''}
              ${facebook ? `
                <div class="hmp-section-row">
                  <div class="hmp-section-label">Facebook</div>
                  <div class="hmp-section-value">
                    <a href="${Utils.escapeHtml(facebook)}" target="_blank" class="hmp-section-link">${Utils.escapeHtml(facebook)}</a>
                  </div>
                </div>
              ` : ''}
              ${instagram ? `
                <div class="hmp-section-row">
                  <div class="hmp-section-label">Instagram</div>
                  <div class="hmp-section-value">
                    <a href="${Utils.escapeHtml(instagram)}" target="_blank" class="hmp-section-link">${Utils.escapeHtml(instagram)}</a>
                  </div>
                </div>
              ` : ''}
            </div>
          ` : ''}
          
          <!-- 個人特性 -->
          ${personality.length > 0 ? `
            <div class="hmp-section">
              <div class="hmp-section-title">個人特性</div>
              <div class="hmp-tags">
                ${personality.map(p => `<span class="hmp-tag">${Utils.escapeHtml(p)}</span>`).join('')}
              </div>
            </div>
          ` : ''}
          
          <!-- メモ -->
          ${notes ? `
            <div class="hmp-section">
              <div class="hmp-section-title">メモ</div>
              <div class="hmp-memo">${Utils.escapeHtml(notes)}</div>
            </div>
          ` : ''}
          
          <!-- 名刺 -->
          ${bcFileKey ? `
            <div class="hmp-section">
              <div class="hmp-section-title">名刺</div>
              <div class="hmp-business-card" id="hmp-bc" data-key="${bcFileKey}">
                <div style="color: #888; font-size: 12px;">読み込み中...</div>
              </div>
            </div>
          ` : ''}
          
          <!-- 接点履歴 -->
          <div class="hmp-section">
            <div class="hmp-section-title">接点履歴</div>
            ${validHistory.length > 0 
              ? validHistory.map(h => {
                  const date = h.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '';
                  const type = h.value[CONFIG.FIELDS.CONTACT_TYPE]?.value || '';
                  const memo = h.value[CONFIG.FIELDS.CONTACT_MEMO]?.value || '';
                  return `
                    <div class="hmp-history-item">
                      <div class="hmp-history-header">
                        <span class="hmp-history-date">${Utils.formatDate(date)}</span>
                        ${type ? `<span class="hmp-history-type">${Utils.escapeHtml(type)}</span>` : ''}
                      </div>
                      ${memo ? `<div class="hmp-history-memo">${Utils.escapeHtml(memo)}</div>` : ''}
                    </div>
                  `;
                }).join('')
              : `<div class="hmp-history-empty">接点履歴がありません</div>`
            }
            <button class="hmp-history-add-btn" id="hmp-add-contact">+ 接点を追加</button>
          </div>
        </div>
      </div>
    `;
    
    // イベント設定
    document.getElementById('hmp-back').addEventListener('click', () => renderList());
    document.getElementById('hmp-edit-btn').addEventListener('click', () => {
      selectedPhotoFile = null;
      selectedBusinessCardFile = null;
      renderEdit(record);
    });
    document.getElementById('hmp-add-contact').addEventListener('click', () => renderContactForm(record));
    
    // 写真タップで拡大
    const avatar = document.getElementById('hmp-avatar');
    if (avatar && fileKey) {
      avatar.addEventListener('click', () => Utils.showPhotoModal(fileKey));
    }
    
    // 写真読み込み
    if (fileKey && !cached) {
      const url = await Utils.getFileUrl(fileKey);
      if (url) {
        avatar.style.backgroundImage = `url('${url}')`;
        avatar.style.color = 'transparent';
      }
    }
    
    // 名刺読み込み
    if (bcFileKey) {
      const bcEl = document.getElementById('hmp-bc');
      const bcUrl = await Utils.getFileUrl(bcFileKey);
      if (bcUrl) {
        bcEl.innerHTML = `<img src="${bcUrl}" alt="名刺">`;
        bcEl.addEventListener('click', () => Utils.showPhotoModal(bcFileKey));
      }
    }
    
    // 紹介者リンク
    const refLink = document.getElementById('hmp-referrer-link');
    if (refLink) {
      refLink.addEventListener('click', () => {
        const refId = refLink.dataset.id;
        const refRecord = allRecords.find(r => Utils.getFieldValue(r, '$id') === refId);
        if (refRecord) renderDetail(refRecord);
      });
    }
  };

  // ========================================
  //  接点追加画面描画
  // ========================================
  
  const renderContactForm = (record) => {
    currentRecord = record;
    
    container.innerHTML = `
      <div class="hmp-container">
        <div class="hmp-header">
          <button class="hmp-header-btn hmp-header-btn-icon" id="hmp-back">←</button>
          <div class="hmp-header-title">接点追加</div>
          <button class="hmp-header-btn" id="hmp-save">保存</button>
        </div>
        
        <div class="hmp-contact-form">
          <div class="hmp-contact-group">
            <div class="hmp-contact-label">接点日</div>
            <input type="date" class="hmp-edit-input" id="hmp-contact-date" value="${Utils.getTodayString()}">
          </div>
          
          <div class="hmp-contact-group">
            <div class="hmp-contact-label">種別</div>
            <select class="hmp-edit-select" id="hmp-contact-type">
              ${contactTypeOptions.map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>
          </div>
          
          <div class="hmp-contact-group">
            <div class="hmp-contact-label">メモ</div>
            <textarea class="hmp-edit-input hmp-edit-textarea" id="hmp-contact-memo" placeholder="接点の内容..."></textarea>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('hmp-back').addEventListener('click', () => renderDetail(record));
    document.getElementById('hmp-save').addEventListener('click', () => saveContact());
  };

  // ========================================
  //  接点保存
  // ========================================
  
  const saveContact = async () => {
    const id = Utils.getFieldValue(currentRecord, '$id');
    const date = document.getElementById('hmp-contact-date').value;
    const type = document.getElementById('hmp-contact-type').value;
    const memo = document.getElementById('hmp-contact-memo').value;
    
    if (!date) {
      alert('接点日を入力してください');
      return;
    }
    
    try {
      // 最新のレコードを取得
      const resp = await kintone.api('/k/v1/record', 'GET', { app: CONFIG.APP_ID, id: id });
      const history = resp.record[CONFIG.FIELDS.CONTACT_HISTORY]?.value || [];
      
      // 新しい接点を追加
      history.push({
        value: {
          [CONFIG.FIELDS.CONTACT_DATE]: { value: date },
          [CONFIG.FIELDS.CONTACT_TYPE]: { value: type },
          [CONFIG.FIELDS.CONTACT_MEMO]: { value: memo },
        }
      });
      
      // 有効な履歴のみ
      const validHistory = history.filter(h => h.value[CONFIG.FIELDS.CONTACT_DATE]?.value);
      validHistory.sort((a, b) => (b.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '').localeCompare(a.value[CONFIG.FIELDS.CONTACT_DATE]?.value || ''));
      
      // 最新の接点情報
      const latest = validHistory[0];
      const latestDate = latest?.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '';
      const latestType = latest?.value[CONFIG.FIELDS.CONTACT_TYPE]?.value || '';
      
      // 更新
      const updateData = {
        [CONFIG.FIELDS.CONTACT_HISTORY]: { value: validHistory },
        [CONFIG.FIELDS.LAST_CONTACT]: { value: latestDate },
        [CONFIG.FIELDS.LAST_CONTACT_TYPE]: { value: latestType },
        [CONFIG.FIELDS.CONTACT_COUNT]: { value: String(validHistory.length) },
      };
      
      await kintone.api('/k/v1/record', 'PUT', { app: CONFIG.APP_ID, id: id, record: updateData });
      
      // データ再取得
      allRecords = await fetchAllRecords();
      loadReferrerOptions();
      applyFilters();
      
      // 更新後のレコードで詳細画面を表示
      const updated = allRecords.find(r => Utils.getFieldValue(r, '$id') === id);
      if (updated) renderDetail(updated);
      
    } catch (e) {
      console.error('接点追加エラー:', e);
      alert('接点の追加に失敗しました: ' + (e.message || e));
    }
  };

  // ========================================
  //  編集画面描画
  // ========================================
  
  const renderEdit = async (record) => {
    editRecord = record;
    const isNew = !record;
    
    const getVal = (fieldCode) => record ? Utils.getFieldValue(record, fieldCode) : '';
    
    const name = getVal(CONFIG.FIELDS.NAME);
    const kanaName = getVal(CONFIG.FIELDS.KANA_NAME);
    const company = getVal(CONFIG.FIELDS.COMPANY);
    const position = getVal(CONFIG.FIELDS.POSITION);
    const phone = getVal(CONFIG.FIELDS.PHONE);
    const email = getVal(CONFIG.FIELDS.EMAIL);
    const postalCode = getVal(CONFIG.FIELDS.POSTAL_CODE);
    const address = getVal(CONFIG.FIELDS.ADDRESS);
    const hp = getVal(CONFIG.FIELDS.HP);
    const facebook = getVal(CONFIG.FIELDS.FACEBOOK);
    const instagram = getVal(CONFIG.FIELDS.INSTAGRAM);
    const birthday = getVal(CONFIG.FIELDS.BIRTHDAY);
    const rel = getVal(CONFIG.FIELDS.RELATIONSHIP);
    const industry = getVal(CONFIG.FIELDS.INDUSTRY);
    const personalityArray = getVal(CONFIG.FIELDS.PERSONALITY) || [];
    const referrer = getVal(CONFIG.FIELDS.REFERRER);
    const referrerId = getVal(CONFIG.FIELDS.REFERRER_ID);
    const notes = getVal(CONFIG.FIELDS.NOTES);
    const photo = getVal(CONFIG.FIELDS.PHOTO);
    const businessCard = getVal(CONFIG.FIELDS.BUSINESS_CARD);
    const fileKey = photo && photo.length > 0 ? photo[0].fileKey : '';
    const bcFileKey = businessCard && businessCard.length > 0 ? businessCard[0].fileKey : '';
    
    container.innerHTML = `
      <div class="hmp-container">
        <div class="hmp-header">
          <button class="hmp-header-btn" id="hmp-cancel">キャンセル</button>
          <div class="hmp-header-title">${isNew ? '新規追加' : '編集'}</div>
          <button class="hmp-header-btn" id="hmp-save">保存</button>
        </div>
        
        <div class="hmp-edit-content">
          <!-- 写真 -->
          <div class="hmp-edit-photo">
            <div class="hmp-edit-photo-preview" id="hmp-photo-preview">📷</div>
            <br>
            <button class="hmp-edit-photo-btn" id="hmp-photo-btn">写真を変更</button>
            <input type="file" id="hmp-photo-input" accept="image/*" style="display: none;">
          </div>
          
          <!-- 重複警告 -->
          ${isNew ? '<div class="hmp-duplicate-warning" id="hmp-duplicate-warning">⚠️ 同じ名前の人脈が既に登録されています</div>' : ''}
          
          <!-- 基本情報 -->
          <div class="hmp-edit-section">
            <div class="hmp-edit-section-title">基本情報</div>
            
            <div class="hmp-edit-group">
              <div class="hmp-edit-label">名前 <span class="hmp-edit-required">*</span></div>
              <input type="text" class="hmp-edit-input" id="hmp-name" value="${Utils.escapeHtml(name)}">
            </div>
            
            <div class="hmp-edit-group">
              <div class="hmp-edit-label">ふりがな</div>
              <input type="text" class="hmp-edit-input" id="hmp-kana" value="${Utils.escapeHtml(kanaName)}">
            </div>
            
            <div class="hmp-edit-group">
              <div class="hmp-edit-label">会社名</div>
              <input type="text" class="hmp-edit-input" id="hmp-company" value="${Utils.escapeHtml(company)}">
            </div>
            
            <div class="hmp-edit-group">
              <div class="hmp-edit-label">役職</div>
              <input type="text" class="hmp-edit-input" id="hmp-position" value="${Utils.escapeHtml(position)}">
            </div>
          </div>
          
          <!-- 連絡先 -->
          <div class="hmp-edit-section">
            <div class="hmp-edit-section-title">連絡先</div>
            
            <div class="hmp-edit-group">
              <div class="hmp-edit-label">電話番号</div>
              <input type="tel" class="hmp-edit-input" id="hmp-phone" value="${Utils.escapeHtml(phone)}">
            </div>
            
            <div class="hmp-edit-group">
              <div class="hmp-edit-label">メールアドレス</div>
              <input type="email" class="hmp-edit-input" id="hmp-email" value="${Utils.escapeHtml(email)}">
            </div>
            
            <div class="hmp-edit-group">
              <div class="hmp-edit-label">郵便番号</div>
              <input type="text" class="hmp-edit-input" id="hmp-postal" placeholder="000-0000" value="${Utils.escapeHtml(postalCode)}">
            </div>
            
            <div class="hmp-edit-group">
              <div class="hmp-edit-label">住所</div>
              <input type="text" class="hmp-edit-input" id="hmp-address" value="${Utils.escapeHtml(address)}">
            </div>
            
            <div class="hmp-edit-group">
              <div class="hmp-edit-label">誕生日</div>
              <input type="date" class="hmp-edit-input" id="hmp-birthday" value="${birthday}">
            </div>
          </div>
          
          <!-- SNS・Web -->
          <div class="hmp-edit-section">
            <div class="hmp-edit-section-title">SNS・Web</div>
            
            <div class="hmp-edit-group">
              <div class="hmp-edit-label">HP</div>
              <input type="url" class="hmp-edit-input" id="hmp-hp" placeholder="https://..." value="${Utils.escapeHtml(hp)}">
            </div>
            
            <div class="hmp-edit-group">
              <div class="hmp-edit-label">Facebook</div>
              <input type="url" class="hmp-edit-input" id="hmp-facebook" placeholder="https://facebook.com/..." value="${Utils.escapeHtml(facebook)}">
            </div>
            
            <div class="hmp-edit-group">
              <div class="hmp-edit-label">Instagram</div>
              <input type="url" class="hmp-edit-input" id="hmp-instagram" placeholder="https://instagram.com/..." value="${Utils.escapeHtml(instagram)}">
            </div>
          </div>
          
          <!-- 分類 -->
          <div class="hmp-edit-section">
            <div class="hmp-edit-section-title">分類</div>
            
            <div class="hmp-edit-group">
              <div class="hmp-edit-label">お付き合い度合い</div>
              <select class="hmp-edit-select" id="hmp-rel">
                <option value="">選択してください</option>
                ${CONFIG.RELATIONSHIP_ORDER.map(r => `
                  <option value="${r}" ${rel === r ? 'selected' : ''}>${r}</option>
                `).join('')}
              </select>
            </div>
            
            <div class="hmp-edit-group">
              <div class="hmp-edit-label">業種</div>
              <select class="hmp-edit-select" id="hmp-industry">
                <option value="">選択してください</option>
                ${industryOptions.map(opt => `
                  <option value="${opt}" ${industry === opt ? 'selected' : ''}>${opt}</option>
                `).join('')}
              </select>
            </div>
            
            <!-- 紹介者検索 -->
            <div class="hmp-edit-group">
              <div class="hmp-edit-label">紹介者</div>
              <div class="hmp-referrer-container">
                <input type="text" class="hmp-edit-input" id="hmp-referrer-search" 
                  placeholder="紹介者名を入力して検索..." value="${Utils.escapeHtml(referrer)}">
                <input type="hidden" id="hmp-referrer-id" value="${referrerId}">
                <input type="hidden" id="hmp-referrer-name" value="${Utils.escapeHtml(referrer)}">
                <button type="button" class="hmp-referrer-clear ${referrerId ? 'show' : ''}" id="hmp-referrer-clear">×</button>
                <div class="hmp-referrer-dropdown" id="hmp-referrer-dropdown"></div>
              </div>
            </div>
          </div>
          
          <!-- 個人特性 -->
          ${personalityOptions.length > 0 ? `
            <div class="hmp-edit-section">
              <div class="hmp-edit-section-title">個人特性</div>
              <div class="hmp-personality-grid">
                ${personalityOptions.map(opt => `
                  <div class="hmp-personality-item">
                    <input type="checkbox" id="hmp-pers-${opt}" name="hmp-personality" value="${opt}" 
                      ${personalityArray.includes(opt) ? 'checked' : ''}>
                    <label for="hmp-pers-${opt}">${opt}</label>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          <!-- メモ -->
          <div class="hmp-edit-section">
            <div class="hmp-edit-section-title">メモ</div>
            <textarea class="hmp-edit-input hmp-edit-textarea" id="hmp-notes" placeholder="メモを入力...">${Utils.escapeHtml(notes)}</textarea>
          </div>
          
          <!-- 名刺写真 -->
          <div class="hmp-edit-section">
            <div class="hmp-edit-section-title">名刺写真</div>
            <div class="hmp-bc-preview" id="hmp-bc-preview">
              <div class="hmp-bc-placeholder">名刺写真なし</div>
            </div>
            <button class="hmp-bc-add-btn" id="hmp-bc-btn">+ 名刺写真を追加</button>
            <input type="file" id="hmp-bc-input" accept="image/*" style="display: none;">
          </div>
          
          <!-- 削除ボタン -->
          ${!isNew ? '<button class="hmp-delete-btn" id="hmp-delete">このデータを削除</button>' : ''}
        </div>
      </div>
    `;
    
    // 写真プレビュー読み込み
    const photoPreview = document.getElementById('hmp-photo-preview');
    if (fileKey) {
      const cached = Utils._fileUrlCache[fileKey];
      if (cached) {
        photoPreview.style.backgroundImage = `url('${cached}')`;
        photoPreview.textContent = '';
      } else {
        const url = await Utils.getFileUrl(fileKey);
        if (url) {
          photoPreview.style.backgroundImage = `url('${url}')`;
          photoPreview.textContent = '';
        }
      }
    }
    
    // 名刺プレビュー読み込み
    if (bcFileKey) {
      const bcPreview = document.getElementById('hmp-bc-preview');
      const bcUrl = await Utils.getFileUrl(bcFileKey);
      if (bcUrl) {
        bcPreview.innerHTML = `<img src="${bcUrl}">`;
      }
    }
    
    // イベント設定
    document.getElementById('hmp-cancel').addEventListener('click', () => {
      selectedPhotoFile = null;
      selectedBusinessCardFile = null;
      if (editRecord) renderDetail(editRecord);
      else renderList();
    });
    
    document.getElementById('hmp-save').addEventListener('click', () => saveRecord());
    
    // 写真選択
    document.getElementById('hmp-photo-btn').addEventListener('click', () => {
      document.getElementById('hmp-photo-input').click();
    });
    
    document.getElementById('hmp-photo-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        selectedPhotoFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
          photoPreview.style.backgroundImage = `url('${ev.target.result}')`;
          photoPreview.style.backgroundSize = 'cover';
          photoPreview.textContent = '';
        };
        reader.readAsDataURL(file);
      }
    });
    
    // 名刺選択
    document.getElementById('hmp-bc-btn').addEventListener('click', () => {
      document.getElementById('hmp-bc-input').click();
    });
    
    document.getElementById('hmp-bc-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        selectedBusinessCardFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
          document.getElementById('hmp-bc-preview').innerHTML = `<img src="${ev.target.result}">`;
        };
        reader.readAsDataURL(file);
      }
    });
    
    // 重複チェック
    if (isNew) {
      const nameInput = document.getElementById('hmp-name');
      const warningEl = document.getElementById('hmp-duplicate-warning');
      let timeout = null;
      
      nameInput.addEventListener('input', () => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          const val = nameInput.value.trim();
          if (val && isDuplicateName(val)) {
            warningEl.classList.add('show');
          } else {
            warningEl.classList.remove('show');
          }
        }, 300);
      });
    }
    
    // 紹介者検索
    const refSearch = document.getElementById('hmp-referrer-search');
    const refIdInput = document.getElementById('hmp-referrer-id');
    const refNameInput = document.getElementById('hmp-referrer-name');
    const refClearBtn = document.getElementById('hmp-referrer-clear');
    const refDropdown = document.getElementById('hmp-referrer-dropdown');
    let refTimeout = null;
    
    refSearch.addEventListener('input', () => {
      const query = refSearch.value.trim().toLowerCase();
      if (refTimeout) clearTimeout(refTimeout);
      
      refTimeout = setTimeout(() => {
        if (query.length < 2) {
          refDropdown.classList.remove('active');
          return;
        }
        
        const filtered = referrerOptions
          .filter(r => r.name.toLowerCase().includes(query) || (r.company && r.company.toLowerCase().includes(query)))
          .slice(0, 20);
        
        if (filtered.length === 0) {
          refDropdown.innerHTML = '<div class="hmp-referrer-no-results">該当する紹介者が見つかりません</div>';
        } else {
          refDropdown.innerHTML = filtered.map(r => `
            <div class="hmp-referrer-item" data-id="${r.id}" data-name="${Utils.escapeHtml(r.name)}">
              <div class="hmp-referrer-item-name">${Utils.escapeHtml(r.name)}</div>
              <div class="hmp-referrer-item-company">${r.company ? Utils.escapeHtml(r.company) : '会社名なし'}</div>
            </div>
          `).join('');
          
          // 選択イベント
          refDropdown.querySelectorAll('.hmp-referrer-item').forEach(item => {
            item.addEventListener('click', () => {
              const id = item.dataset.id;
              const name = item.dataset.name;
              refSearch.value = name;
              refIdInput.value = id;
              refNameInput.value = name;
              refDropdown.classList.remove('active');
              refClearBtn.classList.add('show');
            });
          });
        }
        
        refDropdown.classList.add('active');
      }, 200);
    });
    
    refSearch.addEventListener('focus', () => {
      if (refSearch.value.length >= 2) {
        refDropdown.classList.add('active');
      }
    });
    
    refClearBtn.addEventListener('click', () => {
      refSearch.value = '';
      refIdInput.value = '';
      refNameInput.value = '';
      refClearBtn.classList.remove('show');
      refDropdown.classList.remove('active');
    });
    
    // ドロップダウン外クリックで閉じる
    document.addEventListener('click', (e) => {
      if (!refSearch.contains(e.target) && !refDropdown.contains(e.target)) {
        refDropdown.classList.remove('active');
      }
    });
    
    // 削除ボタン
    if (!isNew) {
      document.getElementById('hmp-delete').addEventListener('click', () => deleteRecord());
    }
  };

  // ========================================
  //  レコード保存
  // ========================================
  
  const saveRecord = async () => {
    const isNew = !editRecord;
    const name = document.getElementById('hmp-name').value.trim();
    
    if (!name) {
      alert('名前を入力してください');
      return;
    }
    
    const data = {
      [CONFIG.FIELDS.NAME]: { value: name },
      [CONFIG.FIELDS.KANA_NAME]: { value: document.getElementById('hmp-kana').value },
      [CONFIG.FIELDS.COMPANY]: { value: document.getElementById('hmp-company').value },
      [CONFIG.FIELDS.POSITION]: { value: document.getElementById('hmp-position').value },
      [CONFIG.FIELDS.PHONE]: { value: document.getElementById('hmp-phone').value },
      [CONFIG.FIELDS.EMAIL]: { value: document.getElementById('hmp-email').value },
      [CONFIG.FIELDS.POSTAL_CODE]: { value: document.getElementById('hmp-postal').value },
      [CONFIG.FIELDS.ADDRESS]: { value: document.getElementById('hmp-address').value },
      [CONFIG.FIELDS.HP]: { value: document.getElementById('hmp-hp').value },
      [CONFIG.FIELDS.FACEBOOK]: { value: document.getElementById('hmp-facebook').value },
      [CONFIG.FIELDS.INSTAGRAM]: { value: document.getElementById('hmp-instagram').value },
      [CONFIG.FIELDS.BIRTHDAY]: { value: document.getElementById('hmp-birthday').value },
      [CONFIG.FIELDS.RELATIONSHIP]: { value: document.getElementById('hmp-rel').value },
      [CONFIG.FIELDS.INDUSTRY]: { value: document.getElementById('hmp-industry').value },
      [CONFIG.FIELDS.NOTES]: { value: document.getElementById('hmp-notes').value },
    };
    
    // 紹介者
    const refId = document.getElementById('hmp-referrer-id').value;
    const refName = document.getElementById('hmp-referrer-name').value || document.getElementById('hmp-referrer-search').value;
    data[CONFIG.FIELDS.REFERRER] = { value: refName };
    data[CONFIG.FIELDS.REFERRER_ID] = { value: refId };
    data[CONFIG.FIELDS.REFERRER_LINK] = { value: refId ? `${location.origin}/k/${CONFIG.APP_ID}/show#record=${refId}` : '' };
    
    // 個人特性
    const persChecks = document.querySelectorAll('input[name="hmp-personality"]:checked');
    const persValues = Array.from(persChecks).map(cb => cb.value);
    if (personalityOptions.length > 0) {
      data[CONFIG.FIELDS.PERSONALITY] = { value: persValues };
    }
    
    try {
      // 写真アップロード
      if (selectedPhotoFile) {
        const formData = new FormData();
        formData.append('__REQUEST_TOKEN__', kintone.getRequestToken());
        formData.append('file', selectedPhotoFile);
        
        const uploadResp = await fetch('/k/v1/file.json', {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          body: formData,
        });
        const uploadResult = await uploadResp.json();
        data[CONFIG.FIELDS.PHOTO] = { value: [{ fileKey: uploadResult.fileKey }] };
      }
      
      // 名刺アップロード
      if (selectedBusinessCardFile) {
        const formData = new FormData();
        formData.append('__REQUEST_TOKEN__', kintone.getRequestToken());
        formData.append('file', selectedBusinessCardFile);
        
        const uploadResp = await fetch('/k/v1/file.json', {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          body: formData,
        });
        const uploadResult = await uploadResp.json();
        data[CONFIG.FIELDS.BUSINESS_CARD] = { value: [{ fileKey: uploadResult.fileKey }] };
      }
      
      if (isNew) {
        await kintone.api('/k/v1/record', 'POST', { app: CONFIG.APP_ID, record: data });
      } else {
        const id = Utils.getFieldValue(editRecord, '$id');
        await kintone.api('/k/v1/record', 'PUT', { app: CONFIG.APP_ID, id: id, record: data });
      }
      
      // リセット
      selectedPhotoFile = null;
      selectedBusinessCardFile = null;
      
      // データ再取得
      allRecords = await fetchAllRecords();
      loadReferrerOptions();
      applyFilters();
      renderList();
      
    } catch (e) {
      console.error('保存エラー:', e);
      alert('保存に失敗しました: ' + (e.message || e));
    }
  };

  // ========================================
  //  レコード削除
  // ========================================
  
  const deleteRecord = async () => {
    if (!confirm('本当にこのデータを削除しますか？')) return;
    
    const id = Utils.getFieldValue(editRecord, '$id');
    
    try {
      await kintone.api('/k/v1/records', 'DELETE', { app: CONFIG.APP_ID, ids: [id] });
      
      allRecords = await fetchAllRecords();
      loadReferrerOptions();
      applyFilters();
      renderList();
      
    } catch (e) {
      console.error('削除エラー:', e);
      alert('削除に失敗しました: ' + (e.message || e));
    }
  };

  // ========================================
  //  初期化
  // ========================================
  
  const init = async (el) => {
    console.log('🌟 HIKARI Mobile People v10 initializing...');
    
    injectStyles();
    
    container = el;
    
    // ローディング表示
    container.innerHTML = `
      <div class="hmp-container">
        <div class="hmp-loading">
          <div class="hmp-loading-spinner"></div>
          <div class="hmp-loading-text">データを読み込み中...</div>
        </div>
      </div>
    `;
    
    try {
      // フォームオプションとデータを並列取得
      await Promise.all([
        loadFormOptions(),
        (async () => {
          allRecords = await fetchAllRecords();
        })(),
      ]);
      
      loadReferrerOptions();
      filteredRecords = [...allRecords];
      
      console.log(`✅ ${allRecords.length}件のデータを取得`);
      
      renderList();
      
      console.log('✅ HIKARI Mobile People v10 initialized');
      
    } catch (e) {
      console.error('❌ 初期化エラー:', e);
      container.innerHTML = `
        <div class="hmp-container">
          <div class="hmp-loading">
            <div style="font-size: 40px; margin-bottom: 16px;">⚠️</div>
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
    
    init(el);
    
    return event;
  });
  
  console.log('🌟 HIKARI Mobile People v10 script loaded');

})();
