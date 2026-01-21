/**
 * HIKARI Portal - Main
 * エントリーポイント：初期化、レンダリング、イベント処理
 */

(function(HIKARI) {
  'use strict';

  // ========================================
  //  メイン初期化
  // ========================================
  
  HIKARI.init = async () => {
    console.log('🌟 HIKARI Portal 初期化開始');
    
    // ポータル要素を作成
    const portal = document.createElement('div');
    portal.id = 'hikari-portal';
    portal.className = 'hikari-portal';
    document.body.appendChild(portal);
    
    // スタイル追加
    const styleEl = document.createElement('style');
    styleEl.textContent = HIKARI.STYLES;
    document.head.appendChild(styleEl);
    
    // ローディング表示
    HIKARI.renderLoading(portal);
    
    try {
      // データ取得
      await HIKARI.api.fetchAllData();
      
      // メイン画面描画
      HIKARI.renderMain(portal);
      
      // イベントリスナー設定
      HIKARI.setupEventListeners();
      
      // アニメーション開始
      HIKARI.startAnimations();
      
      console.log('✅ HIKARI Portal 初期化完了');
      
    } catch (error) {
      console.error('❌ 初期化エラー:', error);
      HIKARI.renderError(portal, error);
    }
  };

  // ========================================
  //  ローディング画面
  // ========================================
  
  HIKARI.renderLoading = (container) => {
    container.innerHTML = `
      <div class="hikari-loading">
        <div class="hikari-loading-spinner"></div>
        <div class="hikari-loading-text">HIKARI</div>
        <div class="hikari-loading-sub">人脈データを読み込んでいます...</div>
      </div>
    `;
  };

  // ========================================
  //  エラー画面
  // ========================================
  
  HIKARI.renderError = (container, error) => {
    container.innerHTML = `
      <div class="hikari-loading">
        <div style="font-size: 4rem; margin-bottom: 20px;">⚠️</div>
        <div style="color: #ef4444; font-size: 1.5rem; margin-bottom: 10px;">エラーが発生しました</div>
        <div style="color: #888; margin-bottom: 30px;">${error.message}</div>
        <button onclick="location.reload()" style="
          background: linear-gradient(135deg, #d4af37, #b8941f);
          color: #0a0a0a;
          border: none;
          padding: 15px 40px;
          border-radius: 30px;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
        ">再読み込み</button>
      </div>
    `;
  };

  // ========================================
  //  メイン画面レンダリング
  // ========================================
  
  HIKARI.renderMain = (container) => {
    // ユーザー情報
    const userName = kintone.getLoginUser().name || 'ゲスト';
    const userInitial = userName.charAt(0);
    
    container.innerHTML = `
      <!-- ヘッダー -->
      <header class="hikari-header">
        <div class="hikari-logo">
          <div class="hikari-logo-icon">✨</div>
          <div class="hikari-logo-text">HIKARI</div>
        </div>
        
        <div class="hikari-header-right">
          <div class="hikari-user-info">
            <span>${userName}様</span>
            <div class="hikari-user-avatar">${userInitial}</div>
          </div>
          <button class="hikari-app-btn" id="goto-app-btn">
            <span>🚀</span>
            <span>人脈アプリへ</span>
          </button>
        </div>
      </header>
      
      <!-- タブナビゲーション -->
      <nav class="hikari-tab-nav">
        <button class="hikari-tab-btn active" data-tab="home">
          <span class="hikari-tab-icon">🏠</span>
          <span>ホーム</span>
        </button>
        <button class="hikari-tab-btn" data-tab="gratitude">
          <span class="hikari-tab-icon">🎁</span>
          <span>ご恩返し</span>
        </button>
        <button class="hikari-tab-btn" data-tab="ranking">
          <span class="hikari-tab-icon">🏆</span>
          <span>ランキング</span>
        </button>
        <button class="hikari-tab-btn" data-tab="map">
          <span class="hikari-tab-icon">🔮</span>
          <span>人脈マップ</span>
        </button>
      </nav>
      
      <!-- タブコンテンツ -->
      <div class="hikari-tab-content-wrapper">
        <div class="hikari-tab-content active" id="tab-home">
          ${HIKARI.tabs.renderHome()}
        </div>
        <div class="hikari-tab-content" id="tab-gratitude">
          ${HIKARI.tabs.renderGratitude()}
        </div>
        <div class="hikari-tab-content" id="tab-ranking">
          ${HIKARI.tabs.renderRanking()}
        </div>
        <div class="hikari-tab-content" id="tab-map">
          ${HIKARI.tabs.renderMap()}
        </div>
      </div>
    `;
  };

  // ========================================
  //  イベントリスナー設定
  // ========================================
  
  HIKARI.setupEventListeners = () => {
    const portal = document.getElementById('hikari-portal');
    if (!portal) return;
    
    // タブ切り替え
    portal.querySelectorAll('.hikari-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        HIKARI.switchTab(tabId);
      });
    });
    
    // 人脈アプリへ遷移
    const gotoAppBtn = document.getElementById('goto-app-btn');
    if (gotoAppBtn) {
      gotoAppBtn.addEventListener('click', () => {
        window.location.href = `/k/${HIKARI.CONFIG.APPS.PEOPLE}/`;
      });
    }
    
    // リストアイテムのクリック（人物詳細）
    portal.querySelectorAll('.hikari-list-item[data-record-id]').forEach(item => {
      item.addEventListener('click', () => {
        const recordId = item.dataset.recordId;
        HIKARI.openPersonDetail(recordId);
      });
    });
    
    // バブルのクリック
    portal.querySelectorAll('.hikari-bubble[data-record-id]').forEach(bubble => {
      bubble.addEventListener('click', () => {
        const recordId = bubble.dataset.recordId;
        HIKARI.openPersonDetail(recordId);
      });
    });
  };

  // ========================================
  //  タブ切り替え
  // ========================================
  
  HIKARI.switchTab = (tabId) => {
    const portal = document.getElementById('hikari-portal');
    if (!portal) return;
    
    // ボタンのアクティブ状態
    portal.querySelectorAll('.hikari-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    
    // コンテンツの表示切り替え
    portal.querySelectorAll('.hikari-tab-content').forEach(content => {
      content.classList.remove('active');
    });
    
    const targetContent = document.getElementById(`tab-${tabId}`);
    if (targetContent) {
      targetContent.classList.add('active');
      
      // イベントリスナー再設定
      targetContent.querySelectorAll('.hikari-list-item[data-record-id]').forEach(item => {
        item.addEventListener('click', () => {
          const recordId = item.dataset.recordId;
          HIKARI.openPersonDetail(recordId);
        });
      });
      
      targetContent.querySelectorAll('.hikari-bubble[data-record-id]').forEach(bubble => {
        bubble.addEventListener('click', () => {
          const recordId = bubble.dataset.recordId;
          HIKARI.openPersonDetail(recordId);
        });
      });
      
      // アニメーション再実行
      HIKARI.startAnimations();
      
      // マップタブの場合は初期化
      if (tabId === 'map' && typeof HIKARI.initMap === 'function') {
        setTimeout(() => {
          HIKARI.initMap();
        }, 200);
      }
    }
  };

  // ========================================
  //  アニメーション開始
  // ========================================
  
  HIKARI.startAnimations = () => {
    // スライドアップアニメーション
    document.querySelectorAll('.hikari-animate-slide-up').forEach((el, i) => {
      setTimeout(() => {
        el.style.opacity = '1';
      }, 100 * i);
    });
    
    // カウントアップアニメーション
    document.querySelectorAll('.hikari-kpi-value[data-count]').forEach(el => {
      const target = parseInt(el.dataset.count, 10);
      if (!isNaN(target)) {
        HIKARI.utils.animateCount(el, target, 1500);
      }
    });
  };

  // ========================================
  //  人物詳細（人脈アプリへ遷移）
  // ========================================
  
  HIKARI.openPersonDetail = (recordId) => {
    // 人脈アプリの該当レコードへ遷移
    window.location.href = `/k/${HIKARI.CONFIG.APPS.PEOPLE}/show#record=${recordId}`;
  };

  // ========================================
  //  kintoneポータルイベント
  // ========================================
  
  kintone.events.on('portal.show', (event) => {
    console.log('🌟 ポータル表示イベント');
    
    // 少し待ってから初期化（DOM準備待ち）
    setTimeout(() => {
      HIKARI.init();
    }, 100);
    
    return event;
  });

  // ========================================
  //  デバッグ用：手動初期化
  // ========================================
  
  HIKARI.debugInit = () => {
    console.log('🔧 デバッグ初期化');
    HIKARI.init();
  };

})(window.HIKARI = window.HIKARI || {});