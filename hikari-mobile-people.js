/**
 * HIKARI Mobile People App v7 - Debug Test
 */
(function() {
  'use strict';

  kintone.events.on('mobile.app.record.index.show', function(event) {
    console.log('🌟 v7 Event fired');
    
    var el = kintone.mobile.app.getHeaderSpaceElement();
    console.log('📍 HeaderSpaceElement:', el);
    console.log('📍 Parent:', el ? el.parentElement : null);
    
    if (!el) {
      console.error('❌ HeaderSpaceElement is null');
      return event;
    }
    
    // 強制的にスタイルを設定
    el.style.cssText = 'display:block !important; min-height:100vh !important; background:#1a1a2e !important; padding:20px !important;';
    
    // シンプルなHTML
    el.innerHTML = '<div style="background:#d4af37; padding:20px; color:#000; font-size:20px; font-weight:bold; text-align:center; border-radius:10px;">HIKARI v7 テスト表示</div><div style="color:#fff; padding:20px; font-size:16px;">これが見えていれば成功です！<br>データ件数: 読み込み中...</div>';
    
    console.log('📍 innerHTML set');
    console.log('📍 el.offsetHeight:', el.offsetHeight);
    console.log('📍 el.innerHTML length:', el.innerHTML.length);
    
    // データ読み込みテスト
    kintone.api('/k/v1/records', 'GET', {
      app: kintone.mobile.app.getId(),
      query: 'limit 10'
    }).then(function(resp) {
      console.log('✅ Records:', resp.records.length);
      el.innerHTML += '<div style="color:#0f0; padding:10px;">✅ ' + resp.records.length + '件のデータを取得しました</div>';
    }).catch(function(e) {
      console.error('❌ API Error:', e);
      el.innerHTML += '<div style="color:#f00; padding:10px;">❌ エラー: ' + e.message + '</div>';
    });
    
    return event;
  });
  
  console.log('🌟 HIKARI v7 script loaded');
})();
