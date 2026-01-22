/**
 * HIKARI Mobile People App v6
 * シンプル版 - CSS問題解決
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
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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
      if (!name) return '?';
      return name.charAt(0);
    },
    
    getRelationshipColor: function(relationship) {
      return CONFIG.RELATIONSHIP_COLORS[relationship] || '#6b7280';
    },
    
    getTodayString: function() {
      var d = new Date();
      var m = d.getMonth() + 1;
      var day = d.getDate();
      return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
    },
    
    _fileUrlCache: {},
    getFileUrl: function(fileKey) {
      var self = this;
      return new Promise(function(resolve) {
        if (!fileKey) return resolve(null);
        if (self._fileUrlCache[fileKey]) return resolve(self._fileUrlCache[fileKey]);
        
        fetch('/k/v1/file.json?fileKey=' + fileKey, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        })
        .then(function(r) { return r.blob(); })
        .then(function(blob) {
          var objectUrl = URL.createObjectURL(blob);
          self._fileUrlCache[fileKey] = objectUrl;
          resolve(objectUrl);
        })
        .catch(function() {
          resolve(null);
        });
      });
    }
  };

  var container = null;
  var allRecords = [];
  var filteredRecords = [];
  var currentSearch = '';
  var currentRelationshipFilter = 'all';
  var currentIndustryFilter = 'all';
  
  var industryOptions = [];
  var personalityOptions = [];
  var contactTypeOptions = [];
  var referrerOptions = [];
  
  var currentDetailRecord = null;
  var currentEditRecord = null;
  var photoFile = null;

  function hideKintoneUI() {
    var styleId = 'hmp-hide-kintone';
    if (document.getElementById(styleId)) return;
    
    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = '.gaia-mobile-v2-viewpanel-viewlist,.gaia-mobile-v2-app-index-toolbar,.gaia-mobile-v2-recordlist,.gaia-mobile-v2-viewpanel-recordlist,.ocean-mobile-ui-app-index-toolbar,.ocean-ui-mobile-appindex-toolbar,.gaia-mobile-v2-viewpanel,.gaia-argoui-app-index-toolbar,.gaia-argoui-app-toolbar{display:none!important}';
    document.head.appendChild(style);
  }

  function fetchAllRecords() {
    return new Promise(function(resolve, reject) {
      var records = [];
      var offset = 0;
      var limit = 500;
      
      function fetchBatch() {
        kintone.api('/k/v1/records', 'GET', {
          app: CONFIG.APP_ID,
          query: 'order by ' + CONFIG.FIELDS.KANA_NAME + ' asc limit ' + limit + ' offset ' + offset
        }).then(function(resp) {
          records = records.concat(resp.records);
          if (resp.records.length < limit) {
            resolve(records);
          } else {
            offset += limit;
            fetchBatch();
          }
        }).catch(reject);
      }
      
      fetchBatch();
    });
  }
  
  function loadFormOptions() {
    return kintone.api('/k/v1/app/form/fields', 'GET', {
      app: CONFIG.APP_ID
    }).then(function(formFields) {
      var industryField = formFields.properties[CONFIG.FIELDS.INDUSTRY];
      if (industryField && industryField.options) {
        industryOptions = Object.keys(industryField.options)
          .filter(function(k) { return k !== ''; })
          .sort(function(a, b) {
            return parseInt(industryField.options[a].index) - parseInt(industryField.options[b].index);
          });
      }
      
      var personalityField = formFields.properties[CONFIG.FIELDS.PERSONALITY];
      if (personalityField && personalityField.options) {
        personalityOptions = Object.keys(personalityField.options)
          .filter(function(k) { return k !== ''; })
          .sort(function(a, b) {
            return parseInt(personalityField.options[a].index) - parseInt(personalityField.options[b].index);
          });
      }
      
      var subtableField = formFields.properties[CONFIG.FIELDS.CONTACT_HISTORY];
      if (subtableField && subtableField.fields) {
        var contactTypeField = subtableField.fields[CONFIG.FIELDS.CONTACT_TYPE];
        if (contactTypeField && contactTypeField.options) {
          contactTypeOptions = Object.keys(contactTypeField.options)
            .filter(function(k) { return k !== ''; })
            .sort(function(a, b) {
              return parseInt(contactTypeField.options[a].index) - parseInt(contactTypeField.options[b].index);
            });
        }
      }
    }).catch(function(e) {
      console.error('フォーム設定の取得に失敗:', e);
    });
  }
  
  function loadReferrerOptions() {
    referrerOptions = allRecords.map(function(record) {
      return {
        id: Utils.getFieldValue(record, '$id'),
        name: Utils.getFieldValue(record, CONFIG.FIELDS.NAME),
        company: Utils.getFieldValue(record, CONFIG.FIELDS.COMPANY)
      };
    }).filter(function(r) { return r.name; });
    referrerOptions.sort(function(a, b) { return a.name.localeCompare(b.name, 'ja'); });
  }

  function applyFilters() {
    filteredRecords = allRecords.filter(function(record) {
      if (currentRelationshipFilter !== 'all') {
        var rel = Utils.getFieldValue(record, CONFIG.FIELDS.RELATIONSHIP);
        if (rel !== currentRelationshipFilter) return false;
      }
      
      if (currentIndustryFilter !== 'all') {
        var industry = Utils.getFieldValue(record, CONFIG.FIELDS.INDUSTRY);
        if (industry !== currentIndustryFilter) return false;
      }
      
      if (currentSearch) {
        var name = Utils.getFieldValue(record, CONFIG.FIELDS.NAME).toLowerCase();
        var kana = Utils.getFieldValue(record, CONFIG.FIELDS.KANA_NAME).toLowerCase();
        var company = Utils.getFieldValue(record, CONFIG.FIELDS.COMPANY).toLowerCase();
        var notes = Utils.getFieldValue(record, CONFIG.FIELDS.NOTES).toLowerCase();
        var search = currentSearch.toLowerCase();
        
        if (name.indexOf(search) === -1 && kana.indexOf(search) === -1 && company.indexOf(search) === -1 && notes.indexOf(search) === -1) {
          return false;
        }
      }
      
      return true;
    });
  }

  function getCSS() {
    return '#hmp-app{font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif;background:#1a1a2e;color:#f5f5f5;font-size:14px;line-height:1.5;min-height:100vh;width:100%;box-sizing:border-box;padding-bottom:20px}#hmp-app *{box-sizing:border-box}.hmp-header{background:linear-gradient(135deg,#d4af37 0%,#b8941f 100%);padding:12px;width:100%}.hmp-header-title{color:#1a1a1a;font-size:16px;font-weight:700;text-align:center;margin:0}.hmp-header-row{display:flex;align-items:center;gap:8px;width:100%}.hmp-header-btn{background:rgba(0,0,0,0.15);border:none;color:#1a1a1a;width:32px;height:32px;border-radius:50%;font-size:14px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}.hmp-header-btn-text{background:rgba(0,0,0,0.15);border:none;color:#1a1a1a;padding:6px 12px;border-radius:16px;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0}.hmp-header-spacer{flex:1}.hmp-search-area{padding:10px 12px;background:#1a1a2e}.hmp-search-row{display:flex;gap:8px;width:100%}.hmp-search-input{flex:1;min-width:0;background:#2a2a4a;border:1px solid #3a3a5a;border-radius:6px;padding:8px 10px;font-size:14px;color:#f5f5f5}.hmp-filter-btn{background:#2a2a4a;border:1px solid #3a3a5a;color:#d4af37;padding:8px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0}.hmp-filter-btn.active{background:#d4af37;color:#1a1a1a}.hmp-list-count{padding:6px 12px;font-size:11px;color:#888}.hmp-list-body{padding:0 10px}.hmp-card{background:#252540;border-radius:8px;padding:10px;margin-bottom:6px;display:flex;align-items:center;gap:10px;border-left:3px solid #6b7280;cursor:pointer}.hmp-card-avatar{width:40px;height:40px;min-width:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;background-size:cover;background-position:center;flex-shrink:0}.hmp-card-info{flex:1;min-width:0;overflow:hidden}.hmp-card-name{font-size:13px;font-weight:600;color:#f5f5f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hmp-card-company{font-size:10px;color:#999;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}.hmp-card-meta{display:flex;align-items:center;gap:4px;margin-top:3px;flex-wrap:wrap}.hmp-card-badge{font-size:9px;padding:1px 5px;border-radius:6px;font-weight:600;color:#1a1a1a;display:inline-block}.hmp-card-contact{font-size:9px;color:#888}.hmp-card-arrow{color:#666;font-size:14px;flex-shrink:0}.hmp-empty{text-align:center;padding:30px 16px;color:#888}.hmp-add-card{background:linear-gradient(135deg,#d4af37 0%,#b8941f 100%);border-radius:8px;padding:14px;margin:12px 10px;text-align:center;color:#1a1a1a;font-size:14px;font-weight:600;cursor:pointer}.hmp-filter-body{padding:16px 12px}.hmp-filter-section{margin-bottom:16px}.hmp-filter-label{font-size:12px;color:#d4af37;margin-bottom:6px;font-weight:600}.hmp-filter-select{width:100%;background:#252540;border:1px solid #3a3a5a;border-radius:6px;padding:10px 12px;font-size:14px;color:#f5f5f5}.hmp-filter-actions{display:flex;gap:10px;margin-top:24px}.hmp-btn{flex:1;padding:12px;border-radius:6px;font-size:14px;font-weight:600;text-align:center;cursor:pointer;border:none}.hmp-btn-secondary{background:#252540;border:1px solid #3a3a5a;color:#f5f5f5}.hmp-btn-primary{background:linear-gradient(135deg,#d4af37,#b8941f);color:#1a1a1a}.hmp-detail-body{padding:12px}.hmp-detail-profile{display:flex;align-items:center;gap:12px;margin-bottom:16px}.hmp-detail-avatar{width:56px;height:56px;min-width:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff;background-size:cover;background-position:center;flex-shrink:0}.hmp-detail-info{flex:1;min-width:0}.hmp-detail-name{font-size:16px;font-weight:700;color:#f5f5f5}.hmp-detail-company{font-size:11px;color:#999;margin-top:2px}.hmp-detail-badge{display:inline-block;font-size:10px;padding:2px 8px;border-radius:8px;font-weight:600;color:#1a1a1a;margin-top:4px}.hmp-detail-actions{display:flex;gap:8px;margin-bottom:16px}.hmp-action-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 8px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:600}.hmp-action-btn-phone{background:#22c55e;color:#fff}.hmp-action-btn-email{background:#3b82f6;color:#fff}.hmp-action-btn-disabled{background:#3a3a5a;color:#666;pointer-events:none}.hmp-section{margin-bottom:16px}.hmp-section-title{font-size:12px;font-weight:600;color:#d4af37;margin-bottom:8px}.hmp-info-row{display:flex;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)}.hmp-info-label{font-size:10px;color:#888;width:60px;flex-shrink:0}.hmp-info-value{font-size:12px;color:#f5f5f5;flex:1;word-break:break-all}.hmp-tags{display:flex;flex-wrap:wrap;gap:4px}.hmp-tag{font-size:10px;padding:3px 6px;border-radius:8px;background:rgba(139,92,246,0.2);color:#a78bfa}.hmp-memo-text{font-size:12px;color:#ccc;line-height:1.5;white-space:pre-wrap}.hmp-history-item{background:#252540;border-radius:6px;padding:8px;margin-bottom:6px}.hmp-history-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:2px}.hmp-history-date{font-size:11px;color:#d4af37;font-weight:600}.hmp-history-type{font-size:9px;padding:1px 5px;border-radius:4px;background:rgba(212,175,55,0.15);color:#d4af37}.hmp-history-memo{font-size:11px;color:#ccc;line-height:1.4}.hmp-history-empty{text-align:center;color:#666;padding:12px;font-size:11px}.hmp-add-contact-btn{width:100%;background:transparent;border:1px dashed #3a3a5a;border-radius:6px;padding:10px;color:#d4af37;font-size:12px;cursor:pointer;margin-top:8px;text-align:center}.hmp-contact-form{background:#252540;border-radius:8px;padding:12px;margin-top:8px}.hmp-form-row{display:flex;gap:8px;margin-bottom:10px}.hmp-form-group{flex:1}.hmp-form-label{font-size:10px;color:#d4af37;margin-bottom:4px;display:block}.hmp-form-input,.hmp-form-select,.hmp-form-textarea{width:100%;background:#1a1a2e;border:1px solid #3a3a5a;border-radius:4px;padding:8px;font-size:13px;color:#f5f5f5}.hmp-form-textarea{min-height:50px;resize:vertical}.hmp-form-actions{display:flex;gap:8px}.hmp-edit-body{padding:12px}.hmp-edit-photo{text-align:center;margin-bottom:16px}.hmp-edit-photo-preview{width:60px;height:60px;border-radius:50%;background:#3a3a5a;display:inline-flex;align-items:center;justify-content:center;font-size:24px;color:#666;margin-bottom:6px;background-size:cover;background-position:center;border:2px solid rgba(212,175,55,0.3)}.hmp-edit-photo-btn{display:block;margin:0 auto;background:transparent;border:1px solid rgba(212,175,55,0.5);color:#d4af37;padding:5px 12px;border-radius:12px;font-size:11px;cursor:pointer}.hmp-edit-photo-input{display:none}.hmp-edit-section{margin-bottom:16px}.hmp-edit-section-title{font-size:11px;font-weight:600;color:#d4af37;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(212,175,55,0.2)}.hmp-edit-field{margin-bottom:12px}.hmp-edit-label{font-size:10px;color:#888;margin-bottom:4px;display:block}.hmp-edit-label.required::after{content:" *";color:#ef4444}.hmp-edit-input,.hmp-edit-select,.hmp-edit-textarea{width:100%;background:#252540;border:1px solid #3a3a5a;border-radius:4px;padding:8px 10px;font-size:13px;color:#f5f5f5}.hmp-edit-textarea{min-height:60px;resize:vertical}.hmp-referrer-container{position:relative}.hmp-referrer-dropdown{position:absolute;left:0;right:0;background:#252540;border:1px solid #3a3a5a;border-radius:4px;margin-top:4px;max-height:120px;overflow-y:auto;z-index:100}.hmp-referrer-item{padding:8px 10px;border-bottom:1px solid #3a3a5a;cursor:pointer}.hmp-referrer-name{font-size:12px;color:#f5f5f5}.hmp-referrer-company{font-size:9px;color:#888}.hmp-checkbox-grid{display:flex;flex-wrap:wrap;gap:4px}.hmp-checkbox-item{display:flex;align-items:center;gap:4px;background:#252540;padding:4px 8px;border-radius:4px}.hmp-checkbox-item input{width:14px;height:14px}.hmp-checkbox-item label{font-size:11px;color:#f5f5f5}.hmp-delete-btn{width:100%;background:transparent;border:1px solid #ef4444;color:#ef4444;padding:10px;border-radius:6px;font-size:12px;cursor:pointer;margin-top:20px}.hmp-duplicate-warning{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#ef4444;padding:8px;border-radius:4px;font-size:11px;margin-bottom:12px}.hmp-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:50px 16px;gap:12px}.hmp-loading-spinner{width:32px;height:32px;border:3px solid rgba(212,175,55,0.2);border-top-color:#d4af37;border-radius:50%;animation:hmp-spin 1s linear infinite}@keyframes hmp-spin{to{transform:rotate(360deg)}}.hmp-loading-text{color:#d4af37;font-size:12px}';
  }

  function injectStyles() {
    var styleId = 'hmp-styles';
    var existing = document.getElementById(styleId);
    if (existing) existing.remove();
    
    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = getCSS();
    document.head.appendChild(style);
  }

  function renderListScreen() {
    injectStyles();
    
    var hasFilter = currentRelationshipFilter !== 'all' || currentIndustryFilter !== 'all';
    var html = '<div id="hmp-app">';
    html += '<div class="hmp-header"><div class="hmp-header-title">人脈管理</div></div>';
    html += '<div class="hmp-search-area"><div class="hmp-search-row">';
    html += '<input type="search" class="hmp-search-input" id="hmp-search" placeholder="名前・会社名で検索..." value="' + Utils.escapeHtml(currentSearch) + '">';
    html += '<button class="hmp-filter-btn' + (hasFilter ? ' active' : '') + '" id="hmp-filter-btn">絞込</button>';
    html += '</div></div>';
    html += '<div class="hmp-list-count">' + filteredRecords.length + '件</div>';
    html += '<div class="hmp-list-body">';
    
    if (filteredRecords.length === 0) {
      html += '<div class="hmp-empty"><div style="font-size:32px;margin-bottom:10px;">🔍</div><div>該当する人脈がありません</div></div>';
    } else {
      for (var i = 0; i < filteredRecords.length; i++) {
        var record = filteredRecords[i];
        var id = Utils.getFieldValue(record, '$id');
        var name = Utils.getFieldValue(record, CONFIG.FIELDS.NAME);
        var company = Utils.getFieldValue(record, CONFIG.FIELDS.COMPANY);
        var position = Utils.getFieldValue(record, CONFIG.FIELDS.POSITION);
        var relationship = Utils.getFieldValue(record, CONFIG.FIELDS.RELATIONSHIP);
        var lastContact = Utils.getFieldValue(record, CONFIG.FIELDS.LAST_CONTACT);
        var lastContactType = Utils.getFieldValue(record, CONFIG.FIELDS.LAST_CONTACT_TYPE);
        var photo = Utils.getFieldValue(record, CONFIG.FIELDS.PHOTO);
        var color = Utils.getRelationshipColor(relationship);
        
        if (!lastContact) {
          var history = Utils.getFieldValue(record, CONFIG.FIELDS.CONTACT_HISTORY) || [];
          var valid = history.filter(function(r) { return r.value[CONFIG.FIELDS.CONTACT_DATE] && r.value[CONFIG.FIELDS.CONTACT_DATE].value; });
          if (valid.length > 0) {
            valid.sort(function(a, b) {
              var da = a.value[CONFIG.FIELDS.CONTACT_DATE] ? a.value[CONFIG.FIELDS.CONTACT_DATE].value : '';
              var db = b.value[CONFIG.FIELDS.CONTACT_DATE] ? b.value[CONFIG.FIELDS.CONTACT_DATE].value : '';
              return db.localeCompare(da);
            });
            lastContact = valid[0].value[CONFIG.FIELDS.CONTACT_DATE] ? valid[0].value[CONFIG.FIELDS.CONTACT_DATE].value : '';
            lastContactType = valid[0].value[CONFIG.FIELDS.CONTACT_TYPE] ? valid[0].value[CONFIG.FIELDS.CONTACT_TYPE].value : '';
          }
        }
        
        var hasPhoto = photo && photo.length > 0;
        var fileKey = hasPhoto ? photo[0].fileKey : '';
        var cachedUrl = fileKey ? Utils._fileUrlCache[fileKey] : '';
        var photoStyle = cachedUrl ? 'background-image:url(' + cachedUrl + ');color:transparent;' : '';
        
        var contactText = lastContact 
          ? (lastContactType ? lastContactType + ' ' : '') + Utils.formatDateShort(lastContact)
          : '接点なし';
        
        html += '<div class="hmp-card" data-id="' + id + '" style="border-left-color:' + color + '">';
        html += '<div class="hmp-card-avatar" data-file-key="' + fileKey + '" style="background-color:' + color + ';' + photoStyle + '">' + Utils.getInitial(name) + '</div>';
        html += '<div class="hmp-card-info">';
        html += '<div class="hmp-card-name">' + Utils.escapeHtml(name) + '</div>';
        html += '<div class="hmp-card-company">' + Utils.escapeHtml(company) + (position ? ' / ' + Utils.escapeHtml(position) : '') + '</div>';
        html += '<div class="hmp-card-meta">';
        html += '<span class="hmp-card-badge" style="background-color:' + color + '">' + (relationship || '未設定') + '</span>';
        html += '<span class="hmp-card-contact">' + contactText + '</span>';
        html += '</div></div>';
        html += '<div class="hmp-card-arrow">›</div>';
        html += '</div>';
      }
    }
    
    html += '</div>';
    html += '<div class="hmp-add-card" id="hmp-add-btn">＋ 新しい人脈を追加</div>';
    html += '</div>';
    
    container.innerHTML = html;
    
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
    for (var j = 0; j < cards.length; j++) {
      (function(card) {
        card.addEventListener('click', function() {
          var cid = card.getAttribute('data-id');
          var rec = allRecords.find(function(r) { return Utils.getFieldValue(r, '$id') === cid; });
          if (rec) renderDetailScreen(rec);
        });
      })(cards[j]);
    }
    
    var avatars = container.querySelectorAll('.hmp-card-avatar[data-file-key]');
    for (var k = 0; k < avatars.length; k++) {
      (function(el) {
        var key = el.getAttribute('data-file-key');
        if (key && !Utils._fileUrlCache[key]) {
          Utils.getFileUrl(key).then(function(url) {
            if (url) {
              el.style.backgroundImage = 'url(' + url + ')';
              el.style.color = 'transparent';
            }
          });
        }
      })(avatars[k]);
    }
  }

  function renderFilterScreen() {
    injectStyles();
    
    var relOptions = '<option value="all"' + (currentRelationshipFilter === 'all' ? ' selected' : '') + '>すべて</option>';
    for (var i = 0; i < CONFIG.RELATIONSHIP_ORDER.length; i++) {
      var rel = CONFIG.RELATIONSHIP_ORDER[i];
      relOptions += '<option value="' + rel + '"' + (currentRelationshipFilter === rel ? ' selected' : '') + '>' + rel + '</option>';
    }
    
    var indOptions = '<option value="all"' + (currentIndustryFilter === 'all' ? ' selected' : '') + '>すべて</option>';
    for (var j = 0; j < industryOptions.length; j++) {
      var opt = industryOptions[j];
      indOptions += '<option value="' + opt + '"' + (currentIndustryFilter === opt ? ' selected' : '') + '>' + opt + '</option>';
    }
    
    var html = '<div id="hmp-app">';
    html += '<div class="hmp-header"><div class="hmp-header-row">';
    html += '<button class="hmp-header-btn" id="hmp-back">←</button>';
    html += '<div class="hmp-header-spacer"></div>';
    html += '<div class="hmp-header-title">絞り込み</div>';
    html += '<div class="hmp-header-spacer"></div>';
    html += '<div style="width:32px"></div>';
    html += '</div></div>';
    html += '<div class="hmp-filter-body">';
    html += '<div class="hmp-filter-section"><div class="hmp-filter-label">お付き合い度合い</div>';
    html += '<select class="hmp-filter-select" id="hmp-filter-relationship">' + relOptions + '</select></div>';
    html += '<div class="hmp-filter-section"><div class="hmp-filter-label">業種</div>';
    html += '<select class="hmp-filter-select" id="hmp-filter-industry">' + indOptions + '</select></div>';
    html += '<div class="hmp-filter-actions">';
    html += '<button class="hmp-btn hmp-btn-secondary" id="hmp-filter-clear">クリア</button>';
    html += '<button class="hmp-btn hmp-btn-primary" id="hmp-filter-apply">適用</button>';
    html += '</div></div></div>';
    
    container.innerHTML = html;
    
    document.getElementById('hmp-back').addEventListener('click', function() { renderListScreen(); });
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
  }

  function renderDetailScreen(record, showContactForm) {
    injectStyles();
    currentDetailRecord = record;
    showContactForm = showContactForm || false;
    
    var name = Utils.getFieldValue(record, CONFIG.FIELDS.NAME);
    var company = Utils.getFieldValue(record, CONFIG.FIELDS.COMPANY);
    var position = Utils.getFieldValue(record, CONFIG.FIELDS.POSITION);
    var phone = Utils.getFieldValue(record, CONFIG.FIELDS.PHONE);
    var email = Utils.getFieldValue(record, CONFIG.FIELDS.EMAIL);
    var relationship = Utils.getFieldValue(record, CONFIG.FIELDS.RELATIONSHIP);
    var industry = Utils.getFieldValue(record, CONFIG.FIELDS.INDUSTRY);
    var personality = Utils.getFieldValue(record, CONFIG.FIELDS.PERSONALITY) || [];
    var referrer = Utils.getFieldValue(record, CONFIG.FIELDS.REFERRER);
    var notes = Utils.getFieldValue(record, CONFIG.FIELDS.NOTES);
    var birthday = Utils.getFieldValue(record, CONFIG.FIELDS.BIRTHDAY);
    var photo = Utils.getFieldValue(record, CONFIG.FIELDS.PHOTO);
    var contactHistory = Utils.getFieldValue(record, CONFIG.FIELDS.CONTACT_HISTORY) || [];
    var color = Utils.getRelationshipColor(relationship);
    
    var hasPhoto = photo && photo.length > 0;
    var fileKey = hasPhoto ? photo[0].fileKey : '';
    var cachedUrl = fileKey ? Utils._fileUrlCache[fileKey] : '';
    var photoStyle = cachedUrl ? 'background-image:url(' + cachedUrl + ');color:transparent;' : '';
    
    var validHistory = contactHistory.filter(function(r) { return r.value[CONFIG.FIELDS.CONTACT_DATE] && r.value[CONFIG.FIELDS.CONTACT_DATE].value; })
      .sort(function(a, b) {
        var da = a.value[CONFIG.FIELDS.CONTACT_DATE] ? a.value[CONFIG.FIELDS.CONTACT_DATE].value : '';
        var db = b.value[CONFIG.FIELDS.CONTACT_DATE] ? b.value[CONFIG.FIELDS.CONTACT_DATE].value : '';
        return db.localeCompare(da);
      });
    
    var historyHtml = '';
    if (validHistory.length > 0) {
      for (var i = 0; i < validHistory.length; i++) {
        var h = validHistory[i];
        var date = h.value[CONFIG.FIELDS.CONTACT_DATE] ? h.value[CONFIG.FIELDS.CONTACT_DATE].value : '';
        var type = h.value[CONFIG.FIELDS.CONTACT_TYPE] ? h.value[CONFIG.FIELDS.CONTACT_TYPE].value : '';
        var memo = h.value[CONFIG.FIELDS.CONTACT_MEMO] ? h.value[CONFIG.FIELDS.CONTACT_MEMO].value : '';
        historyHtml += '<div class="hmp-history-item"><div class="hmp-history-top">';
        historyHtml += '<div class="hmp-history-date">' + Utils.formatDate(date) + '</div>';
        if (type) historyHtml += '<div class="hmp-history-type">' + Utils.escapeHtml(type) + '</div>';
        historyHtml += '</div>';
        if (memo) historyHtml += '<div class="hmp-history-memo">' + Utils.escapeHtml(memo) + '</div>';
        historyHtml += '</div>';
      }
    } else {
      historyHtml = '<div class="hmp-history-empty">接点履歴がありません</div>';
    }
    
    var contactTypeOpts = '';
    for (var j = 0; j < contactTypeOptions.length; j++) {
      contactTypeOpts += '<option value="' + contactTypeOptions[j] + '">' + contactTypeOptions[j] + '</option>';
    }
    
    var contactFormHtml = '';
    if (showContactForm) {
      contactFormHtml = '<div class="hmp-contact-form"><div class="hmp-form-row"><div class="hmp-form-group">';
      contactFormHtml += '<label class="hmp-form-label">接点日</label><input type="date" class="hmp-form-input" id="hmp-contact-date" value="' + Utils.getTodayString() + '"></div>';
      contactFormHtml += '<div class="hmp-form-group"><label class="hmp-form-label">種別</label><select class="hmp-form-select" id="hmp-contact-type">' + contactTypeOpts + '</select></div></div>';
      contactFormHtml += '<div class="hmp-form-group"><label class="hmp-form-label">メモ</label><textarea class="hmp-form-textarea" id="hmp-contact-memo" placeholder="接点の内容..."></textarea></div>';
      contactFormHtml += '<div class="hmp-form-actions"><button class="hmp-btn hmp-btn-secondary" id="hmp-contact-cancel">キャンセル</button>';
      contactFormHtml += '<button class="hmp-btn hmp-btn-primary" id="hmp-contact-save">追加</button></div></div>';
    } else {
      contactFormHtml = '<button class="hmp-add-contact-btn" id="hmp-add-contact-btn">+ 接点を追加</button>';
    }
    
    var infoHtml = '';
    if (phone) infoHtml += '<div class="hmp-info-row"><div class="hmp-info-label">電話</div><div class="hmp-info-value">' + Utils.escapeHtml(phone) + '</div></div>';
    if (email) infoHtml += '<div class="hmp-info-row"><div class="hmp-info-label">メール</div><div class="hmp-info-value">' + Utils.escapeHtml(email) + '</div></div>';
    if (birthday) infoHtml += '<div class="hmp-info-row"><div class="hmp-info-label">誕生日</div><div class="hmp-info-value">' + Utils.formatDate(birthday) + '</div></div>';
    if (industry) infoHtml += '<div class="hmp-info-row"><div class="hmp-info-label">業種</div><div class="hmp-info-value">' + Utils.escapeHtml(industry) + '</div></div>';
    if (referrer) infoHtml += '<div class="hmp-info-row"><div class="hmp-info-label">紹介者</div><div class="hmp-info-value">' + Utils.escapeHtml(referrer) + '</div></div>';
    
    var personalityHtml = '';
    if (personality.length > 0) {
      personalityHtml = '<div class="hmp-section"><div class="hmp-section-title">個人特性</div><div class="hmp-tags">';
      for (var k = 0; k < personality.length; k++) {
        personalityHtml += '<span class="hmp-tag">' + Utils.escapeHtml(personality[k]) + '</span>';
      }
      personalityHtml += '</div></div>';
    }
    
    var notesHtml = '';
    if (notes) {
      notesHtml = '<div class="hmp-section"><div class="hmp-section-title">メモ</div><div class="hmp-memo-text">' + Utils.escapeHtml(notes) + '</div></div>';
    }
    
    var html = '<div id="hmp-app"><div class="hmp-header"><div class="hmp-header-row">';
    html += '<button class="hmp-header-btn" id="hmp-back">←</button><div class="hmp-header-spacer"></div>';
    html += '<div class="hmp-header-title">詳細</div><div class="hmp-header-spacer"></div>';
    html += '<button class="hmp-header-btn-text" id="hmp-edit">編集</button></div></div>';
    html += '<div class="hmp-detail-body"><div class="hmp-detail-profile">';
    html += '<div class="hmp-detail-avatar" id="hmp-detail-avatar" data-file-key="' + fileKey + '" style="background-color:' + color + ';' + photoStyle + '">' + Utils.getInitial(name) + '</div>';
    html += '<div class="hmp-detail-info"><div class="hmp-detail-name">' + Utils.escapeHtml(name) + '</div>';
    html += '<div class="hmp-detail-company">' + Utils.escapeHtml(company) + (position ? ' / ' + Utils.escapeHtml(position) : '') + '</div>';
    html += '<div class="hmp-detail-badge" style="background-color:' + color + '">' + (relationship || '未設定') + '</div></div></div>';
    html += '<div class="hmp-detail-actions">';
    html += '<a href="' + (phone ? 'tel:' + phone : 'javascript:void(0)') + '" class="hmp-action-btn ' + (phone ? 'hmp-action-btn-phone' : 'hmp-action-btn-disabled') + '"><span>📞</span><span>電話</span></a>';
    html += '<a href="' + (email ? 'mailto:' + email : 'javascript:void(0)') + '" class="hmp-action-btn ' + (email ? 'hmp-action-btn-email' : 'hmp-action-btn-disabled') + '"><span>✉️</span><span>メール</span></a></div>';
    html += '<div class="hmp-section"><div class="hmp-section-title">基本情報</div>' + infoHtml + '</div>';
    html += personalityHtml + notesHtml;
    html += '<div class="hmp-section"><div class="hmp-section-title">接点履歴</div>' + historyHtml + contactFormHtml + '</div></div></div>';
    
    container.innerHTML = html;
    
    if (fileKey && !cachedUrl) {
      Utils.getFileUrl(fileKey).then(function(url) {
        if (url) {
          var avatar = document.getElementById('hmp-detail-avatar');
          if (avatar) { avatar.style.backgroundImage = 'url(' + url + ')'; avatar.style.color = 'transparent'; }
        }
      });
    }
    
    document.getElementById('hmp-back').addEventListener('click', function() { renderListScreen(); });
    document.getElementById('hmp-edit').addEventListener('click', function() { photoFile = null; renderEditScreen(record); });
    
    var addBtn = document.getElementById('hmp-add-contact-btn');
    if (addBtn) addBtn.addEventListener('click', function() { renderDetailScreen(record, true); });
    var cancelBtn = document.getElementById('hmp-contact-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', function() { renderDetailScreen(record, false); });
    var saveBtn = document.getElementById('hmp-contact-save');
    if (saveBtn) saveBtn.addEventListener('click', function() { saveContact(); });
  }
  
  function saveContact() {
    var id = Utils.getFieldValue(currentDetailRecord, '$id');
    var date = document.getElementById('hmp-contact-date').value;
    var type = document.getElementById('hmp-contact-type').value;
    var memo = document.getElementById('hmp-contact-memo').value;
    if (!date) { alert('接点日を入力してください'); return; }
    
    kintone.api('/k/v1/record', 'GET', { app: CONFIG.APP_ID, id: id }).then(function(resp) {
      var history = resp.record[CONFIG.FIELDS.CONTACT_HISTORY] ? resp.record[CONFIG.FIELDS.CONTACT_HISTORY].value : [];
      var newEntry = { value: {} };
      newEntry.value[CONFIG.FIELDS.CONTACT_DATE] = { value: date };
      newEntry.value[CONFIG.FIELDS.CONTACT_TYPE] = { value: type };
      newEntry.value[CONFIG.FIELDS.CONTACT_MEMO] = { value: memo };
      history.push(newEntry);
      
      var valid = history.filter(function(r) { return r.value[CONFIG.FIELDS.CONTACT_DATE] && r.value[CONFIG.FIELDS.CONTACT_DATE].value; });
      valid.sort(function(a, b) {
        var da = a.value[CONFIG.FIELDS.CONTACT_DATE] ? a.value[CONFIG.FIELDS.CONTACT_DATE].value : '';
        var db = b.value[CONFIG.FIELDS.CONTACT_DATE] ? b.value[CONFIG.FIELDS.CONTACT_DATE].value : '';
        return db.localeCompare(da);
      });
      
      var latestDate = valid[0] && valid[0].value[CONFIG.FIELDS.CONTACT_DATE] ? valid[0].value[CONFIG.FIELDS.CONTACT_DATE].value : '';
      var latestType = valid[0] && valid[0].value[CONFIG.FIELDS.CONTACT_TYPE] ? valid[0].value[CONFIG.FIELDS.CONTACT_TYPE].value : '';
      
      var updateRecord = {};
      updateRecord[CONFIG.FIELDS.CONTACT_HISTORY] = { value: valid };
      updateRecord[CONFIG.FIELDS.LAST_CONTACT] = { value: latestDate };
      updateRecord[CONFIG.FIELDS.LAST_CONTACT_TYPE] = { value: latestType };
      updateRecord[CONFIG.FIELDS.CONTACT_COUNT] = { value: String(valid.length) };
      
      return kintone.api('/k/v1/record', 'PUT', { app: CONFIG.APP_ID, id: id, record: updateRecord });
    }).then(function() {
      return fetchAllRecords();
    }).then(function(records) {
      allRecords = records;
      loadReferrerOptions();
      applyFilters();
      var updated = allRecords.find(function(r) { return Utils.getFieldValue(r, '$id') === id; });
      if (updated) renderDetailScreen(updated, false);
    }).catch(function(e) {
      console.error('接点追加エラー:', e);
      alert('接点の追加に失敗しました');
    });
  }

  function renderEditScreen(record) {
    injectStyles();
    currentEditRecord = record;
    var isNew = !record;
    
    var name = record ? Utils.getFieldValue(record, CONFIG.FIELDS.NAME) : '';
    var kanaName = record ? Utils.getFieldValue(record, CONFIG.FIELDS.KANA_NAME) : '';
    var company = record ? Utils.getFieldValue(record, CONFIG.FIELDS.COMPANY) : '';
    var position = record ? Utils.getFieldValue(record, CONFIG.FIELDS.POSITION) : '';
    var phone = record ? Utils.getFieldValue(record, CONFIG.FIELDS.PHONE) : '';
    var email = record ? Utils.getFieldValue(record, CONFIG.FIELDS.EMAIL) : '';
    var birthday = record ? Utils.getFieldValue(record, CONFIG.FIELDS.BIRTHDAY) : '';
    var relationship = record ? Utils.getFieldValue(record, CONFIG.FIELDS.RELATIONSHIP) : '';
    var industry = record ? Utils.getFieldValue(record, CONFIG.FIELDS.INDUSTRY) : '';
    var personality = record ? Utils.getFieldValue(record, CONFIG.FIELDS.PERSONALITY) || [] : [];
    var referrer = record ? Utils.getFieldValue(record, CONFIG.FIELDS.REFERRER) : '';
    var referrerId = record ? Utils.getFieldValue(record, CONFIG.FIELDS.REFERRER_ID) : '';
    var notes = record ? Utils.getFieldValue(record, CONFIG.FIELDS.NOTES) : '';
    var photo = record ? Utils.getFieldValue(record, CONFIG.FIELDS.PHOTO) : [];
    var color = Utils.getRelationshipColor(relationship);
    
    var hasPhoto = photo && photo.length > 0;
    var fileKey = hasPhoto ? photo[0].fileKey : '';
    var cachedUrl = fileKey ? Utils._fileUrlCache[fileKey] : '';
    var photoStyle = cachedUrl ? 'background-image:url(' + cachedUrl + ');color:transparent;' : '';
    
    var relOpts = '<option value="">選択してください</option>';
    for (var i = 0; i < CONFIG.RELATIONSHIP_ORDER.length; i++) {
      var rel = CONFIG.RELATIONSHIP_ORDER[i];
      relOpts += '<option value="' + rel + '"' + (relationship === rel ? ' selected' : '') + '>' + rel + '</option>';
    }
    
    var indOpts = '<option value="">選択してください</option>';
    for (var j = 0; j < industryOptions.length; j++) {
      var opt = industryOptions[j];
      indOpts += '<option value="' + opt + '"' + (industry === opt ? ' selected' : '') + '>' + opt + '</option>';
    }
    
    var persHtml = '';
    for (var k = 0; k < personalityOptions.length; k++) {
      var popt = personalityOptions[k];
      var checked = personality.indexOf(popt) !== -1 ? ' checked' : '';
      var safeId = popt.replace(/\s/g, '_');
      persHtml += '<div class="hmp-checkbox-item"><input type="checkbox" name="hmp-personality" value="' + popt + '" id="hmp-p-' + safeId + '"' + checked + '><label for="hmp-p-' + safeId + '">' + popt + '</label></div>';
    }
    
    var html = '<div id="hmp-app"><div class="hmp-header"><div class="hmp-header-row">';
    html += '<button class="hmp-header-btn-text" id="hmp-cancel">キャンセル</button><div class="hmp-header-spacer"></div>';
    html += '<div class="hmp-header-title">' + (isNew ? '新規追加' : '編集') + '</div><div class="hmp-header-spacer"></div>';
    html += '<button class="hmp-header-btn-text" id="hmp-save">保存</button></div></div>';
    html += '<div class="hmp-edit-body"><div class="hmp-edit-photo">';
    html += '<div class="hmp-edit-photo-preview" id="hmp-photo-preview" style="background-color:' + color + ';' + photoStyle + '">' + (cachedUrl ? '' : '📷') + '</div>';
    html += '<button class="hmp-edit-photo-btn" id="hmp-photo-btn">写真を変更</button>';
    html += '<input type="file" class="hmp-edit-photo-input" id="hmp-photo-input" accept="image/*"></div>';
    html += '<div id="hmp-duplicate-warning" class="hmp-duplicate-warning" style="display:none;">⚠️ 同姓同名の人脈が既に登録されています</div>';
    html += '<div class="hmp-edit-section"><div class="hmp-edit-section-title">基本情報</div>';
    html += '<div class="hmp-edit-field"><label class="hmp-edit-label required">名前</label><input type="text" class="hmp-edit-input" id="hmp-edit-name" value="' + Utils.escapeHtml(name) + '"></div>';
    html += '<div class="hmp-edit-field"><label class="hmp-edit-label">ふりがな</label><input type="text" class="hmp-edit-input" id="hmp-edit-kana" value="' + Utils.escapeHtml(kanaName) + '"></div>';
    html += '<div class="hmp-edit-field"><label class="hmp-edit-label">会社名</label><input type="text" class="hmp-edit-input" id="hmp-edit-company" value="' + Utils.escapeHtml(company) + '"></div>';
    html += '<div class="hmp-edit-field"><label class="hmp-edit-label">役職</label><input type="text" class="hmp-edit-input" id="hmp-edit-position" value="' + Utils.escapeHtml(position) + '"></div></div>';
    html += '<div class="hmp-edit-section"><div class="hmp-edit-section-title">連絡先</div>';
    html += '<div class="hmp-edit-field"><label class="hmp-edit-label">電話番号</label><input type="tel" class="hmp-edit-input" id="hmp-edit-phone" value="' + Utils.escapeHtml(phone) + '"></div>';
    html += '<div class="hmp-edit-field"><label class="hmp-edit-label">メールアドレス</label><input type="email" class="hmp-edit-input" id="hmp-edit-email" value="' + Utils.escapeHtml(email) + '"></div>';
    html += '<div class="hmp-edit-field"><label class="hmp-edit-label">誕生日</label><input type="date" class="hmp-edit-input" id="hmp-edit-birthday" value="' + birthday + '"></div></div>';
    html += '<div class="hmp-edit-section"><div class="hmp-edit-section-title">分類</div>';
    html += '<div class="hmp-edit-field"><label class="hmp-edit-label">お付き合い度合い</label><select class="hmp-edit-select" id="hmp-edit-relationship">' + relOpts + '</select></div>';
    html += '<div class="hmp-edit-field"><label class="hmp-edit-label">業種</label><select class="hmp-edit-select" id="hmp-edit-industry">' + indOpts + '</select></div>';
    html += '<div class="hmp-edit-field"><label class="hmp-edit-label">紹介者</label><div class="hmp-referrer-container">';
    html += '<input type="text" class="hmp-edit-input" id="hmp-edit-referrer" placeholder="紹介者名を入力..." value="' + Utils.escapeHtml(referrer) + '">';
    html += '<input type="hidden" id="hmp-edit-referrer-id" value="' + referrerId + '">';
    html += '<div class="hmp-referrer-dropdown" id="hmp-referrer-dropdown" style="display:none;"></div></div></div></div>';
    html += '<div class="hmp-edit-section"><div class="hmp-edit-section-title">個人特性</div><div class="hmp-checkbox-grid">' + persHtml + '</div></div>';
    html += '<div class="hmp-edit-section"><div class="hmp-edit-section-title">メモ</div>';
    html += '<textarea class="hmp-edit-textarea" id="hmp-edit-notes" placeholder="メモを入力...">' + Utils.escapeHtml(notes) + '</textarea></div>';
    if (!isNew) html += '<button class="hmp-delete-btn" id="hmp-delete-btn">このデータを削除</button>';
    html += '</div></div>';
    
    container.innerHTML = html;
    
    if (fileKey && !cachedUrl) {
      Utils.getFileUrl(fileKey).then(function(url) {
        if (url) {
          var preview = document.getElementById('hmp-photo-preview');
          if (preview) { preview.style.backgroundImage = 'url(' + url + ')'; preview.style.color = 'transparent'; preview.textContent = ''; }
        }
      });
    }
    
    setupEditEvents(isNew);
  }
  
  function setupEditEvents(isNew) {
    document.getElementById('hmp-cancel').addEventListener('click', function() {
      photoFile = null;
      if (currentEditRecord) renderDetailScreen(currentEditRecord);
      else renderListScreen();
    });
    
    document.getElementById('hmp-save').addEventListener('click', function() { saveRecord(); });
    document.getElementById('hmp-photo-btn').addEventListener('click', function() { document.getElementById('hmp-photo-input').click(); });
    document.getElementById('hmp-photo-input').addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (file) {
        photoFile = file;
        var reader = new FileReader();
        reader.onload = function(ev) {
          var preview = document.getElementById('hmp-photo-preview');
          preview.style.backgroundImage = 'url(' + ev.target.result + ')';
          preview.style.backgroundSize = 'cover';
          preview.style.backgroundPosition = 'center';
          preview.textContent = '';
        };
        reader.readAsDataURL(file);
      }
    });
    
    if (isNew) {
      var timeout = null;
      document.getElementById('hmp-edit-name').addEventListener('input', function(e) {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(function() {
          var n = e.target.value.trim();
          var warning = document.getElementById('hmp-duplicate-warning');
          if (n.length >= 2) {
            var dup = allRecords.some(function(r) { return Utils.getFieldValue(r, CONFIG.FIELDS.NAME) === n; });
            warning.style.display = dup ? 'block' : 'none';
          } else warning.style.display = 'none';
        }, 500);
      });
    }
    
    var refInput = document.getElementById('hmp-edit-referrer');
    var refDropdown = document.getElementById('hmp-referrer-dropdown');
    var refTimeout = null;
    
    refInput.addEventListener('input', function(e) {
      if (refTimeout) clearTimeout(refTimeout);
      refTimeout = setTimeout(function() {
        var query = e.target.value.trim().toLowerCase();
        if (query.length >= 2) {
          var matches = referrerOptions.filter(function(r) {
            return r.name.toLowerCase().indexOf(query) !== -1 || (r.company && r.company.toLowerCase().indexOf(query) !== -1);
          }).slice(0, 8);
          
          if (matches.length > 0) {
            var ddHtml = '';
            for (var i = 0; i < matches.length; i++) {
              var r = matches[i];
              ddHtml += '<div class="hmp-referrer-item" data-id="' + r.id + '" data-name="' + Utils.escapeHtml(r.name) + '">';
              ddHtml += '<div class="hmp-referrer-name">' + Utils.escapeHtml(r.name) + '</div>';
              ddHtml += '<div class="hmp-referrer-company">' + Utils.escapeHtml(r.company || '') + '</div></div>';
            }
            refDropdown.innerHTML = ddHtml;
            refDropdown.style.display = 'block';
            
            var items = refDropdown.querySelectorAll('.hmp-referrer-item');
            for (var j = 0; j < items.length; j++) {
              (function(item) {
                item.addEventListener('click', function() {
                  refInput.value = item.getAttribute('data-name');
                  document.getElementById('hmp-edit-referrer-id').value = item.getAttribute('data-id');
                  refDropdown.style.display = 'none';
                });
              })(items[j]);
            }
          } else refDropdown.style.display = 'none';
        } else refDropdown.style.display = 'none';
      }, 300);
    });
    
    refInput.addEventListener('blur', function() { setTimeout(function() { refDropdown.style.display = 'none'; }, 200); });
    
    var deleteBtn = document.getElementById('hmp-delete-btn');
    if (deleteBtn) deleteBtn.addEventListener('click', function() { deleteRecord(); });
  }
  
  function saveRecord() {
    var isNew = !currentEditRecord;
    var name = document.getElementById('hmp-edit-name').value.trim();
    if (!name) { alert('名前を入力してください'); return; }
    
    var data = {};
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
    
    var refId = document.getElementById('hmp-edit-referrer-id').value;
    data[CONFIG.FIELDS.REFERRER_LINK] = { value: refId ? location.origin + '/k/' + CONFIG.APP_ID + '/show#record=' + refId : '' };
    
    var personalityChecks = document.querySelectorAll('input[name="hmp-personality"]:checked');
    var persValues = [];
    for (var i = 0; i < personalityChecks.length; i++) persValues.push(personalityChecks[i].value);
    data[CONFIG.FIELDS.PERSONALITY] = { value: persValues };
    
    var savePromise;
    if (photoFile) {
      var formData = new FormData();
      formData.append('__REQUEST_TOKEN__', kintone.getRequestToken());
      formData.append('file', photoFile);
      savePromise = fetch('/k/v1/file.json', { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' }, body: formData })
        .then(function(r) { return r.json(); })
        .then(function(uploadResp) { data[CONFIG.FIELDS.PHOTO] = { value: [{ fileKey: uploadResp.fileKey }] }; return data; });
    } else {
      savePromise = Promise.resolve(data);
    }
    
    savePromise.then(function(finalData) {
      if (isNew) return kintone.api('/k/v1/record', 'POST', { app: CONFIG.APP_ID, record: finalData });
      else {
        var id = Utils.getFieldValue(currentEditRecord, '$id');
        return kintone.api('/k/v1/record', 'PUT', { app: CONFIG.APP_ID, id: id, record: finalData });
      }
    }).then(function() {
      photoFile = null;
      return fetchAllRecords();
    }).then(function(records) {
      allRecords = records;
      loadReferrerOptions();
      applyFilters();
      renderListScreen();
    }).catch(function(e) {
      console.error('保存エラー:', e);
      alert('保存に失敗しました: ' + (e.message || e));
    });
  }
  
  function deleteRecord() {
    if (!confirm('本当にこのデータを削除しますか？')) return;
    var id = Utils.getFieldValue(currentEditRecord, '$id');
    kintone.api('/k/v1/records', 'DELETE', { app: CONFIG.APP_ID, ids: [id] }).then(function() {
      return fetchAllRecords();
    }).then(function(records) {
      allRecords = records;
      loadReferrerOptions();
      applyFilters();
      renderListScreen();
    }).catch(function(e) {
      console.error('削除エラー:', e);
      alert('削除に失敗しました');
    });
  }

  function init(el) {
    console.log('🌟 HIKARI Mobile People v6 initializing...');
    hideKintoneUI();
    injectStyles();
    container = el;
    container.innerHTML = '<div id="hmp-app"><div class="hmp-loading"><div class="hmp-loading-spinner"></div><div class="hmp-loading-text">データを読み込み中...</div></div></div>';
    
    Promise.all([loadFormOptions(), fetchAllRecords()]).then(function(results) {
      allRecords = results[1];
      loadReferrerOptions();
      filteredRecords = allRecords.slice();
      console.log('✅ ' + allRecords.length + '件のデータを取得');
      renderListScreen();
      console.log('✅ HIKARI Mobile People v6 initialized');
    }).catch(function(error) {
      console.error('❌ 初期化エラー:', error);
      container.innerHTML = '<div id="hmp-app"><div class="hmp-loading"><div style="font-size:32px;margin-bottom:12px;">⚠️</div><div class="hmp-loading-text">データの取得に失敗しました</div></div></div>';
    });
  }

  kintone.events.on('mobile.app.record.index.show', function(event) {
    var el = kintone.mobile.app.getHeaderSpaceElement();
    if (!el) return event;
    init(el);
    return event;
  });

})();
