/**
 * HIKARI Mobile Dashboard
 * モバイル用ダッシュボード
 * 
 * 機能:
 * - 人脈サマリー（総数、レベル別、ポイント）
 * - 疎遠アラート（要フォロー）
 * - 今月の誕生日
 * - ご恩返しバランス
 * - 紹介者ランキング
 */

(function() {
  'use strict';

  // ========================================
  //  設定値
  // ========================================
  
  const CONFIG = {
    APP_ID: 6,  // 人脈管理アプリID
    REFERRAL_APP_ID: 10,  // 紹介履歴アプリID
    VIEW_ID: null,  // ★モバイルダッシュボード用ビューID（後で設定）
    
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
      NOTES: 'shokai_memo',
      LAST_CONTACT: 'last_contact_date',
      LAST_CONTACT_TYPE: 'last_contact_type',
      CONTACT_COUNT: 'contact_count',
      CONTACT_HISTORY: 'contact_history',
      CONTACT_DATE: 'contact_date',
      CONTACT_TYPE: 'contact_type',
      CONTACT_MEMO: 'contact_memo',
    },
    
    // 疎遠アラート基準（日数）
    HEALTH_THRESHOLDS: {
      '1': { yellow: 30, red: 60 },   // プライム
      '2': { yellow: 45, red: 90 },   // パワー
      '3': { yellow: 60, red: 120 },  // スタンダード
      '4': { yellow: 90, red: 180 },  // フレンド
      '5': { yellow: null, red: null }, // コネクト（チェックなし）
    },
    
    // お付き合い度合いのポイント
    RELATIONSHIP_POINTS: {
      '1': 5,  // プライム
      '2': 4,  // パワー
      '3': 3,  // スタンダード
      '4': 2,  // フレンド
      '5': 1,  // コネクト
    },
    
    // お付き合い度合いの色
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
      return `${d.getMonth() + 1}/${d.getDate()}`;
    },
    
    formatDateFull: (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    },
    
    getInitial: (name) => {
      if (!name) return '?';
      return name.charAt(0);
    },
    
    getRelationshipLevel: (relationship) => {
      if (!relationship) return '5';
      const match = relationship.match(/^(\d)/);
      return match ? match[1] : '5';
    },
    
    getRelationshipColor: (relationship) => {
      return CONFIG.RELATIONSHIP_COLORS[relationship] || '#6b7280';
    },
    
    // 日数計算
    getDaysSince: (dateStr) => {
      if (!dateStr) return null;
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now - date;
      return Math.floor(diff / (1000 * 60 * 60 * 24));
    },
    
    // ヘルスステータス判定
    getHealthStatus: (lastContactDate, relationship) => {
      if (!lastContactDate) return 'unknown';
      
      const level = Utils.getRelationshipLevel(relationship);
      const threshold = CONFIG.HEALTH_THRESHOLDS[level];
      
      if (!threshold || threshold.red === null) return 'none';
      
      const days = Utils.getDaysSince(lastContactDate);
      if (days === null) return 'unknown';
      
      if (days >= threshold.red) return 'red';
      if (days >= threshold.yellow) return 'yellow';
      return 'green';
    },
    
    // 写真URL取得
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
  let referralRecords = [];

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
  
  const fetchReferralRecords = async () => {
    try {
      const records = [];
      let offset = 0;
      const limit = 500;
      
      while (true) {
        const resp = await kintone.api('/k/v1/records', 'GET', {
          app: CONFIG.REFERRAL_APP_ID,
          query: `limit ${limit} offset ${offset}`,
        });
        records.push(...resp.records);
        if (resp.records.length < limit) break;
        offset += limit;
      }
      
      return records;
    } catch (e) {
      console.warn('紹介履歴の取得に失敗:', e);
      return [];
    }
  };

  // ========================================
  //  集計関数
  // ========================================
  
  // レベル別人数
  const aggregateByRelationship = (records) => {
    const counts = {};
    CONFIG.RELATIONSHIP_ORDER.forEach(rel => counts[rel] = 0);
    
    for (const record of records) {
      const rel = Utils.getFieldValue(record, CONFIG.FIELDS.RELATIONSHIP);
      if (counts[rel] !== undefined) {
        counts[rel]++;
      }
    }
    
    return counts;
  };
  
  // 人脈ポイント計算
  const calculateTotalPoints = (records) => {
    let total = 0;
    
    for (const record of records) {
      const rel = Utils.getFieldValue(record, CONFIG.FIELDS.RELATIONSHIP);
      const level = Utils.getRelationshipLevel(rel);
      const point = CONFIG.RELATIONSHIP_POINTS[level] || 1;
      total += point;
    }
    
    return total;
  };
  
  // ヘルス統計
  const aggregateHealthStats = (records) => {
    const stats = { green: 0, yellow: 0, red: 0, unknown: 0, none: 0 };
    
    for (const record of records) {
      const lastContact = Utils.getFieldValue(record, CONFIG.FIELDS.LAST_CONTACT);
      const relationship = Utils.getFieldValue(record, CONFIG.FIELDS.RELATIONSHIP);
      const status = Utils.getHealthStatus(lastContact, relationship);
      stats[status]++;
    }
    
    return stats;
  };
  
  // 要フォローリスト
  const getNeedFollowUp = (records, limit = 10) => {
    const needFollowUp = [];
    
    for (const record of records) {
      const name = Utils.getFieldValue(record, CONFIG.FIELDS.NAME);
      const lastContact = Utils.getFieldValue(record, CONFIG.FIELDS.LAST_CONTACT);
      const relationship = Utils.getFieldValue(record, CONFIG.FIELDS.RELATIONSHIP);
      const status = Utils.getHealthStatus(lastContact, relationship);
      
      if (status === 'red' || status === 'yellow') {
        const days = Utils.getDaysSince(lastContact);
        needFollowUp.push({
          record,
          name,
          relationship,
          days,
          status,
        });
      }
    }
    
    // 日数でソート（多い順）
    needFollowUp.sort((a, b) => (b.days || 9999) - (a.days || 9999));
    
    return needFollowUp.slice(0, limit);
  };
  
  // 今月の誕生日
  const getThisMonthBirthdays = (records) => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    const birthdays = [];
    
    for (const record of records) {
      const birthday = Utils.getFieldValue(record, CONFIG.FIELDS.BIRTHDAY);
      if (!birthday) continue;
      
      const d = new Date(birthday);
      const month = d.getMonth() + 1;
      const day = d.getDate();
      
      if (month === currentMonth) {
        birthdays.push({
          record,
          name: Utils.getFieldValue(record, CONFIG.FIELDS.NAME),
          day,
          isPast: day < currentDay,
          isToday: day === currentDay,
        });
      }
    }
    
    // 日付でソート
    birthdays.sort((a, b) => a.day - b.day);
    
    return birthdays;
  };
  
  // 紹介者ランキング
  const getReferrerRanking = (records, limit = 5) => {
    const referrerCounts = {};
    
    for (const record of records) {
      const referrer = Utils.getFieldValue(record, CONFIG.FIELDS.REFERRER);
      const referrerId = Utils.getFieldValue(record, CONFIG.FIELDS.REFERRER_ID);
      
      if (referrer && referrerId) {
        if (!referrerCounts[referrerId]) {
          referrerCounts[referrerId] = { name: referrer, count: 0 };
        }
        referrerCounts[referrerId].count++;
      }
    }
    
    const ranking = Object.values(referrerCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
    
    return ranking;
  };
  
  // Give/Takeカウント
  const getGiveTakeBalance = (peopleRecords, referralRecords) => {
    const giveCount = referralRecords.length;
    const takeCount = peopleRecords.filter(r => Utils.getFieldValue(r, CONFIG.FIELDS.REFERRER_ID)).length;
    
    return { giveCount, takeCount };
  };

  // ========================================
  //  スタイル
  // ========================================
  
  const injectStyles = () => {
    if (document.getElementById('hikari-mobile-dashboard-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'hikari-mobile-dashboard-styles';
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
    
    .hikari-mobile-dashboard {
      font-family: 'Noto Sans JP', sans-serif;
      background: linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 100%);
      min-height: 100vh;
      padding: 0;
      margin: -16px;
      color: #f7e7ce;
      padding-bottom: 80px;
    }
    
    /* ========== ヘッダー ========== */
    .hikari-m-header {
      background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%);
      padding: 20px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    
    .hikari-m-header-title {
      font-size: 1.3rem;
      font-weight: 700;
      color: #0a0a0a;
      text-align: center;
      letter-spacing: 0.1em;
    }
    
    /* ========== サマリーカード ========== */
    .hikari-m-summary {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      padding: 15px;
    }
    
    .hikari-m-summary-card {
      background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
      border: 1px solid rgba(212, 175, 55, 0.2);
      border-radius: 15px;
      padding: 15px;
      text-align: center;
    }
    
    .hikari-m-summary-card.large {
      grid-column: span 2;
    }
    
    .hikari-m-summary-value {
      font-size: 2rem;
      font-weight: 700;
      color: #d4af37;
      line-height: 1;
    }
    
    .hikari-m-summary-label {
      font-size: 0.8rem;
      color: #888;
      margin-top: 5px;
    }
    
    .hikari-m-summary-sub {
      font-size: 0.75rem;
      color: #666;
      margin-top: 8px;
    }
    
    /* ========== レベル別バー ========== */
    .hikari-m-levels {
      padding: 0 15px 15px;
    }
    
    .hikari-m-level-bar {
      display: flex;
      height: 30px;
      border-radius: 15px;
      overflow: hidden;
      background: #1a1a1a;
    }
    
    .hikari-m-level-segment {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.7rem;
      font-weight: 600;
      color: #0a0a0a;
      min-width: 30px;
      transition: all 0.3s ease;
    }
    
    .hikari-m-level-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
      justify-content: center;
    }
    
    .hikari-m-level-legend-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.7rem;
      color: #888;
    }
    
    .hikari-m-level-legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    
    /* ========== セクション ========== */
    .hikari-m-section {
      padding: 15px;
    }
    
    .hikari-m-section-title {
      font-size: 1rem;
      font-weight: 600;
      color: #d4af37;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .hikari-m-section-title-icon {
      font-size: 1.2rem;
    }
    
    /* ========== 要フォローリスト ========== */
    .hikari-m-follow-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    
    .hikari-m-follow-item {
      display: flex;
      align-items: center;
      gap: 12px;
      background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
      border: 1px solid rgba(212, 175, 55, 0.15);
      border-radius: 12px;
      padding: 12px 15px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .hikari-m-follow-item:active {
      transform: scale(0.98);
      background: #252525;
    }
    
    .hikari-m-follow-status {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    
    .hikari-m-follow-status.red { background: #ef4444; }
    .hikari-m-follow-status.yellow { background: #fbbf24; }
    
    .hikari-m-follow-info {
      flex: 1;
      min-width: 0;
    }
    
    .hikari-m-follow-name {
      font-size: 0.95rem;
      font-weight: 500;
      color: #f7e7ce;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .hikari-m-follow-rel {
      font-size: 0.75rem;
      color: #888;
    }
    
    .hikari-m-follow-days {
      font-size: 0.85rem;
      font-weight: 600;
      color: #ef4444;
      flex-shrink: 0;
    }
    
    .hikari-m-follow-days.yellow {
      color: #fbbf24;
    }
    
    .hikari-m-empty {
      text-align: center;
      color: #4ade80;
      padding: 20px;
      font-size: 0.9rem;
    }
    
    /* ========== 誕生日リスト ========== */
    .hikari-m-birthday-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .hikari-m-birthday-item {
      display: flex;
      align-items: center;
      gap: 12px;
      background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
      border: 1px solid rgba(212, 175, 55, 0.15);
      border-radius: 12px;
      padding: 12px 15px;
      cursor: pointer;
    }
    
    .hikari-m-birthday-item:active {
      transform: scale(0.98);
    }
    
    .hikari-m-birthday-item.today {
      border-color: #d4af37;
      background: linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.05) 100%);
    }
    
    .hikari-m-birthday-item.past {
      opacity: 0.5;
    }
    
    .hikari-m-birthday-date {
      font-size: 0.9rem;
      font-weight: 600;
      color: #d4af37;
      min-width: 50px;
    }
    
    .hikari-m-birthday-name {
      flex: 1;
      font-size: 0.95rem;
      color: #f7e7ce;
    }
    
    .hikari-m-birthday-badge {
      font-size: 0.7rem;
      padding: 3px 8px;
      border-radius: 10px;
      background: #d4af37;
      color: #0a0a0a;
      font-weight: 600;
    }
    
    /* ========== ご恩返しバランス ========== */
    .hikari-m-balance {
      background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
      border: 1px solid rgba(212, 175, 55, 0.2);
      border-radius: 15px;
      padding: 15px;
    }
    
    .hikari-m-balance-bar {
      display: flex;
      height: 35px;
      border-radius: 18px;
      overflow: hidden;
      background: #0a0a0a;
    }
    
    .hikari-m-balance-give {
      background: linear-gradient(90deg, #4ade80, #22c55e);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      font-weight: 600;
      color: #0a0a0a;
      min-width: 40px;
    }
    
    .hikari-m-balance-take {
      background: linear-gradient(90deg, #60a5fa, #3b82f6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      font-weight: 600;
      color: #0a0a0a;
      min-width: 40px;
    }
    
    .hikari-m-balance-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: #888;
      margin-top: 8px;
    }
    
    .hikari-m-balance-ratio {
      text-align: center;
      font-size: 0.85rem;
      color: #d4af37;
      margin-top: 10px;
    }
    
    /* ========== 紹介者ランキング ========== */
    .hikari-m-ranking-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .hikari-m-ranking-item {
      display: flex;
      align-items: center;
      gap: 12px;
      background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
      border: 1px solid rgba(212, 175, 55, 0.15);
      border-radius: 12px;
      padding: 12px 15px;
    }
    
    .hikari-m-ranking-rank {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      font-weight: 700;
      background: #d4af37;
      color: #0a0a0a;
    }
    
    .hikari-m-ranking-rank.silver {
      background: #c0c0c0;
    }
    
    .hikari-m-ranking-rank.bronze {
      background: #cd7f32;
    }
    
    .hikari-m-ranking-rank.normal {
      background: #444;
      color: #fff;
    }
    
    .hikari-m-ranking-name {
      flex: 1;
      font-size: 0.95rem;
      color: #f7e7ce;
    }
    
    .hikari-m-ranking-count {
      font-size: 0.85rem;
      color: #d4af37;
      font-weight: 600;
    }
    
    /* ========== 詳細モーダル ========== */
    .hikari-m-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.9);
      z-index: 1000;
      display: flex;
      align-items: flex-end;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
    }
    
    .hikari-m-modal-overlay.active {
      opacity: 1;
      visibility: visible;
    }
    
    .hikari-m-modal {
      background: linear-gradient(180deg, #1a1a2e 0%, #0a0a0a 100%);
      width: 100%;
      max-height: 85vh;
      border-radius: 25px 25px 0 0;
      overflow-y: auto;
      transform: translateY(100%);
      transition: transform 0.3s ease;
    }
    
    .hikari-m-modal-overlay.active .hikari-m-modal {
      transform: translateY(0);
    }
    
    .hikari-m-modal-handle {
      width: 40px;
      height: 5px;
      background: #444;
      border-radius: 3px;
      margin: 12px auto;
    }
    
    .hikari-m-modal-header {
      padding: 0 20px 15px;
      border-bottom: 1px solid rgba(212, 175, 55, 0.2);
    }
    
    .hikari-m-modal-name {
      font-size: 1.3rem;
      font-weight: 700;
      color: #f7e7ce;
    }
    
    .hikari-m-modal-company {
      font-size: 0.9rem;
      color: #888;
      margin-top: 4px;
    }
    
    .hikari-m-modal-body {
      padding: 20px;
    }
    
    .hikari-m-modal-actions {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    
    .hikari-m-modal-action-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 15px;
      border-radius: 12px;
      font-size: 0.9rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
    }
    
    .hikari-m-modal-action-btn.phone {
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: #fff;
    }
    
    .hikari-m-modal-action-btn.email {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: #fff;
    }
    
    .hikari-m-modal-action-btn:active {
      transform: scale(0.95);
    }
    
    .hikari-m-modal-info {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .hikari-m-modal-info-row {
      display: flex;
      gap: 10px;
    }
    
    .hikari-m-modal-info-label {
      font-size: 0.8rem;
      color: #888;
      min-width: 80px;
    }
    
    .hikari-m-modal-info-value {
      font-size: 0.9rem;
      color: #f7e7ce;
      flex: 1;
    }
    
    /* ========== ローディング ========== */
    .hikari-m-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      gap: 20px;
    }
    
    .hikari-m-loading-spinner {
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
    
    .hikari-m-loading-text {
      color: #d4af37;
      font-size: 0.9rem;
    }
    `;
    document.head.appendChild(style);
  };

  // ========================================
  //  レンダリング
  // ========================================
  
  const renderDashboard = (mount) => {
    // 集計
    const relationshipCounts = aggregateByRelationship(allRecords);
    const totalPoints = calculateTotalPoints(allRecords);
    const healthStats = aggregateHealthStats(allRecords);
    const needFollowUp = getNeedFollowUp(allRecords, 10);
    const birthdays = getThisMonthBirthdays(allRecords);
    const referrerRanking = getReferrerRanking(allRecords, 5);
    const { giveCount, takeCount } = getGiveTakeBalance(allRecords, referralRecords);
    
    // 健全率
    const healthyCount = healthStats.green + healthStats.none;
    const totalForHealth = allRecords.length - healthStats.unknown;
    const healthRate = totalForHealth > 0 ? Math.round((healthyCount / totalForHealth) * 100) : 0;
    
    // Give/Takeパーセント
    const total = giveCount + takeCount;
    const givePercent = total > 0 ? Math.round((giveCount / total) * 100) : 50;
    const giveRate = takeCount > 0 ? (giveCount / takeCount).toFixed(2) : giveCount > 0 ? '∞' : '0';
    
    // レベル別バーのHTML
    const levelBarHtml = CONFIG.RELATIONSHIP_ORDER.map(rel => {
      const count = relationshipCounts[rel] || 0;
      const percent = allRecords.length > 0 ? (count / allRecords.length) * 100 : 0;
      const color = CONFIG.RELATIONSHIP_COLORS[rel];
      return percent > 0 ? `
        <div class="hikari-m-level-segment" style="width: ${percent}%; background: ${color};">
          ${count}
        </div>
      ` : '';
    }).join('');
    
    // 凡例
    const legendHtml = CONFIG.RELATIONSHIP_ORDER.map(rel => {
      const count = relationshipCounts[rel] || 0;
      const color = CONFIG.RELATIONSHIP_COLORS[rel];
      const label = rel.replace(/^\d\./, '');
      return `
        <div class="hikari-m-level-legend-item">
          <div class="hikari-m-level-legend-dot" style="background: ${color};"></div>
          <span>${label}(${count})</span>
        </div>
      `;
    }).join('');
    
    // 要フォローリスト
    const followListHtml = needFollowUp.length > 0 
      ? needFollowUp.map(item => `
          <div class="hikari-m-follow-item" data-record-id="${Utils.getFieldValue(item.record, '$id')}">
            <div class="hikari-m-follow-status ${item.status}"></div>
            <div class="hikari-m-follow-info">
              <div class="hikari-m-follow-name">${Utils.escapeHtml(item.name)}</div>
              <div class="hikari-m-follow-rel">${item.relationship || '未設定'}</div>
            </div>
            <div class="hikari-m-follow-days ${item.status}">${item.days}日前</div>
          </div>
        `).join('')
      : '<div class="hikari-m-empty">🎉 全員フォロー済み！</div>';
    
    // 誕生日リスト
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const birthdayListHtml = birthdays.length > 0
      ? birthdays.map(item => `
          <div class="hikari-m-birthday-item ${item.isToday ? 'today' : ''} ${item.isPast ? 'past' : ''}" 
               data-record-id="${Utils.getFieldValue(item.record, '$id')}">
            <div class="hikari-m-birthday-date">${currentMonth}/${item.day}</div>
            <div class="hikari-m-birthday-name">${Utils.escapeHtml(item.name)}</div>
            ${item.isToday ? '<div class="hikari-m-birthday-badge">TODAY!</div>' : ''}
          </div>
        `).join('')
      : '<div class="hikari-m-empty">今月の誕生日はありません</div>';
    
    // 紹介者ランキング
    const rankingHtml = referrerRanking.length > 0
      ? referrerRanking.map((item, i) => `
          <div class="hikari-m-ranking-item">
            <div class="hikari-m-ranking-rank ${i === 1 ? 'silver' : i === 2 ? 'bronze' : i > 2 ? 'normal' : ''}">${i + 1}</div>
            <div class="hikari-m-ranking-name">${Utils.escapeHtml(item.name)}</div>
            <div class="hikari-m-ranking-count">${item.count}人</div>
          </div>
        `).join('')
      : '<div class="hikari-m-empty">データがありません</div>';
    
    mount.innerHTML = `
      <div class="hikari-mobile-dashboard">
        <!-- ヘッダー -->
        <div class="hikari-m-header">
          <div class="hikari-m-header-title">👥 人脈ダッシュボード</div>
        </div>
        
        <!-- サマリーカード -->
        <div class="hikari-m-summary">
          <div class="hikari-m-summary-card">
            <div class="hikari-m-summary-value">${allRecords.length}</div>
            <div class="hikari-m-summary-label">総人脈数</div>
          </div>
          <div class="hikari-m-summary-card">
            <div class="hikari-m-summary-value" style="color: #d4af37;">${totalPoints}</div>
            <div class="hikari-m-summary-label">人脈ポイント</div>
          </div>
          <div class="hikari-m-summary-card">
            <div class="hikari-m-summary-value" style="color: #4ade80;">${healthRate}%</div>
            <div class="hikari-m-summary-label">健全率</div>
          </div>
          <div class="hikari-m-summary-card">
            <div class="hikari-m-summary-value" style="color: #ef4444;">${healthStats.red + healthStats.yellow}</div>
            <div class="hikari-m-summary-label">要フォロー</div>
          </div>
        </div>
        
        <!-- レベル別バー -->
        <div class="hikari-m-levels">
          <div class="hikari-m-level-bar">
            ${levelBarHtml}
          </div>
          <div class="hikari-m-level-legend">
            ${legendHtml}
          </div>
        </div>
        
        <!-- 要フォロー -->
        <div class="hikari-m-section">
          <div class="hikari-m-section-title">
            <span class="hikari-m-section-title-icon">⚠️</span>
            要フォロー
          </div>
          <div class="hikari-m-follow-list">
            ${followListHtml}
          </div>
        </div>
        
        <!-- 今月の誕生日 -->
        <div class="hikari-m-section">
          <div class="hikari-m-section-title">
            <span class="hikari-m-section-title-icon">🎂</span>
            ${currentMonth}月の誕生日
          </div>
          <div class="hikari-m-birthday-list">
            ${birthdayListHtml}
          </div>
        </div>
        
        <!-- ご恩返しバランス -->
        <div class="hikari-m-section">
          <div class="hikari-m-section-title">
            <span class="hikari-m-section-title-icon">🎁</span>
            ご恩返しバランス
          </div>
          <div class="hikari-m-balance">
            <div class="hikari-m-balance-bar">
              <div class="hikari-m-balance-give" style="width: ${givePercent}%;">${giveCount}</div>
              <div class="hikari-m-balance-take" style="width: ${100 - givePercent}%;">${takeCount}</div>
            </div>
            <div class="hikari-m-balance-labels">
              <span>Give（紹介した）</span>
              <span>Take（紹介された）</span>
            </div>
            <div class="hikari-m-balance-ratio">Give/Take比率: ${giveRate}</div>
          </div>
        </div>
        
        <!-- 紹介者ランキング -->
        <div class="hikari-m-section">
          <div class="hikari-m-section-title">
            <span class="hikari-m-section-title-icon">🏆</span>
            紹介者ランキング
          </div>
          <div class="hikari-m-ranking-list">
            ${rankingHtml}
          </div>
        </div>
        
        <!-- モーダル -->
        <div class="hikari-m-modal-overlay" id="hikari-modal-overlay">
          <div class="hikari-m-modal" id="hikari-modal">
            <div class="hikari-m-modal-handle"></div>
            <div class="hikari-m-modal-header" id="hikari-modal-header"></div>
            <div class="hikari-m-modal-body" id="hikari-modal-body"></div>
          </div>
        </div>
      </div>
    `;
    
    // イベント設定
    setupEventListeners();
  };
  
  // ========================================
  //  イベント
  // ========================================
  
  const setupEventListeners = () => {
    // 要フォローアイテムクリック
    document.querySelectorAll('.hikari-m-follow-item').forEach(item => {
      item.addEventListener('click', () => {
        const recordId = item.dataset.recordId;
        const record = allRecords.find(r => Utils.getFieldValue(r, '$id') === recordId);
        if (record) showDetailModal(record);
      });
    });
    
    // 誕生日アイテムクリック
    document.querySelectorAll('.hikari-m-birthday-item').forEach(item => {
      item.addEventListener('click', () => {
        const recordId = item.dataset.recordId;
        const record = allRecords.find(r => Utils.getFieldValue(r, '$id') === recordId);
        if (record) showDetailModal(record);
      });
    });
    
    // モーダルオーバーレイクリックで閉じる
    const overlay = document.getElementById('hikari-modal-overlay');
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });
  };
  
  // 詳細モーダル
  const showDetailModal = (record) => {
    const name = Utils.getFieldValue(record, CONFIG.FIELDS.NAME);
    const company = Utils.getFieldValue(record, CONFIG.FIELDS.COMPANY);
    const position = Utils.getFieldValue(record, CONFIG.FIELDS.POSITION);
    const phone = Utils.getFieldValue(record, CONFIG.FIELDS.PHONE);
    const email = Utils.getFieldValue(record, CONFIG.FIELDS.EMAIL);
    const relationship = Utils.getFieldValue(record, CONFIG.FIELDS.RELATIONSHIP);
    const lastContact = Utils.getFieldValue(record, CONFIG.FIELDS.LAST_CONTACT);
    const lastContactType = Utils.getFieldValue(record, CONFIG.FIELDS.LAST_CONTACT_TYPE);
    const notes = Utils.getFieldValue(record, CONFIG.FIELDS.NOTES);
    const id = Utils.getFieldValue(record, '$id');
    
    const header = document.getElementById('hikari-modal-header');
    const body = document.getElementById('hikari-modal-body');
    
    header.innerHTML = `
      <div class="hikari-m-modal-name">${Utils.escapeHtml(name)}</div>
      <div class="hikari-m-modal-company">${Utils.escapeHtml(company)} ${position ? `/ ${Utils.escapeHtml(position)}` : ''}</div>
    `;
    
    body.innerHTML = `
      <div class="hikari-m-modal-actions">
        ${phone ? `<a href="tel:${phone}" class="hikari-m-modal-action-btn phone">📞 電話</a>` : ''}
        ${email ? `<a href="mailto:${email}" class="hikari-m-modal-action-btn email">✉️ メール</a>` : ''}
      </div>
      <div class="hikari-m-modal-info">
        <div class="hikari-m-modal-info-row">
          <div class="hikari-m-modal-info-label">お付き合い</div>
          <div class="hikari-m-modal-info-value">${relationship || '未設定'}</div>
        </div>
        <div class="hikari-m-modal-info-row">
          <div class="hikari-m-modal-info-label">最終接点</div>
          <div class="hikari-m-modal-info-value">${lastContact ? `${Utils.formatDateFull(lastContact)} (${lastContactType || ''})` : '未記録'}</div>
        </div>
        ${phone ? `
        <div class="hikari-m-modal-info-row">
          <div class="hikari-m-modal-info-label">電話番号</div>
          <div class="hikari-m-modal-info-value">${Utils.escapeHtml(phone)}</div>
        </div>
        ` : ''}
        ${email ? `
        <div class="hikari-m-modal-info-row">
          <div class="hikari-m-modal-info-label">メール</div>
          <div class="hikari-m-modal-info-value">${Utils.escapeHtml(email)}</div>
        </div>
        ` : ''}
        ${notes ? `
        <div class="hikari-m-modal-info-row">
          <div class="hikari-m-modal-info-label">メモ</div>
          <div class="hikari-m-modal-info-value">${Utils.escapeHtml(notes)}</div>
        </div>
        ` : ''}
      </div>
    `;
    
    document.getElementById('hikari-modal-overlay').classList.add('active');
  };
  
  const closeModal = () => {
    document.getElementById('hikari-modal-overlay').classList.remove('active');
  };

  // ========================================
  //  初期化
  // ========================================
  
  const init = async (mount) => {
    console.log('🌟 HIKARI Mobile Dashboard initializing...');
    
    injectStyles();
    
    // ローディング表示
    mount.innerHTML = `
      <div class="hikari-mobile-dashboard">
        <div class="hikari-m-loading">
          <div class="hikari-m-loading-spinner"></div>
          <div class="hikari-m-loading-text">データを読み込み中...</div>
        </div>
      </div>
    `;
    
    try {
      // データ取得
      [allRecords, referralRecords] = await Promise.all([
        fetchAllRecords(),
        fetchReferralRecords(),
      ]);
      
      console.log(`✅ 人脈: ${allRecords.length}件, 紹介履歴: ${referralRecords.length}件`);
      
      // 描画
      renderDashboard(mount);
      
      console.log('✅ HIKARI Mobile Dashboard initialized');
      
    } catch (error) {
      console.error('❌ 初期化エラー:', error);
      mount.innerHTML = `
        <div class="hikari-mobile-dashboard">
          <div class="hikari-m-loading">
            <div style="color: #ef4444; font-size: 2rem;">⚠️</div>
            <div class="hikari-m-loading-text">データの取得に失敗しました</div>
          </div>
        </div>
      `;
    }
  };

  // ========================================
  //  イベント登録
  // ========================================
  
  kintone.events.on('mobile.app.record.index.show', (event) => {
    // モバイルカスタムビューの場合のみ実行
    // ★VIEW_IDを設定した場合は条件を追加
    // if (event.viewId !== CONFIG.VIEW_ID) return event;
    
    const mount = kintone.mobile.app.getHeaderSpaceElement();
    if (mount) {
      init(mount);
    }
    
    return event;
  });

})();
