/**
 * HIKARI - 人脈管理アプリカスタマイズ
 * カード一覧、詳細・編集・新規モーダル
 */

(function() {
  'use strict';

  // ========================================
  //  設定
  // ========================================
  
  const CONFIG = {
    APP_ID: 6,
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
      RELATIONSHIP: 'お付き合い度合い',
      LAST_CONTACT: 'last_contact_date',
      LAST_CONTACT_TYPE: 'last_contact_type',
      CONTACT_COUNT: 'contact_count',
      BIRTHDAY: 'birthday',
      NOTES: 'shokai_memo',
      PHOTO: '顔写真',
      BUSINESS_CARD: '名刺写真',
      INDUSTRY: '業種',
      // サブテーブル
      CONTACT_HISTORY: 'contact_history',
      CONTACT_DATE: 'contact_date',
      CONTACT_TYPE: 'contact_type',
      CONTACT_MEMO: 'contact_memo',
    },
    CONTACT_TYPES: ['対面', '電話', 'メール', 'LINE', 'SNS', 'その他'],
    RELATIONSHIP_COLORS: {
      '1.プライム': '#d4af37',
      '2.パワー': '#c0c0c0',
      '3.スタンダード': '#cd7f32',
      '4.フレンド': '#5b9bd5',
      '5.コネクト': '#888888',
    },
    RELATIONSHIP_ORDER: ['1.プライム', '2.パワー', '3.スタンダード', '4.フレンド', '5.コネクト'],
  };

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
        return field.value;
      }
      if (field.type === 'SUBTABLE') {
        return field.value;
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
    
    formatBirthday: (dateStr) => {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      if (parts.length >= 2) {
        return `${parseInt(parts[1])}月${parseInt(parts[2])}日`;
      }
      return dateStr;
    },
    
    getRelationshipColor: (rel) => {
      return CONFIG.RELATIONSHIP_COLORS[rel] || '#888';
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
        const url = kintone.api.url('/k/v1/file', true) + '?fileKey=' + fileKey;
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
      
      // 拡大表示用に新しくBlobURLを取得（キャッシュとは別）
      let url;
      try {
        const apiUrl = kintone.api.url('/k/v1/file', true) + '?fileKey=' + fileKey;
        const resp = await fetch(apiUrl, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        if (!resp.ok) return;
        const blob = await resp.blob();
        url = URL.createObjectURL(blob);
      } catch (e) {
        console.error('写真取得エラー:', e);
        return;
      }
      
      const modal = document.createElement('div');
      modal.className = 'hikari-photo-modal';
      modal.innerHTML = `
        <button class="hikari-photo-modal-close">&times;</button>
        <img src="${url}" alt="拡大写真">
      `;
      
      document.body.appendChild(modal);
      
      requestAnimationFrame(() => {
        modal.classList.add('active');
      });
      
      const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => {
          modal.remove();
          URL.revokeObjectURL(url); // この拡大用URLだけ解放
        }, 300);
        // イベントリスナー削除
        document.removeEventListener('keydown', handleKey);
        document.removeEventListener('wheel', handleWheel);
      };
      
      // 閉じるボタン
      modal.querySelector('.hikari-photo-modal-close').addEventListener('click', (e) => {
        e.stopPropagation();
        closeModal();
      });
      
      // 画像クリックでも閉じる
      modal.querySelector('img').addEventListener('click', (e) => {
        e.stopPropagation();
        closeModal();
      });
      
      // オーバーレイクリックで閉じる（ドラッグ対策）
      let mouseDownTarget = null;
      modal.addEventListener('mousedown', (e) => {
        mouseDownTarget = e.target;
      });
      modal.addEventListener('mouseup', (e) => {
        if (mouseDownTarget === modal && e.target === modal) {
          closeModal();
        }
        mouseDownTarget = null;
      });
      
      // ESCキーで閉じる
      const handleKey = (e) => {
        if (e.key === 'Escape') {
          closeModal();
        }
      };
      document.addEventListener('keydown', handleKey);
      
      // ホイールで縮小方向に回したら閉じる
      const handleWheel = (e) => {
        if (e.deltaY > 0) { // 下方向（縮小）
          closeModal();
        }
      };
      document.addEventListener('wheel', handleWheel, { passive: true });
    },
  };

  // ========================================
  //  スタイル注入
  // ========================================
  
  const injectStyles = () => {
    if (document.getElementById('hikari-people-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'hikari-people-styles';
    style.textContent = `
    /* ========== 基本 ========== */
    .hikari-people-container {
      background: #0a0a0a;
      min-height: 100vh;
      padding: 30px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #f7e7ce;
      box-sizing: border-box;
    }
    
    .hikari-people-container *,
    .hikari-people-container *::before,
    .hikari-people-container *::after {
      box-sizing: border-box;
    }
    
    .hikari-modal *,
    .hikari-modal *::before,
    .hikari-modal *::after {
      box-sizing: border-box;
    }
    
    /* ========== ヘッダー ========== */
    .hikari-people-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      flex-wrap: wrap;
      gap: 20px;
    }
    
    .hikari-people-title {
      font-size: 2rem;
      font-weight: 300;
      color: #f7e7ce;
      display: flex;
      align-items: center;
      gap: 15px;
    }
    
    .hikari-people-title-icon {
      font-size: 2.5rem;
    }
    
    .hikari-people-count {
      font-size: 1rem;
      color: #888;
      font-weight: 400;
    }
    
    /* ========== 検索・フィルター ========== */
    .hikari-people-controls {
      display: flex;
      gap: 15px;
      align-items: center;
      flex-wrap: wrap;
    }
    
    .hikari-search-box {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(212, 175, 55, 0.3);
      border-radius: 10px;
      padding: 12px 20px;
      color: #f7e7ce;
      font-size: 1rem;
      width: 300px;
      transition: all 0.3s ease;
    }
    
    .hikari-search-box:focus {
      outline: none;
      border-color: #d4af37;
      box-shadow: 0 0 15px rgba(212, 175, 55, 0.2);
    }
    
    .hikari-search-box::placeholder {
      color: #666;
    }
    
    .hikari-filter-select {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(212, 175, 55, 0.3);
      border-radius: 10px;
      padding: 12px 20px;
      color: #f7e7ce;
      font-size: 1rem;
      cursor: pointer;
    }
    
    .hikari-filter-select:focus {
      outline: none;
      border-color: #d4af37;
    }
    
    .hikari-filter-select option {
      background: #1a1a1a;
      color: #f7e7ce;
    }
    
    .hikari-btn-add {
      background: linear-gradient(135deg, #d4af37, #b8962e);
      border: none;
      border-radius: 10px;
      padding: 12px 25px;
      color: #0a0a0a;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .hikari-btn-add:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(212, 175, 55, 0.4);
    }
    
    /* ========== カードグリッド ========== */
    .hikari-people-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 25px;
    }
    
    /* ========== カード ========== */
    .hikari-person-card {
      background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
      border: 1px solid rgba(212, 175, 55, 0.2);
      border-radius: 20px;
      padding: 25px;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }
    
    .hikari-person-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: var(--relationship-color, #888);
    }
    
    .hikari-person-card:hover {
      transform: translateY(-5px);
      border-color: rgba(212, 175, 55, 0.5);
      box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4), 0 0 30px rgba(212, 175, 55, 0.1);
    }
    
    .hikari-card-top {
      display: flex;
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .hikari-card-avatar {
      width: 70px;
      height: 70px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.8rem;
      font-weight: 700;
      color: #0a0a0a;
      flex-shrink: 0;
      background-size: cover;
      background-position: center;
      border: 3px solid var(--relationship-color, #888);
    }
    
    .hikari-card-info {
      flex: 1;
      min-width: 0;
    }
    
    .hikari-card-name {
      font-size: 1.3rem;
      font-weight: 600;
      color: #f7e7ce;
      margin-bottom: 5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .hikari-card-company {
      font-size: 0.95rem;
      color: #888;
      margin-bottom: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .hikari-card-position {
      font-size: 0.85rem;
      color: #666;
    }
    
    .hikari-card-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 15px;
      border-top: 1px solid rgba(255,255,255,0.05);
    }
    
    .hikari-card-relationship {
      font-size: 0.8rem;
      padding: 5px 12px;
      border-radius: 20px;
      background: var(--relationship-color, #888);
      color: #0a0a0a;
      font-weight: 600;
    }
    
    .hikari-card-contact {
      font-size: 0.85rem;
      color: #666;
    }
    
    .hikari-card-contact-date {
      color: #888;
    }
    
    /* ========== モーダル ========== */
    .hikari-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
    }
    
    .hikari-modal-overlay.active {
      opacity: 1;
      visibility: visible;
    }
    
    .hikari-modal {
      background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
      border: 1px solid rgba(212, 175, 55, 0.3);
      border-radius: 25px;
      width: 90%;
      max-width: 700px;
      max-height: 90vh;
      overflow-y: auto;
      transform: scale(0.9);
      transition: transform 0.3s ease;
    }
    
    .hikari-modal-overlay.active .hikari-modal {
      transform: scale(1);
    }
    
    .hikari-modal-header {
      padding: 25px 30px;
      border-bottom: 1px solid rgba(212, 175, 55, 0.2);
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      background: #1a1a1a;
      z-index: 1;
    }
    
    .hikari-modal-title {
      font-size: 1.5rem;
      font-weight: 300;
      color: #f7e7ce;
    }
    
    .hikari-modal-close {
      background: none;
      border: none;
      color: #888;
      font-size: 2rem;
      cursor: pointer;
      line-height: 1;
      transition: color 0.3s ease;
    }
    
    .hikari-modal-close:hover {
      color: #d4af37;
    }
    
    .hikari-modal-body {
      padding: 30px;
    }
    
    /* ========== 詳細モーダル ========== */
    .hikari-detail-top {
      display: flex;
      gap: 30px;
      margin-bottom: 30px;
      align-items: flex-start;
    }
    
    .hikari-detail-avatar {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3rem;
      font-weight: 700;
      color: #0a0a0a;
      flex-shrink: 0;
      background-size: cover;
      background-position: center;
      border: 4px solid var(--relationship-color, #888);
    }
    
    .hikari-detail-main {
      flex: 1;
    }
    
    .hikari-detail-name {
      font-size: 2rem;
      font-weight: 600;
      color: #f7e7ce;
      margin-bottom: 5px;
    }
    
    .hikari-detail-kana {
      font-size: 0.95rem;
      color: #666;
      margin-bottom: 15px;
    }
    
    .hikari-detail-company-row {
      font-size: 1.1rem;
      color: #888;
    }
    
    .hikari-detail-section {
      margin-bottom: 25px;
    }
    
    .hikari-detail-section-title {
      font-size: 0.9rem;
      color: #d4af37;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(212, 175, 55, 0.2);
    }
    
    .hikari-detail-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
    }
    
    .hikari-detail-item {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .hikari-detail-item.full {
      grid-column: 1 / -1;
    }
    
    .hikari-detail-label {
      font-size: 0.8rem;
      color: #666;
    }
    
    .hikari-detail-value {
      font-size: 1rem;
      color: #f7e7ce;
    }
    
    .hikari-detail-value a {
      color: #d4af37;
      text-decoration: none;
    }
    
    .hikari-detail-value a:hover {
      text-decoration: underline;
    }
    
    .hikari-detail-actions {
      display: flex;
      gap: 15px;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid rgba(212, 175, 55, 0.2);
    }
    
    .hikari-btn {
      padding: 12px 25px;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
      border: none;
    }
    
    .hikari-btn-primary {
      background: linear-gradient(135deg, #d4af37, #b8962e);
      color: #0a0a0a;
    }
    
    .hikari-btn-primary:hover {
      box-shadow: 0 5px 20px rgba(212, 175, 55, 0.4);
    }
    
    .hikari-btn-secondary {
      background: rgba(255,255,255,0.1);
      color: #f7e7ce;
      border: 1px solid rgba(212, 175, 55, 0.3);
    }
    
    .hikari-btn-secondary:hover {
      background: rgba(255,255,255,0.15);
    }
    
    .hikari-btn-danger {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    
    .hikari-btn-danger:hover {
      background: rgba(239, 68, 68, 0.3);
    }
    
    /* ========== 編集フォーム ========== */
    .hikari-form-label {
      display: block;
      font-size: 0.9rem;
      color: #888;
      margin-bottom: 8px;
    }
    
    .hikari-form-input,
    .hikari-form-textarea,
    .hikari-form-select {
      width: 100%;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(212, 175, 55, 0.3);
      border-radius: 10px;
      padding: 12px 15px;
      color: #f7e7ce;
      font-size: 1rem;
      transition: all 0.3s ease;
    }
    
    .hikari-form-input:focus,
    .hikari-form-textarea:focus,
    .hikari-form-select:focus {
      outline: none;
      border-color: #d4af37;
      box-shadow: 0 0 15px rgba(212, 175, 55, 0.2);
    }
    
    .hikari-form-textarea {
      min-height: 100px;
      resize: vertical;
    }
    
    .hikari-form-select option {
      background: #1a1a1a;
      color: #f7e7ce;
    }
    
    .hikari-form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    
    @media (max-width: 600px) {
      .hikari-form-row {
        grid-template-columns: 1fr;
      }
    }
    
    .hikari-form-group {
      margin-bottom: 20px;
      min-width: 0;
    }
    
    .hikari-form-photo-preview {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: rgba(255,255,255,0.05);
      border: 2px dashed rgba(212, 175, 55, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 10px;
      background-size: cover;
      background-position: center;
      color: #666;
      font-size: 2rem;
    }
    
    /* ========== 空状態 ========== */
    .hikari-empty {
      text-align: center;
      padding: 60px 20px;
      color: #666;
    }
    
    .hikari-empty-icon {
      font-size: 4rem;
      margin-bottom: 20px;
      opacity: 0.5;
    }
    
    /* ========== 写真拡大モーダル ========== */
    .hikari-photo-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.95);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 20000;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
      cursor: zoom-out;
    }
    
    .hikari-photo-modal.active {
      opacity: 1;
      visibility: visible;
    }
    
    .hikari-photo-modal img {
      max-width: 90vw;
      max-height: 90vh;
      object-fit: contain;
      border-radius: 10px;
      box-shadow: 0 0 50px rgba(0, 0, 0, 0.5);
      cursor: zoom-out;
    }
    
    .hikari-photo-modal-close {
      position: absolute;
      top: 20px;
      right: 30px;
      background: none;
      border: none;
      color: #fff;
      font-size: 3rem;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.3s ease;
    }
    
    .hikari-photo-modal-close:hover {
      opacity: 1;
    }
    
    /* アバターにポインターカーソル */
    .hikari-card-avatar[data-file-key]:not([data-file-key=""]),
    .hikari-detail-avatar[data-file-key]:not([data-file-key=""]),
    .hikari-form-photo-preview[data-file-key]:not([data-file-key=""]) {
      cursor: zoom-in;
    }
    
    /* ========== kintone標準UI非表示 ========== */
    .gaia-argoui-app-index-pager,
    .gaia-argoui-app-toolbar,
    .gaia-argoui-app-menu,
    .recordlist-header-gaia,
    .recordlist-gaia,
    .gaia-argoui-appindex-toolbar,
    .gaia-argoui-app-header-buttons {
      display: none !important;
    }
    
    /* ========== レスポンシブ ========== */
    @media (max-width: 768px) {
      .hikari-people-header {
        flex-direction: column;
        align-items: flex-start;
      }
      
      .hikari-search-box {
        width: 100%;
      }
      
      .hikari-people-grid {
        grid-template-columns: 1fr;
      }
      
      .hikari-detail-top {
        flex-direction: column;
        align-items: center;
        text-align: center;
      }
      
      .hikari-form-row {
        grid-template-columns: 1fr;
      }
      
      .hikari-detail-grid {
        grid-template-columns: 1fr;
      }
    }
    
    /* ========== 接点履歴 ========== */
    .hikari-history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    
    .hikari-history-title {
      font-size: 0.9rem;
      color: #d4af37;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(212, 175, 55, 0.2);
      flex: 1;
    }
    
    .hikari-btn-add-history {
      background: linear-gradient(135deg, #d4af37, #b8962e);
      color: #0a0a0a;
      border: none;
      padding: 6px 15px;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      margin-left: 15px;
      transition: all 0.3s ease;
    }
    
    .hikari-btn-add-history:hover {
      box-shadow: 0 3px 10px rgba(212, 175, 55, 0.4);
    }
    
    .hikari-history-list {
      max-height: 200px;
      overflow-y: auto;
      padding-right: 5px;
    }
    
    .hikari-history-list::-webkit-scrollbar {
      width: 6px;
    }
    
    .hikari-history-list::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.05);
      border-radius: 3px;
    }
    
    .hikari-history-list::-webkit-scrollbar-thumb {
      background: rgba(212, 175, 55, 0.3);
      border-radius: 3px;
    }
    
    .hikari-history-item {
      display: flex;
      align-items: flex-start;
      gap: 15px;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    
    .hikari-history-item:last-child {
      border-bottom: none;
    }
    
    .hikari-history-date {
      font-size: 0.85rem;
      color: #666;
      min-width: 90px;
    }
    
    .hikari-history-type {
      font-size: 0.8rem;
      padding: 3px 10px;
      border-radius: 15px;
      background: rgba(212, 175, 55, 0.15);
      color: #d4af37;
      min-width: 60px;
      text-align: center;
    }
    
    .hikari-history-memo {
      flex: 1;
      font-size: 0.9rem;
      color: #f7e7ce;
      line-height: 1.5;
    }
    
    .hikari-history-empty {
      color: #666;
      font-size: 0.9rem;
      padding: 20px 0;
      text-align: center;
    }
    
    /* 接点追加フォーム */
    .hikari-history-form {
      background: rgba(255,255,255,0.03);
      border-radius: 10px;
      padding: 15px;
      margin-bottom: 15px;
      border: 1px solid rgba(212, 175, 55, 0.2);
    }
    
    .hikari-history-form-row {
      display: flex;
      gap: 15px;
      margin-bottom: 12px;
    }
    
    .hikari-history-form-row:last-child {
      margin-bottom: 0;
    }
    
    .hikari-history-form-group {
      flex: 1;
    }
    
    .hikari-history-form-label {
      display: block;
      font-size: 0.8rem;
      color: #888;
      margin-bottom: 5px;
    }
    
    .hikari-history-input,
    .hikari-history-select,
    .hikari-history-textarea {
      width: 100%;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(212, 175, 55, 0.3);
      border-radius: 8px;
      padding: 10px 12px;
      color: #f7e7ce;
      font-size: 0.9rem;
    }
    
    .hikari-history-textarea {
      resize: vertical;
      min-height: 60px;
    }
    
    .hikari-history-input:focus,
    .hikari-history-select:focus,
    .hikari-history-textarea:focus {
      outline: none;
      border-color: #d4af37;
    }
    
    .hikari-history-form-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }
    
    .hikari-btn-history-save {
      background: linear-gradient(135deg, #d4af37, #b8962e);
      color: #0a0a0a;
      border: none;
      padding: 8px 20px;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
    }
    
    .hikari-btn-history-cancel {
      background: rgba(255,255,255,0.1);
      color: #888;
      border: none;
      padding: 8px 20px;
      border-radius: 8px;
      font-size: 0.85rem;
      cursor: pointer;
    }
    `;
    document.head.appendChild(style);
  };

  // ========================================
  //  データ管理
  // ========================================
  
  let allRecords = [];
  let filteredRecords = [];
  let currentFilter = 'all';
  let currentSearch = '';

  // 全レコード取得
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

  // フィルター適用
  const applyFilters = () => {
    filteredRecords = allRecords.filter(record => {
      // お付き合い度合いフィルター
      if (currentFilter !== 'all') {
        const rel = Utils.getFieldValue(record, CONFIG.FIELDS.RELATIONSHIP);
        if (rel !== currentFilter) return false;
      }
      
      // 検索フィルター
      if (currentSearch) {
        const name = Utils.getFieldValue(record, CONFIG.FIELDS.NAME).toLowerCase();
        const kana = Utils.getFieldValue(record, CONFIG.FIELDS.KANA_NAME).toLowerCase();
        const company = Utils.getFieldValue(record, CONFIG.FIELDS.COMPANY).toLowerCase();
        const search = currentSearch.toLowerCase();
        if (!name.includes(search) && !kana.includes(search) && !company.includes(search)) {
          return false;
        }
      }
      
      return true;
    });
    
    renderCards();
  };

  // ========================================
  //  レンダリング
  // ========================================
  
  // メインコンテナ作成
  const createContainer = () => {
    const container = document.createElement('div');
    container.id = 'hikari-people-container';
    container.className = 'hikari-people-container';
    
    container.innerHTML = `
      <div class="hikari-people-header">
        <div class="hikari-people-title">
          <span class="hikari-people-title-icon">👥</span>
          <span>人脈管理</span>
          <span class="hikari-people-count" id="hikari-people-count"></span>
        </div>
        <div class="hikari-people-controls">
          <input type="text" class="hikari-search-box" id="hikari-search" placeholder="🔍 名前・会社名で検索...">
          <select class="hikari-filter-select" id="hikari-filter">
            <option value="all">すべて</option>
            ${CONFIG.RELATIONSHIP_ORDER.map(rel => `<option value="${rel}">${rel}</option>`).join('')}
          </select>
          <button class="hikari-btn-add" id="hikari-btn-add">
            <span>＋</span>
            <span>新規追加</span>
          </button>
        </div>
      </div>
      <div class="hikari-people-grid" id="hikari-people-grid"></div>
    `;
    
    return container;
  };

  // カード一覧レンダリング
  const renderCards = () => {
    const grid = document.getElementById('hikari-people-grid');
    const countEl = document.getElementById('hikari-people-count');
    
    if (!grid) return;
    
    countEl.textContent = `（${filteredRecords.length}人）`;
    
    if (filteredRecords.length === 0) {
      grid.innerHTML = `
        <div class="hikari-empty" style="grid-column: 1 / -1;">
          <div class="hikari-empty-icon">🔍</div>
          <div>該当する人脈が見つかりません</div>
        </div>
      `;
      return;
    }
    
    grid.innerHTML = filteredRecords.map(record => {
      const id = Utils.getFieldValue(record, '$id');
      const name = Utils.getFieldValue(record, CONFIG.FIELDS.NAME);
      const company = Utils.getFieldValue(record, CONFIG.FIELDS.COMPANY);
      const position = Utils.getFieldValue(record, CONFIG.FIELDS.POSITION);
      const relationship = Utils.getFieldValue(record, CONFIG.FIELDS.RELATIONSHIP);
      const lastContact = Utils.getFieldValue(record, CONFIG.FIELDS.LAST_CONTACT);
      const photo = Utils.getFieldValue(record, CONFIG.FIELDS.PHOTO);
      const color = Utils.getRelationshipColor(relationship);
      
      const hasPhoto = photo && photo.length > 0;
      const fileKey = hasPhoto ? photo[0].fileKey : '';
      
      // キャッシュにあればURLを直接使用
      const cachedUrl = fileKey ? Utils._fileUrlCache[fileKey] : '';
      const photoStyle = cachedUrl 
        ? `background-image: url('${cachedUrl}'); background-size: cover; background-position: center; color: transparent;`
        : '';
      
      return `
        <div class="hikari-person-card" data-record-id="${id}" style="--relationship-color: ${color}">
          <div class="hikari-card-top">
            <div class="hikari-card-avatar" data-file-key="${fileKey}" style="background: ${color}; ${photoStyle}">
              ${Utils.getInitial(name)}
            </div>
            <div class="hikari-card-info">
              <div class="hikari-card-name">${Utils.escapeHtml(name)}</div>
              <div class="hikari-card-company">${Utils.escapeHtml(company)}</div>
              <div class="hikari-card-position">${Utils.escapeHtml(position)}</div>
            </div>
          </div>
          <div class="hikari-card-meta">
            <span class="hikari-card-relationship" style="background: ${color}">${relationship || '未設定'}</span>
            <span class="hikari-card-contact">
              ${lastContact ? `<span class="hikari-card-contact-date">${Utils.formatDate(lastContact)}</span>` : '接点なし'}
            </span>
          </div>
        </div>
      `;
    }).join('');
    
    // カードクリックイベント
    grid.querySelectorAll('.hikari-person-card').forEach(card => {
      card.addEventListener('click', () => {
        const recordId = card.dataset.recordId;
        const record = allRecords.find(r => Utils.getFieldValue(r, '$id') === recordId);
        if (record) {
          showDetailModal(record);
        }
      });
    });
    
    // 写真を非同期で読み込み（キャッシュにないものだけ）
    grid.querySelectorAll('.hikari-card-avatar[data-file-key]').forEach(async (avatar) => {
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
      
      // 写真クリックで拡大（キャッシュ有無に関わらず）
      if (fileKey) {
        avatar.addEventListener('click', (e) => {
          e.stopPropagation();
          Utils.showPhotoModal(fileKey);
        });
      }
    });
  };

  // ========================================
  //  詳細モーダル
  // ========================================
  
  const showDetailModal = async (record) => {
    const id = Utils.getFieldValue(record, '$id');
    const name = Utils.getFieldValue(record, CONFIG.FIELDS.NAME);
    const kana = Utils.getFieldValue(record, CONFIG.FIELDS.KANA_NAME);
    const company = Utils.getFieldValue(record, CONFIG.FIELDS.COMPANY);
    const position = Utils.getFieldValue(record, CONFIG.FIELDS.POSITION);
    const phone = Utils.getFieldValue(record, CONFIG.FIELDS.PHONE);
    const email = Utils.getFieldValue(record, CONFIG.FIELDS.EMAIL);
    const address = Utils.getFieldValue(record, CONFIG.FIELDS.ADDRESS);
    const hp = Utils.getFieldValue(record, CONFIG.FIELDS.HP);
    const facebook = Utils.getFieldValue(record, CONFIG.FIELDS.FACEBOOK);
    const instagram = Utils.getFieldValue(record, CONFIG.FIELDS.INSTAGRAM);
    const referrer = Utils.getFieldValue(record, CONFIG.FIELDS.REFERRER);
    const relationship = Utils.getFieldValue(record, CONFIG.FIELDS.RELATIONSHIP);
    const lastContact = Utils.getFieldValue(record, CONFIG.FIELDS.LAST_CONTACT);
    const contactCount = Utils.getFieldValue(record, CONFIG.FIELDS.CONTACT_COUNT);
    const birthday = Utils.getFieldValue(record, CONFIG.FIELDS.BIRTHDAY);
    const notes = Utils.getFieldValue(record, CONFIG.FIELDS.NOTES);
    const photo = Utils.getFieldValue(record, CONFIG.FIELDS.PHOTO);
    const contactHistory = Utils.getFieldValue(record, CONFIG.FIELDS.CONTACT_HISTORY) || [];
    const color = Utils.getRelationshipColor(relationship);
    
    const hasPhoto = photo && photo.length > 0;
    const fileKey = hasPhoto ? photo[0].fileKey : '';
    
    const modal = document.createElement('div');
    modal.className = 'hikari-modal-overlay';
    modal.innerHTML = `
      <div class="hikari-modal">
        <div class="hikari-modal-header">
          <span class="hikari-modal-title">人脈詳細</span>
          <button class="hikari-modal-close">&times;</button>
        </div>
        <div class="hikari-modal-body">
          <div class="hikari-detail-top">
            <div class="hikari-detail-avatar" id="detail-avatar" data-file-key="${fileKey}" style="background: ${color};">
              ${Utils.getInitial(name)}
            </div>
            <div class="hikari-detail-main">
              <div class="hikari-detail-name">${Utils.escapeHtml(name)}</div>
              <div class="hikari-detail-kana">${Utils.escapeHtml(kana)}</div>
              <div class="hikari-detail-company-row">
                ${Utils.escapeHtml(company)}${position ? ` / ${Utils.escapeHtml(position)}` : ''}
              </div>
            </div>
          </div>
          
          <div class="hikari-detail-section">
            <div class="hikari-detail-section-title">連絡先</div>
            <div class="hikari-detail-grid">
              <div class="hikari-detail-item">
                <span class="hikari-detail-label">電話番号</span>
                <span class="hikari-detail-value">${phone ? `<a href="tel:${phone}">${Utils.escapeHtml(phone)}</a>` : '-'}</span>
              </div>
              <div class="hikari-detail-item">
                <span class="hikari-detail-label">メール</span>
                <span class="hikari-detail-value">${email ? `<a href="mailto:${email}">${Utils.escapeHtml(email)}</a>` : '-'}</span>
              </div>
              <div class="hikari-detail-item full">
                <span class="hikari-detail-label">住所</span>
                <span class="hikari-detail-value">${Utils.escapeHtml(address) || '-'}</span>
              </div>
              <div class="hikari-detail-item">
                <span class="hikari-detail-label">HP</span>
                <span class="hikari-detail-value">${hp ? `<a href="${hp}" target="_blank">${Utils.escapeHtml(hp)}</a>` : '-'}</span>
              </div>
              <div class="hikari-detail-item">
                <span class="hikari-detail-label">SNS</span>
                <span class="hikari-detail-value">
                  ${facebook ? `<a href="${facebook}" target="_blank">Facebook</a>` : ''}
                  ${facebook && instagram ? ' / ' : ''}
                  ${instagram ? `<a href="${instagram}" target="_blank">Instagram</a>` : ''}
                  ${!facebook && !instagram ? '-' : ''}
                </span>
              </div>
            </div>
          </div>
          
          <div class="hikari-detail-section">
            <div class="hikari-detail-section-title">関係性</div>
            <div class="hikari-detail-grid">
              <div class="hikari-detail-item">
                <span class="hikari-detail-label">お付き合い度合い</span>
                <span class="hikari-detail-value" style="color: ${color}; font-weight: 600;">${relationship || '-'}</span>
              </div>
              <div class="hikari-detail-item">
                <span class="hikari-detail-label">紹介者</span>
                <span class="hikari-detail-value">${Utils.escapeHtml(referrer) || '-'}</span>
              </div>
              <div class="hikari-detail-item">
                <span class="hikari-detail-label">最終接点日</span>
                <span class="hikari-detail-value">${Utils.formatDate(lastContact) || '-'}</span>
              </div>
              <div class="hikari-detail-item">
                <span class="hikari-detail-label">接点回数</span>
                <span class="hikari-detail-value">${contactCount || 0}回</span>
              </div>
            </div>
          </div>
          
          <div class="hikari-detail-section">
            <div class="hikari-detail-section-title">プロフィール</div>
            <div class="hikari-detail-grid">
              <div class="hikari-detail-item">
                <span class="hikari-detail-label">生年月日</span>
                <span class="hikari-detail-value">${Utils.formatBirthday(birthday) || '-'}</span>
              </div>
              <div class="hikari-detail-item full">
                <span class="hikari-detail-label">メモ</span>
                <span class="hikari-detail-value">${Utils.escapeHtml(notes) || '-'}</span>
              </div>
            </div>
          </div>
          
          <div class="hikari-detail-section">
            <div class="hikari-history-header">
              <div class="hikari-history-title">接点履歴</div>
              <button class="hikari-btn-add-history" id="hikari-btn-add-history">＋ 接点追加</button>
            </div>
            <div id="hikari-history-form-container"></div>
            <div class="hikari-history-list" id="hikari-history-list">
              ${contactHistory.length > 0 
                ? contactHistory
                    .sort((a, b) => {
                      const dateA = a.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '';
                      const dateB = b.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '';
                      return dateB.localeCompare(dateA);
                    })
                    .map(row => {
                      const date = row.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '';
                      const type = row.value[CONFIG.FIELDS.CONTACT_TYPE]?.value || '';
                      const memo = row.value[CONFIG.FIELDS.CONTACT_MEMO]?.value || '';
                      return `
                        <div class="hikari-history-item">
                          <span class="hikari-history-date">${Utils.formatDate(date)}</span>
                          <span class="hikari-history-type">${Utils.escapeHtml(type)}</span>
                          <span class="hikari-history-memo">${Utils.escapeHtml(memo) || '-'}</span>
                        </div>
                      `;
                    }).join('')
                : '<div class="hikari-history-empty">接点履歴がありません</div>'
              }
            </div>
          </div>
          
          <div class="hikari-detail-actions">
            <button class="hikari-btn hikari-btn-primary" id="hikari-btn-edit">編集</button>
            <button class="hikari-btn hikari-btn-secondary" id="hikari-btn-kintone">kintoneで開く</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // アニメーション
    requestAnimationFrame(() => {
      modal.classList.add('active');
    });
    
    // 閉じる
    const closeModal = () => {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 300);
    };
    
    modal.querySelector('.hikari-modal-close').addEventListener('click', closeModal);
    
    // オーバーレイクリックで閉じる（ドラッグ対策：mousedownとmouseup両方がオーバーレイ上の場合のみ）
    let mouseDownTarget = null;
    modal.addEventListener('mousedown', (e) => {
      mouseDownTarget = e.target;
    });
    modal.addEventListener('mouseup', (e) => {
      if (mouseDownTarget === modal && e.target === modal) {
        closeModal();
      }
      mouseDownTarget = null;
    });
    
    // 編集ボタン
    modal.querySelector('#hikari-btn-edit').addEventListener('click', () => {
      closeModal();
      showEditModal(record);
    });
    
    // kintoneで開くボタン
    modal.querySelector('#hikari-btn-kintone').addEventListener('click', () => {
      window.open(`/k/${CONFIG.APP_ID}/show#record=${id}`, '_blank');
    });
    
    // 写真を非同期で読み込み
    if (fileKey) {
      Utils.getFileUrl(fileKey).then(url => {
        if (url) {
          const avatar = modal.querySelector('#detail-avatar');
          if (avatar) {
            avatar.style.backgroundImage = `url('${url}')`;
            avatar.style.backgroundSize = 'cover';
            avatar.style.backgroundPosition = 'center';
            avatar.style.color = 'transparent';
            
            // 写真クリックで拡大
            avatar.addEventListener('click', () => {
              Utils.showPhotoModal(fileKey);
            });
          }
        }
      });
    }
    
    // 接点追加ボタン
    const addHistoryBtn = modal.querySelector('#hikari-btn-add-history');
    const formContainer = modal.querySelector('#hikari-history-form-container');
    const historyList = modal.querySelector('#hikari-history-list');
    
    addHistoryBtn.addEventListener('click', () => {
      // フォームがすでにあれば何もしない
      if (formContainer.querySelector('.hikari-history-form')) return;
      
      // 今日の日付をデフォルト値に
      const today = new Date().toISOString().split('T')[0];
      
      formContainer.innerHTML = `
        <div class="hikari-history-form">
          <div class="hikari-history-form-row">
            <div class="hikari-history-form-group">
              <label class="hikari-history-form-label">接点日</label>
              <input type="date" class="hikari-history-input" id="new-contact-date" value="${today}">
            </div>
            <div class="hikari-history-form-group">
              <label class="hikari-history-form-label">種別</label>
              <select class="hikari-history-select" id="new-contact-type">
                ${CONFIG.CONTACT_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="hikari-history-form-row">
            <div class="hikari-history-form-group">
              <label class="hikari-history-form-label">メモ</label>
              <textarea class="hikari-history-textarea" id="new-contact-memo" placeholder="接点の内容を入力..."></textarea>
            </div>
          </div>
          <div class="hikari-history-form-actions">
            <button type="button" class="hikari-btn-history-cancel" id="cancel-history">キャンセル</button>
            <button type="button" class="hikari-btn-history-save" id="save-history">追加</button>
          </div>
        </div>
      `;
      
      // キャンセルボタン
      formContainer.querySelector('#cancel-history').addEventListener('click', () => {
        formContainer.innerHTML = '';
      });
      
      // 追加ボタン
      formContainer.querySelector('#save-history').addEventListener('click', async () => {
        const newDate = formContainer.querySelector('#new-contact-date').value;
        const newType = formContainer.querySelector('#new-contact-type').value;
        const newMemo = formContainer.querySelector('#new-contact-memo').value;
        
        if (!newDate) {
          alert('接点日を入力してください');
          return;
        }
        
        // 保存中表示
        const saveBtn = formContainer.querySelector('#save-history');
        saveBtn.textContent = '保存中...';
        saveBtn.disabled = true;
        
        try {
          // 現在のサブテーブルデータに新しい行を追加
          const currentHistory = contactHistory.map(row => ({
            id: row.id,
            value: {
              [CONFIG.FIELDS.CONTACT_DATE]: { value: row.value[CONFIG.FIELDS.CONTACT_DATE]?.value || '' },
              [CONFIG.FIELDS.CONTACT_TYPE]: { value: row.value[CONFIG.FIELDS.CONTACT_TYPE]?.value || '' },
              [CONFIG.FIELDS.CONTACT_MEMO]: { value: row.value[CONFIG.FIELDS.CONTACT_MEMO]?.value || '' },
            }
          }));
          
          // 新しい行を追加
          currentHistory.push({
            value: {
              [CONFIG.FIELDS.CONTACT_DATE]: { value: newDate },
              [CONFIG.FIELDS.CONTACT_TYPE]: { value: newType },
              [CONFIG.FIELDS.CONTACT_MEMO]: { value: newMemo },
            }
          });
          
          // レコード更新
          await kintone.api('/k/v1/record', 'PUT', {
            app: CONFIG.APP_ID,
            id: id,
            record: {
              [CONFIG.FIELDS.CONTACT_HISTORY]: {
                value: currentHistory
              }
            }
          });
          
          console.log('✅ 接点履歴追加成功');
          
          // モーダルを閉じてデータ再読み込み
          closeModal();
          await loadAndRender();
          
          // 再度詳細モーダルを開く
          const updatedRecord = allRecords.find(r => Utils.getFieldValue(r, '$id') === id);
          if (updatedRecord) {
            showDetailModal(updatedRecord);
          }
          
        } catch (err) {
          console.error('❌ 接点追加エラー:', err);
          alert('接点の追加に失敗しました');
          saveBtn.textContent = '追加';
          saveBtn.disabled = false;
        }
      });
    });
  };

  // ========================================
  //  編集モーダル
  // ========================================
  
  const showEditModal = (record = null) => {
    const isNew = !record;
    const id = record ? Utils.getFieldValue(record, '$id') : '';
    
    const getVal = (field) => record ? Utils.getFieldValue(record, field) : '';
    const photo = record ? Utils.getFieldValue(record, CONFIG.FIELDS.PHOTO) : [];
    const hasPhoto = photo && photo.length > 0;
    const fileKey = hasPhoto ? photo[0].fileKey : '';
    
    const modal = document.createElement('div');
    modal.className = 'hikari-modal-overlay';
    modal.innerHTML = `
      <div class="hikari-modal">
        <div class="hikari-modal-header">
          <span class="hikari-modal-title">${isNew ? '新規追加' : '編集'}</span>
          <button class="hikari-modal-close">&times;</button>
        </div>
        <div class="hikari-modal-body">
          <form id="hikari-edit-form">
            <div class="hikari-form-group" style="text-align: center;">
              <div class="hikari-form-photo-preview" id="photo-preview" data-file-key="${fileKey}">${hasPhoto ? '' : '📷'}</div>
              <input type="file" id="photo-input" accept="image/*" style="display: none;">
              <button type="button" class="hikari-btn hikari-btn-secondary" id="photo-btn" style="font-size: 0.85rem; padding: 8px 15px;">写真を選択</button>
            </div>
            
            <div class="hikari-form-row">
              <div class="hikari-form-group">
                <label class="hikari-form-label">名前 *</label>
                <input type="text" class="hikari-form-input" name="name" value="${Utils.escapeHtml(getVal(CONFIG.FIELDS.NAME))}" required>
              </div>
              <div class="hikari-form-group">
                <label class="hikari-form-label">ふりがな</label>
                <input type="text" class="hikari-form-input" name="kananame" value="${Utils.escapeHtml(getVal(CONFIG.FIELDS.KANA_NAME))}">
              </div>
            </div>
            
            <div class="hikari-form-row">
              <div class="hikari-form-group">
                <label class="hikari-form-label">会社名</label>
                <input type="text" class="hikari-form-input" name="company" value="${Utils.escapeHtml(getVal(CONFIG.FIELDS.COMPANY))}">
              </div>
              <div class="hikari-form-group">
                <label class="hikari-form-label">役職</label>
                <input type="text" class="hikari-form-input" name="position" value="${Utils.escapeHtml(getVal(CONFIG.FIELDS.POSITION))}">
              </div>
            </div>
            
            <div class="hikari-form-row">
              <div class="hikari-form-group">
                <label class="hikari-form-label">電話番号</label>
                <input type="tel" class="hikari-form-input" name="phone" value="${Utils.escapeHtml(getVal(CONFIG.FIELDS.PHONE))}">
              </div>
              <div class="hikari-form-group">
                <label class="hikari-form-label">メールアドレス</label>
                <input type="email" class="hikari-form-input" name="email" value="${Utils.escapeHtml(getVal(CONFIG.FIELDS.EMAIL))}">
              </div>
            </div>
            
            <div class="hikari-form-group">
              <label class="hikari-form-label">住所</label>
              <input type="text" class="hikari-form-input" name="address" value="${Utils.escapeHtml(getVal(CONFIG.FIELDS.ADDRESS))}">
            </div>
            
            <div class="hikari-form-row">
              <div class="hikari-form-group">
                <label class="hikari-form-label">HP</label>
                <input type="url" class="hikari-form-input" name="hp" value="${Utils.escapeHtml(getVal(CONFIG.FIELDS.HP))}" placeholder="https://...">
              </div>
              <div class="hikari-form-group">
                <label class="hikari-form-label">Facebook</label>
                <input type="url" class="hikari-form-input" name="facebook" value="${Utils.escapeHtml(getVal(CONFIG.FIELDS.FACEBOOK))}" placeholder="https://facebook.com/...">
              </div>
            </div>
            
            <div class="hikari-form-group">
              <label class="hikari-form-label">Instagram</label>
              <input type="url" class="hikari-form-input" name="instagram" value="${Utils.escapeHtml(getVal(CONFIG.FIELDS.INSTAGRAM))}" placeholder="https://instagram.com/...">
            </div>
            
            <div class="hikari-form-row">
              <div class="hikari-form-group">
                <label class="hikari-form-label">お付き合い度合い</label>
                <select class="hikari-form-select" name="relationship">
                  <option value="">選択してください</option>
                  ${CONFIG.RELATIONSHIP_ORDER.map(rel => `
                    <option value="${rel}" ${getVal(CONFIG.FIELDS.RELATIONSHIP) === rel ? 'selected' : ''}>${rel}</option>
                  `).join('')}
                </select>
              </div>
              <div class="hikari-form-group">
                <label class="hikari-form-label">生年月日</label>
                <input type="date" class="hikari-form-input" name="birthday" value="${getVal(CONFIG.FIELDS.BIRTHDAY)}">
              </div>
            </div>
            
            <div class="hikari-form-group">
              <label class="hikari-form-label">メモ</label>
              <textarea class="hikari-form-textarea" name="notes">${Utils.escapeHtml(getVal(CONFIG.FIELDS.NOTES))}</textarea>
            </div>
            
            <div class="hikari-detail-actions">
              <button type="submit" class="hikari-btn hikari-btn-primary">保存</button>
              <button type="button" class="hikari-btn hikari-btn-secondary hikari-modal-cancel">キャンセル</button>
              ${!isNew ? '<button type="button" class="hikari-btn hikari-btn-danger" id="hikari-btn-delete">削除</button>' : ''}
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    requestAnimationFrame(() => {
      modal.classList.add('active');
    });
    
    const closeModal = () => {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 300);
    };
    
    modal.querySelector('.hikari-modal-close').addEventListener('click', closeModal);
    modal.querySelector('.hikari-modal-cancel').addEventListener('click', closeModal);
    
    // オーバーレイクリックで閉じる（ドラッグ対策：mousedownとmouseup両方がオーバーレイ上の場合のみ）
    let mouseDownTarget = null;
    modal.addEventListener('mousedown', (e) => {
      mouseDownTarget = e.target;
    });
    modal.addEventListener('mouseup', (e) => {
      if (mouseDownTarget === modal && e.target === modal) {
        closeModal();
      }
      mouseDownTarget = null;
    });
    
    // 写真選択
    let selectedFile = null;
    const photoInput = modal.querySelector('#photo-input');
    const photoPreview = modal.querySelector('#photo-preview');
    const photoBtn = modal.querySelector('#photo-btn');
    
    photoBtn.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
          photoPreview.style.backgroundImage = `url('${ev.target.result}')`;
          photoPreview.textContent = '';
        };
        reader.readAsDataURL(file);
      }
    });
    
    // 既存写真を非同期で読み込み
    if (fileKey) {
      Utils.getFileUrl(fileKey).then(url => {
        if (url && photoPreview) {
          photoPreview.style.backgroundImage = `url('${url}')`;
          photoPreview.textContent = '';
          
          // 写真クリックで拡大（既存写真のみ）
          photoPreview.addEventListener('click', () => {
            if (!selectedFile && fileKey) { // 新しい写真を選んでいない場合
              Utils.showPhotoModal(fileKey);
            }
          });
        }
      });
    }
    
    // フォーム送信
    modal.querySelector('#hikari-edit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = modal.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = '保存中...';
      
      const formData = new FormData(e.target);
      const data = {};
      
      // フィールドマッピング
      const fieldMap = {
        'name': CONFIG.FIELDS.NAME,
        'kananame': CONFIG.FIELDS.KANA_NAME,
        'company': CONFIG.FIELDS.COMPANY,
        'position': CONFIG.FIELDS.POSITION,
        'phone': CONFIG.FIELDS.PHONE,
        'email': CONFIG.FIELDS.EMAIL,
        'address': CONFIG.FIELDS.ADDRESS,
        'hp': CONFIG.FIELDS.HP,
        'facebook': CONFIG.FIELDS.FACEBOOK,
        'instagram': CONFIG.FIELDS.INSTAGRAM,
        'relationship': CONFIG.FIELDS.RELATIONSHIP,
        'birthday': CONFIG.FIELDS.BIRTHDAY,
        'notes': CONFIG.FIELDS.NOTES,
      };
      
      for (const [formName, fieldCode] of Object.entries(fieldMap)) {
        const value = formData.get(formName);
        if (value !== null && value !== undefined) {
          data[fieldCode] = { value: value };
        }
      }
      
      console.log('📝 送信データ:', JSON.stringify(data, null, 2));
      
      try {
        // 写真アップロード
        if (selectedFile) {
          console.log('📷 写真アップロード開始:', selectedFile.name, selectedFile.size, 'bytes');
          const fileFormData = new FormData();
          fileFormData.append('file', selectedFile, selectedFile.name);
          fileFormData.append('__REQUEST_TOKEN__', kintone.getRequestToken()); // CSRFトークン追加
          
          // kintone.api.url()を使って正しいURLを取得
          const uploadUrl = kintone.api.url('/k/v1/file', true);
          console.log('📷 アップロードURL:', uploadUrl);
          
          const uploadResult = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', uploadUrl);
            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
            xhr.onload = function() {
              console.log('📷 アップロード結果:', xhr.status, xhr.responseText);
              if (xhr.status === 200) {
                resolve(JSON.parse(xhr.responseText));
              } else {
                reject(new Error('ファイルアップロードに失敗しました: ' + xhr.status + ' - ' + xhr.responseText));
              }
            };
            xhr.onerror = function() {
              console.error('📷 ネットワークエラー');
              reject(new Error('ネットワークエラー'));
            };
            xhr.send(fileFormData);
          });
          
          console.log('📷 アップロード成功:', uploadResult);
          data[CONFIG.FIELDS.PHOTO] = { value: [{ fileKey: uploadResult.fileKey }] };
        }
        
        console.log('💾 最終送信データ:', JSON.stringify(data, null, 2));
        
        let result;
        if (isNew) {
          console.log('➕ 新規レコード作成');
          result = await kintone.api('/k/v1/record', 'POST', {
            app: CONFIG.APP_ID,
            record: data,
          });
          console.log('✅ 作成成功:', result);
        } else {
          console.log('✏️ レコード更新 ID:', id);
          result = await kintone.api('/k/v1/record', 'PUT', {
            app: CONFIG.APP_ID,
            id: id,
            record: data,
          });
          console.log('✅ 更新成功:', result);
        }
        
        closeModal();
        await refreshData();
        
      } catch (err) {
        console.error('❌ 保存エラー:', err);
        console.error('❌ エラー詳細:', JSON.stringify(err, null, 2));
        if (err.message) console.error('❌ メッセージ:', err.message);
        if (err.errors) console.error('❌ フィールドエラー:', JSON.stringify(err.errors, null, 2));
        
        let errorMsg = '保存に失敗しました。\n\n';
        if (err.message) {
          errorMsg += 'エラー: ' + err.message + '\n';
        }
        if (err.errors) {
          errorMsg += '\nフィールドエラー:\n';
          for (const [field, detail] of Object.entries(err.errors)) {
            errorMsg += `・${field}: ${JSON.stringify(detail)}\n`;
          }
        }
        alert(errorMsg);
        submitBtn.disabled = false;
        submitBtn.textContent = '保存';
      }
    });
    
    // 削除ボタン
    if (!isNew) {
      modal.querySelector('#hikari-btn-delete')?.addEventListener('click', async () => {
        if (!confirm('本当に削除しますか？')) return;
        
        try {
          await kintone.api('/k/v1/record', 'DELETE', {
            app: CONFIG.APP_ID,
            ids: [id],
          });
          
          closeModal();
          await refreshData();
          
        } catch (err) {
          console.error('Delete error:', err);
          alert('削除に失敗しました: ' + (err.message || err));
        }
      });
    }
  };

  // ========================================
  //  データ更新
  // ========================================
  
  const refreshData = async () => {
    allRecords = await fetchAllRecords();
    applyFilters();
  };

  // ========================================
  //  初期化
  // ========================================
  
  const init = async () => {
    console.log('🌟 HIKARI People App initializing...');
    
    injectStyles();
    
    // kintoneの一覧表示領域を取得
    const indexEl = kintone.app.getHeaderSpaceElement();
    if (!indexEl) return;
    
    // コンテナ作成
    const container = createContainer();
    indexEl.parentElement.insertBefore(container, indexEl);
    
    // イベント設定
    document.getElementById('hikari-search').addEventListener('input', (e) => {
      currentSearch = e.target.value;
      applyFilters();
    });
    
    document.getElementById('hikari-filter').addEventListener('change', (e) => {
      currentFilter = e.target.value;
      applyFilters();
    });
    
    document.getElementById('hikari-btn-add').addEventListener('click', () => {
      showEditModal(null);
    });
    
    // データ取得
    await refreshData();
    
    console.log('✅ HIKARI People App initialized');
  };

  // ========================================
  //  イベント登録
  // ========================================
  
  kintone.events.on('app.record.index.show', (event) => {
    init();
    return event;
  });

})();
