/**
 * HIKARI Mobile People App v9
 * PC版機能完全移植版
 * 
 * 追加機能:
 * - kintone標準UI完全非表示（強化版CSS）
 * - 写真タップで拡大表示
 * - 紹介者ルックアップ（検索・選択）
 * - 住所/HP/Facebook/Instagram/郵便番号フィールド
 * - 名刺写真
 * - 重複チェック
 */
(function() {
  'use strict';

  var CONFIG = {
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
      BIRTHDAY: 'birthday',
      PHOTO: '顔写真',
      BUSINESS_CARD: '名刺写真',
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
      CONTACT_MEMO: 'contact_memo'
    },
    RELATIONSHIP_ORDER: ['1.プライム', '2.パワー', '3.スタンダード', '4.フレンド', '5.コネクト'],
    RELATIONSHIP_COLORS: {
      '1.プライム': '#d4af37',
      '2.パワー': '#a855f7',
      '3.スタンダード': '#cd7f32',
      '4.フレンド': '#5b9bd5',
      '5.コネクト': '#6b7280'
    }
  };

  var Utils = {
    getFieldValue: function(record, fieldCode) {
      var field = record[fieldCode];
      if (!field) return '';
      if (field.type === 'SUBTABLE') return field.value || [];
      if (field.type === 'FILE') return field.value || [];
      if (field.type === 'CHECK_BOX' || field.type === 'MULTI_SELECT') return field.value || [];
      return field.value || '';
    },
    escapeHtml: function(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    },
    formatDate: function(dateStr) {
      if (!dateStr) return '';
      var d = new Date(dateStr);
      return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
    },
    formatDateShort: function(dateStr) {
      if (!dateStr) return '';
      var d = new Date(dateStr);
      return (d.getMonth() + 1) + '/' + d.getDate();
    },
    getInitial: function(name) {
      return name ? name.charAt(0) : '?';
    },
    getRelationshipColor: function(rel) {
      return CONFIG.RELATIONSHIP_COLORS[rel] || '#6b7280';
    },
    getTodayString: function() {
      var d = new Date();
      var m = d.getMonth() + 1;
      var day = d.getDate();
      return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
    },
    fileCache: {},
    getFileUrl: function(fileKey) {
      var self = this;
      return new Promise(function(resolve) {
        if (!fileKey) return resolve(null);
        if (self.fileCache[fileKey]) return resolve(self.fileCache[fileKey]);
        fetch('/k/v1/file.json?fileKey=' + fileKey, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        }).then(function(r) { return r.blob(); }).then(function(blob) {
          var url = URL.createObjectURL(blob);
          self.fileCache[fileKey] = url;
          resolve(url);
        }).catch(function() { resolve(null); });
      });
    }
  };

  var state = {
    container: null,
    allRecords: [],
    filteredRecords: [],
    search: '',
    relationshipFilter: 'all',
    industryFilter: 'all',
    industryOptions: [],
    personalityOptions: [],
    contactTypeOptions: [],
    referrerOptions: [],
    currentRecord: null,
    editRecord: null,
    photoFile: null,
    businessCardFile: null
  };

  // ========== kintone標準UI完全非表示（強化版） ==========
  function hideKintoneUI() {
    var css = document.createElement('style');
    css.id = 'hikari-hide-kintone-ui';
    css.textContent = [
      // モバイル標準UI
      '.gaia-mobile-v2-viewpanel-viewtab',
      '.gaia-mobile-v2-viewpanel-pager',
      '.gaia-mobile-v2-viewpanel-viewlist',
      '.gaia-mobile-v2-viewpanel-recordlist',
      '.gaia-mobile-v2-app-index-pager',
      '.gaia-mobile-v2-app-index-toolbar',
      '.gaia-mobile-v2-app-index-addbutton',
      // レコード一覧
      '.recordlist-gaia',
      '.gaia-mobile-v2-recordlist',
      '.gaia-mobile-v2-record-single-show',
      // 追加ボタン
      '.gaia-mobile-v2-app-addbutton',
      '.gaia-mobile-v2-app-toolbar-gaia',
      // ツールバー
      '.gaia-mobile-v2-app-index-view',
      // その他
      '.gaia-mobile-v2-buttonarea',
      '.gaia-mobile-v2-messagepanel',
      '.gaia-mobile-v2-app-pager',
      // 新しい要素
      '.recordlist-wrapper-gaia',
      '.gaia-mobile-v2-app-record-viewtab-container',
      '.gaia-mobile-v2-view-list-record',
      '.gaia-mobile-v2-app-indexHeader'
    ].join(',') + '{display:none!important;visibility:hidden!important;height:0!important;overflow:hidden!important;position:absolute!important;left:-9999px!important}';
    
    // 既存のスタイルがあれば削除
    var existing = document.getElementById('hikari-hide-kintone-ui');
    if (existing) existing.remove();
    
    document.head.appendChild(css);
    
    // 動的に追加される要素も非表示にする
    setTimeout(function() {
      var lists = document.querySelectorAll('.gaia-mobile-v2-viewpanel-recordlist, .recordlist-gaia, .gaia-mobile-v2-app-index-toolbar');
      lists.forEach(function(el) {
        el.style.cssText = 'display:none!important;visibility:hidden!important;height:0!important';
      });
    }, 100);
    
    // さらに遅延して再チェック
    setTimeout(function() {
      var lists = document.querySelectorAll('.gaia-mobile-v2-viewpanel-recordlist, .recordlist-gaia, .gaia-mobile-v2-app-index-toolbar');
      lists.forEach(function(el) {
        el.style.cssText = 'display:none!important;visibility:hidden!important;height:0!important';
      });
    }, 500);
  }

  // ========== 写真拡大表示モーダル ==========
  function showPhotoModal(fileKey) {
    if (!fileKey) return;
    
    // ローディング表示
    var modal = document.createElement('div');
    modal.id = 'hikari-photo-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);z-index:99999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.3s';
    modal.innerHTML = '<div style="color:#d4af37;font-size:14px">読み込み中...</div>';
    document.body.appendChild(modal);
    
    // フェードイン
    setTimeout(function() { modal.style.opacity = '1'; }, 10);
    
    // 画像取得
    fetch('/k/v1/file.json?fileKey=' + fileKey, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    }).then(function(r) { return r.blob(); }).then(function(blob) {
      var url = URL.createObjectURL(blob);
      
      modal.innerHTML = '<button style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,0.1);border:none;color:#fff;width:40px;height:40px;border-radius:50%;font-size:24px;cursor:pointer;z-index:10">&times;</button><img src="' + url + '" style="max-width:95%;max-height:90%;object-fit:contain;border-radius:8px">';
      
      // 閉じる処理
      var closeModal = function() {
        modal.style.opacity = '0';
        setTimeout(function() {
          modal.remove();
          URL.revokeObjectURL(url);
        }, 300);
      };
      
      // 閉じるボタン
      modal.querySelector('button').addEventListener('click', function(e) {
        e.stopPropagation();
        closeModal();
      });
      
      // 背景クリックで閉じる
      modal.addEventListener('click', function(e) {
        if (e.target === modal) closeModal();
      });
      
      // 画像クリックでも閉じる
      modal.querySelector('img').addEventListener('click', closeModal);
      
    }).catch(function() {
      modal.innerHTML = '<div style="color:#ef4444;font-size:14px">画像の読み込みに失敗しました</div>';
      setTimeout(function() { modal.remove(); }, 2000);
    });
  }

  // ========== データ取得 ==========
  function fetchAllRecords() {
    return new Promise(function(resolve, reject) {
      var records = [];
      var offset = 0;
      function batch() {
        kintone.api('/k/v1/records', 'GET', {
          app: CONFIG.APP_ID,
          query: 'order by ' + CONFIG.FIELDS.KANA_NAME + ' asc limit 500 offset ' + offset
        }).then(function(resp) {
          records = records.concat(resp.records);
          if (resp.records.length < 500) resolve(records);
          else { offset += 500; batch(); }
        }).catch(reject);
      }
      batch();
    });
  }

  function loadFormOptions() {
    return kintone.api('/k/v1/app/form/fields', 'GET', { app: CONFIG.APP_ID }).then(function(f) {
      var ind = f.properties[CONFIG.FIELDS.INDUSTRY];
      if (ind && ind.options) {
        state.industryOptions = Object.keys(ind.options).filter(function(k) { return k; }).sort(function(a, b) {
          return parseInt(ind.options[a].index) - parseInt(ind.options[b].index);
        });
      }
      var pers = f.properties[CONFIG.FIELDS.PERSONALITY];
      if (pers && pers.options) {
        state.personalityOptions = Object.keys(pers.options).filter(function(k) { return k; }).sort(function(a, b) {
          return parseInt(pers.options[a].index) - parseInt(pers.options[b].index);
        });
      }
      var sub = f.properties[CONFIG.FIELDS.CONTACT_HISTORY];
      if (sub && sub.fields) {
        var ct = sub.fields[CONFIG.FIELDS.CONTACT_TYPE];
        if (ct && ct.options) {
          state.contactTypeOptions = Object.keys(ct.options).filter(function(k) { return k; }).sort(function(a, b) {
            return parseInt(ct.options[a].index) - parseInt(ct.options[b].index);
          });
        }
      }
    }).catch(function(e) { console.error('Form error:', e); });
  }

  function loadReferrerOptions() {
    state.referrerOptions = state.allRecords.map(function(r) {
      return { 
        id: Utils.getFieldValue(r, '$id'), 
        name: Utils.getFieldValue(r, CONFIG.FIELDS.NAME), 
        company: Utils.getFieldValue(r, CONFIG.FIELDS.COMPANY) 
      };
    }).filter(function(r) { return r.name; });
  }

  // ========== 重複チェック ==========
  function isDuplicateName(name) {
    if (!name) return false;
    var lower = name.toLowerCase().trim();
    return state.allRecords.some(function(r) {
      var n = Utils.getFieldValue(r, CONFIG.FIELDS.NAME);
      return n && n.toLowerCase().trim() === lower;
    });
  }

  // ========== フィルター ==========
  function applyFilters() {
    state.filteredRecords = state.allRecords.filter(function(r) {
      if (state.relationshipFilter !== 'all' && Utils.getFieldValue(r, CONFIG.FIELDS.RELATIONSHIP) !== state.relationshipFilter) return false;
      if (state.industryFilter !== 'all' && Utils.getFieldValue(r, CONFIG.FIELDS.INDUSTRY) !== state.industryFilter) return false;
      if (state.search) {
        var s = state.search.toLowerCase();
        var name = Utils.getFieldValue(r, CONFIG.FIELDS.NAME).toLowerCase();
        var kana = Utils.getFieldValue(r, CONFIG.FIELDS.KANA_NAME).toLowerCase();
        var company = Utils.getFieldValue(r, CONFIG.FIELDS.COMPANY).toLowerCase();
        var notes = Utils.getFieldValue(r, CONFIG.FIELDS.NOTES).toLowerCase();
        // サブテーブルのメモも検索
        var history = Utils.getFieldValue(r, CONFIG.FIELDS.CONTACT_HISTORY) || [];
        var historyMemo = history.map(function(h) {
          return (h.value[CONFIG.FIELDS.CONTACT_MEMO] && h.value[CONFIG.FIELDS.CONTACT_MEMO].value) ? h.value[CONFIG.FIELDS.CONTACT_MEMO].value.toLowerCase() : '';
        }).join(' ');
        if (name.indexOf(s) === -1 && kana.indexOf(s) === -1 && company.indexOf(s) === -1 && notes.indexOf(s) === -1 && historyMemo.indexOf(s) === -1) return false;
      }
      return true;
    });
  }

  // ========== 画面描画：一覧 ==========
  function renderList() {
    var hasFilter = state.relationshipFilter !== 'all' || state.industryFilter !== 'all';
    var html = '<div style="background:linear-gradient(135deg,#d4af37,#b8941f);padding:12px;text-align:center;font-size:16px;font-weight:700;color:#1a1a1a">人脈管理</div>';
    html += '<div style="padding:10px 12px;display:flex;gap:8px"><input type="search" id="hmp-search" placeholder="名前・会社名・メモで検索..." value="' + Utils.escapeHtml(state.search) + '" style="flex:1;min-width:0;background:#2a2a4a;border:1px solid #3a3a5a;border-radius:6px;padding:8px 10px;font-size:14px;color:#f5f5f5"><button id="hmp-filter-btn" style="background:' + (hasFilter ? '#d4af37;color:#1a1a1a' : '#2a2a4a;color:#d4af37') + ';border:1px solid #3a3a5a;border-radius:6px;padding:8px 12px;font-size:12px;font-weight:600">絞込</button></div>';
    html += '<div style="padding:6px 12px;font-size:11px;color:#888">' + state.filteredRecords.length + '件</div>';
    html += '<div style="padding:0 10px">';
    
    if (state.filteredRecords.length === 0) {
      html += '<div style="text-align:center;padding:30px;color:#888"><div style="font-size:32px;margin-bottom:10px">🔍</div>該当する人脈がありません</div>';
    } else {
      for (var i = 0; i < state.filteredRecords.length; i++) {
        var r = state.filteredRecords[i];
        var id = Utils.getFieldValue(r, '$id');
        var name = Utils.getFieldValue(r, CONFIG.FIELDS.NAME);
        var company = Utils.getFieldValue(r, CONFIG.FIELDS.COMPANY);
        var position = Utils.getFieldValue(r, CONFIG.FIELDS.POSITION);
        var rel = Utils.getFieldValue(r, CONFIG.FIELDS.RELATIONSHIP);
        var color = Utils.getRelationshipColor(rel);
        var lastContact = Utils.getFieldValue(r, CONFIG.FIELDS.LAST_CONTACT);
        var lastType = Utils.getFieldValue(r, CONFIG.FIELDS.LAST_CONTACT_TYPE);
        var notes = Utils.getFieldValue(r, CONFIG.FIELDS.NOTES);
        var photo = Utils.getFieldValue(r, CONFIG.FIELDS.PHOTO);
        var fileKey = photo && photo.length > 0 ? photo[0].fileKey : '';
        var cached = fileKey ? Utils.fileCache[fileKey] : '';
        var avatarStyle = 'width:40px;height:40px;min-width:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;background:' + color + ';' + (cached ? 'background-image:url(' + cached + ');background-size:cover;color:transparent' : '');
        var contactText = lastContact ? (lastType ? lastType + ' ' : '') + Utils.formatDateShort(lastContact) : '接点なし';
        
        // メモの一部を表示
        var shortNotes = notes ? (notes.length > 20 ? notes.substring(0, 20) + '...' : notes) : '';
        
        html += '<div class="hmp-card" data-id="' + id + '" style="background:#252540;border-radius:8px;padding:10px;margin-bottom:6px;display:flex;align-items:center;gap:10px;border-left:3px solid ' + color + ';cursor:pointer">';
        html += '<div class="hmp-avatar" data-key="' + fileKey + '" style="' + avatarStyle + '">' + Utils.getInitial(name) + '</div>';
        html += '<div style="flex:1;min-width:0;overflow:hidden">';
        html += '<div style="font-size:13px;font-weight:600;color:#f5f5f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + Utils.escapeHtml(name) + '</div>';
        html += '<div style="font-size:10px;color:#999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + Utils.escapeHtml(company) + (position ? ' / ' + Utils.escapeHtml(position) : '') + '</div>';
        if (shortNotes) {
          html += '<div style="font-size:9px;color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">' + Utils.escapeHtml(shortNotes) + '</div>';
        }
        html += '<div style="display:flex;align-items:center;gap:4px;margin-top:3px"><span style="font-size:9px;padding:1px 5px;border-radius:6px;font-weight:600;color:#1a1a1a;background:' + color + '">' + (rel || '未設定') + '</span><span style="font-size:9px;color:#888">' + contactText + '</span></div>';
        html += '</div><div style="color:#666;font-size:14px">›</div></div>';
      }
    }
    
    html += '</div>';
    html += '<div id="hmp-add-btn" style="background:linear-gradient(135deg,#d4af37,#b8941f);border-radius:8px;padding:14px;margin:12px 10px;text-align:center;color:#1a1a1a;font-size:14px;font-weight:600;cursor:pointer">＋ 新しい人脈を追加</div>';
    
    state.container.innerHTML = html;
    
    // イベント
    document.getElementById('hmp-search').addEventListener('input', function(e) {
      state.search = e.target.value;
      applyFilters();
      renderList();
    });
    document.getElementById('hmp-filter-btn').addEventListener('click', function() { renderFilter(); });
    document.getElementById('hmp-add-btn').addEventListener('click', function() { 
      state.photoFile = null; 
      state.businessCardFile = null;
      state.editRecord = null; 
      renderEdit(null); 
    });
    
    var cards = state.container.querySelectorAll('.hmp-card');
    for (var j = 0; j < cards.length; j++) {
      (function(card) {
        card.addEventListener('click', function() {
          var cid = card.getAttribute('data-id');
          var rec = state.allRecords.find(function(r) { return Utils.getFieldValue(r, '$id') === cid; });
          if (rec) renderDetail(rec);
        });
      })(cards[j]);
    }
    
    // 画像遅延読み込み
    var avatars = state.container.querySelectorAll('.hmp-avatar');
    for (var k = 0; k < avatars.length; k++) {
      (function(el) {
        var key = el.getAttribute('data-key');
        if (key && !Utils.fileCache[key]) {
          Utils.getFileUrl(key).then(function(url) {
            if (url) { el.style.backgroundImage = 'url(' + url + ')'; el.style.backgroundSize = 'cover'; el.style.color = 'transparent'; }
          });
        }
      })(avatars[k]);
    }
  }

  // ========== 画面描画：フィルター ==========
  function renderFilter() {
    var relOpts = '<option value="all"' + (state.relationshipFilter === 'all' ? ' selected' : '') + '>すべて</option>';
    for (var i = 0; i < CONFIG.RELATIONSHIP_ORDER.length; i++) {
      var rel = CONFIG.RELATIONSHIP_ORDER[i];
      relOpts += '<option value="' + rel + '"' + (state.relationshipFilter === rel ? ' selected' : '') + '>' + rel + '</option>';
    }
    var indOpts = '<option value="all"' + (state.industryFilter === 'all' ? ' selected' : '') + '>すべて</option>';
    for (var j = 0; j < state.industryOptions.length; j++) {
      var opt = state.industryOptions[j];
      indOpts += '<option value="' + opt + '"' + (state.industryFilter === opt ? ' selected' : '') + '>' + opt + '</option>';
    }
    
    var html = '<div style="background:linear-gradient(135deg,#d4af37,#b8941f);padding:12px;display:flex;align-items:center;gap:8px"><button id="hmp-back" style="background:rgba(0,0,0,0.15);border:none;color:#1a1a1a;width:32px;height:32px;border-radius:50%;font-size:14px;cursor:pointer">←</button><div style="flex:1;text-align:center;font-size:16px;font-weight:700;color:#1a1a1a">絞り込み</div><div style="width:32px"></div></div>';
    html += '<div style="padding:16px 12px">';
    html += '<div style="margin-bottom:16px"><div style="font-size:12px;color:#d4af37;margin-bottom:6px;font-weight:600">お付き合い度合い</div><select id="hmp-rel" style="width:100%;background:#252540;border:1px solid #3a3a5a;border-radius:6px;padding:10px 12px;font-size:14px;color:#f5f5f5">' + relOpts + '</select></div>';
    html += '<div style="margin-bottom:16px"><div style="font-size:12px;color:#d4af37;margin-bottom:6px;font-weight:600">業種</div><select id="hmp-ind" style="width:100%;background:#252540;border:1px solid #3a3a5a;border-radius:6px;padding:10px 12px;font-size:14px;color:#f5f5f5">' + indOpts + '</select></div>';
    html += '<div style="display:flex;gap:10px;margin-top:24px"><button id="hmp-clear" style="flex:1;padding:12px;border-radius:6px;font-size:14px;font-weight:600;background:#252540;border:1px solid #3a3a5a;color:#f5f5f5;cursor:pointer">クリア</button><button id="hmp-apply" style="flex:1;padding:12px;border-radius:6px;font-size:14px;font-weight:600;background:linear-gradient(135deg,#d4af37,#b8941f);border:none;color:#1a1a1a;cursor:pointer">適用</button></div>';
    html += '</div>';
    
    state.container.innerHTML = html;
    
    document.getElementById('hmp-back').addEventListener('click', function() { renderList(); });
    document.getElementById('hmp-clear').addEventListener('click', function() {
      document.getElementById('hmp-rel').value = 'all';
      document.getElementById('hmp-ind').value = 'all';
    });
    document.getElementById('hmp-apply').addEventListener('click', function() {
      state.relationshipFilter = document.getElementById('hmp-rel').value;
      state.industryFilter = document.getElementById('hmp-ind').value;
      applyFilters();
      renderList();
    });
  }

  // ========== 画面描画：詳細 ==========
  function renderDetail(record) {
    state.currentRecord = record;
    var name = Utils.getFieldValue(record, CONFIG.FIELDS.NAME);
    var company = Utils.getFieldValue(record, CONFIG.FIELDS.COMPANY);
    var position = Utils.getFieldValue(record, CONFIG.FIELDS.POSITION);
    var phone = Utils.getFieldValue(record, CONFIG.FIELDS.PHONE);
    var email = Utils.getFieldValue(record, CONFIG.FIELDS.EMAIL);
    var address = Utils.getFieldValue(record, CONFIG.FIELDS.ADDRESS);
    var postalCode = Utils.getFieldValue(record, CONFIG.FIELDS.POSTAL_CODE);
    var hp = Utils.getFieldValue(record, CONFIG.FIELDS.HP);
    var facebook = Utils.getFieldValue(record, CONFIG.FIELDS.FACEBOOK);
    var instagram = Utils.getFieldValue(record, CONFIG.FIELDS.INSTAGRAM);
    var rel = Utils.getFieldValue(record, CONFIG.FIELDS.RELATIONSHIP);
    var industry = Utils.getFieldValue(record, CONFIG.FIELDS.INDUSTRY);
    var personality = Utils.getFieldValue(record, CONFIG.FIELDS.PERSONALITY) || [];
    var referrer = Utils.getFieldValue(record, CONFIG.FIELDS.REFERRER);
    var referrerId = Utils.getFieldValue(record, CONFIG.FIELDS.REFERRER_ID);
    var notes = Utils.getFieldValue(record, CONFIG.FIELDS.NOTES);
    var birthday = Utils.getFieldValue(record, CONFIG.FIELDS.BIRTHDAY);
    var photo = Utils.getFieldValue(record, CONFIG.FIELDS.PHOTO);
    var businessCard = Utils.getFieldValue(record, CONFIG.FIELDS.BUSINESS_CARD);
    var history = Utils.getFieldValue(record, CONFIG.FIELDS.CONTACT_HISTORY) || [];
    var color = Utils.getRelationshipColor(rel);
    var fileKey = photo && photo.length > 0 ? photo[0].fileKey : '';
    var bcFileKey = businessCard && businessCard.length > 0 ? businessCard[0].fileKey : '';
    var cached = fileKey ? Utils.fileCache[fileKey] : '';
    
    var html = '<div style="background:linear-gradient(135deg,#d4af37,#b8941f);padding:12px;display:flex;align-items:center;gap:8px"><button id="hmp-back" style="background:rgba(0,0,0,0.15);border:none;color:#1a1a1a;width:32px;height:32px;border-radius:50%;font-size:14px;cursor:pointer">←</button><div style="flex:1;text-align:center;font-size:16px;font-weight:700;color:#1a1a1a">詳細</div><button id="hmp-edit" style="background:rgba(0,0,0,0.15);border:none;color:#1a1a1a;padding:6px 12px;border-radius:16px;font-size:12px;font-weight:600;cursor:pointer">編集</button></div>';
    html += '<div style="padding:12px">';
    
    // プロフィール（写真タップで拡大可能）
    var avatarStyle = 'width:56px;height:56px;min-width:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff;background:' + color + ';cursor:pointer;' + (cached ? 'background-image:url(' + cached + ');background-size:cover;color:transparent' : '');
    html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px"><div id="hmp-detail-avatar" data-key="' + fileKey + '" style="' + avatarStyle + '">' + Utils.getInitial(name) + '</div><div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:700;color:#f5f5f5">' + Utils.escapeHtml(name) + '</div><div style="font-size:11px;color:#999;margin-top:2px">' + Utils.escapeHtml(company) + (position ? ' / ' + Utils.escapeHtml(position) : '') + '</div><div style="display:inline-block;font-size:10px;padding:2px 8px;border-radius:8px;font-weight:600;color:#1a1a1a;background:' + color + ';margin-top:4px">' + (rel || '未設定') + '</div></div></div>';
    
    // アクションボタン
    html += '<div style="display:flex;gap:8px;margin-bottom:16px">';
    html += '<a href="' + (phone ? 'tel:' + phone : 'javascript:void(0)') + '" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 8px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:600;background:' + (phone ? '#22c55e' : '#3a3a5a') + ';color:' + (phone ? '#fff' : '#666') + '"><span>📞</span><span>電話</span></a>';
    html += '<a href="' + (email ? 'mailto:' + email : 'javascript:void(0)') + '" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 8px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:600;background:' + (email ? '#3b82f6' : '#3a3a5a') + ';color:' + (email ? '#fff' : '#666') + '"><span>✉️</span><span>メール</span></a>';
    html += '</div>';
    
    // 基本情報
    html += '<div style="margin-bottom:16px"><div style="font-size:12px;font-weight:600;color:#d4af37;margin-bottom:8px">基本情報</div>';
    if (phone) html += '<div style="display:flex;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)"><div style="font-size:10px;color:#888;width:70px">電話</div><div style="font-size:12px;color:#f5f5f5;flex:1;word-break:break-all">' + Utils.escapeHtml(phone) + '</div></div>';
    if (email) html += '<div style="display:flex;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)"><div style="font-size:10px;color:#888;width:70px">メール</div><div style="font-size:12px;color:#f5f5f5;flex:1;word-break:break-all">' + Utils.escapeHtml(email) + '</div></div>';
    if (birthday) html += '<div style="display:flex;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)"><div style="font-size:10px;color:#888;width:70px">誕生日</div><div style="font-size:12px;color:#f5f5f5;flex:1">' + Utils.formatDate(birthday) + '</div></div>';
    if (postalCode || address) {
      var fullAddress = (postalCode ? '〒' + postalCode + ' ' : '') + (address || '');
      html += '<div style="display:flex;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)"><div style="font-size:10px;color:#888;width:70px">住所</div><div style="font-size:12px;color:#f5f5f5;flex:1;word-break:break-all">' + Utils.escapeHtml(fullAddress) + '</div></div>';
    }
    if (industry) html += '<div style="display:flex;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)"><div style="font-size:10px;color:#888;width:70px">業種</div><div style="font-size:12px;color:#f5f5f5;flex:1">' + Utils.escapeHtml(industry) + '</div></div>';
    if (referrer) {
      var referrerHtml = Utils.escapeHtml(referrer);
      if (referrerId) {
        referrerHtml = '<span id="hmp-referrer-link" data-id="' + referrerId + '" style="color:#d4af37;text-decoration:underline;cursor:pointer">' + referrerHtml + '</span>';
      }
      html += '<div style="display:flex;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)"><div style="font-size:10px;color:#888;width:70px">紹介者</div><div style="font-size:12px;color:#f5f5f5;flex:1">' + referrerHtml + '</div></div>';
    }
    html += '</div>';
    
    // SNSリンク
    if (hp || facebook || instagram) {
      html += '<div style="margin-bottom:16px"><div style="font-size:12px;font-weight:600;color:#d4af37;margin-bottom:8px">SNS・Web</div>';
      if (hp) html += '<div style="display:flex;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)"><div style="font-size:10px;color:#888;width:70px">HP</div><a href="' + Utils.escapeHtml(hp) + '" target="_blank" style="font-size:12px;color:#3b82f6;flex:1;word-break:break-all;text-decoration:none">' + Utils.escapeHtml(hp) + '</a></div>';
      if (facebook) html += '<div style="display:flex;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)"><div style="font-size:10px;color:#888;width:70px">Facebook</div><a href="' + Utils.escapeHtml(facebook) + '" target="_blank" style="font-size:12px;color:#3b82f6;flex:1;word-break:break-all;text-decoration:none">' + Utils.escapeHtml(facebook) + '</a></div>';
      if (instagram) html += '<div style="display:flex;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)"><div style="font-size:10px;color:#888;width:70px">Instagram</div><a href="' + Utils.escapeHtml(instagram) + '" target="_blank" style="font-size:12px;color:#3b82f6;flex:1;word-break:break-all;text-decoration:none">' + Utils.escapeHtml(instagram) + '</a></div>';
      html += '</div>';
    }
    
    // 個人特性
    if (personality.length > 0) {
      html += '<div style="margin-bottom:16px"><div style="font-size:12px;font-weight:600;color:#d4af37;margin-bottom:8px">個人特性</div><div style="display:flex;flex-wrap:wrap;gap:4px">';
      for (var i = 0; i < personality.length; i++) {
        html += '<span style="font-size:10px;padding:3px 6px;border-radius:8px;background:rgba(139,92,246,0.2);color:#a78bfa">' + Utils.escapeHtml(personality[i]) + '</span>';
      }
      html += '</div></div>';
    }
    
    // メモ
    if (notes) {
      html += '<div style="margin-bottom:16px"><div style="font-size:12px;font-weight:600;color:#d4af37;margin-bottom:8px">メモ</div><div style="font-size:12px;color:#ccc;line-height:1.5;white-space:pre-wrap">' + Utils.escapeHtml(notes) + '</div></div>';
    }
    
    // 名刺写真（タップで拡大）
    if (bcFileKey) {
      html += '<div style="margin-bottom:16px"><div style="font-size:12px;font-weight:600;color:#d4af37;margin-bottom:8px">名刺</div><div id="hmp-bc-container" data-key="' + bcFileKey + '" style="background:#252540;border-radius:8px;padding:16px;text-align:center;cursor:pointer"><div style="font-size:11px;color:#888">読み込み中...</div></div></div>';
    }
    
    // 接点履歴
    html += '<div style="margin-bottom:16px"><div style="font-size:12px;font-weight:600;color:#d4af37;margin-bottom:8px">接点履歴</div>';
    var validHistory = history.filter(function(h) { return h.value[CONFIG.FIELDS.CONTACT_DATE] && h.value[CONFIG.FIELDS.CONTACT_DATE].value; })
      .sort(function(a, b) { return (b.value[CONFIG.FIELDS.CONTACT_DATE].value || '').localeCompare(a.value[CONFIG.FIELDS.CONTACT_DATE].value || ''); });
    
    if (validHistory.length > 0) {
      for (var j = 0; j < validHistory.length; j++) {
        var h = validHistory[j];
        var date = h.value[CONFIG.FIELDS.CONTACT_DATE] ? h.value[CONFIG.FIELDS.CONTACT_DATE].value : '';
        var type = h.value[CONFIG.FIELDS.CONTACT_TYPE] ? h.value[CONFIG.FIELDS.CONTACT_TYPE].value : '';
        var memo = h.value[CONFIG.FIELDS.CONTACT_MEMO] ? h.value[CONFIG.FIELDS.CONTACT_MEMO].value : '';
        html += '<div style="background:#252540;border-radius:6px;padding:8px;margin-bottom:6px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px"><div style="font-size:11px;color:#d4af37;font-weight:600">' + Utils.formatDate(date) + '</div>' + (type ? '<div style="font-size:9px;padding:1px 5px;border-radius:4px;background:rgba(212,175,55,0.15);color:#d4af37">' + Utils.escapeHtml(type) + '</div>' : '') + '</div>' + (memo ? '<div style="font-size:11px;color:#ccc;line-height:1.4">' + Utils.escapeHtml(memo) + '</div>' : '') + '</div>';
      }
    } else {
      html += '<div style="text-align:center;color:#666;padding:12px;font-size:11px">接点履歴がありません</div>';
    }
    html += '<button id="hmp-add-contact" style="width:100%;background:transparent;border:1px dashed #3a3a5a;border-radius:6px;padding:10px;color:#d4af37;font-size:12px;cursor:pointer;margin-top:8px">+ 接点を追加</button>';
    html += '</div></div>';
    
    state.container.innerHTML = html;
    
    // 画像読み込み
    if (fileKey && !cached) {
      Utils.getFileUrl(fileKey).then(function(url) {
        if (url) {
          var avatar = document.getElementById('hmp-detail-avatar');
          if (avatar) { 
            avatar.style.backgroundImage = 'url(' + url + ')'; 
            avatar.style.backgroundSize = 'cover'; 
            avatar.style.color = 'transparent'; 
          }
        }
      });
    }
    
    // 名刺画像読み込み
    if (bcFileKey) {
      Utils.getFileUrl(bcFileKey).then(function(url) {
        if (url) {
          var bcContainer = document.getElementById('hmp-bc-container');
          if (bcContainer) {
            bcContainer.innerHTML = '<img src="' + url + '" style="max-width:100%;border-radius:4px">';
          }
        }
      });
    }
    
    // イベント
    document.getElementById('hmp-back').addEventListener('click', function() { renderList(); });
    document.getElementById('hmp-edit').addEventListener('click', function() { 
      state.photoFile = null; 
      state.businessCardFile = null;
      renderEdit(record); 
    });
    document.getElementById('hmp-add-contact').addEventListener('click', function() { renderContactForm(record); });
    
    // 写真タップで拡大
    var avatar = document.getElementById('hmp-detail-avatar');
    if (avatar && fileKey) {
      avatar.addEventListener('click', function() {
        showPhotoModal(fileKey);
      });
    }
    
    // 名刺タップで拡大
    var bcContainer = document.getElementById('hmp-bc-container');
    if (bcContainer && bcFileKey) {
      bcContainer.addEventListener('click', function() {
        showPhotoModal(bcFileKey);
      });
    }
    
    // 紹介者リンク
    var referrerLink = document.getElementById('hmp-referrer-link');
    if (referrerLink) {
      referrerLink.addEventListener('click', function() {
        var rid = referrerLink.getAttribute('data-id');
        var refRecord = state.allRecords.find(function(r) { return Utils.getFieldValue(r, '$id') === rid; });
        if (refRecord) renderDetail(refRecord);
      });
    }
  }

  // ========== 画面描画：接点追加 ==========
  function renderContactForm(record) {
    state.currentRecord = record;
    var typeOpts = '';
    for (var i = 0; i < state.contactTypeOptions.length; i++) {
      typeOpts += '<option value="' + state.contactTypeOptions[i] + '">' + state.contactTypeOptions[i] + '</option>';
    }
    
    var html = '<div style="background:linear-gradient(135deg,#d4af37,#b8941f);padding:12px;display:flex;align-items:center;gap:8px"><button id="hmp-back" style="background:rgba(0,0,0,0.15);border:none;color:#1a1a1a;width:32px;height:32px;border-radius:50%;font-size:14px;cursor:pointer">←</button><div style="flex:1;text-align:center;font-size:16px;font-weight:700;color:#1a1a1a">接点追加</div><button id="hmp-save" style="background:rgba(0,0,0,0.15);border:none;color:#1a1a1a;padding:6px 12px;border-radius:16px;font-size:12px;font-weight:600;cursor:pointer">保存</button></div>';
    html += '<div style="padding:12px">';
    html += '<div style="margin-bottom:12px"><div style="font-size:10px;color:#d4af37;margin-bottom:4px">接点日</div><input type="date" id="hmp-contact-date" value="' + Utils.getTodayString() + '" style="width:100%;background:#252540;border:1px solid #3a3a5a;border-radius:4px;padding:8px;font-size:13px;color:#f5f5f5"></div>';
    html += '<div style="margin-bottom:12px"><div style="font-size:10px;color:#d4af37;margin-bottom:4px">種別</div><select id="hmp-contact-type" style="width:100%;background:#252540;border:1px solid #3a3a5a;border-radius:4px;padding:8px;font-size:13px;color:#f5f5f5">' + typeOpts + '</select></div>';
    html += '<div style="margin-bottom:12px"><div style="font-size:10px;color:#d4af37;margin-bottom:4px">メモ</div><textarea id="hmp-contact-memo" placeholder="接点の内容..." style="width:100%;background:#252540;border:1px solid #3a3a5a;border-radius:4px;padding:8px;font-size:13px;color:#f5f5f5;min-height:80px;resize:vertical"></textarea></div>';
    html += '</div>';
    
    state.container.innerHTML = html;
    
    document.getElementById('hmp-back').addEventListener('click', function() { renderDetail(record); });
    document.getElementById('hmp-save').addEventListener('click', function() { saveContact(); });
  }

  function saveContact() {
    var id = Utils.getFieldValue(state.currentRecord, '$id');
    var date = document.getElementById('hmp-contact-date').value;
    var type = document.getElementById('hmp-contact-type').value;
    var memo = document.getElementById('hmp-contact-memo').value;
    if (!date) { alert('接点日を入力してください'); return; }
    
    kintone.api('/k/v1/record', 'GET', { app: CONFIG.APP_ID, id: id }).then(function(resp) {
      var history = resp.record[CONFIG.FIELDS.CONTACT_HISTORY] ? resp.record[CONFIG.FIELDS.CONTACT_HISTORY].value : [];
      var entry = { value: {} };
      entry.value[CONFIG.FIELDS.CONTACT_DATE] = { value: date };
      entry.value[CONFIG.FIELDS.CONTACT_TYPE] = { value: type };
      entry.value[CONFIG.FIELDS.CONTACT_MEMO] = { value: memo };
      history.push(entry);
      
      var valid = history.filter(function(h) { return h.value[CONFIG.FIELDS.CONTACT_DATE] && h.value[CONFIG.FIELDS.CONTACT_DATE].value; });
      valid.sort(function(a, b) { return (b.value[CONFIG.FIELDS.CONTACT_DATE].value || '').localeCompare(a.value[CONFIG.FIELDS.CONTACT_DATE].value || ''); });
      
      var latest = valid[0] || {};
      var latestDate = latest.value && latest.value[CONFIG.FIELDS.CONTACT_DATE] ? latest.value[CONFIG.FIELDS.CONTACT_DATE].value : '';
      var latestType = latest.value && latest.value[CONFIG.FIELDS.CONTACT_TYPE] ? latest.value[CONFIG.FIELDS.CONTACT_TYPE].value : '';
      
      var update = {};
      update[CONFIG.FIELDS.CONTACT_HISTORY] = { value: valid };
      update[CONFIG.FIELDS.LAST_CONTACT] = { value: latestDate };
      update[CONFIG.FIELDS.LAST_CONTACT_TYPE] = { value: latestType };
      update[CONFIG.FIELDS.CONTACT_COUNT] = { value: String(valid.length) };
      
      return kintone.api('/k/v1/record', 'PUT', { app: CONFIG.APP_ID, id: id, record: update });
    }).then(function() {
      return fetchAllRecords();
    }).then(function(records) {
      state.allRecords = records;
      loadReferrerOptions();
      applyFilters();
      var updated = state.allRecords.find(function(r) { return Utils.getFieldValue(r, '$id') === id; });
      if (updated) renderDetail(updated);
    }).catch(function(e) {
      console.error('接点追加エラー:', e);
      alert('接点の追加に失敗しました');
    });
  }

  // ========== 画面描画：編集 ==========
  function renderEdit(record) {
    state.editRecord = record;
    var isNew = !record;
    var name = record ? Utils.getFieldValue(record, CONFIG.FIELDS.NAME) : '';
    var kanaName = record ? Utils.getFieldValue(record, CONFIG.FIELDS.KANA_NAME) : '';
    var company = record ? Utils.getFieldValue(record, CONFIG.FIELDS.COMPANY) : '';
    var position = record ? Utils.getFieldValue(record, CONFIG.FIELDS.POSITION) : '';
    var phone = record ? Utils.getFieldValue(record, CONFIG.FIELDS.PHONE) : '';
    var email = record ? Utils.getFieldValue(record, CONFIG.FIELDS.EMAIL) : '';
    var postalCode = record ? Utils.getFieldValue(record, CONFIG.FIELDS.POSTAL_CODE) : '';
    var address = record ? Utils.getFieldValue(record, CONFIG.FIELDS.ADDRESS) : '';
    var hp = record ? Utils.getFieldValue(record, CONFIG.FIELDS.HP) : '';
    var facebook = record ? Utils.getFieldValue(record, CONFIG.FIELDS.FACEBOOK) : '';
    var instagram = record ? Utils.getFieldValue(record, CONFIG.FIELDS.INSTAGRAM) : '';
    var birthday = record ? Utils.getFieldValue(record, CONFIG.FIELDS.BIRTHDAY) : '';
    var rel = record ? Utils.getFieldValue(record, CONFIG.FIELDS.RELATIONSHIP) : '';
    var industry = record ? Utils.getFieldValue(record, CONFIG.FIELDS.INDUSTRY) : '';
    var personality = record ? Utils.getFieldValue(record, CONFIG.FIELDS.PERSONALITY) || [] : [];
    var referrer = record ? Utils.getFieldValue(record, CONFIG.FIELDS.REFERRER) : '';
    var referrerId = record ? Utils.getFieldValue(record, CONFIG.FIELDS.REFERRER_ID) : '';
    var notes = record ? Utils.getFieldValue(record, CONFIG.FIELDS.NOTES) : '';
    
    var relOpts = '<option value="">選択してください</option>';
    for (var i = 0; i < CONFIG.RELATIONSHIP_ORDER.length; i++) {
      var r = CONFIG.RELATIONSHIP_ORDER[i];
      relOpts += '<option value="' + r + '"' + (rel === r ? ' selected' : '') + '>' + r + '</option>';
    }
    var indOpts = '<option value="">選択してください</option>';
    for (var j = 0; j < state.industryOptions.length; j++) {
      var o = state.industryOptions[j];
      indOpts += '<option value="' + o + '"' + (industry === o ? ' selected' : '') + '>' + o + '</option>';
    }
    var persHtml = '';
    for (var k = 0; k < state.personalityOptions.length; k++) {
      var p = state.personalityOptions[k];
      var checked = personality.indexOf(p) !== -1 ? ' checked' : '';
      persHtml += '<label style="display:flex;align-items:center;gap:4px;background:#252540;padding:4px 8px;border-radius:4px"><input type="checkbox" name="hmp-pers" value="' + p + '"' + checked + ' style="width:14px;height:14px"><span style="font-size:11px;color:#f5f5f5">' + p + '</span></label>';
    }
    
    var inputStyle = 'width:100%;background:#252540;border:1px solid #3a3a5a;border-radius:4px;padding:8px 10px;font-size:13px;color:#f5f5f5';
    
    var html = '<div style="background:linear-gradient(135deg,#d4af37,#b8941f);padding:12px;display:flex;align-items:center;gap:8px"><button id="hmp-cancel" style="background:rgba(0,0,0,0.15);border:none;color:#1a1a1a;padding:6px 12px;border-radius:16px;font-size:12px;font-weight:600;cursor:pointer">キャンセル</button><div style="flex:1;text-align:center;font-size:16px;font-weight:700;color:#1a1a1a">' + (isNew ? '新規追加' : '編集') + '</div><button id="hmp-save" style="background:rgba(0,0,0,0.15);border:none;color:#1a1a1a;padding:6px 12px;border-radius:16px;font-size:12px;font-weight:600;cursor:pointer">保存</button></div>';
    html += '<div style="padding:12px">';
    
    // 写真
    html += '<div style="text-align:center;margin-bottom:16px"><div id="hmp-photo-preview" style="width:60px;height:60px;border-radius:50%;background:#3a3a5a;display:inline-flex;align-items:center;justify-content:center;font-size:24px;color:#666;margin-bottom:6px;background-size:cover;background-position:center;border:2px solid rgba(212,175,55,0.3)">📷</div><br><button id="hmp-photo-btn" style="background:transparent;border:1px solid rgba(212,175,55,0.5);color:#d4af37;padding:5px 12px;border-radius:12px;font-size:11px;cursor:pointer">写真を変更</button><input type="file" id="hmp-photo-input" accept="image/*" style="display:none"></div>';
    
    // 重複警告（新規のみ）
    if (isNew) {
      html += '<div id="hmp-duplicate-warning" style="display:none;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:6px;padding:8px 12px;margin-bottom:12px;font-size:11px;color:#ef4444">⚠️ 同じ名前の人脈が既に登録されています</div>';
    }
    
    // 基本情報
    html += '<div style="margin-bottom:16px"><div style="font-size:11px;font-weight:600;color:#d4af37;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(212,175,55,0.2)">基本情報</div>';
    html += '<div style="margin-bottom:12px"><div style="font-size:10px;color:#888;margin-bottom:4px">名前 <span style="color:#ef4444">*</span></div><input type="text" id="hmp-name" value="' + Utils.escapeHtml(name) + '" style="' + inputStyle + '"></div>';
    html += '<div style="margin-bottom:12px"><div style="font-size:10px;color:#888;margin-bottom:4px">ふりがな</div><input type="text" id="hmp-kana" value="' + Utils.escapeHtml(kanaName) + '" style="' + inputStyle + '"></div>';
    html += '<div style="margin-bottom:12px"><div style="font-size:10px;color:#888;margin-bottom:4px">会社名</div><input type="text" id="hmp-company" value="' + Utils.escapeHtml(company) + '" style="' + inputStyle + '"></div>';
    html += '<div style="margin-bottom:12px"><div style="font-size:10px;color:#888;margin-bottom:4px">役職</div><input type="text" id="hmp-position" value="' + Utils.escapeHtml(position) + '" style="' + inputStyle + '"></div></div>';
    
    // 連絡先
    html += '<div style="margin-bottom:16px"><div style="font-size:11px;font-weight:600;color:#d4af37;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(212,175,55,0.2)">連絡先</div>';
    html += '<div style="margin-bottom:12px"><div style="font-size:10px;color:#888;margin-bottom:4px">電話番号</div><input type="tel" id="hmp-phone" value="' + Utils.escapeHtml(phone) + '" style="' + inputStyle + '"></div>';
    html += '<div style="margin-bottom:12px"><div style="font-size:10px;color:#888;margin-bottom:4px">メールアドレス</div><input type="email" id="hmp-email" value="' + Utils.escapeHtml(email) + '" style="' + inputStyle + '"></div>';
    html += '<div style="margin-bottom:12px"><div style="font-size:10px;color:#888;margin-bottom:4px">郵便番号</div><input type="text" id="hmp-postal" placeholder="000-0000" value="' + Utils.escapeHtml(postalCode) + '" style="' + inputStyle + '"></div>';
    html += '<div style="margin-bottom:12px"><div style="font-size:10px;color:#888;margin-bottom:4px">住所</div><input type="text" id="hmp-address" value="' + Utils.escapeHtml(address) + '" style="' + inputStyle + '"></div>';
    html += '<div style="margin-bottom:12px"><div style="font-size:10px;color:#888;margin-bottom:4px">誕生日</div><input type="date" id="hmp-birthday" value="' + birthday + '" style="' + inputStyle + '"></div></div>';
    
    // SNS
    html += '<div style="margin-bottom:16px"><div style="font-size:11px;font-weight:600;color:#d4af37;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(212,175,55,0.2)">SNS・Web</div>';
    html += '<div style="margin-bottom:12px"><div style="font-size:10px;color:#888;margin-bottom:4px">HP</div><input type="url" id="hmp-hp" placeholder="https://..." value="' + Utils.escapeHtml(hp) + '" style="' + inputStyle + '"></div>';
    html += '<div style="margin-bottom:12px"><div style="font-size:10px;color:#888;margin-bottom:4px">Facebook</div><input type="url" id="hmp-facebook" placeholder="https://facebook.com/..." value="' + Utils.escapeHtml(facebook) + '" style="' + inputStyle + '"></div>';
    html += '<div style="margin-bottom:12px"><div style="font-size:10px;color:#888;margin-bottom:4px">Instagram</div><input type="url" id="hmp-instagram" placeholder="https://instagram.com/..." value="' + Utils.escapeHtml(instagram) + '" style="' + inputStyle + '"></div></div>';
    
    // 分類
    html += '<div style="margin-bottom:16px"><div style="font-size:11px;font-weight:600;color:#d4af37;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(212,175,55,0.2)">分類</div>';
    html += '<div style="margin-bottom:12px"><div style="font-size:10px;color:#888;margin-bottom:4px">お付き合い度合い</div><select id="hmp-rel" style="' + inputStyle + '">' + relOpts + '</select></div>';
    html += '<div style="margin-bottom:12px"><div style="font-size:10px;color:#888;margin-bottom:4px">業種</div><select id="hmp-ind" style="' + inputStyle + '">' + indOpts + '</select></div>';
    
    // 紹介者（ルックアップ方式）
    html += '<div style="margin-bottom:12px"><div style="font-size:10px;color:#888;margin-bottom:4px">紹介者</div>';
    html += '<div style="position:relative">';
    html += '<input type="text" id="hmp-referrer-search" placeholder="紹介者名を入力して検索..." value="' + Utils.escapeHtml(referrer) + '" style="' + inputStyle + '">';
    html += '<input type="hidden" id="hmp-referrer-id" value="' + referrerId + '">';
    html += '<input type="hidden" id="hmp-referrer-name" value="' + Utils.escapeHtml(referrer) + '">';
    html += '<button type="button" id="hmp-referrer-clear" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.1);border:none;color:#888;width:20px;height:20px;border-radius:50%;font-size:12px;cursor:pointer;display:' + (referrerId ? 'block' : 'none') + '">×</button>';
    html += '<div id="hmp-referrer-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:#252540;border:1px solid #3a3a5a;border-top:none;border-radius:0 0 4px 4px;max-height:200px;overflow-y:auto;z-index:100"></div>';
    html += '</div></div></div>';
    
    // 個人特性
    html += '<div style="margin-bottom:16px"><div style="font-size:11px;font-weight:600;color:#d4af37;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(212,175,55,0.2)">個人特性</div><div style="display:flex;flex-wrap:wrap;gap:4px">' + persHtml + '</div></div>';
    
    // メモ
    html += '<div style="margin-bottom:16px"><div style="font-size:11px;font-weight:600;color:#d4af37;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(212,175,55,0.2)">メモ</div><textarea id="hmp-notes" placeholder="メモを入力..." style="' + inputStyle + ';min-height:60px;resize:vertical">' + Utils.escapeHtml(notes) + '</textarea></div>';
    
    // 名刺写真
    html += '<div style="margin-bottom:16px"><div style="font-size:11px;font-weight:600;color:#d4af37;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(212,175,55,0.2)">名刺写真</div>';
    html += '<div id="hmp-bc-preview" style="background:#252540;border-radius:6px;padding:12px;text-align:center;margin-bottom:8px"><div style="font-size:11px;color:#666">名刺写真なし</div></div>';
    html += '<button id="hmp-bc-btn" style="width:100%;background:transparent;border:1px dashed #3a3a5a;border-radius:6px;padding:8px;color:#888;font-size:11px;cursor:pointer">+ 名刺写真を追加</button>';
    html += '<input type="file" id="hmp-bc-input" accept="image/*" style="display:none"></div>';
    
    // 削除ボタン
    if (!isNew) {
      html += '<button id="hmp-delete" style="width:100%;background:transparent;border:1px solid #ef4444;color:#ef4444;padding:10px;border-radius:6px;font-size:12px;cursor:pointer;margin-top:20px">このデータを削除</button>';
    }
    html += '</div>';
    
    state.container.innerHTML = html;
    
    // 写真プレビュー
    if (record) {
      var photo = Utils.getFieldValue(record, CONFIG.FIELDS.PHOTO);
      if (photo && photo.length > 0) {
        var fileKey = photo[0].fileKey;
        var cached = Utils.fileCache[fileKey];
        if (cached) {
          var preview = document.getElementById('hmp-photo-preview');
          preview.style.backgroundImage = 'url(' + cached + ')';
          preview.textContent = '';
        } else {
          Utils.getFileUrl(fileKey).then(function(url) {
            if (url) {
              var preview = document.getElementById('hmp-photo-preview');
              if (preview) { preview.style.backgroundImage = 'url(' + url + ')'; preview.textContent = ''; }
            }
          });
        }
      }
      
      // 名刺プレビュー
      var bc = Utils.getFieldValue(record, CONFIG.FIELDS.BUSINESS_CARD);
      if (bc && bc.length > 0) {
        Utils.getFileUrl(bc[0].fileKey).then(function(url) {
          if (url) {
            var bcPreview = document.getElementById('hmp-bc-preview');
            if (bcPreview) {
              bcPreview.innerHTML = '<img src="' + url + '" style="max-width:100%;border-radius:4px">';
            }
          }
        });
      }
    }
    
    // イベント
    document.getElementById('hmp-cancel').addEventListener('click', function() {
      state.photoFile = null;
      state.businessCardFile = null;
      if (state.editRecord) renderDetail(state.editRecord);
      else renderList();
    });
    document.getElementById('hmp-save').addEventListener('click', function() { saveRecord(); });
    document.getElementById('hmp-photo-btn').addEventListener('click', function() { document.getElementById('hmp-photo-input').click(); });
    document.getElementById('hmp-photo-input').addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (file) {
        state.photoFile = file;
        var reader = new FileReader();
        reader.onload = function(ev) {
          var preview = document.getElementById('hmp-photo-preview');
          preview.style.backgroundImage = 'url(' + ev.target.result + ')';
          preview.style.backgroundSize = 'cover';
          preview.textContent = '';
        };
        reader.readAsDataURL(file);
      }
    });
    
    // 名刺写真
    document.getElementById('hmp-bc-btn').addEventListener('click', function() { document.getElementById('hmp-bc-input').click(); });
    document.getElementById('hmp-bc-input').addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (file) {
        state.businessCardFile = file;
        var reader = new FileReader();
        reader.onload = function(ev) {
          var preview = document.getElementById('hmp-bc-preview');
          preview.innerHTML = '<img src="' + ev.target.result + '" style="max-width:100%;border-radius:4px">';
        };
        reader.readAsDataURL(file);
      }
    });
    
    // 重複チェック（新規のみ）
    if (isNew) {
      var nameInput = document.getElementById('hmp-name');
      var warningDiv = document.getElementById('hmp-duplicate-warning');
      var checkTimeout = null;
      nameInput.addEventListener('input', function() {
        if (checkTimeout) clearTimeout(checkTimeout);
        checkTimeout = setTimeout(function() {
          var val = nameInput.value.trim();
          if (val && isDuplicateName(val)) {
            warningDiv.style.display = 'block';
          } else {
            warningDiv.style.display = 'none';
          }
        }, 300);
      });
    }
    
    // 紹介者ルックアップ
    var refSearch = document.getElementById('hmp-referrer-search');
    var refIdInput = document.getElementById('hmp-referrer-id');
    var refNameInput = document.getElementById('hmp-referrer-name');
    var refClearBtn = document.getElementById('hmp-referrer-clear');
    var refDropdown = document.getElementById('hmp-referrer-dropdown');
    var refTimeout = null;
    
    refSearch.addEventListener('input', function() {
      var query = refSearch.value.trim().toLowerCase();
      if (refTimeout) clearTimeout(refTimeout);
      
      refTimeout = setTimeout(function() {
        if (query.length < 2) {
          refDropdown.style.display = 'none';
          return;
        }
        
        var filtered = state.referrerOptions.filter(function(r) {
          return r.name.toLowerCase().indexOf(query) !== -1 || 
                 (r.company && r.company.toLowerCase().indexOf(query) !== -1);
        }).slice(0, 20);
        
        if (filtered.length === 0) {
          refDropdown.innerHTML = '<div style="padding:12px;text-align:center;color:#888;font-size:11px">該当する紹介者が見つかりません</div>';
        } else {
          var html = '';
          for (var i = 0; i < filtered.length; i++) {
            var item = filtered[i];
            html += '<div class="hmp-ref-item" data-id="' + item.id + '" data-name="' + Utils.escapeHtml(item.name) + '" style="padding:10px 12px;border-bottom:1px solid #3a3a5a;cursor:pointer"><div style="font-size:12px;color:#f5f5f5">' + Utils.escapeHtml(item.name) + '</div><div style="font-size:10px;color:#888">' + (item.company ? Utils.escapeHtml(item.company) : '会社名なし') + '</div></div>';
          }
          refDropdown.innerHTML = html;
          
          // 選択イベント
          var items = refDropdown.querySelectorAll('.hmp-ref-item');
          for (var j = 0; j < items.length; j++) {
            (function(item) {
              item.addEventListener('click', function() {
                var id = item.getAttribute('data-id');
                var name = item.getAttribute('data-name');
                refSearch.value = name;
                refIdInput.value = id;
                refNameInput.value = name;
                refDropdown.style.display = 'none';
                refClearBtn.style.display = 'block';
              });
            })(items[j]);
          }
        }
        
        refDropdown.style.display = 'block';
      }, 200);
    });
    
    refSearch.addEventListener('focus', function() {
      if (refSearch.value.length >= 2) {
        refDropdown.style.display = 'block';
      }
    });
    
    refClearBtn.addEventListener('click', function() {
      refSearch.value = '';
      refIdInput.value = '';
      refNameInput.value = '';
      refClearBtn.style.display = 'none';
      refDropdown.style.display = 'none';
    });
    
    // ドロップダウン外クリックで閉じる
    document.addEventListener('click', function(e) {
      if (!refSearch.contains(e.target) && !refDropdown.contains(e.target)) {
        refDropdown.style.display = 'none';
      }
    });
    
    // 削除ボタン
    if (!isNew) {
      document.getElementById('hmp-delete').addEventListener('click', function() { deleteRecord(); });
    }
  }

  // ========== 保存処理 ==========
  function saveRecord() {
    var isNew = !state.editRecord;
    var name = document.getElementById('hmp-name').value.trim();
    if (!name) { alert('名前を入力してください'); return; }
    
    var data = {};
    data[CONFIG.FIELDS.NAME] = { value: name };
    data[CONFIG.FIELDS.KANA_NAME] = { value: document.getElementById('hmp-kana').value };
    data[CONFIG.FIELDS.COMPANY] = { value: document.getElementById('hmp-company').value };
    data[CONFIG.FIELDS.POSITION] = { value: document.getElementById('hmp-position').value };
    data[CONFIG.FIELDS.PHONE] = { value: document.getElementById('hmp-phone').value };
    data[CONFIG.FIELDS.EMAIL] = { value: document.getElementById('hmp-email').value };
    data[CONFIG.FIELDS.POSTAL_CODE] = { value: document.getElementById('hmp-postal').value };
    data[CONFIG.FIELDS.ADDRESS] = { value: document.getElementById('hmp-address').value };
    data[CONFIG.FIELDS.HP] = { value: document.getElementById('hmp-hp').value };
    data[CONFIG.FIELDS.FACEBOOK] = { value: document.getElementById('hmp-facebook').value };
    data[CONFIG.FIELDS.INSTAGRAM] = { value: document.getElementById('hmp-instagram').value };
    data[CONFIG.FIELDS.BIRTHDAY] = { value: document.getElementById('hmp-birthday').value };
    data[CONFIG.FIELDS.RELATIONSHIP] = { value: document.getElementById('hmp-rel').value };
    data[CONFIG.FIELDS.INDUSTRY] = { value: document.getElementById('hmp-ind').value };
    data[CONFIG.FIELDS.NOTES] = { value: document.getElementById('hmp-notes').value };
    
    // 紹介者
    var refId = document.getElementById('hmp-referrer-id').value;
    var refName = document.getElementById('hmp-referrer-name').value || document.getElementById('hmp-referrer-search').value;
    data[CONFIG.FIELDS.REFERRER] = { value: refName };
    data[CONFIG.FIELDS.REFERRER_ID] = { value: refId };
    data[CONFIG.FIELDS.REFERRER_LINK] = { value: refId ? location.origin + '/k/' + CONFIG.APP_ID + '/show#record=' + refId : '' };
    
    // 個人特性
    var persChecks = document.querySelectorAll('input[name="hmp-pers"]:checked');
    var persValues = [];
    for (var i = 0; i < persChecks.length; i++) persValues.push(persChecks[i].value);
    data[CONFIG.FIELDS.PERSONALITY] = { value: persValues };
    
    // ファイルアップロード
    var uploadPromises = [];
    
    // 顔写真
    if (state.photoFile) {
      var photoFormData = new FormData();
      photoFormData.append('__REQUEST_TOKEN__', kintone.getRequestToken());
      photoFormData.append('file', state.photoFile);
      uploadPromises.push(
        fetch('/k/v1/file.json', { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' }, body: photoFormData })
          .then(function(r) { return r.json(); })
          .then(function(resp) { data[CONFIG.FIELDS.PHOTO] = { value: [{ fileKey: resp.fileKey }] }; })
      );
    }
    
    // 名刺写真
    if (state.businessCardFile) {
      var bcFormData = new FormData();
      bcFormData.append('__REQUEST_TOKEN__', kintone.getRequestToken());
      bcFormData.append('file', state.businessCardFile);
      uploadPromises.push(
        fetch('/k/v1/file.json', { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' }, body: bcFormData })
          .then(function(r) { return r.json(); })
          .then(function(resp) { data[CONFIG.FIELDS.BUSINESS_CARD] = { value: [{ fileKey: resp.fileKey }] }; })
      );
    }
    
    Promise.all(uploadPromises).then(function() {
      if (isNew) return kintone.api('/k/v1/record', 'POST', { app: CONFIG.APP_ID, record: data });
      else {
        var id = Utils.getFieldValue(state.editRecord, '$id');
        return kintone.api('/k/v1/record', 'PUT', { app: CONFIG.APP_ID, id: id, record: data });
      }
    }).then(function() {
      state.photoFile = null;
      state.businessCardFile = null;
      return fetchAllRecords();
    }).then(function(records) {
      state.allRecords = records;
      loadReferrerOptions();
      applyFilters();
      renderList();
    }).catch(function(e) {
      console.error('保存エラー:', e);
      alert('保存に失敗しました: ' + (e.message || e));
    });
  }

  // ========== 削除処理 ==========
  function deleteRecord() {
    if (!confirm('本当にこのデータを削除しますか？')) return;
    var id = Utils.getFieldValue(state.editRecord, '$id');
    kintone.api('/k/v1/records', 'DELETE', { app: CONFIG.APP_ID, ids: [id] }).then(function() {
      return fetchAllRecords();
    }).then(function(records) {
      state.allRecords = records;
      loadReferrerOptions();
      applyFilters();
      renderList();
    }).catch(function(e) {
      console.error('削除エラー:', e);
      alert('削除に失敗しました');
    });
  }

  // ========== 初期化 ==========
  function init(el) {
    console.log('🌟 HIKARI v9 initializing...');
    hideKintoneUI();
    state.container = el;
    el.style.cssText = 'display:block;min-height:100vh;background:#1a1a2e;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif;color:#f5f5f5;font-size:14px;line-height:1.5;padding-bottom:20px';
    el.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:50px 16px;gap:12px"><div style="width:32px;height:32px;border:3px solid rgba(212,175,55,0.2);border-top-color:#d4af37;border-radius:50%;animation:spin 1s linear infinite"></div><div style="color:#d4af37;font-size:12px">データを読み込み中...</div></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
    
    Promise.all([loadFormOptions(), fetchAllRecords()]).then(function(results) {
      state.allRecords = results[1];
      loadReferrerOptions();
      state.filteredRecords = state.allRecords.slice();
      console.log('✅ ' + state.allRecords.length + '件のデータを取得');
      renderList();
      console.log('✅ HIKARI v9 initialized');
    }).catch(function(e) {
      console.error('❌ 初期化エラー:', e);
      el.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:50px 16px;gap:12px"><div style="font-size:32px;margin-bottom:12px">⚠️</div><div style="color:#d4af37;font-size:12px">データの取得に失敗しました</div></div>';
    });
  }

  // ========== イベント登録 ==========
  kintone.events.on('mobile.app.record.index.show', function(event) {
    var el = kintone.mobile.app.getHeaderSpaceElement();
    if (!el) return event;
    init(el);
    return event;
  });

  console.log('🌟 HIKARI v9 script loaded');
})();
