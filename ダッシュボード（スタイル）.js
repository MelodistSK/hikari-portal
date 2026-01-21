/**
 * HIKARI Portal - Core
 * ベース機能：スタイル、ユーティリティ関数、API、グローバル変数
 */

(function(HIKARI) {
  'use strict';

  // ========================================
  //  設定値
  // ========================================
  
  HIKARI.CONFIG = {
    // アプリID
    APPS: {
      PEOPLE: 6,              // 人脈管理アプリ
      REFERRAL_HISTORY: 10,    // 紹介履歴アプリ
    },
    
    // フィールドコード（人脈管理アプリ）
    PEOPLE_FIELDS: {
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
      MEMO: 'shokai_memo',
      LAST_CONTACT_DATE: 'last_contact_date',
      LAST_CONTACT_TYPE: 'last_contact_type',
      CONTACT_COUNT: 'contact_count',
      CONTACT_HISTORY: 'contact_history',
    },
    
    // フィールドコード（紹介履歴アプリ）
    REFERRAL_FIELDS: {
      DATE: 'referral_date',
      PERSON_NAME: 'referred_person_name',
      PERSON_ID: 'referred_person_id',
      TO_NAME: 'introduced_to_name',
      TO_ID: 'introduced_to_id',
      REASON: 'reason',
      STATUS: 'result_status',
      MEMO: 'result_memo',
    },
    
    // 疎遠アラート基準（日数）
    HEALTH_THRESHOLDS: {
      '1': { yellow: 30, red: 60 },
      '2': { yellow: 45, red: 90 },
      '3': { yellow: 60, red: 120 },
      '4': { yellow: 90, red: 180 },
      '5': { yellow: null, red: null },
    },
    
    // お付き合い度合いのポイント
    RELATIONSHIP_POINTS: {
      '1': 5, '2': 4, '3': 3, '4': 2, '5': 1,
    },
    
    // お付き合い度合いの色
    RELATIONSHIP_COLORS: {
      '1': '#d4af37',
      '2': '#c0c0c0',
      '3': '#cd7f32',
      '4': '#4a90d9',
      '5': '#666666',
    },
    
    // お付き合い度合いの名前
    RELATIONSHIP_NAMES: {
      '1': 'プライム',
      '2': 'パワー',
      '3': 'スタンダード',
      '4': 'フレンド',
      '5': 'コネクト',
    },
  };

  // ========================================
  //  グローバルデータ
  // ========================================
  
  HIKARI.data = {
    peopleRecords: [],
    referralRecords: [],
    contactTypeOptions: [],
    resultStatusOptions: [],
    isLoaded: false,
  };

  // ========================================
  //  ユーティリティ関数
  // ========================================
  
  HIKARI.utils = {
    // フィールド値を安全に取得
    getFieldValue: (record, fieldCode) => {
      const field = record[fieldCode];
      return field && field.value !== undefined ? field.value : null;
    },

    // 日付フォーマット（YYYY/M/D）
    formatDate: (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    },

    // 日付フォーマット（M月D日）
    formatDateShort: (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return `${d.getMonth() + 1}月${d.getDate()}日`;
    },

    // 曜日付き日付
    formatDateWithDay: (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      const days = ['日', '月', '火', '水', '木', '金', '土'];
      return `${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
    },

    // 年齢計算
    calculateAge: (birthday) => {
      if (!birthday) return null;
      const today = new Date();
      const birth = new Date(birthday);
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    },

    // 経過日数計算
    getDaysPassed: (dateStr) => {
      if (!dateStr) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(dateStr);
      target.setHours(0, 0, 0, 0);
      return Math.floor((today - target) / (1000 * 60 * 60 * 24));
    },

    // 誕生日までの日数
    getDaysUntilBirthday: (birthday) => {
      if (!birthday) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const birth = new Date(birthday);
      birth.setFullYear(today.getFullYear());
      birth.setHours(0, 0, 0, 0);
      if (birth < today) {
        birth.setFullYear(today.getFullYear() + 1);
      }
      return Math.floor((birth - today) / (1000 * 60 * 60 * 24));
    },

    // ヘルスステータス判定
    getHealthStatus: (lastContactDate, relationshipLevel) => {
      if (!lastContactDate || !relationshipLevel) return 'unknown';
      const levelNumber = relationshipLevel.charAt(0);
      const thresholds = HIKARI.CONFIG.HEALTH_THRESHOLDS[levelNumber];
      if (!thresholds || thresholds.yellow === null) return 'none';
      const daysPassed = HIKARI.utils.getDaysPassed(lastContactDate);
      if (daysPassed >= thresholds.red) return 'red';
      if (daysPassed >= thresholds.yellow) return 'yellow';
      return 'green';
    },

    // お付き合い度合いから表示名を取得
    getRelationshipDisplayName: (relationship) => {
      if (!relationship) return '未設定';
      if (relationship.includes('.')) return relationship.split('.')[1].trim();
      if (relationship.includes(':')) return relationship.split(':')[1].trim();
      if (relationship.includes('：')) return relationship.split('：')[1].trim();
      return relationship;
    },

    // お付き合い度合いからレベル番号を取得
    getRelationshipLevel: (relationship) => {
      if (!relationship) return '5';
      return relationship.charAt(0) || '5';
    },

    // イニシャル取得
    getInitial: (name) => {
      if (!name) return '?';
      return name.charAt(0);
    },

    // スコア計算（バブルチャート用）
    calculateScore: (record, referralCount) => {
      const contactCount = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.CONTACT_COUNT) || 0;
      const relationship = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.RELATIONSHIP);
      const level = HIKARI.utils.getRelationshipLevel(relationship);
      const relationshipPoint = HIKARI.CONFIG.RELATIONSHIP_POINTS[level] || 1;
      return (referralCount * 2) + (contactCount * 0.5) + (relationshipPoint * 3);
    },

    // 数値のフォーマット
    formatNumber: (num) => {
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    // アニメーション付きカウントアップ
    animateCount: (element, target, duration = 1000) => {
      const start = 0;
      const startTime = performance.now();
      
      const updateCount = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(start + (target - start) * easeOut);
        element.textContent = HIKARI.utils.formatNumber(current);
        
        if (progress < 1) {
          requestAnimationFrame(updateCount);
        }
      };
      
      requestAnimationFrame(updateCount);
    },
  };

  // ========================================
  //  API関数
  // ========================================
  
  HIKARI.api = {
    // 人脈アプリから全レコード取得
    fetchAllPeopleRecords: async () => {
      const records = [];
      let offset = 0;
      const limit = 500;
      
      while (true) {
        const query = `limit ${limit} offset ${offset}`;
        const resp = await kintone.api('/k/v1/records', 'GET', {
          app: HIKARI.CONFIG.APPS.PEOPLE,
          query: query,
        });
        records.push(...resp.records);
        if (resp.records.length < limit) break;
        offset += limit;
        if (offset >= 10000) break;
      }
      return records;
    },

    // 紹介履歴アプリから全レコード取得
    fetchAllReferralRecords: async () => {
      const records = [];
      let offset = 0;
      const limit = 500;
      
      while (true) {
        const query = `limit ${limit} offset ${offset}`;
        const resp = await kintone.api('/k/v1/records', 'GET', {
          app: HIKARI.CONFIG.APPS.REFERRAL_HISTORY,
          query: query,
        });
        records.push(...resp.records);
        if (resp.records.length < limit) break;
        offset += limit;
        if (offset >= 10000) break;
      }
      return records;
    },

    // ドロップダウン選択肢を取得
    fetchDropdownOptions: async (appId, fieldCode) => {
      const resp = await kintone.api('/k/v1/app/form/fields', 'GET', { app: appId });
      const field = resp.properties[fieldCode];
      if (field && field.options) {
        return Object.keys(field.options);
      }
      return [];
    },

    // 全データ取得
    fetchAllData: async () => {
      console.log('📦 データ取得開始...');
      
      const [peopleRecords, referralRecords, contactTypes] = await Promise.all([
        HIKARI.api.fetchAllPeopleRecords(),
        HIKARI.api.fetchAllReferralRecords(),
        HIKARI.api.fetchDropdownOptions(HIKARI.CONFIG.APPS.PEOPLE, 'contact_type'),
      ]);
      
      HIKARI.data.peopleRecords = peopleRecords;
      HIKARI.data.referralRecords = referralRecords;
      HIKARI.data.contactTypeOptions = contactTypes;
      HIKARI.data.isLoaded = true;
      
      console.log(`✅ 人脈: ${peopleRecords.length}件`);
      console.log(`✅ 紹介履歴: ${referralRecords.length}件`);
      
      return HIKARI.data;
    },
  };

  // ========================================
  //  集計関数
  // ========================================
  
  HIKARI.aggregation = {
    // 紹介者別の紹介数を集計
    aggregateReferrals: () => {
      const referrerCounts = {};
      
      for (const record of HIKARI.data.peopleRecords) {
        const referrer = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.REFERRER);
        const referrerId = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.REFERRER_ID);
        const relationship = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.RELATIONSHIP);
        
        if (referrer && referrerId) {
          if (!referrerCounts[referrerId]) {
            referrerCounts[referrerId] = { name: referrer, count: 0, quality: 0 };
          }
          referrerCounts[referrerId].count++;
          
          const level = HIKARI.utils.getRelationshipLevel(relationship);
          const point = HIKARI.CONFIG.RELATIONSHIP_POINTS[level] || 1;
          referrerCounts[referrerId].quality += point;
        }
      }
      
      return referrerCounts;
    },

    // Give（紹介した）数を集計
    getGiveCount: () => {
      return HIKARI.data.referralRecords.length;
    },

    // Take（紹介された）数を集計
    getTakeCount: () => {
      return HIKARI.data.peopleRecords.filter(r => 
        HIKARI.utils.getFieldValue(r, HIKARI.CONFIG.PEOPLE_FIELDS.REFERRER_ID)
      ).length;
    },

    // ヘルス統計
    getHealthStats: () => {
      const stats = { green: 0, yellow: 0, red: 0, unknown: 0, none: 0 };
      
      for (const record of HIKARI.data.peopleRecords) {
        const lastContact = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.LAST_CONTACT_DATE);
        const relationship = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.RELATIONSHIP);
        const status = HIKARI.utils.getHealthStatus(lastContact, relationship);
        stats[status]++;
      }
      
      return stats;
    },

    // 関係性別の人数
    getRelationshipDistribution: () => {
      const dist = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
      
      for (const record of HIKARI.data.peopleRecords) {
        const relationship = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.RELATIONSHIP);
        const level = HIKARI.utils.getRelationshipLevel(relationship);
        dist[level]++;
      }
      
      return dist;
    },

    // 今週の誕生日リスト
    getUpcomingBirthdays: (days = 7) => {
      const upcoming = [];
      
      for (const record of HIKARI.data.peopleRecords) {
        const birthday = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.BIRTHDAY);
        if (!birthday) continue;
        
        const daysUntil = HIKARI.utils.getDaysUntilBirthday(birthday);
        if (daysUntil !== null && daysUntil <= days) {
          upcoming.push({
            record,
            name: HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.NAME),
            birthday: birthday,
            daysUntil: daysUntil,
            age: HIKARI.utils.calculateAge(birthday) + 1, // 次の誕生日の年齢
          });
        }
      }
      
      return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
    },

    // 要フォローリスト
    getNeedFollowUp: (limit = 10) => {
      const list = [];
      
      for (const record of HIKARI.data.peopleRecords) {
        const lastContact = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.LAST_CONTACT_DATE);
        const relationship = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.RELATIONSHIP);
        const status = HIKARI.utils.getHealthStatus(lastContact, relationship);
        
        if (status === 'red' || status === 'yellow') {
          list.push({
            record,
            name: HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.NAME),
            company: HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.COMPANY),
            status,
            daysPassed: HIKARI.utils.getDaysPassed(lastContact),
            relationship,
          });
        }
      }
      
      return list.sort((a, b) => (b.daysPassed || 0) - (a.daysPassed || 0)).slice(0, limit);
    },

    // 最近の接点履歴
    getRecentContacts: (limit = 10) => {
      const contacts = [];
      
      for (const record of HIKARI.data.peopleRecords) {
        const history = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.CONTACT_HISTORY);
        if (!history || history.length === 0) continue;
        
        const name = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.NAME);
        
        for (const item of history) {
          contacts.push({
            record,
            name,
            date: item.value.contact_date?.value,
            type: item.value.contact_type?.value,
            memo: item.value.contact_memo?.value,
          });
        }
      }
      
      return contacts
        .filter(c => c.date)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, limit);
    },

    // ランキング（量）
    getRankingByCount: (limit = 10) => {
      const aggregation = HIKARI.aggregation.aggregateReferrals();
      return Object.entries(aggregation)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    },

    // ランキング（質）
    getRankingByQuality: (limit = 10) => {
      const aggregation = HIKARI.aggregation.aggregateReferrals();
      return Object.entries(aggregation)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.quality - a.quality)
        .slice(0, limit);
    },
  };

  // ========================================
  //  スタイル
  // ========================================
  
  HIKARI.STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;900&display=swap');
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    /* kintone標準UIを完全非表示 */
    #portal-header,
    .gaia-header,
    .gaia-header-toolbar,
    .gaia-argoui-portal-header,
    .gaia-argoui-portal-content,
    .gaia-argoui-portal-nav,
    .gaia-argoui-portal-announcement,
    .gaia-argoui-portal-space,
    .gaia-argoui-portal-appshortcuts,
    .gaia-argoui-portal-notifications,
    .ocean-portal-header,
    .ocean-portal-content {
      display: none !important;
    }
    
    body {
      overflow-x: hidden;
    }
    
    /* ========== ベーススタイル ========== */
    .hikari-portal {
      font-family: 'Noto Sans JP', sans-serif;
      background: #0a0a0a;
      min-height: 100vh;
      color: #f7e7ce;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      overflow-y: auto;
      z-index: 10000;
    }
    
    /* ========== ヘッダー ========== */
    .hikari-header {
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
      border-bottom: 1px solid rgba(212, 175, 55, 0.3);
      padding: 20px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    
    .hikari-logo {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    
    .hikari-logo-icon {
      width: 50px;
      height: 50px;
      background: linear-gradient(135deg, #d4af37, #b8941f);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
    }
    
    .hikari-logo-text {
      font-size: 2rem;
      font-weight: 900;
      letter-spacing: 0.2em;
      background: linear-gradient(135deg, #d4af37, #f7e7ce);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .hikari-header-right {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    
    .hikari-user-info {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #888;
    }
    
    .hikari-user-avatar {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #d4af37, #b8941f);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #0a0a0a;
      font-weight: 700;
    }
    
    .hikari-app-btn {
      background: linear-gradient(135deg, #d4af37, #b8941f);
      color: #0a0a0a;
      border: none;
      padding: 12px 30px;
      border-radius: 30px;
      font-family: inherit;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .hikari-app-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(212, 175, 55, 0.4);
    }
    
    /* ========== タブナビゲーション ========== */
    .hikari-tab-nav {
      display: flex;
      justify-content: center;
      gap: 10px;
      padding: 30px 40px 0;
      background: linear-gradient(180deg, #0a0a0a 0%, #0f0f0f 100%);
    }
    
    .hikari-tab-btn {
      background: transparent;
      border: 1px solid rgba(212, 175, 55, 0.2);
      color: #888;
      padding: 15px 35px;
      border-radius: 15px 15px 0 0;
      font-family: inherit;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .hikari-tab-btn:hover {
      color: #f7e7ce;
      border-color: rgba(212, 175, 55, 0.4);
    }
    
    .hikari-tab-btn.active {
      background: #1a1a1a;
      color: #d4af37;
      border-color: rgba(212, 175, 55, 0.5);
      border-bottom-color: #1a1a1a;
    }
    
    .hikari-tab-icon {
      font-size: 1.3rem;
    }
    
    /* ========== タブコンテンツ ========== */
    .hikari-tab-content-wrapper {
      background: #1a1a1a;
      min-height: calc(100vh - 180px);
      padding: 40px;
    }
    
    .hikari-tab-content {
      display: none;
      max-width: 1600px;
      margin: 0 auto;
      animation: fadeIn 0.5s ease;
    }
    
    .hikari-tab-content.active {
      display: block;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    /* ========== カードスタイル ========== */
    .hikari-card {
      background: rgba(26, 26, 26, 0.9);
      border: 1px solid rgba(212, 175, 55, 0.2);
      border-radius: 20px;
      padding: 25px;
      transition: all 0.3s ease;
    }
    
    .hikari-card:hover {
      border-color: rgba(212, 175, 55, 0.4);
    }
    
    .hikari-card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid rgba(212, 175, 55, 0.2);
    }
    
    .hikari-card-icon {
      font-size: 1.5rem;
    }
    
    .hikari-card-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: #d4af37;
    }
    
    /* ========== KPIスタイル ========== */
    .hikari-kpi-large {
      text-align: center;
      padding: 30px;
    }
    
    .hikari-kpi-value {
      font-size: 4rem;
      font-weight: 900;
      background: linear-gradient(135deg, #d4af37, #f7e7ce);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1;
    }
    
    .hikari-kpi-label {
      font-size: 1rem;
      color: #888;
      margin-top: 10px;
    }
    
    .hikari-kpi-change {
      font-size: 0.9rem;
      margin-top: 8px;
    }
    
    .hikari-kpi-change.positive { color: #4ade80; }
    .hikari-kpi-change.negative { color: #ef4444; }
    
    /* ========== リストスタイル ========== */
    .hikari-list {
      list-style: none;
    }
    
    .hikari-list-item {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 15px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      cursor: pointer;
      transition: all 0.3s ease;
      border-radius: 10px;
      margin-bottom: 5px;
    }
    
    .hikari-list-item:hover {
      background: rgba(212, 175, 55, 0.1);
    }
    
    .hikari-list-item:last-child {
      border-bottom: none;
    }
    
    /* ========== ステータスインジケーター ========== */
    .hikari-status {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    
    .hikari-status.green { background: #4ade80; box-shadow: 0 0 10px #4ade80; }
    .hikari-status.yellow { background: #fbbf24; box-shadow: 0 0 10px #fbbf24; }
    .hikari-status.red { background: #ef4444; box-shadow: 0 0 10px #ef4444; }
    
    /* ========== ランクバッジ ========== */
    .hikari-rank {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      font-weight: 700;
      background: linear-gradient(135deg, #d4af37, #b8941f);
      color: #0a0a0a;
      flex-shrink: 0;
    }
    
    .hikari-rank.silver { background: linear-gradient(135deg, #c0c0c0, #a0a0a0); }
    .hikari-rank.bronze { background: linear-gradient(135deg, #cd7f32, #a0522d); }
    .hikari-rank.normal { background: #333; color: #888; }
    
    /* ========== プログレスバー ========== */
    .hikari-progress-bar {
      height: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
    }
    
    .hikari-progress-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 1s ease;
    }
    
    /* ========== バブルチャート ========== */
    .hikari-bubble-container {
      position: relative;
      width: 100%;
      height: 500px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 15px;
      overflow: hidden;
    }
    
    .hikari-bubble {
      position: absolute;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #0a0a0a;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s ease;
      text-align: center;
      line-height: 1.2;
    }
    
    .hikari-bubble:hover {
      transform: scale(1.15);
      z-index: 100;
      box-shadow: 0 0 30px rgba(212, 175, 55, 0.5);
    }
    
    .hikari-bubble-tooltip {
      position: absolute;
      background: #0a0a0a;
      border: 1px solid #d4af37;
      padding: 10px 15px;
      border-radius: 10px;
      font-size: 0.85rem;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease;
      z-index: 200;
    }
    
    .hikari-bubble:hover .hikari-bubble-tooltip {
      opacity: 1;
    }
    
    /* ========== バランスバー ========== */
    .hikari-balance-bar {
      display: flex;
      height: 50px;
      border-radius: 25px;
      overflow: hidden;
      margin: 20px 0;
    }
    
    .hikari-balance-give {
      background: linear-gradient(135deg, #d4af37, #b8941f);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #0a0a0a;
      font-weight: 700;
      font-size: 1.1rem;
      transition: width 1s ease;
    }
    
    .hikari-balance-take {
      background: linear-gradient(135deg, #4a90d9, #2563eb);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 700;
      font-size: 1.1rem;
      transition: width 1s ease;
    }
    
    /* ========== ローディング ========== */
    .hikari-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      gap: 30px;
    }
    
    .hikari-loading-spinner {
      width: 80px;
      height: 80px;
      border: 4px solid rgba(212, 175, 55, 0.2);
      border-top-color: #d4af37;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .hikari-loading-text {
      color: #d4af37;
      font-size: 1.2rem;
      font-weight: 500;
    }
    
    .hikari-loading-sub {
      color: #666;
      font-size: 0.9rem;
    }
    
    /* ========== 空の状態 ========== */
    .hikari-empty {
      text-align: center;
      padding: 40px;
      color: #666;
    }
    
    .hikari-empty-icon {
      font-size: 3rem;
      margin-bottom: 15px;
    }
    
    /* ========== グリッドレイアウト ========== */
    .hikari-grid {
      display: grid;
      gap: 25px;
    }
    
    .hikari-grid-2 { grid-template-columns: repeat(2, 1fr); }
    .hikari-grid-3 { grid-template-columns: repeat(3, 1fr); }
    .hikari-grid-4 { grid-template-columns: repeat(4, 1fr); }
    
    @media (max-width: 1200px) {
      .hikari-grid-4 { grid-template-columns: repeat(2, 1fr); }
      .hikari-grid-3 { grid-template-columns: repeat(2, 1fr); }
    }
    
    @media (max-width: 768px) {
      .hikari-grid-2, .hikari-grid-3, .hikari-grid-4 {
        grid-template-columns: 1fr;
      }
      
      .hikari-header {
        flex-direction: column;
        gap: 20px;
        padding: 20px;
      }
      
      .hikari-tab-nav {
        flex-wrap: wrap;
        padding: 20px 20px 0;
      }
      
      .hikari-tab-btn {
        padding: 12px 20px;
        font-size: 0.9rem;
      }
      
      .hikari-tab-content-wrapper {
        padding: 20px;
      }
    }
    
    /* ========== アニメーション ========== */
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    .hikari-animate-slide-up {
      animation: slideUp 0.6s ease forwards;
    }
    
    .hikari-animate-delay-1 { animation-delay: 0.1s; }
    .hikari-animate-delay-2 { animation-delay: 0.2s; }
    .hikari-animate-delay-3 { animation-delay: 0.3s; }
    .hikari-animate-delay-4 { animation-delay: 0.4s; }
    
    /* ========== マップ（Googleマップ風） ========== */
    .hikari-map-viewport {
      width: 100%;
      height: 550px;
      overflow: auto;
      position: relative;
      cursor: grab;
      background: linear-gradient(135deg, #0a0a0a 0%, #151515 100%);
      border-radius: 15px;
    }
    
    .hikari-map-viewport.dragging {
      cursor: grabbing;
      user-select: none;
    }
    
    .hikari-map-viewport::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    
    .hikari-map-viewport::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.3);
    }
    
    .hikari-map-viewport::-webkit-scrollbar-thumb {
      background: rgba(212, 175, 55, 0.3);
      border-radius: 4px;
    }
    
    .hikari-map-viewport::-webkit-scrollbar-thumb:hover {
      background: rgba(212, 175, 55, 0.5);
    }
    
    .hikari-map-canvas {
      position: relative;
      background: 
        radial-gradient(circle at center, rgba(212, 175, 55, 0.03) 0%, transparent 50%);
    }
    
    .hikari-map-grid {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: 
        radial-gradient(circle, rgba(212, 175, 55, 0.1) 1px, transparent 1px);
      background-size: 50px 50px;
      pointer-events: none;
    }
    
    .hikari-map-center-marker {
      position: absolute;
      width: 20px;
      height: 20px;
      margin-left: -10px;
      margin-top: -10px;
      border: 2px solid rgba(212, 175, 55, 0.3);
      border-radius: 50%;
      pointer-events: none;
    }
    
    .hikari-map-center-marker::before,
    .hikari-map-center-marker::after {
      content: '';
      position: absolute;
      background: rgba(212, 175, 55, 0.2);
    }
    
    .hikari-map-center-marker::before {
      width: 1px;
      height: 40px;
      left: 50%;
      top: -10px;
      transform: translateX(-50%);
    }
    
    .hikari-map-center-marker::after {
      width: 40px;
      height: 1px;
      top: 50%;
      left: -10px;
      transform: translateY(-50%);
    }
    
    .hikari-map-bubble {
      position: absolute;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #0a0a0a;
      font-weight: 700;
      cursor: pointer;
      transition: box-shadow 0.2s ease, filter 0.2s ease;
      text-align: center;
      line-height: 1.2;
      user-select: none;
      border: 2px solid rgba(0, 0, 0, 0.2);
    }
    
    .hikari-map-bubble:hover {
      z-index: 100;
      box-shadow: 0 0 25px rgba(212, 175, 55, 0.6);
      filter: brightness(1.1);
    }
    
    .hikari-map-ctrl-btn {
      background: rgba(212, 175, 55, 0.15);
      border: 1px solid rgba(212, 175, 55, 0.3);
      color: #d4af37;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      font-size: 1.1rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .hikari-map-ctrl-btn:hover {
      background: #d4af37;
      color: #0a0a0a;
    }
    
    .hikari-map-ctrl-btn-text {
      width: auto;
      padding: 0 12px;
      font-size: 0.85rem;
      font-weight: 500;
    }
    
    .hikari-minimap {
      position: absolute;
      bottom: 15px;
      right: 15px;
      width: 120px;
      height: 120px;
      background: rgba(0, 0, 0, 0.85);
      border: 1px solid rgba(212, 175, 55, 0.4);
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
    }
    
    .hikari-minimap:hover {
      border-color: rgba(212, 175, 55, 0.7);
    }
    
    .hikari-minimap-dot {
      position: absolute;
      width: 4px;
      height: 4px;
      margin-left: -2px;
      margin-top: -2px;
      border-radius: 50%;
      pointer-events: none;
    }
    
    .hikari-minimap-viewport {
      position: absolute;
      border: 2px solid #d4af37;
      background: rgba(212, 175, 55, 0.1);
      border-radius: 2px;
      pointer-events: none;
      box-shadow: 0 0 10px rgba(212, 175, 55, 0.3);
    }
    
    .hikari-map-tooltip {
      position: absolute;
      background: rgba(10, 10, 10, 0.95);
      border: 1px solid #d4af37;
      color: #f7e7ce;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 0.9rem;
      pointer-events: none;
      z-index: 1000;
      transform: translate(-50%, -100%);
      opacity: 0;
      transition: opacity 0.15s ease;
      white-space: nowrap;
      box-shadow: 0 5px 20px rgba(0, 0, 0, 0.5);
    }
    
    .hikari-map-tooltip.visible {
      opacity: 1;
    }
  `;

})(window.HIKARI = window.HIKARI || {});