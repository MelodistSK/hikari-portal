(function() {
  'use strict';

  // ========================================
  //  設定値（環境に応じて変更してください）
  // ========================================
  
  const CONFIG = {
    // ■ アプリケーションID
    APPS: {
      TARGET_APP_ID: kintone.app.getId(),           // 現在のアプリID（人脈管理アプリ）
      TEMPLATE_APP_ID: 9,                          // メールテンプレートアプリのID
    },
    
    // ■ ビューID
    VIEWS: {
      FORM_VIEW_ID: 6532482,                        // 名刺スキャナー用カスタムビューのID
    },
    
// ■ 外部API設定
EXTERNAL_API: {
  // Google Vision API
  VISION_API_KEY: 'AIzaSyDvSBi6S_WOwB5QEWU1DB0uPIzIw_EqZMQ',
  
  // Claude API
  CLAUDE_API_KEY: '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',
  
  // メール送信 GAS Webhook
  EMAIL_WEBHOOK_URL: 'https://script.google.com/macros/s/AKfycbz99AzrDmqxqxJCmK9Sb5aJpfQaLE8LfA6srtxOdGv2Hiwq1ITGKZCMPF-MZ-g81cYQ4Q/exec',
},
    
    // ■ メール送信者情報
    EMAIL_SENDER: {
      EMAIL: 's.kamiya@mamayoro.com',               // 送信者メールアドレス
      NAME: '神谷真太郎',                           // 送信者名
      COMPANY: '株式会社ままよろ',                  // 送信者会社名
    },
    
    // ■ フィールドコード定義
    FIELD_CODES: {
      // 人脈管理アプリのフィールド
      PEOPLE: {
        NAME: 'name',                                // 名前
        COMPANY: 'ルックアップ',                     // 会社名
        POSITION: '役職',                            // 役職
        PHONE: '電話番号',                           // 電話番号
        EMAIL: 'メールアドレス',                     // メールアドレス
        WEBSITE: 'HP',                               // ウェブサイト
        ADDRESS: '住所',                             // 住所
        POSTAL_CODE: '郵便番号',                     // 郵便番号
        CARD_IMAGE: '名刺写真',                      // 名刺画像
        REFERRER: '紹介者',                          // 紹介者名
        REFERRER_ID: '紹介者rid',                    // 紹介者ID
        BIRTHDAY: 'birthday',                        // 誕生日
        INDUSTRY: '業種',                            // 業種
        PERSONALITY: 'パーソナリティ評価',           // パーソナリティ評価
        RELATIONSHIP_LEVEL: 'お付き合い度合い',      // お付き合い度合い
        INTRO_MEMO: 'shokai_memo',                   // 初回メモ
      },
      
      // メールテンプレートアプリのフィールド
      TEMPLATE: {
        TEMPLATE_ID: 'template_id',                  // テンプレートID
        TEMPLATE_NAME: 'template_name',              // テンプレート名
        SUBJECT: 'subject',                          // 件名
        BODY: 'body',                                // 本文
        IS_ACTIVE: 'is_active',                      // 有効フラグ
        SORT_ORDER: 'sort_order',                    // 表示順
      },
    },
  };
  
// 設定値を個別の定数に展開
const TARGET_APP_ID = CONFIG.APPS.TARGET_APP_ID;
const TEMPLATE_APP_ID = CONFIG.APPS.TEMPLATE_APP_ID;
const FORM_VIEW_ID = CONFIG.VIEWS.FORM_VIEW_ID;
const VISION_API_KEY = CONFIG.EXTERNAL_API.VISION_API_KEY;
const CLAUDE_API_KEY = CONFIG.EXTERNAL_API.CLAUDE_API_KEY;
const EMAIL_WEBHOOK_URL = CONFIG.EXTERNAL_API.EMAIL_WEBHOOK_URL;  // ← ここ！
const SENDER_EMAIL = CONFIG.EMAIL_SENDER.EMAIL;
const SENDER_NAME = CONFIG.EMAIL_SENDER.NAME;
const SENDER_COMPANY = CONFIG.EMAIL_SENDER.COMPANY;
  const PEOPLE_FIELD_CODES = CONFIG.FIELD_CODES.PEOPLE;
  const TEMPLATE_FIELD_CODES = CONFIG.FIELD_CODES.TEMPLATE;

  const isFormView = (event) => event.viewType === 'custom' && event.viewId === FORM_VIEW_ID;

  // グローバル変数
  let selectedCardImage = null;
  let selectedCardImageBack = null;
  let cardImageFile = null;
  let cardImageFileBack = null;
  let emailTemplates = [];
  let extractedContactData = {};
  let referrerOptions = [];
  let industryOptions = [];
  let personalityOptions = [];
  let relationshipOptions = [];
  
  let updateTemplatePreview = null;
  let getCurrentTemplate = null;
  let getExtractedData = null;

// GAS経由メール送信機能
const sendEmailViaGAS = async (to, subject, body) => {
  if (!to || !subject || !body) {
    throw new Error('送信に必要な情報が不足しています');
  }
  
  if (!SENDER_EMAIL || !SENDER_NAME) {
    throw new Error('送信者情報が設定されていません');
  }
  
  const emailPayload = {
    from_email: SENDER_EMAIL,
    from_name: SENDER_NAME,
    to_email: to,
    subject: subject,
    body: body,
    sender_company: SENDER_COMPANY,
    timestamp: new Date().toISOString(),
    source: 'kintone_business_card',
    contact_name: extractedContactData.name || '',
    contact_company: extractedContactData.company || '',
    contact_position: extractedContactData.position || ''
  };
  
  try {
    const response = await new Promise((resolve, reject) => {
      kintone.proxy(
        EMAIL_WEBHOOK_URL,  // ← GASのURLに変更
        'POST',
        { 'Content-Type': 'application/json' },
        JSON.stringify(emailPayload),
(response, status) => {
  // 200, 201, 302 は成功として扱う（GASリダイレクト対応）
  if (status === 200 || status === 201 || status === 302) {
    try {
      const parsedResponse = JSON.parse(response);
      resolve(parsedResponse);
    } catch (parseError) {
      resolve({ success: true, message: 'Email sent' });
    }
  } else {
    reject(new Error(`Email API Error ${status}: ${response}`));
  }
}
      );
    });
    
    return response;
    
  } catch (error) {
    throw error;
  }
};

  // 抽出失敗項目チェック用モーダル表示
  function showExtractionFailureModal(extractedData) {
    const failedFields = [];
    const fieldLabels = {
      name: '名前',
      company: '会社名',
      position: '役職',
      phone: '電話番号',
      email: 'メールアドレス',
      website: 'ウェブサイト',
      address: '住所',
      postalCode: '郵便番号'
    };
    
    Object.keys(fieldLabels).forEach(key => {
      if (!extractedData[key] || extractedData[key].trim() === '') {
        failedFields.push(fieldLabels[key]);
      }
    });
    
    if (failedFields.length > 0) {
      const failedFieldsList = failedFields.join('、');
      showBusinessCardAlert(
        '抽出結果の確認',
        `以下の項目は自動抽出できませんでした：<br><br><strong>${failedFieldsList}</strong><br><br>必要に応じて手動で入力してください。`
      );
    } else {
      showBusinessCardAlert('抽出完了', 'すべての項目が正常に抽出されました。内容を確認してから登録してください。');
    }
  }

  const render = (mount) => {
    mount.innerHTML = `
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&display=swap');

* { box-sizing: border-box; }

/* body { background: #0a0a0a !important; } */

/* kintone標準UIを非表示（設定メニューとビュー切り替えは残す） */
.gaia-argoui-app-index-pager,
.gaia-argoui-app-index-footer,
.recordlist-header,
.box-gaia {
  display: none !important;
}

/* kintone標準ツールバーの調整 */
.contents-actionmenu-gaia {
  background: linear-gradient(135deg, #1a1a2e 0%, #0a0a0a 100%) !important;
  padding: 8px 15px !important;
  border-bottom: 1px solid rgba(212, 175, 55, 0.3) !important;
}

.gaia-argoui-customview {
  padding: 0 !important;
  margin: 0 !important;
  background: #0a0a0a !important;
}

.ocean-portal-body,
.ocean-portal-body-ocean-blue,
.gaia-argoui-app {
  background: #0a0a0a !important;
}

.premium-container {
  min-height: calc(100vh - 200px);
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
  padding: 20px 20px 60px;
  font-family: 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif;
  animation: fadeIn 0.8s ease-out;
}

.premium-form {
  max-width: 800px;
  margin: 0 auto;
  background: linear-gradient(145deg, rgba(26, 26, 46, 0.95), rgba(16, 16, 35, 0.95));
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 20px;
  padding: 60px;
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.5),
    0 0 100px rgba(212, 175, 55, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  position: relative;
  overflow: hidden;
}

.premium-form::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(45deg, transparent, rgba(212, 175, 55, 0.15), transparent);
  border-radius: 20px;
  opacity: 1;
  z-index: -1;
}

.premium-title {
  font-size: 32px;
  font-weight: 300;
  letter-spacing: 4px;
  color: #d4af37;
  text-align: center;
  margin-bottom: 50px;
  position: relative;
  animation: slideDown 0.6s ease-out;
}

.premium-title::after {
  content: '';
  position: absolute;
  bottom: -15px;
  left: 50%;
  transform: translateX(-50%);
  width: 100px;
  height: 1px;
  background: linear-gradient(90deg, transparent, #d4af37, transparent);
}

.form-group {
  margin-bottom: 35px;
  animation: slideUp 0.6s ease-out backwards;
  position: relative;
}

.form-label {
  display: block;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #888;
  margin-bottom: 12px;
  transition: color 0.3s ease;
}

.form-group:focus-within .form-label {
  color: #d4af37;
}

.form-control {
  width: 100%;
  padding: 18px 20px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  font-size: 16px;
  font-weight: 300;
  transition: all 0.3s ease;
  outline: none;
}

.form-control:focus {
  background: rgba(0, 0, 0, 0.5);
  border-color: rgba(212, 175, 55, 0.5);
  box-shadow: 
    0 0 0 3px rgba(212, 175, 55, 0.1),
    0 10px 40px rgba(212, 175, 55, 0.1);
}

.form-control::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

/* 名刺アップロード専用スタイル */
.business-card-upload {
  position: relative;
  padding: 30px 20px;
  background: rgba(0, 0, 0, 0.2);
  border: 2px dashed rgba(212, 175, 55, 0.3);
  border-radius: 12px;
  text-align: center;
  transition: all 0.4s ease;
  cursor: pointer;
  overflow: hidden;
}

.card-upload-icon {
  font-size: 48px;
  color: rgba(212, 175, 55, 0.4);
  margin-bottom: 12px;
}

.card-upload-text {
  color: rgba(255, 255, 255, 0.7);
  font-size: 16px;
  font-weight: 300;
  letter-spacing: 1px;
  margin-bottom: 6px;
}

.card-upload-subtext {
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  letter-spacing: 0.5px;
}

.card-upload-content {
  transition: all 0.3s ease;
}

.card-image-container {
  position: relative;
  margin-top: 20px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(212, 175, 55, 0.3);
}

.card-image {
  width: 100%;
  height: auto;
  max-height: 250px;
  object-fit: contain;
  border-radius: 16px;
}

.processing-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
}

.scanning-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, #d4af37, transparent);
  animation: scanLine 2s ease-in-out infinite;
}

.processing-dots {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.processing-dots span {
  width: 12px;
  height: 12px;
  background: #d4af37;
  border-radius: 50%;
  animation: processingDots 1.5s ease-in-out infinite;
}

.processing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.processing-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

.processing-text {
  color: #d4af37;
  font-size: 18px;
  font-weight: 500;
  letter-spacing: 1px;
  text-align: center;
}

@keyframes scanLine {
  0% { transform: translateY(0); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: translateY(250px); opacity: 0; }
}

@keyframes processingDots {
  0%, 20% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.5); opacity: 0.5; }
  80%, 100% { transform: scale(1); opacity: 1; }
}

/* OCR結果表示 */
.ocr-results {
  margin-top: 25px;
  padding: 25px;
  background: rgba(212, 175, 55, 0.05);
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 12px;
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.5s ease;
}

.ocr-results.show {
  opacity: 1;
  transform: translateY(0);
}

.ocr-title {
  color: #d4af37;
  font-size: 18px;
  font-weight: 400;
  letter-spacing: 2px;
  margin-bottom: 20px;
  text-align: center;
}

.ocr-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.ocr-field {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 15px;
  border: 1px solid rgba(212, 175, 55, 0.1);
}

.ocr-field-label {
  color: rgba(212, 175, 55, 0.8);
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 8px;
}

/* 紹介者検索コンテナ */
.referrer-search-container {
  position: relative;
}

.referrer-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: linear-gradient(145deg, rgba(26, 26, 46, 0.98), rgba(16, 16, 35, 0.98));
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 12px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 2000;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-10px);
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.referrer-dropdown.active {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.referrer-dropdown::-webkit-scrollbar {
  width: 6px;
}

.referrer-dropdown::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.referrer-dropdown::-webkit-scrollbar-thumb {
  background: rgba(212, 175, 55, 0.3);
  border-radius: 3px;
}

.referrer-item {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.1);
  cursor: pointer;
  transition: all 0.2s ease;
}

.referrer-item:hover {
  background: rgba(212, 175, 55, 0.1);
}

.referrer-item:last-child {
  border-bottom: none;
}

.referrer-name {
  color: #fff;
  font-weight: 500;
  margin-bottom: 4px;
  font-size: 14px;
}

.referrer-company {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
}

.referrer-loading {
  padding: 20px;
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
}

.referrer-no-results {
  padding: 20px;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
}

.referrer-clear-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  background: rgba(255, 59, 48, 0.2);
  border: 1px solid rgba(255, 59, 48, 0.3);
  border-radius: 50%;
  color: #ff3b30;
  font-size: 12px;
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.referrer-clear-btn:hover {
  background: rgba(255, 59, 48, 0.3);
  transform: translateY(-50%) scale(1.1);
}

.referrer-clear-btn.show {
  display: flex;
}

.duplicate-warning {
  margin-top: 20px;
  padding: 15px;
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 8px;
  color: #ffc107;
  font-size: 14px;
  display: none;
  animation: slideIn 0.3s ease-out;
}

.duplicate-warning.show {
  display: block;
}

.duplicate-warning-icon {
  font-size: 18px;
  margin-right: 8px;
}

.submit-btn {
  width: 100%;
  padding: 16px;
  margin-top: 10px;
  background: linear-gradient(135deg, #d4af37, #b8941f);
  border: none;
  border-radius: 8px;
  color: #000;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 3px;
  text-transform: uppercase;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.4s ease;
}

.submit-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 
    0 10px 30px rgba(212, 175, 55, 0.4),
    0 0 60px rgba(212, 175, 55, 0.2);
}

.submit-btn:hover::before {
  width: 300px;
  height: 300px;
}

.submit-btn:active {
  transform: translateY(0);
}

.submit-btn.loading {
  pointer-events: none;
  background: rgba(212, 175, 55, 0.5);
}

.submit-btn.loading::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  top: 50%;
  left: 50%;
  margin-left: -10px;
  margin-top: -10px;
  border: 2px solid #000;
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 0.8s linear infinite;
}

/* 分割ボタンスタイル */
.button-group {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-top: 24px;
  margin-bottom: 40px;
  max-width: 350px;
  margin-left: auto;
  margin-right: auto;
}

.button-group .submit-btn,
.button-group .secondary-btn {
  margin-top: 0;
  flex: none;
  width: 100%;
}

.secondary-btn {
  width: 100%;
  padding: 16px;
  background: rgba(212, 175, 55, 0.1);
  border: 2px solid rgba(212, 175, 55, 0.3);
  border-radius: 8px;
  color: #d4af37;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 3px;
  text-transform: uppercase;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.4s ease;
}

.secondary-btn:hover {
  transform: translateY(-2px);
  background: rgba(212, 175, 55, 0.2);
  box-shadow: 0 10px 30px rgba(212, 175, 55, 0.3);
}

.secondary-btn:active {
  transform: translateY(0);
}

.secondary-btn.loading {
  pointer-events: none;
  background: rgba(212, 175, 55, 0.2);
}

.secondary-btn.loading::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  top: 50%;
  left: 50%;
  margin-left: -10px;
  margin-top: -10px;
  border: 2px solid #d4af37;
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 0.8s linear infinite;
}

.cancel-btn {
  width: 100%;
  padding: 16px;
  background: rgba(255, 59, 48, 0.1);
  border: 2px solid rgba(255, 59, 48, 0.3);
  border-radius: 8px;
  color: #ff3b30;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 2px;
  text-transform: uppercase;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.4s ease;
}

.cancel-btn:hover {
  background: rgba(255, 59, 48, 0.2);
  transform: translateY(-2px);
}

.cancel-btn:active {
  transform: translateY(0);
}

.success-animation {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: fadeIn 0.3s ease-out;
}

.success-content {
  text-align: center;
  animation: successPulse 0.6s ease-out;
}

.success-icon {
  width: 120px;
  height: 120px;
  margin: 0 auto 30px;
  position: relative;
}

.success-icon svg {
  width: 100%;
  height: 100%;
}

.success-circle {
  stroke: #d4af37;
  stroke-width: 2;
  fill: none;
  stroke-dasharray: 300;
  stroke-dashoffset: 300;
  animation: drawCircle 0.8s ease-out forwards;
}

.success-check {
  stroke: #d4af37;
  stroke-width: 3;
  fill: none;
  stroke-dasharray: 50;
  stroke-dashoffset: 50;
  animation: drawCheck 0.5s ease-out 0.5s forwards;
}

.success-message {
  font-size: 24px;
  color: #d4af37;
  letter-spacing: 2px;
  margin-bottom: 10px;
  opacity: 0;
  animation: fadeInUp 0.5s ease-out 0.8s forwards;
}

.success-submessage {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  opacity: 0;
  animation: fadeInUp 0.5s ease-out 1s forwards;
}

/* モーダルアラート */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
}

.modal-overlay.active {
  opacity: 1;
  visibility: visible;
}

.modal-content {
  background: linear-gradient(145deg, rgba(26, 26, 46, 0.98), rgba(16, 16, 35, 0.98));
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 16px;
  padding: 40px;
  max-width: 500px;
  width: 90%;
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.8),
    0 0 100px rgba(212, 175, 55, 0.1);
  transform: scale(0.9);
  transition: transform 0.3s ease;
}

.modal-overlay.active .modal-content {
  transform: scale(1);
  animation: modalPulse 0.4s ease;
}

.modal-icon {
  width: 60px;
  height: 60px;
  margin: 0 auto 20px;
  background: rgba(212, 175, 55, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
}

.modal-title {
  font-size: 20px;
  font-weight: 400;
  color: #d4af37;
  text-align: center;
  margin-bottom: 15px;
  letter-spacing: 1px;
}

.modal-message {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  line-height: 1.6;
  margin-bottom: 30px;
}

.modal-button {
  width: 48%;
  padding: 15px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 2px;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.3s ease;
  margin: 0 1%;
}

.modal-button.primary {
  background: linear-gradient(135deg, #d4af37, #b8941f);
  color: #000;
}

.modal-button.secondary {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.8);
}

.modal-button:hover {
  transform: translateY(-2px);
}

.modal-button.primary:hover {
  box-shadow: 0 10px 30px rgba(212, 175, 55, 0.3);
}

.modal-button.secondary:hover {
  background: rgba(255, 255, 255, 0.2);
}

.modal-button:active {
  transform: translateY(0);
}

.modal-button.single {
  width: auto;
  min-width: 120px;
  margin: 0 auto;
  display: block;
}

.modal-button-container.center {
  display: flex;
  justify-content: center;
  margin-top: 30px;
}

/* メール作成画面専用スタイル */
.email-compose-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
  z-index: 9999;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  overflow-y: auto;
}

.email-compose-screen.active {
  opacity: 1;
  visibility: visible;
}

.email-compose-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 20px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.email-compose-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 40px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.2);
}

.email-compose-title {
  font-size: 28px;
  color: #d4af37;
  font-weight: 300;
  letter-spacing: 3px;
}

.email-close-btn {
  width: 50px;
  height: 50px;
  background: rgba(255, 59, 48, 0.1);
  border: 1px solid rgba(255, 59, 48, 0.3);
  border-radius: 12px;
  color: #ff3b30;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.email-close-btn:hover {
  background: rgba(255, 59, 48, 0.2);
  transform: scale(1.05);
}

.email-form {
  flex: 1;
  background: linear-gradient(145deg, rgba(26, 26, 46, 0.95), rgba(16, 16, 35, 0.95));
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 16px;
  padding: 40px;
  backdrop-filter: blur(10px);
}

.email-addresses {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 30px;
}

.email-address-field {
  padding: 20px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(212, 175, 55, 0.2);
  border-radius: 12px;
}

.email-address-label {
  font-size: 12px;
  color: rgba(212, 175, 55, 0.8);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.email-address-value {
  font-size: 16px;
  color: #fff;
  font-weight: 300;
}

.template-selection {
  margin-bottom: 30px;
}

.email-template-management {
  margin-bottom: 25px;
}

.email-template-select-wrapper {
  width: 100%;
}

.email-preview {
  margin-bottom: 30px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(212, 175, 55, 0.1);
  border-radius: 12px;
  overflow: hidden;
}

.email-preview-header {
  padding: 15px 20px;
  background: rgba(212, 175, 55, 0.1);
  border-bottom: 1px solid rgba(212, 175, 55, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.email-preview-label {
  color: rgba(212, 175, 55, 0.9);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.email-edit-btn {
  padding: 6px 12px;
  background: rgba(212, 175, 55, 0.2);
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 4px;
  color: #d4af37;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.email-edit-btn:hover {
  background: rgba(212, 175, 55, 0.3);
}

.email-preview-content {
  padding: 25px 20px;
}

.email-subject-preview {
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.1);
}

.email-subject-label {
  color: rgba(212, 175, 55, 0.8);
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.email-subject-text {
  color: #fff;
  font-size: 16px;
  font-weight: 400;
}

.email-body-preview {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-line;
}

.email-actions {
  display: flex;
  gap: 15px;
  margin-top: 30px;
}

.email-send-btn {
  flex: 2;
  padding: 18px;
  background: linear-gradient(135deg, #d4af37, #b8941f);
  border: none;
  border-radius: 8px;
  color: #000;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 2px;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.3s ease;
}

.email-send-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(212, 175, 55, 0.4);
}

.email-cancel-btn {
  flex: 1;
  padding: 18px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 2px;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.3s ease;
}

.email-cancel-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-30px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes drawCircle {
  to { stroke-dashoffset: 0; }
}

@keyframes drawCheck {
  to { stroke-dashoffset: 0; }
}

@keyframes successPulse {
  0% { transform: scale(0.8); opacity: 0; }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes fadeInUp {
  to { opacity: 1; transform: translateY(-10px); }
}

@keyframes modalPulse {
  0% { transform: scale(0.8); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.card-images-container {
  display: flex;
  gap: 20px;
  margin-top: 20px;
}

.card-side-container {
  flex: 1;
  position: relative;
}

.card-side-label {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(212, 175, 55, 0.9);
  color: #000;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  z-index: 10;
}

.add-back-btn {
  width: 100%;
  padding: 12px;
  margin-top: 15px;
  background: rgba(212, 175, 55, 0.1);
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 8px;
  color: #d4af37;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.add-back-btn:hover {
  background: rgba(212, 175, 55, 0.2);
  transform: translateY(-1px);
}

.process-btn {
  width: 100%;
  padding: 16px;
  margin-top: 20px;
  background: linear-gradient(135deg, #d4af37, #b8941f);
  border: none;
  border-radius: 8px;
  color: #000;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 2px;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.3s ease;
}

.process-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(212, 175, 55, 0.4);
}

.process-btn:disabled {
  background: rgba(212, 175, 55, 0.3);
  cursor: not-allowed;
  transform: none;
}

.process-btn.loading::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  top: 50%;
  left: 50%;
  margin-left: -10px;
  margin-top: -10px;
  border: 2px solid #000;
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 0.8s linear infinite;
}

</style>

      <div class="premium-container">
        <div class="premium-form">
          <h1 class="premium-title">Business Card Scanner</h1>
          
          <!-- 名刺アップロード画面 -->
          <div id="card-upload-screen" class="card-upload-screen">
            <div class="form-group">
              <label class="form-label">名刺をアップロード</label>
<div style="background: rgba(255, 193, 7, 0.08); border: 1px solid rgba(255, 193, 7, 0.2); border-radius: 8px; padding: 12px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
  <span style="color: #ffc107; font-size: 18px;">📡</span>
  <span style="color: rgba(255, 255, 255, 0.7); font-size: 13px; line-height: 1.5;">
    表面をアップロード後、必要に応じて裏面も追加できます。
  </span>
</div>
<!-- 表面アップロード -->
<div class="business-card-upload" id="card-upload">
  <div class="card-upload-content">
    <div class="card-upload-icon">📇</div>
    <div class="card-upload-text">名刺の表面をアップロード</div>
    <div class="card-upload-subtext">JPG, PNG対応</div>
  </div>
  <div class="card-image-container" id="card-image-container" style="display: none;">
    <div class="card-side-label">表面</div>
    <img id="card-image" class="card-image" />
  </div>
  <input type="file" id="card-file" accept="image/*" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer;" />
</div>

<!-- 裏面追加ボタン（初期は非表示） -->
<button id="add-back-btn" class="add-back-btn" style="display: none;">
  裏面を追加する
</button>

<!-- 裏面アップロード（初期は非表示） -->
<div class="business-card-upload" id="card-upload-back" style="display: none; margin-top: 20px;">
  <div class="card-upload-content" id="back-upload-content">
    <div class="card-upload-icon">📄</div>
    <div class="card-upload-text">名刺の裏面をアップロード</div>
    <div class="card-upload-subtext">JPG, PNG対応</div>
  </div>
  <div class="card-image-container" id="card-image-container-back" style="display: none;">
    <div class="card-side-label">裏面</div>
    <img id="card-image-back" class="card-image" />
  </div>
  <input type="file" id="card-file-back" accept="image/*" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer;" />
</div>

<!-- 読み込み開始ボタン（初期は非表示） -->
<button id="process-btn" class="process-btn" style="display: none;">
  読み込み開始
</button>

<!-- 手動登録ボタン -->
<button id="manual-register-btn" class="secondary-btn" style="margin-top: 16px;">
  📝 名刺なし - 手動で登録する
</button>

<!-- 処理中オーバーレイ（初期は非表示） -->
<div class="processing-overlay" id="processing-overlay" style="display: none;">
  <div class="scanning-line"></div>
  <div class="processing-dots">
    <span></span><span></span><span></span>
  </div>
  <div class="processing-text">AI分析中...</div>
</div>
            </div>
          </div>
          
          <!-- 結果表示画面（初期は非表示） -->
          <div id="card-result-screen" class="card-result-screen" style="display: none;">
            <!-- 重複チェック警告 -->
            <div id="duplicate-warning" class="duplicate-warning">
              <span class="duplicate-warning-icon">⚠️</span>
              同姓同名の人脈が既に登録されています。重複登録ご注意ください。
            </div>
            
            <!-- OCR結果表示 -->
            <div class="ocr-results" id="ocr-results">
              <div class="ocr-title">抽出された情報</div>
              <div class="ocr-grid">
                <div class="ocr-field">
                  <div class="ocr-field-label">Name</div>
                  <input type="text" id="extracted-name" class="form-control" style="margin-top: 8px;" />
                </div>
                <div class="ocr-field">
                  <div class="ocr-field-label">Company</div>
                  <input type="text" id="extracted-company" class="form-control" style="margin-top: 8px;" />
                </div>
                <div class="ocr-field">
                  <div class="ocr-field-label">Position</div>
                  <input type="text" id="extracted-position" class="form-control" style="margin-top: 8px;" />
                </div>
                <div class="ocr-field">
                  <div class="ocr-field-label">Phone</div>
                  <input type="text" id="extracted-phone" class="form-control" style="margin-top: 8px;" />
                </div>
                <div class="ocr-field">
                  <div class="ocr-field-label">Email</div>
                  <input type="text" id="extracted-email" class="form-control" style="margin-top: 8px;" />
                </div>
                <div class="ocr-field">
                  <div class="ocr-field-label">Website</div>
                  <input type="text" id="extracted-website" class="form-control" style="margin-top: 8px;" />
                </div>
                <div class="ocr-field">
                  <div class="ocr-field-label">Address</div>
                  <input type="text" id="extracted-address" class="form-control" style="margin-top: 8px;" />
                </div>
                <div class="ocr-field">
                  <div class="ocr-field-label">Postal Code</div>
                  <input type="text" id="extracted-postalcode" class="form-control" style="margin-top: 8px;" />
                </div>
                <div class="ocr-field">
                  <div class="ocr-field-label">Birthday</div>
                  <input type="date" id="extracted-birthday" class="form-control" style="margin-top: 8px;" />
                </div>
                <div class="ocr-field">
                  <div class="ocr-field-label">業種</div>
                  <select id="extracted-industry" class="form-control" style="margin-top: 8px;">
                    <option value="">読み込み中...</option>
                  </select>
                </div>
                <div class="ocr-field">
                  <div class="ocr-field-label">Referrer</div>
                  <div class="referrer-search-container">
                    <input type="text" id="extracted-referrer-search" class="form-control" placeholder="紹介者名を入力して検索..." style="margin-top: 8px;" />
                    <input type="hidden" id="extracted-referrer" />
                    <input type="hidden" id="extracted-referrer-name" />
                    <div id="referrer-dropdown" class="referrer-dropdown"></div>
                  </div>
                </div>
                
                <!-- ⭐ パーソナリティ評価（チェックボックス） -->
                <div class="ocr-field" style="grid-column: 1 / -1;">
                  <div class="ocr-field-label">パーソナリティ評価</div>
                  <div id="extracted-personality-container" style="margin-top: 8px;">
                    <div style="color: rgba(255, 255, 255, 0.5); font-size: 13px;">読み込み中...</div>
                  </div>
                </div>
                
                <!-- ⭐ お付き合い度合い（ドロップダウン） -->
                <div class="ocr-field">
                  <div class="ocr-field-label">お付き合い度合い</div>
                  <select id="extracted-relationship" class="form-control" style="margin-top: 8px;">
                    <option value="">読み込み中...</option>
                  </select>
                </div>
                
                <!-- ⭐ 初回メモ（テキスト複数行） -->
                <div class="ocr-field" style="grid-column: 1 / -1;">
                  <div class="ocr-field-label">初回メモ</div>
                  <textarea 
                    id="extracted-memo" 
                    class="form-control" 
                    rows="4" 
                    placeholder="この方との出会いや印象、話した内容など..."
                    style="margin-top: 8px; resize: vertical; min-height: 100px;"
                  ></textarea>
                </div>
              </div>
            </div>
            
            <!-- ボタングループ -->
            <div class="button-group">
              <button class="submit-btn" id="save-only-btn">人脈に登録して終了</button>
              <button class="secondary-btn" id="create-email-btn">メール作成画面へ</button>
              <button class="cancel-btn" id="cancel-card-btn">キャンセル</button>
            </div>
          </div>
        </div>
        
        <!-- メール作成画面 -->
        <div id="email-compose-screen" class="email-compose-screen">
          <div class="email-compose-container">
            <div class="email-compose-header">
              <h1 class="email-compose-title">お礼メール作成</h1>
              <button id="email-close-btn" class="email-close-btn">×</button>
            </div>
            
            <div class="email-form">
              <!-- 送信者・受信者情報 -->
              <div class="email-addresses">
                <div class="email-address-field">
                  <div class="email-address-label">送信者</div>
                  <div class="email-address-value" id="sender-info">
                    ${SENDER_NAME}<br>
                    <span style="opacity: 0.7;">${SENDER_EMAIL}</span>
                  </div>
                </div>
                <div class="email-address-field">
                  <div class="email-address-label">送信先</div>
                  <div class="email-address-value" id="recipient-info">
                    <!-- 動的に設定される -->
                  </div>
                </div>
              </div>
              
              <!-- テンプレート選択 -->
              <div class="template-selection">
                <div class="form-label">メールテンプレート</div>
                
                <div class="email-template-management">
                  <div class="email-template-select-wrapper">
                    <select id="email-template-select" class="form-control">
                      <option value="">読み込み中...</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <!-- メールプレビュー -->
              <div id="email-preview" class="email-preview">
                <div class="email-preview-header">
                  <span class="email-preview-label">メールプレビュー</span>
                  <button id="email-edit-preview-btn" class="email-edit-btn">編集する</button>
                </div>
                <div class="email-preview-content">
                  <div class="email-subject-preview">
                    <div class="email-subject-label">件名</div>
                    <div class="email-subject-text" id="email-subject-preview-text">
                      <!-- 動的に設定される -->
                    </div>
                  </div>
                  <div class="email-body-preview" id="email-body-preview-text">
                    <!-- 動的に設定される -->
                  </div>
                </div>
              </div>
              
              <!-- アクションボタン -->
              <div class="email-actions">
                <button id="email-send-btn" class="email-send-btn">メール送信 & 人脈登録</button>
                <button id="email-cancel-btn" class="email-cancel-btn">キャンセル</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // DOM要素取得
    const el = (id) => mount.querySelector(id);
    const $cardFile = el('#card-file');
    const $cardFileBack = el('#card-file-back');
    const $addBackBtn = el('#add-back-btn');
    const $processBtn = el('#process-btn');
    const $cardUploadBack = el('#card-upload-back');
    const $saveOnlyBtn = el('#save-only-btn');
    const $createEmailBtn = el('#create-email-btn');
    const $ocrResults = el('#ocr-results');
    const $duplicateWarning = el('#duplicate-warning');
    const $extractedBirthday = el('#extracted-birthday');
    const $extractedReferrer = el('#extracted-referrer');

    let openEmailCompose = null;

    // 現在選択されているテンプレートを取得
    getCurrentTemplate = () => {
      const selectedId = el('#email-template-select').value;
      return emailTemplates.find(template => template.id === selectedId);
    };

    // 抽出されたデータを取得
    getExtractedData = () => {
      return extractedContactData;
    };

    // テンプレートタグを実際の値で置換
    const replaceTemplateTags = (template, data) => {
      let result = template;
      Object.keys(data).forEach(key => {
        const regex = new RegExp(`{${key}}`, 'g');
        result = result.replace(regex, data[key] || `[${key}]`);
      });
      return result;
    };

    // テンプレートプレビューを更新
    updateTemplatePreview = () => {
      const template = getCurrentTemplate();
      if (!template) return;

      const data = getExtractedData();
      const previewSubject = replaceTemplateTags(template.subject, data);
      const previewBody = replaceTemplateTags(template.body, data);
      
      const subjectElement = el('#email-subject-preview-text');
      const bodyElement = el('#email-body-preview-text');
      
      if (subjectElement) {
        subjectElement.textContent = previewSubject;
      }
      
      if (bodyElement) {
        bodyElement.textContent = previewBody;
      }
    };

    // 紹介者オプションを読み込み
    const loadReferrerOptions = async () => {
      try {
        let allRecords = [];
        let offset = 0;
        const limit = 500;
        let hasMore = true;

        while (hasMore) {
          const response = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
            app: TARGET_APP_ID,
            query: `order by $id desc limit ${limit} offset ${offset}`
          });
          
          allRecords = allRecords.concat(response.records);
          
          hasMore = response.records.length === limit;
          offset += limit;
          
          if (allRecords.length >= 10000) {
            break;
          }
        }

        referrerOptions = [];
        allRecords.forEach((record) => {
          try {
            let name = '';
            let company = '';
            
            if (record.name && typeof record.name === 'object' && record.name.value !== undefined) {
              name = String(record.name.value || '').trim();
            }
            
            if (record['ルックアップ'] && typeof record['ルックアップ'] === 'object' && record['ルックアップ'].value !== undefined) {
              company = String(record['ルックアップ'].value || '').trim();
            }
            
            if (name && name.length > 0) {
              referrerOptions.push({
                id: record.$id.value,
                name: name,
                company: company
              });
            }
          } catch (recordError) {
            // エラーが発生したレコードはスキップ
          }
        });
        
        referrerOptions.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        updateReferrerSelect();
        
      } catch (error) {
        console.error('紹介者データの読み込みに失敗:', error);
      }
    };
    
    // 業種選択肢を読み込み
    const loadIndustryOptions = async () => {
      try {
        const formFields = await kintone.api(kintone.api.url('/k/v1/app/form/fields', true), 'GET', {
          app: TARGET_APP_ID
        });
        
        const industryField = formFields.properties[PEOPLE_FIELD_CODES.INDUSTRY];
        if (industryField && industryField.type === 'DROP_DOWN') {
          industryOptions = industryField.options ? 
            Object.entries(industryField.options)
              .filter(([key]) => key !== '')
              .sort((a, b) => parseInt(a[1].index) - parseInt(b[1].index))
              .map(([key]) => key) : [];
          updateIndustrySelect();
        }
      } catch (error) {
        console.error('業種選択肢の取得に失敗:', error);
        industryOptions = [];
      }
    };

    // パーソナリティ評価選択肢を読み込み
    const loadPersonalityOptions = async () => {
      try {
        const formFields = await kintone.api(kintone.api.url('/k/v1/app/form/fields', true), 'GET', {
          app: TARGET_APP_ID
        });
        
        const personalityField = formFields.properties[PEOPLE_FIELD_CODES.PERSONALITY];
        if (personalityField && personalityField.type === 'CHECK_BOX') {
          personalityOptions = personalityField.options ? 
            Object.entries(personalityField.options)
              .filter(([key]) => key !== '')
              .sort((a, b) => parseInt(a[1].index) - parseInt(b[1].index))
              .map(([key]) => key) : [];
          updatePersonalityCheckboxes();
        }
      } catch (error) {
        console.error('パーソナリティ評価選択肢の取得に失敗:', error);
        personalityOptions = [];
      }
    };

    // お付き合い度合い選択肢を読み込み
    const loadRelationshipOptions = async () => {
      try {
        const formFields = await kintone.api(kintone.api.url('/k/v1/app/form/fields', true), 'GET', {
          app: TARGET_APP_ID
        });
        
        const relationshipField = formFields.properties[PEOPLE_FIELD_CODES.RELATIONSHIP_LEVEL];
        if (relationshipField && relationshipField.type === 'DROP_DOWN') {
          relationshipOptions = relationshipField.options ? 
            Object.entries(relationshipField.options)
              .filter(([key]) => key !== '')
              .sort((a, b) => parseInt(a[1].index) - parseInt(b[1].index))
              .map(([key]) => key) : [];
          updateRelationshipSelect();
        }
      } catch (error) {
        console.error('お付き合い度合い選択肢の取得に失敗:', error);
        relationshipOptions = [];
      }
    };

    const updatePersonalityCheckboxes = () => {
      const personalityContainer = document.getElementById('extracted-personality-container');
      if (!personalityContainer) return;
      
      personalityContainer.innerHTML = '';
      personalityOptions.forEach(option => {
        const checkboxWrapper = document.createElement('label');
        checkboxWrapper.style.cssText = `
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(212, 175, 55, 0.1);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: 8px;
        `;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = option;
        checkbox.className = 'personality-checkbox';
        checkbox.style.cssText = `
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: #d4af37;
        `;
        
        const label = document.createElement('span');
        label.textContent = option;
        label.style.cssText = `
          color: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          cursor: pointer;
        `;
        
        checkboxWrapper.appendChild(checkbox);
        checkboxWrapper.appendChild(label);
        personalityContainer.appendChild(checkboxWrapper);
        
        // ホバー効果
        checkboxWrapper.addEventListener('mouseenter', () => {
          checkboxWrapper.style.background = 'rgba(212, 175, 55, 0.1)';
        });
        checkboxWrapper.addEventListener('mouseleave', () => {
          checkboxWrapper.style.background = 'rgba(0, 0, 0, 0.2)';
        });
      });
    };

const updateRelationshipSelect = () => {
  const relationshipSelect = document.getElementById('extracted-relationship');
  if (!relationshipSelect) return;
  
  relationshipSelect.innerHTML = '<option value="">選択してください</option>';
  relationshipOptions.forEach((option, index) => {
    const optionElement = document.createElement('option');
    optionElement.value = option;
    optionElement.textContent = option;
    relationshipSelect.appendChild(optionElement);
  });
  
  // ⭐ 選択肢が5つ以上ある場合、5番目をデフォルト選択
  if (relationshipOptions.length >= 5) {
    relationshipSelect.value = relationshipOptions[4];
  }
};

    const updateIndustrySelect = () => {
      const industrySelect = el('#extracted-industry');
      if (!industrySelect) return;
      
      industrySelect.innerHTML = '<option value="">選択してください</option>';
      industryOptions.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        industrySelect.appendChild(optionElement);
      });
    };

    // 紹介者検索機能の初期化
    const initReferrerSearch = () => {
      const searchInput = el('#extracted-referrer-search');
      const hiddenIdInput = el('#extracted-referrer');
      const hiddenNameInput = el('#extracted-referrer-name');
      const clearBtn = document.createElement('div');
      
      clearBtn.className = 'referrer-clear-btn';
      clearBtn.innerHTML = '×';
      clearBtn.title = 'クリア';
      searchInput.parentElement.appendChild(clearBtn);
      
      let searchTimeout = null;
      let filteredReferrers = [];
      
      const performSearch = (query) => {
        const searchTerm = query.toLowerCase().trim();
        
        if (searchTerm.length === 0) {
          const overlayDropdown = document.getElementById('referrer-dropdown-overlay');
          if (overlayDropdown) {
            overlayDropdown.remove();
          }
          return;
        }
        
        if (searchTerm.length < 2) {
          displaySearchResults([]);
          const overlayDropdown = document.getElementById('referrer-dropdown-overlay');
          if (overlayDropdown) {
            overlayDropdown.innerHTML = '<div class="referrer-no-results">2文字以上入力してください</div>';
          }
          return;
        }
        
        filteredReferrers = referrerOptions.filter(referrer => 
          referrer.name.toLowerCase().includes(searchTerm) ||
          (referrer.company && referrer.company.toLowerCase().includes(searchTerm))
        );
        
        displaySearchResults(filteredReferrers);
      };
      
      const displaySearchResults = (results) => {
        const existingDropdown = document.getElementById('referrer-dropdown-overlay');
        if (existingDropdown) {
          existingDropdown.remove();
        }
        
        const inputRect = searchInput.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
        
        const overlayDropdown = document.createElement('div');
        overlayDropdown.id = 'referrer-dropdown-overlay';
        overlayDropdown.style.cssText = `
          position: fixed;
          top: ${inputRect.bottom + 5}px;
          left: ${inputRect.left}px;
          width: ${inputRect.width}px;
          background: linear-gradient(145deg, rgba(26, 26, 46, 0.98), rgba(16, 16, 35, 0.98));
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 12px;
          max-height: 200px;
          overflow-y: auto;
          z-index: 10000;
          backdrop-filter: blur(10px);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
          opacity: 0;
          visibility: hidden;
          transform: translateY(-10px);
          transition: all 0.3s ease;
        `;
        
        if (results.length === 0) {
          overlayDropdown.innerHTML = '<div class="referrer-no-results" style="padding: 20px; text-align: center; color: rgba(255, 255, 255, 0.4); font-size: 14px;">該当する紹介者が見つかりません</div>';
        } else {
          overlayDropdown.innerHTML = results.slice(0, 50).map(referrer => `
            <div class="referrer-item" data-id="${referrer.id}" data-name="${referrer.name}" style="padding: 12px 16px; border-bottom: 1px solid rgba(212, 175, 55, 0.1); cursor: pointer; transition: all 0.2s ease;">
              <div class="referrer-name" style="color: #fff; font-weight: 500; margin-bottom: 4px; font-size: 14px;">${referrer.name}</div>
              <div class="referrer-company" style="color: rgba(255, 255, 255, 0.6); font-size: 12px;">${referrer.company || '会社名なし'}</div>
            </div>
          `).join('');
          
          overlayDropdown.querySelectorAll('.referrer-item').forEach(item => {
            item.addEventListener('mouseenter', () => {
              item.style.background = 'rgba(212, 175, 55, 0.1)';
            });
            
            item.addEventListener('mouseleave', () => {
              item.style.background = 'transparent';
            });
            
            item.addEventListener('click', () => {
              const referrerId = item.dataset.id;
              const referrerName = item.dataset.name;
              const referrerCompany = item.querySelector('.referrer-company').textContent;
              
              searchInput.value = `${referrerName}${referrerCompany !== '会社名なし' ? ` (${referrerCompany})` : ''}`;
              hiddenIdInput.value = referrerId;
              hiddenNameInput.value = referrerName;
              
              overlayDropdown.remove();
              clearBtn.classList.add('show');
            });
          });
        }
        
        document.body.appendChild(overlayDropdown);
        
        setTimeout(() => {
          overlayDropdown.style.opacity = '1';
          overlayDropdown.style.visibility = 'visible';
          overlayDropdown.style.transform = 'translateY(0)';
        }, 10);
      };
      
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        
        if (searchTimeout) {
          clearTimeout(searchTimeout);
        }
        
        searchTimeout = setTimeout(() => {
          performSearch(query);
        }, 300);
        
        if (query.length > 0) {
          clearBtn.classList.add('show');
        } else {
          clearBtn.classList.remove('show');
          hiddenIdInput.value = '';
          hiddenNameInput.value = '';
        }
      });
      
      searchInput.addEventListener('focus', () => {
        if (searchInput.value.length >= 2) {
          performSearch(searchInput.value);
        }
      });
      
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        hiddenIdInput.value = '';
        hiddenNameInput.value = '';
        
        const overlayDropdown = document.getElementById('referrer-dropdown-overlay');
        if (overlayDropdown) {
          overlayDropdown.remove();
        }
        
        clearBtn.classList.remove('show');
        searchInput.focus();
      });

      document.addEventListener('click', (e) => {
        const overlayDropdown = document.getElementById('referrer-dropdown-overlay');
        if (overlayDropdown && !searchInput.parentElement.contains(e.target) && !overlayDropdown.contains(e.target)) {
          overlayDropdown.remove();
        }
      });

      window.addEventListener('scroll', () => {
        const overlayDropdown = document.getElementById('referrer-dropdown-overlay');
        if (overlayDropdown && overlayDropdown.style.visibility === 'visible') {
          const inputRect = searchInput.getBoundingClientRect();
          overlayDropdown.style.top = `${inputRect.bottom + 5}px`;
          overlayDropdown.style.left = `${inputRect.left}px`;
        }
      });
    };

    const updateReferrerSelect = () => {
      initReferrerSearch();
    };

    // テンプレート管理機能の初期化
    const initTemplateManager = () => {
      const templateSelect = el('#email-template-select');
      
      const loadTemplatesFromApp = async () => {
        try {
          const response = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
            app: TEMPLATE_APP_ID,
            query: 'is_active in ("有効") order by sort_order asc, $id asc'
          });
          
          emailTemplates = response.records.map(record => ({
            id: record.template_id?.value || record.$id.value,
            name: record.template_name?.value || 'Untitled',
            subject: record.subject?.value || '',
            body: record.body?.value || '',
            isActive: record.is_active?.value === '有効',
            sortOrder: parseInt(record.sort_order?.value) || 0
          }));
          
          updateTemplateSelect();
          
        } catch (error) {
          emailTemplates = [];
          const templateSelect = el('#email-template-select');
          if (templateSelect) {
            templateSelect.innerHTML = '<option value="">テンプレートの取得に失敗しました</option>';
            templateSelect.disabled = true;
          }
        }
      };

      const updateTemplateSelect = () => {
        const currentValue = templateSelect.value;
        templateSelect.innerHTML = '';
        
        emailTemplates
          .filter(template => template.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = template.name;
            templateSelect.appendChild(option);
          });
        
        if (Array.from(templateSelect.options).some(opt => opt.value === currentValue)) {
          templateSelect.value = currentValue;
        } else if (templateSelect.options.length > 0) {
          templateSelect.value = templateSelect.options[0].value;
        }
        
        updateTemplatePreview();
      };

      loadTemplatesFromApp();

      templateSelect.addEventListener('change', () => {
        updateTemplatePreview();
      });
    };

    // メール作成画面の初期化
    const initEmailCompose = () => {
      const emailScreen = el('#email-compose-screen');
      const emailCloseBtn = el('#email-close-btn');
      const emailCancelBtn = el('#email-cancel-btn');
      const emailSendBtn = el('#email-send-btn');
      
      const closeEmailCompose = () => {
        emailScreen.classList.remove('active');
      };
      
      const initManualEdit = () => {
        const emailEditBtn = el('#email-edit-preview-btn');

        if (!emailEditBtn) {
          return;
        }

        const newEditBtn = emailEditBtn.cloneNode(true);
        emailEditBtn.parentNode.replaceChild(newEditBtn, emailEditBtn);
        
        let isEditing = false;
        let originalSubject = '';
        let originalBody = '';

        newEditBtn.addEventListener('click', () => {
          const subjectElement = el('#email-subject-preview-text');
          const bodyElement = el('#email-body-preview-text');
          
          if (!subjectElement || !bodyElement) {
            return;
          }

          if (!isEditing) {
            isEditing = true;
            
            const getTextWithLineBreaks = (element) => {
              const html = element.innerHTML;
              return html
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&');
            };
            
            const recipientNameElement = el('#recipient-name');
            const recipientEmailElement = el('#recipient-email');
            
            originalSubject = getTextWithLineBreaks(subjectElement);
            originalBody = getTextWithLineBreaks(bodyElement);
            const originalRecipientName = recipientNameElement ? recipientNameElement.textContent : '';
            const originalRecipientEmail = recipientEmailElement ? recipientEmailElement.textContent : '';
            
            const escapeHtml = (text) => {
              return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;');
            };
            
            subjectElement.innerHTML = `<input type="text" class="form-control" value="${escapeHtml(originalSubject)}" id="manual-subject" />`;
            bodyElement.innerHTML = `<textarea class="form-control" rows="10" id="manual-body">${escapeHtml(originalBody)}</textarea>`;
            
            if (recipientNameElement) {
              recipientNameElement.innerHTML = `<input type="text" class="form-control" value="${escapeHtml(originalRecipientName)}" id="manual-recipient-name" placeholder="受信者名" />`;
            }
            if (recipientEmailElement) {
              recipientEmailElement.innerHTML = `<input type="email" class="form-control" value="${escapeHtml(originalRecipientEmail)}" id="manual-recipient-email" placeholder="メールアドレス" />`;
            }
            
            newEditBtn.textContent = '保存';
                
          } else {
            isEditing = false;
            
            const manualSubject = el('#manual-subject');
            const manualBody = el('#manual-body');
            const manualRecipientName = el('#manual-recipient-name');
            const manualRecipientEmail = el('#manual-recipient-email');
            
            if (manualSubject && manualBody) {
              const editedSubject = manualSubject.value || '';
              const editedBody = manualBody.value || '';
              const editedRecipientName = manualRecipientName ? manualRecipientName.value || '' : '';
              const editedRecipientEmail = manualRecipientEmail ? manualRecipientEmail.value || '' : '';
              
              originalSubject = editedSubject;
              originalBody = editedBody;
              
              if (editedRecipientName) extractedContactData.name = editedRecipientName;
              if (editedRecipientEmail) extractedContactData.email = editedRecipientEmail;
              
              const escapeAndFormatForDisplay = (text) => {
                return text
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/\n/g, '<br>');
              };
              
              subjectElement.innerHTML = escapeAndFormatForDisplay(editedSubject);
              bodyElement.innerHTML = escapeAndFormatForDisplay(editedBody);
              
              const recipientNameElement = el('#recipient-name');
              const recipientEmailElement = el('#recipient-email');
              if (recipientNameElement) {
                recipientNameElement.textContent = editedRecipientName;
              }
              if (recipientEmailElement) {
                recipientEmailElement.textContent = editedRecipientEmail;
              }
              
              newEditBtn.textContent = '編集する';
            }
          }
        });
      };

      openEmailCompose = () => {
        const recipientInfo = el('#recipient-info');
        if (recipientInfo) {
          recipientInfo.innerHTML = `
            <div id="recipient-name">${extractedContactData.name || '[名前不明]'}</div>
            <div id="recipient-email" style="opacity: 0.7;">${extractedContactData.email || '[メールアドレス不明]'}</div>
          `;
        }
        
        emailScreen.classList.add('active');
        
        initTemplateManager();
        
        setTimeout(() => {
          initManualEdit();
        }, 300);
      };

      emailCloseBtn.addEventListener('click', closeEmailCompose);
      emailCancelBtn.addEventListener('click', closeEmailCompose);

      emailSendBtn.addEventListener('click', async () => {
        const template = getCurrentTemplate();
        if (!template) {
          showBusinessCardAlert('エラー', 'メールテンプレートが選択されていません');
          return;
        }
        
        if (!extractedContactData.email) {
          showBusinessCardAlert('エラー', '送信先メールアドレスが設定されていません');
          return;
        }
        
        try {
          emailSendBtn.textContent = '送信中...';
          emailSendBtn.disabled = true;
          
          const subjectElement = el('#email-subject-preview-text');
          const bodyElement = el('#email-body-preview-text');
          
          let finalSubject, finalBody;
          
          const manualSubjectInput = el('#manual-subject');
          const manualBodyInput = el('#manual-body');
          
          if (manualSubjectInput && manualBodyInput) {
            finalSubject = manualSubjectInput.value;
            finalBody = manualBodyInput.value;
          } else {
            finalSubject = subjectElement.textContent || subjectElement.innerText;
            
            const bodyHtml = bodyElement.innerHTML;
            finalBody = bodyHtml
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<[^>]*>/g, '')
              .replace(/&nbsp;/g, ' ')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&amp;/g, '&');
          }
          
          await Promise.all([
            sendEmailViaGAS(extractedContactData.email, finalSubject, finalBody),
            saveContactToDatabase()
          ]);
          
          showBusinessCardAlert('完了', 'メール送信と人脈登録が完了しました');
          closeEmailCompose();
          resetBusinessCardForm();
          
        } catch (error) {
          showBusinessCardAlert('送信エラー', 'メール送信に失敗しました: ' + error.message);
        } finally {
          emailSendBtn.textContent = 'メール送信 & 人脈登録';
          emailSendBtn.disabled = false;
        }
      });

      window.openEmailCompose = openEmailCompose;
    };

    // 紹介者入力モーダル表示関数
    const showReferrerInputModal = () => {
      const modalHtml = `
        <div class="modal-overlay active" id="referrer-input-modal">
          <div class="modal-content" style="max-width: 500px;">
            <div class="modal-icon">👥</div>
            <div class="modal-title">紹介者情報の入力</div>
            <div class="modal-message">この方の紹介者がいる場合は入力してください</div>
            
            <div class="referrer-search-container" style="margin: 25px 0; position: relative;">
              <input type="text" id="modal-referrer-search" class="form-control" 
                     placeholder="紹介者名を入力して検索..." style="margin-bottom: 15px;" />
              <input type="hidden" id="modal-referrer-id" />
              <input type="hidden" id="modal-referrer-name" />
              <div id="modal-referrer-dropdown" class="referrer-dropdown"></div>
            </div>
            
            <div class="modal-button-container" style="display: flex; gap: 15px;">
              <button class="modal-button primary" id="referrer-complete-btn">完了</button>
              <button class="modal-button secondary" id="referrer-skip-btn">スキップ（紹介者なし）</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      
      initModalReferrerSearch();
      
      document.getElementById('referrer-complete-btn').addEventListener('click', () => {
        const referrerId = document.getElementById('modal-referrer-id').value;
        const referrerName = document.getElementById('modal-referrer-name').value;
        
        el('#extracted-referrer').value = referrerId;
        el('#extracted-referrer-name').value = referrerName;
        if (referrerName) {
          const referrerSearchInput = el('#extracted-referrer-search');
          const company = referrerOptions.find(r => r.id === referrerId)?.company || '';
          referrerSearchInput.value = `${referrerName}${company ? ` (${company})` : ''}`;
        }
        
        closeReferrerModal();
        showResultScreen();
      });
      
      document.getElementById('referrer-skip-btn').addEventListener('click', () => {
        closeReferrerModal();
        showResultScreen();
      });
    };

    const closeReferrerModal = () => {
      const modal = document.getElementById('referrer-input-modal');
      if (modal) {
        modal.remove();
      }
    };

    const showResultScreen = () => {
      el('#card-upload-screen').style.display = 'none';
      const resultScreen = el('#card-result-screen');
      resultScreen.style.display = 'block';
      setTimeout(() => resultScreen.classList.add('show'), 100);
      $ocrResults.classList.add('show');
    };

    const initModalReferrerSearch = () => {
      const searchInput = document.getElementById('modal-referrer-search');
      const hiddenIdInput = document.getElementById('modal-referrer-id');
      const hiddenNameInput = document.getElementById('modal-referrer-name');
      
      let searchTimeout = null;
      
      const performModalSearch = (query) => {
        const searchTerm = query.toLowerCase().trim();
        
        if (searchTerm.length === 0) {
          const dropdown = document.getElementById('modal-referrer-dropdown');
          if (dropdown) {
            dropdown.classList.remove('active');
          }
          return;
        }
        
        if (searchTerm.length < 2) {
          displayModalSearchResults([]);
          return;
        }
        
        const filteredReferrers = referrerOptions.filter(referrer => 
          referrer.name.toLowerCase().includes(searchTerm) ||
          (referrer.company && referrer.company.toLowerCase().includes(searchTerm))
        );
        
        displayModalSearchResults(filteredReferrers);
      };
      
      const displayModalSearchResults = (results) => {
        const dropdown = document.getElementById('modal-referrer-dropdown');
        
        if (results.length === 0) {
          dropdown.innerHTML = '<div class="referrer-no-results">該当する紹介者が見つかりません</div>';
        } else {
          dropdown.innerHTML = results.slice(0, 50).map(referrer => `
            <div class="referrer-item" data-id="${referrer.id}" data-name="${referrer.name}">
              <div class="referrer-name">${referrer.name}</div>
              <div class="referrer-company">${referrer.company || '会社名なし'}</div>
            </div>
          `).join('');
          
          dropdown.querySelectorAll('.referrer-item').forEach(item => {
            item.addEventListener('click', () => {
              const referrerId = item.dataset.id;
              const referrerName = item.dataset.name;
              const referrerCompany = item.querySelector('.referrer-company').textContent;
              
              searchInput.value = `${referrerName}${referrerCompany !== '会社名なし' ? ` (${referrerCompany})` : ''}`;
              hiddenIdInput.value = referrerId;
              hiddenNameInput.value = referrerName;
              
              dropdown.classList.remove('active');
            });
          });
        }
        
        dropdown.classList.add('active');
      };
      
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        
        if (searchTimeout) {
          clearTimeout(searchTimeout);
        }
        
        searchTimeout = setTimeout(() => {
          performModalSearch(query);
        }, 300);
      });
      
      searchInput.addEventListener('focus', () => {
        if (searchInput.value.length >= 2) {
          performModalSearch(searchInput.value);
        }
      });
    };

    // 名刺OCR機能の初期化
    const initBusinessCardOCR = () => {
      // 表面画像のアップロード
      $cardFile.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        cardImageFile = file;
        
        try {
          const cardImageContainer = el('#card-image-container');
          const cardImage = el('#card-image');
          const uploadContent = document.querySelector('.card-upload-content');
          
          await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
              selectedCardImage = e.target.result;
              cardImage.src = e.target.result;
              uploadContent.style.display = 'none';
              cardImageContainer.style.display = 'block';
              resolve();
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          
          // 裏面追加ボタンと読み込み開始ボタンを表示
          $addBackBtn.style.display = 'block';
          $processBtn.style.display = 'block';
          
        } catch (error) {
          showBusinessCardAlert('エラー', '画像の読み込みに失敗しました: ' + error.message);
        }
      });
      
      // 裏面追加ボタンのクリック
      $addBackBtn.addEventListener('click', function() {
        $cardUploadBack.style.display = 'block';
        $addBackBtn.style.display = 'none';
      });
      
      // 裏面画像のアップロード
      $cardFileBack.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        cardImageFileBack = file;
        
        try {
          const cardImageContainerBack = el('#card-image-container-back');
          const cardImageBack = el('#card-image-back');
          const uploadContentBack = el('#back-upload-content');
          
          await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
              selectedCardImageBack = e.target.result;
              cardImageBack.src = e.target.result;
              uploadContentBack.style.display = 'none';
              cardImageContainerBack.style.display = 'block';
              resolve();
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          
        } catch (error) {
          showBusinessCardAlert('エラー', '裏面画像の読み込みに失敗しました: ' + error.message);
        }
      });
      
      // 読み込み開始ボタンのクリック
      $processBtn.addEventListener('click', async function() {
        console.log('=== 読み込み開始 ===');
        console.log('表面画像:', selectedCardImage ? '有り' : '無し');
        console.log('裏面画像:', selectedCardImageBack ? '有り' : '無し');
        
        if (!selectedCardImage) {
          showBusinessCardAlert('エラー', '表面の画像をアップロードしてください');
          return;
        }
        
        try {
          $processBtn.disabled = true;
          $processBtn.classList.add('loading');
          $processBtn.textContent = '処理中...';
          
          // 処理オーバーレイを表示
          el('#processing-overlay').style.display = 'flex';
          
          console.log('Vision API呼び出し開始（表面）');
          console.log('APIキー:', VISION_API_KEY ? `${VISION_API_KEY.substring(0, 10)}...` : '未設定');
          
          // 表面のOCR処理
          const ocrResult = await callVisionAPI(VISION_API_KEY, selectedCardImage);
          console.log('表面OCR結果:', ocrResult);
          
          // 裏面がある場合は裏面もOCR処理
          let backOcrResult = null;
          if (selectedCardImageBack) {
            console.log('Vision API呼び出し開始（裏面）');
            backOcrResult = await callVisionAPI(VISION_API_KEY, selectedCardImageBack);
            console.log('裏面OCR結果:', backOcrResult);
          }
          
          // OCR結果を結合
          let combinedText = '';
          if (ocrResult.success) {
            combinedText = ocrResult.text;
            if (backOcrResult && backOcrResult.success) {
              combinedText += '\n\n[裏面]\n' + backOcrResult.text;
            }
          }
          console.log('結合されたテキスト:', combinedText ? `${combinedText.substring(0, 100)}...` : '空');
          
          if (ocrResult.success) {
            await displayOCRResults(combinedText);
            
            // 処理オーバーレイを非表示
            el('#processing-overlay').style.display = 'none';
            
            setTimeout(() => {
              showReferrerInputModal();
            }, 1000);
            
            extractedContactData = {
              name: el('#extracted-name').value || '',
              company: el('#extracted-company').value || '',
              position: el('#extracted-position').value || '',
              phone: el('#extracted-phone').value || '',
              email: el('#extracted-email').value || '',
              website: el('#extracted-website').value || '',
              address: el('#extracted-address').value || '',
              postalCode: el('#extracted-postalcode').value || '',
              birthday: el('#extracted-birthday').value || '',
              industry: el('#extracted-industry').value || '',
              sender_name: SENDER_NAME,
              sender_company: SENDER_COMPANY
            };
            
            await checkDuplicateName();
            
          } else {
            showBusinessCardAlert('OCRエラー', 'OCR処理に失敗しました: ' + ocrResult.error);
            resetToUploadScreen();
          }
          
        } catch (error) {
          console.error('=== エラー発生 ===');
          console.error('エラー詳細:', error);
          console.error('エラーメッセージ:', error.message);
          console.error('スタックトレース:', error.stack);
          showBusinessCardAlert('処理エラー', 'OCR処理中にエラーが発生しました: ' + error.message);
          resetToUploadScreen();
        } finally {
          console.log('=== 処理完了 ===');
          $processBtn.disabled = false;
          $processBtn.classList.remove('loading');
          $processBtn.textContent = '読み込み開始';
          el('#processing-overlay').style.display = 'none';
        }
      });

      // 手動登録ボタン
      const $manualRegisterBtn = el('#manual-register-btn');
      $manualRegisterBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // OCR結果フィールドを空で初期化
        el('#extracted-name').value = '';
        el('#extracted-company').value = '';
        el('#extracted-position').value = '';
        el('#extracted-phone').value = '';
        el('#extracted-email').value = '';
        el('#extracted-website').value = '';
        el('#extracted-address').value = '';
        el('#extracted-postalcode').value = '';
        el('#extracted-birthday').value = '';
        el('#extracted-industry').value = '';
        
        // extractedContactDataを空で初期化
        extractedContactData = {
          name: '',
          company: '',
          position: '',
          phone: '',
          email: '',
          website: '',
          address: '',
          postalCode: '',
          birthday: '',
          industry: '',
          sender_name: SENDER_NAME,
          sender_company: SENDER_COMPANY
        };
        
        // 紹介者入力モーダルを表示
        showReferrerInputModal();
      });

      const resetToUploadScreen = () => {
        const uploadContent = document.querySelector('.card-upload-content');
        const cardImageContainer = el('#card-image-container');
        
        uploadContent.style.display = 'flex';
        cardImageContainer.style.display = 'none';
        
        uploadContent.querySelector('.card-upload-text').textContent = '名刺の表面をアップロード';
        uploadContent.querySelector('.card-upload-subtext').textContent = 'JPG, PNG対応';
      };

      // 人脈登録のみボタン
      $saveOnlyBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const name = el('#extracted-name').value.trim();
        const company = el('#extracted-company').value.trim();
        const position = el('#extracted-position').value.trim();
        const phone = el('#extracted-phone').value.trim();
        const email = el('#extracted-email').value.trim();
        const website = el('#extracted-website').value.trim();
        const address = el('#extracted-address').value.trim();
        const postalCode = el('#extracted-postalcode').value.trim();
        const birthday = el('#extracted-birthday').value.trim();
        const industry = el('#extracted-industry').value.trim();
        const referrerId = el('#extracted-referrer').value.trim();
        
        if (!name && !company && !phone && !email) {
          showBusinessCardAlert('入力エラー', '名前、会社名、電話番号、メールアドレスのいずれかを入力してください');
          return;
        }
        
        if (name && await isDuplicateName(name)) {
          // 重複があっても登録は継続
        }
        
        try {
          $saveOnlyBtn.classList.add('loading');
          
          await saveContactToDatabase();
          
          showBusinessCardSuccess('登録完了');
          resetBusinessCardForm();
          
        } catch (error) {
          showBusinessCardAlert('保存エラー', 'データ保存中にエラーが発生しました: ' + error.message);
        } finally {
          $saveOnlyBtn.classList.remove('loading');
        }
      });

      // メール作成ボタン
      $createEmailBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const name = el('#extracted-name').value.trim();
        const email = el('#extracted-email').value.trim();
        
        if (!name) {
          showBusinessCardAlert('入力エラー', '名前を入力してください');
          return;
        }
        
        if (!email) {
          showBusinessCardAlert('入力エラー', 'メールアドレスを入力してください');
          return;
        }
        
        extractedContactData = {
          name: el('#extracted-name').value || '',
          company: el('#extracted-company').value || '',
          position: el('#extracted-position').value || '',
          phone: el('#extracted-phone').value || '',
          email: el('#extracted-email').value || '',
          website: el('#extracted-website').value || '',
          address: el('#extracted-address').value || '',
          postalCode: el('#extracted-postalcode').value || '',
          birthday: el('#extracted-birthday').value || '',
          industry: el('#extracted-industry').value || '',
          sender_name: SENDER_NAME,
          sender_company: SENDER_COMPANY
        };
        
        openEmailCompose();
      });
      
      // キャンセルボタン
      const $cancelCardBtn = el('#cancel-card-btn');
      $cancelCardBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        showModal('確認', '名刺の読み取りをキャンセルしますか？<br>入力されたデータは失われます。', () => {
          resetBusinessCardForm();
        }, true);
      });
    };

    // 人脈データベースに保存する関数
    const saveContactToDatabase = async () => {
      // 画像がある場合のみアップロード
      const fileKeys = [];
      
      if (cardImageFile) {
        const fileKey = await uploadBusinessCardImage(cardImageFile);
        fileKeys.push({ fileKey: fileKey });
        
        // 裏面がある場合は裏面もアップロード
        if (cardImageFileBack) {
          const fileKeyBack = await uploadBusinessCardImage(cardImageFileBack);
          fileKeys.push({ fileKey: fileKeyBack });
        }
      }
      
      const referrerId = el('#extracted-referrer').value.trim();
      const referrerName = el('#extracted-referrer-name').value.trim();
      
      // パーソナリティ評価の選択値を取得（チェックボックス）
      const personalityCheckboxes = document.querySelectorAll('.personality-checkbox:checked');
      const selectedPersonalities = Array.from(personalityCheckboxes).map(cb => cb.value);
      
      // お付き合い度合いの選択値を取得（ドロップダウン）
      const relationshipSelect = el('#extracted-relationship');
      const selectedRelationship = relationshipSelect ? relationshipSelect.value : '';
      
      // 初回メモの内容を取得（テキストエリア）
      const introMemo = el('#extracted-memo') ? el('#extracted-memo').value.trim() : '';
      
      const businessCardRecord = {
        [PEOPLE_FIELD_CODES.NAME]: { value: el('#extracted-name').value.trim() },
        [PEOPLE_FIELD_CODES.COMPANY]: { value: el('#extracted-company').value.trim() },
        [PEOPLE_FIELD_CODES.POSITION]: { value: el('#extracted-position').value.trim() },
        [PEOPLE_FIELD_CODES.PHONE]: { value: el('#extracted-phone').value.trim() },
        [PEOPLE_FIELD_CODES.EMAIL]: { value: el('#extracted-email').value.trim() },
        [PEOPLE_FIELD_CODES.WEBSITE]: { value: el('#extracted-website').value.trim() },
        [PEOPLE_FIELD_CODES.ADDRESS]: { value: el('#extracted-address').value.trim() },
        [PEOPLE_FIELD_CODES.POSTAL_CODE]: { value: el('#extracted-postalcode').value.trim() },
        [PEOPLE_FIELD_CODES.CARD_IMAGE]: { value: fileKeys },
        [PEOPLE_FIELD_CODES.REFERRER]: { value: referrerName },
        [PEOPLE_FIELD_CODES.BIRTHDAY]: { value: el('#extracted-birthday').value.trim() },
        [PEOPLE_FIELD_CODES.INDUSTRY]: { value: el('#extracted-industry').value.trim() },
        [PEOPLE_FIELD_CODES.REFERRER_ID]: { value: referrerId || '' },
        [PEOPLE_FIELD_CODES.PERSONALITY]: { value: selectedPersonalities },
        [PEOPLE_FIELD_CODES.RELATIONSHIP_LEVEL]: { value: selectedRelationship },
        [PEOPLE_FIELD_CODES.INTRO_MEMO]: { value: introMemo }
      };
      
      const response = await kintone.api(kintone.api.url('/k/v1/record', true), 'POST', {
        app: TARGET_APP_ID,
        record: businessCardRecord
      });
      
      return response;
    };

    // 同姓同名チェック機能
    async function checkDuplicateName() {
      const nameInput = el('#extracted-name');
      const name = nameInput.value.trim();
      
      if (name && await isDuplicateName(name)) {
        $duplicateWarning.classList.add('show');
      } else {
        $duplicateWarning.classList.remove('show');
      }
    }

    async function isDuplicateName(name) {
      try {
        const normalizedName = name.replace(/\s+/g, '');
        const query = `${PEOPLE_FIELD_CODES.NAME} = "${normalizedName}"`;
        
        const response = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
          app: TARGET_APP_ID,
          query: query
        });
        
        return response.records.length > 0;
      } catch (error) {
        return false;
      }
    }

    // ヘルパー関数群
    const clearExtractedData = () => {
      el('#extracted-name').value = '';
      el('#extracted-company').value = '';
      el('#extracted-position').value = '';
      el('#extracted-phone').value = '';
      el('#extracted-email').value = '';
      el('#extracted-website').value = '';
      el('#extracted-address').value = '';
      el('#extracted-postalcode').value = '';
      el('#extracted-birthday').value = '';
      el('#extracted-industry').value = '';
      el('#extracted-referrer').value = '';
      el('#extracted-referrer-search').value = '';
      el('#extracted-referrer-name').value = '';
      
      // 追加フィールドのクリア
      // パーソナリティ評価のチェックを外す
      const personalityCheckboxes = document.querySelectorAll('.personality-checkbox');
      personalityCheckboxes.forEach(cb => cb.checked = false);
      
      // お付き合い度合いをリセット
      const relationshipSelect = el('#extracted-relationship');
      if (relationshipSelect) relationshipSelect.value = '';
      
      // 初回メモをクリア
      const memoTextarea = el('#extracted-memo');
      if (memoTextarea) memoTextarea.value = '';
    };

    const getBase64FromDataURL = (dataURL) => {
      return dataURL.split(',')[1];
    };

    const preprocessOCRText = (rawText) => {
      return rawText
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n\s*\n/g, '\n')
        .replace(/[ \u3000]+/g, ' ')
        .trim()
        .split('\n')
        .filter(line => line.trim())
        .join('\n');
    };

    const callVisionAPI = async (apiKey, imageDataURL) => {
      console.log('callVisionAPI開始');
      const base64Image = getBase64FromDataURL(imageDataURL);
      console.log('Base64画像サイズ:', base64Image.length, '文字');
      
      const apiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
      console.log('APIエンドポイント:', apiUrl.replace(apiKey, 'XXX...'));
      
      const requestBody = {
        requests: [{
          image: { content: base64Image },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }]
        }]
      };
      
      try {
        console.log('Vision API呼び出し中...');
        const response = await new Promise((resolve, reject) => {
          kintone.proxy(apiUrl, 'POST', {
            'Content-Type': 'application/json'
          }, JSON.stringify(requestBody), (response, status) => {
            console.log('Vision APIレスポンスステータス:', status);
            if (status === 200) {
              console.log('Vision API成功');
              resolve(JSON.parse(response));
            } else {
              console.error('Vision APIエラー:', status, response);
              reject(new Error(`API Error: ${status}`));
            }
          });
        });
        
        if (response.responses && response.responses[0] && response.responses[0].textAnnotations) {
          const fullText = response.responses[0].textAnnotations[0].description;
          return { success: true, text: fullText };
        } else if (response.responses && response.responses[0] && response.responses[0].error) {
          return { success: false, error: response.responses[0].error.message };
        } else {
          return { success: false, error: 'テキストが検出されませんでした' };
        }
        
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    const displayOCRResults = async (rawText) => {
      const processedText = preprocessOCRText(rawText);
      
      el('#extracted-name').value = 'AI分析中...';
      el('#extracted-company').value = 'AI分析中...';
      el('#extracted-position').value = 'AI分析中...';
      el('#extracted-phone').value = 'AI分析中...';
      el('#extracted-email').value = 'AI分析中...';
      el('#extracted-website').value = 'AI分析中...';
      el('#extracted-address').value = 'AI分析中...';
      el('#extracted-postalcode').value = 'AI分析中...';
      
      try {
        const extractedData = await extractBusinessCardInfoWithClaude(processedText);
        
        const normalizedName = extractedData.name ? extractedData.name.replace(/\s+/g, '') : '';
        
        el('#extracted-name').value = normalizedName;
        el('#extracted-company').value = extractedData.company || '';
        el('#extracted-position').value = extractedData.position || '';
        el('#extracted-phone').value = extractedData.phone || '';
        el('#extracted-email').value = extractedData.email || '';
        el('#extracted-website').value = extractedData.website || '';
        el('#extracted-address').value = extractedData.address || '';
        el('#extracted-postalcode').value = extractedData.postalCode || '';
        
      } catch (error) {
        const fallbackData = extractBusinessCardInfoFallback(rawText);
        
        el('#extracted-name').value = fallbackData.name.replace(/\s+/g, '');
        el('#extracted-company').value = fallbackData.company;
        el('#extracted-position').value = fallbackData.position;
        el('#extracted-phone').value = fallbackData.phone;
        el('#extracted-email').value = fallbackData.email;
        el('#extracted-website').value = fallbackData.website;
        el('#extracted-address').value = fallbackData.address;
        el('#extracted-postalcode').value = fallbackData.postalCode;
        
        showExtractionFailureModal(fallbackData);
      }
    };

    // Claude APIを使用した高精度抽出
    const extractBusinessCardInfoWithClaude = async (processedText) => {
      const prompt = `あなたは日本の名刺情報抽出の専門AIです。縦書き・横書き・混在レイアウトの全パターンに対応し、業界・企業規模を問わず正確な情報抽出を行ってください。

=== 基本方針 ===
・配置位置ではなく語彙・文脈・日本の商習慣から判別
・特定企業や業界に依存しない汎用ルールで処理
・不明な項目は推測せず空文字で返す
・装飾語・スローガン・キャッチコピーは除外

=== 日本名刺の構造理解 ===
一般的階層：組織名→部署・支社名→個人名→役職→連絡先情報
ただし、レイアウトは多様で順序が入れ替わることも多い

=== 項目別抽出基準 ===

【name】個人の氏名
・日本人名（漢字・かな・カナ）または外国人名（アルファベット）
・メールアドレスのローカル部分との一致を参考にする
・組織語（支社/支店/部/課/本社/営業所/センター等）を含む文字列は除外
・法人格（株式会社/有限会社等）を含む文字列は除外
・役職語（部長/課長/社長/取締役等）を含む文字列は除外

【company】組織の正式名称
・法人格を含む正式名称を優先：株式会社/有限会社/合同会社/一般社団法人/一般財団法人/医療法人/学校法人/社会福祉法人/NPO法人/生命保険株式会社/損害保険株式会社/農業協同組合/信用金庫/信用組合/労働金庫/相互会社/銀行/証券/生命/海上/火災/信金/信組/農協/法律事務所/会計事務所/司法書士事務所/行政書士事務所/税理士事務所/弁理士事務所/社会保険労務士事務所/土地家屋調査士事務所/不動産鑑定士事務所/公認会計士事務所/社労士事務所/FP事務所/コンサルティング事務所/特許事務所/弁護士法人/税理士法人/司法書士法人/行政書士法人/Inc./Co.,Ltd./Corp.等
・金融機関特有の表記も対象：○○銀行/○○証券/○○生命/○○海上/○○火災/○○信金/○○信組/○○農協/JA○○等
・支社名・部署名単体は除外、必ず法人としての名称を抽出

【position】役職・所属部署
・個人の役職名と所属部署の組み合わせ可
・代表取締役/部長/課長/マネージャー/エンジニア/コンサルタント/プランナー等
・支社名も所属として含める場合あり

【phone】電話番号
・優先順位：携帯（070/080/090）→フリーダイヤル（0120/0800）→固定電話
・形式：0で始まる10-11桁、数字とハイフンのみ
・FAX番号・内線番号は除外
・郵便番号（7桁）との混同を避ける

【email】メールアドレス
・@を含む完全なアドレス
・ドメイン部分が適切な形式（.com/.co.jp/.jp/.net等）

【website】ウェブサイト
・http://、https://、www.で始まる、または適切なドメインで終わるURL

【postalCode】郵便番号
・7桁の数字（XXX-XXXX形式）
・〒マークの有無は問わない
・電話番号（特に0120等のフリーダイヤル）と絶対に混同しない

【address】住所
・都道府県から始まる完全住所（郵便番号部分は除く）
・複数住所がある場合は代表住所を優先

=== 重要な判別ポイント ===
・個人名と組織名の厳密な区別
・電話番号（0120-XXXXXX）と郵便番号（XXX-XXXX）の形式による判別
・法人格の有無による会社名の特定
・メールアドレスとの整合性チェック

OCRテキスト:
"""
${processedText}
"""

以下のJSON形式のみで出力（説明・コメント一切不要）:
{
  "name": "",
  "company": "",
  "position": "",
  "phone": "",
  "email": "",
  "website": "",
  "address": "",
  "postalCode": ""
}`;

      try {
        const requestBody = JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          temperature: 0.02,
          messages: [
            { role: "user", content: prompt }
          ]
        });

        const response = await new Promise((resolve, reject) => {
          kintone.proxy(
            'https://api.anthropic.com/v1/messages',
            'POST',
            {
              'Content-Type': 'application/json',
              'x-api-key': CLAUDE_API_KEY,
              'anthropic-version': '2023-06-01'
            },
            requestBody,
            (response, status) => {
              if (status === 200) {
                resolve(JSON.parse(response));
              } else {
                reject(new Error(`Claude API Error: ${status} - ${response}`));
              }
            }
          );
        });

        let responseText = response.content[0].text;
        responseText = responseText.replace(/```json\s?/g, "").replace(/```\s?/g, "").trim();
        const extractedData = JSON.parse(responseText);
        
        return validateAndNormalizeData(extractedData);

      } catch (error) {
        throw error;
      }
    };

    // データ検証・正規化関数
    const validateAndNormalizeData = (data) => {
      const result = {
        name: '', company: '', position: '', phone: '', 
        email: '', website: '', address: '', postalCode: ''
      };

      const toHalfWidth = (str = '') => {
        return str.replace(/[０-９－]/g, (char) => {
          return String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
        });
      };

      const ORG_PATTERNS = /(支社|支店|本社|営業所|事業所|支部|本部|部|課|室|センター|グループ|ホールディングス)/;
      const CORP_PATTERNS = /(株式会社|有限会社|合同会社|合名会社|合資会社|一般社団法人|一般財団法人|医療法人|学校法人|社会福祉法人|NPO法人|生命保険株式会社|損害保険株式会社|農業協同組合|信用金庫|信用組合|労働金庫|相互会社|銀行|証券|生命|海上|火災|信金|信組|農協|法律事務所|会計事務所|司法書士事務所|行政書士事務所|税理士事務所|弁理士事務所|社会保険労務士事務所|土地家屋調査士事務所|不動産鑑定士事務所|公認会計士事務所|社労士事務所|FP事務所|コンサルティング事務所|特許事務所|弁護士法人|税理士法人|司法書士法人|行政書士法人|Inc\.?|Co\.?,?\s*Ltd\.?|Corp\.?|LLC)/i;

      if (data.name && !ORG_PATTERNS.test(data.name) && !CORP_PATTERNS.test(data.name)) {
        const POSITION_PATTERNS = /(社長|会長|部長|課長|係長|主任|取締役|代表|専務|常務|マネージャー|リーダー)/;
        if (!POSITION_PATTERNS.test(data.name)) {
          result.name = toHalfWidth(data.name).replace(/\s+/g, '');
        }
      }

      if (data.company && CORP_PATTERNS.test(data.company)) {
        result.company = data.company.trim();
      }

      if (data.position) {
        result.position = data.position.trim();
      }

      if (data.phone) {
        const phoneClean = toHalfWidth(data.phone).replace(/[^\d-]/g, '');
        if (/^(070|080|090)-?\d{4}-?\d{4}$/.test(phoneClean) ||
            /^(0120|0800)-?\d{3}-?\d{3}$/.test(phoneClean) ||
            /^0\d{1,4}-?\d{1,4}-?\d{4}$/.test(phoneClean)) {
          result.phone = phoneClean;
        }
      }

      if (data.email) {
        const emailClean = data.email.trim().toLowerCase();
        if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(emailClean)) {
          result.email = emailClean;
        }
      }

      if (data.website) {
        let websiteClean = data.website.trim();
        websiteClean = websiteClean.replace(/[。．、,]$/, '');
        if (/^(https?:\/\/|www\.)/i.test(websiteClean) || /\.(com|co\.jp|jp|net|org)$/i.test(websiteClean)) {
          result.website = websiteClean;
        }
      }

      if (data.postalCode) {
        const postalClean = toHalfWidth(data.postalCode).replace(/[^\d-]/g, '');
        if (/^\d{3}-?\d{4}$/.test(postalClean) && 
            !postalClean.startsWith('0120') && 
            !postalClean.startsWith('0800') &&
            !/^0\d{2,4}/.test(postalClean)) {
          result.postalCode = postalClean.includes('-') ? postalClean : 
            postalClean.replace(/^(\d{3})(\d{4})$/, '$1-$2');
        }
      }

      if (data.address && /(都|道|府|県|市|区|郡|町|村)/.test(data.address)) {
        result.address = data.address.replace(/^〒?\s?\d{3}-?\d{4}\s*/, '').trim();
      }

      return result;
    };

    // フォールバック用の基本抽出
    const extractBusinessCardInfoFallback = (text) => {
      const result = { 
        name: '', 
        company: '', 
        position: '', 
        phone: '', 
        email: '', 
        website: '', 
        address: '', 
        postalCode: '' 
      };
      
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emailMatch = text.match(emailRegex);
      if (emailMatch) {
        result.email = emailMatch[0];
      }
      
      const phoneRegex = /(?:\d{2,4}[-\s]?\d{2,4}[-\s]?\d{4}|\d{3}[-\s]?\d{4}[-\s]?\d{4})/g;
      const phoneMatches = text.match(phoneRegex);
      if (phoneMatches) {
        const mobilePatterns = [
          /0[789]0[-\s]?\d{4}[-\s]?\d{4}/,
          /0[789]0\d{8}/
        ];
        
        let mobilePhone = null;
        for (let pattern of mobilePatterns) {
          const mobileMatch = text.match(pattern);
          if (mobileMatch) {
            mobilePhone = mobileMatch[0].replace(/\s/g, '');
            break;
          }
        }
        
        result.phone = mobilePhone || phoneMatches[0].replace(/\s/g, '');
      }
      
      const urlRegex = /https?:\/\/[^\s]+/g;
      const urlMatch = text.match(urlRegex);
      if (urlMatch) {
        result.website = urlMatch[0];
      }
      
      const postalRegex = /〒?\s?(\d{3}-?\d{4})/g;
      const postalMatch = text.match(postalRegex);
      if (postalMatch) {
        result.postalCode = postalMatch[0].replace(/〒\s?/, '');
      }
      
      const companyRegex = /(株式会社|有限会社|合同会社|合名会社|合資会社|一般社団法人|一般財団法人|医療法人|学校法人|社会福祉法人|NPO法人|生命保険株式会社|損害保険株式会社|農業協同組合|信用金庫|信用組合|労働金庫|相互会社|銀行|証券|生命|海上|火災|信金|信組|農協|法律事務所|会計事務所|司法書士事務所|行政書士事務所|税理士事務所|弁理士事務所|社会保険労務士事務所|土地家屋調査士事務所|不動産鑑定士事務所|公認会計士事務所|社労士事務所|FP事務所|コンサルティング事務所|特許事務所|弁護士法人|税理士法人|司法書士法人|行政書士法人|Inc\.?|Co\.?,?\s*Ltd\.?|Corp\.?|LLC)[^\n\r]+/g;
      const companyMatch = text.match(companyRegex);
      if (companyMatch) {
        result.company = companyMatch[0].trim();
      }
      
      const positionRegex = /(代表取締役|取締役|専務|常務|部長|課長|主任|係長|社長|副社長|CEO|CTO|CFO|代表|作曲家|デザイナー|エンジニア|マネージャー)/g;
      const positionMatch = text.match(positionRegex);
      if (positionMatch) {
        result.position = positionMatch.join('・');
      }
      
      const lines = text.split('\n').filter(line => line.trim());
      for (let line of lines) {
        const trimmed = line.trim();
        if (/^[ぁ-んァ-ヶ一-龯\s]{2,8}$/.test(trimmed) && 
            !trimmed.includes('株式会社') &&
            !trimmed.includes('有限会社') &&
            !trimmed.includes('会社') &&
            !trimmed.includes('部長') &&
            !trimmed.includes('課長') &&
            !trimmed.includes('代表') &&
            !trimmed.includes('取締役') &&
            !/@/.test(trimmed) &&
            !/\d/.test(trimmed)) {
          result.name = trimmed.replace(/\s+/g, '');
          break;
        }
      }
      
      return result;
    };

    const uploadBusinessCardImage = async (file) => {
      const formData = new FormData();
      formData.append('__REQUEST_TOKEN__', kintone.getRequestToken());
      formData.append('file', file, file.name);
      
      const response = await fetch(kintone.api.url('/k/v1/file', true), {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('名刺画像のアップロードに失敗しました');
      }
      
      const result = await response.json();
      return result.fileKey;
    };

    const resetBusinessCardForm = () => {
      $cardFile.value = '';
      $cardFileBack.value = '';
      
      const imagePreview = el('#image-preview');
      if (imagePreview) {
        imagePreview.style.display = 'none';
      }
      
      $ocrResults.classList.remove('show');
      $duplicateWarning.classList.remove('show');
      clearExtractedData();
      selectedCardImage = null;
      selectedCardImageBack = null;
      cardImageFile = null;
      cardImageFileBack = null;
      extractedContactData = {};
      
      $addBackBtn.style.display = 'none';
      $processBtn.style.display = 'none';
      $cardUploadBack.style.display = 'none';

      const backUploadContent = el('#back-upload-content');
      const backImageContainer = el('#card-image-container-back');
      if (backUploadContent && backImageContainer) {
        backUploadContent.style.display = 'flex';
        backUploadContent.style.flexDirection = 'column';
        backUploadContent.style.alignItems = 'center';
        backImageContainer.style.display = 'none';
      }
      
      const uploadContent = document.querySelector('.card-upload-content');
      const cardImageContainer = el('#card-image-container');
      
      if (uploadContent && cardImageContainer) {
        uploadContent.style.display = 'flex';
        uploadContent.style.flexDirection = 'column';
        uploadContent.style.alignItems = 'center';
        cardImageContainer.style.display = 'none';
      }
      
      const uploadScreen = el('#card-upload-screen');
      const resultScreen = el('#card-result-screen');
      
      if (uploadScreen && resultScreen) {
        uploadScreen.style.display = 'block';
        resultScreen.style.display = 'none';
        resultScreen.classList.remove('show');
      }
      
      const uploadArea = el('#card-upload');
      if (uploadArea) {
        uploadArea.style.background = 'rgba(0, 0, 0, 0.2)';
        uploadArea.style.borderColor = 'rgba(212, 175, 55, 0.3)';
        
        const uploadText = uploadArea.querySelector('.card-upload-text');
        const uploadSubtext = uploadArea.querySelector('.card-upload-subtext');
        
        if (uploadText) {
          uploadText.textContent = '名刺画像をアップロード';
          uploadText.style.textAlign = 'center';
        }
        if (uploadSubtext) {
          uploadSubtext.textContent = 'JPG, PNG対応 | 自動OCR + AI分析';
          uploadSubtext.style.textAlign = 'center';
        }
      }
    };

    // 名刺専用のアラート表示
    function showBusinessCardAlert(title, message) {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay active';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-icon">💼</div>
          <div class="modal-title">${title}</div>
          <div class="modal-message">${message}</div>
          <div class="modal-button-container center">
            <button class="modal-button primary single">OK</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      const closeModal = () => modal.remove();
      modal.querySelector('.modal-button').addEventListener('click', closeModal);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    // 名刺専用の成功表示
    function showBusinessCardSuccess(recordId) {
      const successHtml = `
        <div class="success-animation" id="business-card-success">
          <div class="success-content">
            <div class="success-icon">
              <svg viewBox="0 0 120 120">
                <circle class="success-circle" cx="60" cy="60" r="50"/>
                <polyline class="success-check" points="40,60 52,72 80,44"/>
              </svg>
            </div>
            <div class="success-message">人脈登録完了</div>
            <div class="success-submessage">レコードID: ${recordId}</div>
          </div>
        </div>
      `;
      
      document.body.insertAdjacentHTML('beforeend', successHtml);
      
      setTimeout(() => {
        const successEl = document.getElementById('business-card-success');
        if (successEl) {
          successEl.style.animation = 'fadeOut 0.5s ease-out';
          setTimeout(() => {
            successEl.remove();
          }, 500);
        }
      }, 2500);
    }

    const showModal = (title, message, onClose, showCancel = false) => {
      const modalHtml = `
        <div class="modal-overlay" id="alert-modal">
          <div class="modal-content">
            <div class="modal-icon">${title === '成功' ? '✅' : '⚠️'}</div>
            <div class="modal-title">${title}</div>
            <div class="modal-message">${message}</div>
            <div class="modal-button-container" style="display: flex; gap: 12px;">
              ${showCancel ? '<button class="modal-button secondary" id="modal-cancel">キャンセル</button>' : ''}
              <button class="modal-button primary" id="modal-close">OK</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      
      const modal = document.getElementById('alert-modal');
      const closeBtn = document.getElementById('modal-close');
      
      setTimeout(() => {
        modal.classList.add('active');
      }, 10);
      
      const closeModal = (confirmed = false) => {
        modal.classList.remove('active');
        setTimeout(() => {
          modal.remove();
          if (onClose && confirmed) onClose();
        }, 300);
      };

      closeBtn.addEventListener('click', () => closeModal(true));
      const cancelBtn = document.getElementById('modal-cancel');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => closeModal(false));
      }
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(false);
      });
    };

    // 初期化
    initBusinessCardOCR();
    initEmailCompose();
    loadReferrerOptions();
    loadIndustryOptions();
    loadPersonalityOptions();
    loadRelationshipOptions();
  };

  kintone.events.on('app.record.index.show', (event) => {
    if (!isFormView(event)) return;
    const mount = kintone.app.getHeaderSpaceElement();
    mount.innerHTML = '';
    render(mount);
  });
})();
