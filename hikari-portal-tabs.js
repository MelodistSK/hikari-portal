/**
 * HIKARI Portal - Tabs
 * 各タブのコンテンツ生成関数
 */

(function(HIKARI) {
  'use strict';

  HIKARI.tabs = {};

  // ========================================
  //  🏠 ホームタブ
  // ========================================
  
  HIKARI.tabs.renderHome = () => {
    const healthStats = HIKARI.aggregation.getHealthStats();
    const totalPeople = HIKARI.data.peopleRecords.length;
    const totalWithHealth = healthStats.green + healthStats.yellow + healthStats.red;
    const healthRate = totalWithHealth > 0 ? Math.round((healthStats.green / totalWithHealth) * 100) : 0;
    const relationshipDist = HIKARI.aggregation.getRelationshipDistribution();
    
    const upcomingBirthdays = HIKARI.aggregation.getUpcomingBirthdays(7);
    const needFollowUp = HIKARI.aggregation.getNeedFollowUp(5);
    const recentContacts = HIKARI.aggregation.getRecentContacts(5);
    
    const giveCount = HIKARI.aggregation.getGiveCount();
    const takeCount = HIKARI.aggregation.getTakeCount();
    
    // 今日の日付
    const today = new Date();
    const dateStr = HIKARI.utils.formatDateWithDay(today.toISOString());
    
    return `
      <div class="hikari-home-welcome" style="text-align: center; margin-bottom: 40px;">
        <div style="font-size: 1rem; color: #888; margin-bottom: 10px;">${dateStr}</div>
        <h1 style="font-size: 2.5rem; font-weight: 300; color: #f7e7ce; margin-bottom: 10px;">
          おかえりなさい
        </h1>
        <p style="color: #666; font-size: 1.1rem;">あなたの人脈を光で照らします</p>
      </div>
      
      <!-- KPIセクション -->
      <div class="hikari-grid hikari-grid-4" style="margin-bottom: 40px;">
        <div class="hikari-card hikari-animate-slide-up" style="opacity: 0;">
          <div class="hikari-kpi-large">
            <div class="hikari-kpi-value" data-count="${totalPeople}">0</div>
            <div class="hikari-kpi-label">総人脈数</div>
          </div>
        </div>
        
        <div class="hikari-card hikari-animate-slide-up hikari-animate-delay-1" style="opacity: 0;">
          <div class="hikari-kpi-large">
            <div class="hikari-kpi-value" style="background: linear-gradient(135deg, #4ade80, #22c55e); -webkit-background-clip: text; -webkit-text-fill-color: transparent;" data-count="${healthRate}">0</div>
            <div class="hikari-kpi-label">健全率 %</div>
          </div>
        </div>
        
        <div class="hikari-card hikari-animate-slide-up hikari-animate-delay-2" style="opacity: 0;">
          <div class="hikari-kpi-large">
            <div class="hikari-kpi-value" style="background: linear-gradient(135deg, #ef4444, #dc2626); -webkit-background-clip: text; -webkit-text-fill-color: transparent;" data-count="${healthStats.red}">0</div>
            <div class="hikari-kpi-label">要フォロー</div>
          </div>
        </div>
        
        <div class="hikari-card hikari-animate-slide-up hikari-animate-delay-3" style="opacity: 0;">
          <div class="hikari-kpi-large">
            <div class="hikari-kpi-value" data-count="${upcomingBirthdays.length}">0</div>
            <div class="hikari-kpi-label">今週の誕生日</div>
          </div>
        </div>
      </div>
      
      <!-- メインコンテンツ -->
      <div class="hikari-grid hikari-grid-3">
        <!-- 今週の誕生日 -->
        <div class="hikari-card hikari-animate-slide-up hikari-animate-delay-2" style="opacity: 0;">
          <div class="hikari-card-header">
            <span class="hikari-card-icon">🎂</span>
            <span class="hikari-card-title">今週の誕生日</span>
          </div>
          ${upcomingBirthdays.length > 0 ? `
            <ul class="hikari-list">
              ${upcomingBirthdays.map(item => {
                const recordId = HIKARI.utils.getFieldValue(item.record, '$id');
                return `
                  <li class="hikari-list-item" data-record-id="${recordId}">
                    <div style="
                      width: 45px;
                      height: 45px;
                      background: linear-gradient(135deg, #ff6b9d, #c44569);
                      border-radius: 50%;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      color: #fff;
                      font-weight: 700;
                    ">${HIKARI.utils.getInitial(item.name)}</div>
                    <div style="flex: 1;">
                      <div style="font-weight: 500;">${item.name}</div>
                      <div style="font-size: 0.85rem; color: #888;">
                        ${HIKARI.utils.formatDateShort(item.birthday)}（${item.age}歳）
                      </div>
                    </div>
                    <div style="
                      background: ${item.daysUntil === 0 ? '#ff6b9d' : 'rgba(255, 107, 157, 0.2)'};
                      color: ${item.daysUntil === 0 ? '#fff' : '#ff6b9d'};
                      padding: 5px 12px;
                      border-radius: 15px;
                      font-size: 0.8rem;
                      font-weight: 500;
                    ">${item.daysUntil === 0 ? '🎉 今日！' : item.daysUntil + '日後'}</div>
                  </li>
                `;
              }).join('')}
            </ul>
          ` : `
            <div class="hikari-empty">
              <div class="hikari-empty-icon">🎂</div>
              <div>今週の誕生日はありません</div>
            </div>
          `}
        </div>
        
        <!-- 要フォローリスト -->
        <div class="hikari-card hikari-animate-slide-up hikari-animate-delay-3" style="opacity: 0;">
          <div class="hikari-card-header">
            <span class="hikari-card-icon">⚠️</span>
            <span class="hikari-card-title">要フォロー</span>
          </div>
          ${needFollowUp.length > 0 ? `
            <ul class="hikari-list">
              ${needFollowUp.map(item => {
                const recordId = HIKARI.utils.getFieldValue(item.record, '$id');
                return `
                  <li class="hikari-list-item" data-record-id="${recordId}">
                    <span class="hikari-status ${item.status}"></span>
                    <div style="flex: 1;">
                      <div style="font-weight: 500;">${item.name}</div>
                      <div style="font-size: 0.85rem; color: #666;">${item.company || ''}</div>
                    </div>
                    <div style="color: ${item.status === 'red' ? '#ef4444' : '#fbbf24'}; font-weight: 500;">
                      ${item.daysPassed}日
                    </div>
                  </li>
                `;
              }).join('')}
            </ul>
          ` : `
            <div class="hikari-empty" style="color: #4ade80;">
              <div class="hikari-empty-icon">✨</div>
              <div>全員フォロー済み！</div>
            </div>
          `}
        </div>
        
        <!-- 最近の接点 -->
        <div class="hikari-card hikari-animate-slide-up hikari-animate-delay-4" style="opacity: 0;">
          <div class="hikari-card-header">
            <span class="hikari-card-icon">📞</span>
            <span class="hikari-card-title">最近の接点</span>
          </div>
          ${recentContacts.length > 0 ? `
            <ul class="hikari-list">
              ${recentContacts.map(item => {
                const recordId = HIKARI.utils.getFieldValue(item.record, '$id');
                const icon = {
                  '電話': '📞',
                  'メール・LINE': '✉️',
                  '対面': '🤝',
                  '会食': '🍽️',
                  'イベント': '🎉',
                  'オンラインMTG': '💻',
                }[item.type] || '📌';
                return `
                  <li class="hikari-list-item" data-record-id="${recordId}">
                    <div style="font-size: 1.3rem;">${icon}</div>
                    <div style="flex: 1;">
                      <div style="font-weight: 500;">${item.name}</div>
                      <div style="font-size: 0.85rem; color: #888;">${item.type}</div>
                    </div>
                    <div style="font-size: 0.85rem; color: #666;">
                      ${HIKARI.utils.formatDateShort(item.date)}
                    </div>
                  </li>
                `;
              }).join('')}
            </ul>
          ` : `
            <div class="hikari-empty">
              <div class="hikari-empty-icon">📞</div>
              <div>接点履歴がありません</div>
            </div>
          `}
        </div>
      </div>
      
      <!-- 関係性分布 -->
      <div class="hikari-card hikari-animate-slide-up" style="margin-top: 30px; opacity: 0;">
        <div class="hikari-card-header">
          <span class="hikari-card-icon">📊</span>
          <span class="hikari-card-title">関係性の分布</span>
        </div>
        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
          ${Object.entries(relationshipDist).map(([level, count]) => {
            const percentage = totalPeople > 0 ? Math.round((count / totalPeople) * 100) : 0;
            const color = HIKARI.CONFIG.RELATIONSHIP_COLORS[level];
            const name = HIKARI.CONFIG.RELATIONSHIP_NAMES[level];
            return `
              <div style="flex: 1; min-width: 150px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="color: ${color}; font-weight: 500;">${name}</span>
                  <span style="color: #888;">${count}人 (${percentage}%)</span>
                </div>
                <div class="hikari-progress-bar">
                  <div class="hikari-progress-fill" style="width: ${percentage}%; background: ${color};"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  };

  // ========================================
  //  🎁 ご恩返しタブ
  // ========================================
  
  HIKARI.tabs.renderGratitude = () => {
    const giveCount = HIKARI.aggregation.getGiveCount();
    const takeCount = HIKARI.aggregation.getTakeCount();
    const total = giveCount + takeCount;
    const givePercent = total > 0 ? Math.round((giveCount / total) * 100) : 50;
    const giveRate = takeCount > 0 ? (giveCount / takeCount).toFixed(2) : '∞';
    
    // 紹介履歴（最新10件）
    const referralRecords = HIKARI.data.referralRecords
      .sort((a, b) => {
        const dateA = HIKARI.utils.getFieldValue(a, HIKARI.CONFIG.REFERRAL_FIELDS.DATE) || '';
        const dateB = HIKARI.utils.getFieldValue(b, HIKARI.CONFIG.REFERRAL_FIELDS.DATE) || '';
        return new Date(dateB) - new Date(dateA);
      })
      .slice(0, 10);
    
    // ========== 個人別バランス計算 ==========
    
    // 1. 各紹介者からもらった人数を集計（Take）
    const receivedFrom = {}; // { 紹介者ID: { name, count } }
    for (const record of HIKARI.data.peopleRecords) {
      const referrerId = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.REFERRER_ID);
      const referrerName = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.REFERRER);
      if (referrerId && referrerName) {
        if (!receivedFrom[referrerId]) {
          receivedFrom[referrerId] = { name: referrerName, count: 0 };
        }
        receivedFrom[referrerId].count++;
      }
    }
    
    // 2. 各人にお返しした人数を集計（Give）
    const givenTo = {}; // { 紹介先ID: { name, count } }
    for (const record of HIKARI.data.referralRecords) {
      const toId = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.REFERRAL_FIELDS.TO_ID);
      const toName = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.REFERRAL_FIELDS.TO_NAME);
      if (toId && toName) {
        if (!givenTo[toId]) {
          givenTo[toId] = { name: toName, count: 0 };
        }
        givenTo[toId].count++;
      }
    }
    
    // 3. 個人別バランスを計算
    const personalBalance = [];
    for (const [id, data] of Object.entries(receivedFrom)) {
      const given = givenTo[id]?.count || 0;
      const received = data.count;
      const diff = given - received; // プラス=お返し多い、マイナス=お返し不足
      personalBalance.push({
        id,
        name: data.name,
        received,
        given,
        diff,
      });
    }
    
    // お返しできていない人（diffがマイナスで大きい順）
    const needToReturn = personalBalance
      .filter(p => p.diff < 0)
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 5);
    
    // バランス良好な人（diffが0以上）
    const wellBalanced = personalBalance
      .filter(p => p.diff >= 0)
      .sort((a, b) => b.given - a.given)
      .slice(0, 5);
    
    // ========== バランスメッセージ ==========
    
    let balanceMessage = '';
    let balanceColor = '#d4af37';
    if (giveRate === '∞') {
      balanceMessage = '素晴らしい！たくさん紹介していますね 🌟';
      balanceColor = '#4ade80';
    } else if (parseFloat(giveRate) >= 1) {
      balanceMessage = '良いバランスです！Give精神が素晴らしい ✨';
      balanceColor = '#4ade80';
    } else if (parseFloat(giveRate) >= 0.5) {
      balanceMessage = 'もう少しお返しできるといいですね 💪';
      balanceColor = '#fbbf24';
    } else {
      balanceMessage = '紹介でお返ししていきましょう！ 🎁';
      balanceColor = '#ef4444';
    }
    
    return `
      <div style="text-align: center; margin-bottom: 40px;">
        <h2 style="font-size: 2rem; font-weight: 300; color: #f7e7ce; margin-bottom: 10px;">
          ご恩返しバランス
        </h2>
        <p style="color: #666;">紹介の「Give」と「Take」を可視化します</p>
      </div>
      
      <!-- メインバランス表示 -->
      <div class="hikari-card hikari-animate-slide-up" style="max-width: 800px; margin: 0 auto 40px; opacity: 0;">
        <div class="hikari-balance-bar">
          <div class="hikari-balance-give" style="width: ${Math.max(givePercent, 10)}%;">
            Give ${giveCount}
          </div>
          <div class="hikari-balance-take" style="width: ${Math.max(100 - givePercent, 10)}%;">
            Take ${takeCount}
          </div>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 0.9rem; color: #888;">
          <span>← 紹介した</span>
          <span>紹介された →</span>
        </div>
        
        <div style="text-align: center;">
          <div style="font-size: 3rem; font-weight: 900; color: #d4af37; margin-bottom: 10px;">
            ${giveRate}
          </div>
          <div style="color: #888; margin-bottom: 15px;">Give / Take 比率</div>
          <div style="color: ${balanceColor}; font-size: 1.1rem;">${balanceMessage}</div>
        </div>
      </div>
      
      <!-- Give/Take 詳細 -->
      <div class="hikari-grid hikari-grid-2" style="margin-bottom: 40px;">
        <div class="hikari-card hikari-animate-slide-up hikari-animate-delay-1" style="opacity: 0;">
          <div class="hikari-card-header">
            <span class="hikari-card-icon">🎁</span>
            <span class="hikari-card-title">Give（紹介した）</span>
          </div>
          <div class="hikari-kpi-large">
            <div class="hikari-kpi-value" data-count="${giveCount}">0</div>
            <div class="hikari-kpi-label">人を紹介しました</div>
          </div>
        </div>
        
        <div class="hikari-card hikari-animate-slide-up hikari-animate-delay-2" style="opacity: 0;">
          <div class="hikari-card-header">
            <span class="hikari-card-icon">🙏</span>
            <span class="hikari-card-title">Take（紹介された）</span>
          </div>
          <div class="hikari-kpi-large">
            <div class="hikari-kpi-value" style="background: linear-gradient(135deg, #4a90d9, #2563eb); -webkit-background-clip: text; -webkit-text-fill-color: transparent;" data-count="${takeCount}">0</div>
            <div class="hikari-kpi-label">人を紹介されました</div>
          </div>
        </div>
      </div>
      
      <!-- 個人別バランス -->
      <div class="hikari-grid hikari-grid-2" style="margin-bottom: 40px;">
        <!-- お返しできていない人 -->
        <div class="hikari-card hikari-animate-slide-up hikari-animate-delay-3" style="opacity: 0;">
          <div class="hikari-card-header">
            <span class="hikari-card-icon">🔴</span>
            <span class="hikari-card-title">お返しできていない人</span>
          </div>
          <div style="color: #888; font-size: 0.9rem; margin-bottom: 20px;">
            紹介をいただいた分、まだお返しできていない方
          </div>
          ${needToReturn.length > 0 ? `
            <ul class="hikari-list">
              ${needToReturn.map((item, i) => `
                <li class="hikari-list-item" data-person-id="${item.id}">
                  <div style="
                    width: 40px;
                    height: 40px;
                    background: linear-gradient(135deg, #ef4444, #dc2626);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
                    font-weight: 700;
                  ">${HIKARI.utils.getInitial(item.name)}</div>
                  <div style="flex: 1;">
                    <div style="font-weight: 500;">${item.name}</div>
                    <div style="font-size: 0.85rem; color: #888;">
                      もらった: ${item.received}人 / 返した: ${item.given}人
                    </div>
                  </div>
                  <div style="
                    background: rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                    padding: 8px 15px;
                    border-radius: 20px;
                    font-weight: 700;
                    font-size: 1.1rem;
                  ">${item.diff}</div>
                </li>
              `).join('')}
            </ul>
          ` : `
            <div class="hikari-empty" style="color: #4ade80;">
              <div class="hikari-empty-icon">✨</div>
              <div>全員にお返しできています！</div>
            </div>
          `}
        </div>
        
        <!-- バランス良好な人 -->
        <div class="hikari-card hikari-animate-slide-up hikari-animate-delay-4" style="opacity: 0;">
          <div class="hikari-card-header">
            <span class="hikari-card-icon">✅</span>
            <span class="hikari-card-title">バランス良好</span>
          </div>
          <div style="color: #888; font-size: 0.9rem; margin-bottom: 20px;">
            お返しができている方、または紹介が多い方
          </div>
          ${wellBalanced.length > 0 ? `
            <ul class="hikari-list">
              ${wellBalanced.map((item, i) => `
                <li class="hikari-list-item" data-person-id="${item.id}">
                  <div style="
                    width: 40px;
                    height: 40px;
                    background: linear-gradient(135deg, #4ade80, #22c55e);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #0a0a0a;
                    font-weight: 700;
                  ">${HIKARI.utils.getInitial(item.name)}</div>
                  <div style="flex: 1;">
                    <div style="font-weight: 500;">${item.name}</div>
                    <div style="font-size: 0.85rem; color: #888;">
                      もらった: ${item.received}人 / 返した: ${item.given}人
                    </div>
                  </div>
                  <div style="
                    background: rgba(74, 222, 128, 0.2);
                    color: #4ade80;
                    padding: 8px 15px;
                    border-radius: 20px;
                    font-weight: 700;
                    font-size: 1.1rem;
                  ">${item.diff >= 0 ? '+' : ''}${item.diff}</div>
                </li>
              `).join('')}
            </ul>
          ` : `
            <div class="hikari-empty">
              <div class="hikari-empty-icon">📊</div>
              <div>データがありません</div>
            </div>
          `}
        </div>
      </div>
      
      <!-- 紹介履歴 -->
      <div class="hikari-card hikari-animate-slide-up" style="opacity: 0;">
        <div class="hikari-card-header">
          <span class="hikari-card-icon">📜</span>
          <span class="hikari-card-title">紹介履歴（最新10件）</span>
        </div>
        ${referralRecords.length > 0 ? `
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid rgba(212, 175, 55, 0.3);">
                  <th style="padding: 15px; text-align: left; color: #d4af37;">日付</th>
                  <th style="padding: 15px; text-align: left; color: #d4af37;">紹介した人</th>
                  <th style="padding: 15px; text-align: left; color: #d4af37;">紹介先</th>
                  <th style="padding: 15px; text-align: left; color: #d4af37;">ステータス</th>
                </tr>
              </thead>
              <tbody>
                ${referralRecords.map(record => {
                  const date = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.REFERRAL_FIELDS.DATE);
                  const personName = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.REFERRAL_FIELDS.PERSON_NAME);
                  const toName = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.REFERRAL_FIELDS.TO_NAME);
                  const status = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.REFERRAL_FIELDS.STATUS) || '不明';
                  
                  const statusColor = {
                    '成約': '#4ade80',
                    '進行中': '#fbbf24',
                    '見送り': '#ef4444',
                  }[status] || '#888';
                  
                  return `
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                      <td style="padding: 15px; color: #888;">${HIKARI.utils.formatDateShort(date)}</td>
                      <td style="padding: 15px;">${personName || '-'}</td>
                      <td style="padding: 15px;">${toName || '-'}</td>
                      <td style="padding: 15px;">
                        <span style="
                          background: ${statusColor}22;
                          color: ${statusColor};
                          padding: 5px 12px;
                          border-radius: 15px;
                          font-size: 0.85rem;
                        ">${status}</span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="hikari-empty">
            <div class="hikari-empty-icon">📜</div>
            <div>紹介履歴がありません</div>
            <div style="font-size: 0.9rem; margin-top: 10px;">人脈アプリで紹介を記録しましょう</div>
          </div>
        `}
      </div>
    `;
  };

  // ========================================
  //  🏆 ランキングタブ
  // ========================================
  
  HIKARI.tabs.renderRanking = () => {
    const rankingByCount = HIKARI.aggregation.getRankingByCount(10);
    const rankingByQuality = HIKARI.aggregation.getRankingByQuality(10);
    
    const renderRankingList = (ranking, valueLabel) => {
      if (ranking.length === 0) {
        return `
          <div class="hikari-empty">
            <div class="hikari-empty-icon">🏆</div>
            <div>ランキングデータがありません</div>
          </div>
        `;
      }
      
      return `
        <ul class="hikari-list">
          ${ranking.map((item, i) => {
            const rankClass = i === 0 ? '' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'normal';
            const value = valueLabel === 'count' ? item.count : item.quality;
            const valueUnit = valueLabel === 'count' ? '人' : 'pt';
            
            return `
              <li class="hikari-list-item" data-referrer-id="${item.id}">
                <span class="hikari-rank ${rankClass}">${i + 1}</span>
                <div style="
                  width: 45px;
                  height: 45px;
                  background: linear-gradient(135deg, #d4af37, #b8941f);
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: #0a0a0a;
                  font-weight: 700;
                ">${HIKARI.utils.getInitial(item.name)}</div>
                <div style="flex: 1;">
                  <div style="font-weight: 500;">${item.name}</div>
                  <div style="font-size: 0.85rem; color: #888;">
                    ${item.count}人紹介 / ${item.quality}pt
                  </div>
                </div>
                <div style="
                  font-size: 1.5rem;
                  font-weight: 700;
                  color: #d4af37;
                ">${value}<span style="font-size: 0.9rem; color: #888;">${valueUnit}</span></div>
              </li>
            `;
          }).join('')}
        </ul>
      `;
    };
    
    return `
      <div style="text-align: center; margin-bottom: 40px;">
        <h2 style="font-size: 2rem; font-weight: 300; color: #f7e7ce; margin-bottom: 10px;">
          紹介者ランキング
        </h2>
        <p style="color: #666;">あなたに人脈を繋いでくれた大切な方々</p>
      </div>
      
      <div class="hikari-grid hikari-grid-2">
        <!-- 量ランキング -->
        <div class="hikari-card hikari-animate-slide-up" style="opacity: 0;">
          <div class="hikari-card-header">
            <span class="hikari-card-icon">📊</span>
            <span class="hikari-card-title">紹介人数ランキング</span>
          </div>
          <div style="color: #888; font-size: 0.9rem; margin-bottom: 20px;">
            たくさんの方を紹介してくれた人
          </div>
          ${renderRankingList(rankingByCount, 'count')}
        </div>
        
        <!-- 質ランキング -->
        <div class="hikari-card hikari-animate-slide-up hikari-animate-delay-1" style="opacity: 0;">
          <div class="hikari-card-header">
            <span class="hikari-card-icon">💎</span>
            <span class="hikari-card-title">紹介品質ランキング</span>
          </div>
          <div style="color: #888; font-size: 0.9rem; margin-bottom: 20px;">
            質の高い紹介をしてくれた人（プライム=5pt, パワー=4pt...）
          </div>
          ${renderRankingList(rankingByQuality, 'quality')}
        </div>
      </div>
      
      <!-- 感謝メッセージ -->
      ${rankingByCount.length > 0 ? `
        <div class="hikari-card hikari-animate-slide-up hikari-animate-delay-2" style="margin-top: 30px; text-align: center; opacity: 0;">
          <div style="font-size: 1.5rem; margin-bottom: 15px;">🙏</div>
          <div style="font-size: 1.2rem; color: #f7e7ce; margin-bottom: 10px;">
            ${rankingByCount[0]?.name || ''}さんに最も多くの方を紹介していただきました
          </div>
          <div style="color: #888;">
            感謝の気持ちを忘れずに、いつかお返しをしましょう
          </div>
        </div>
      ` : ''}
    `;
  };

  // ========================================
  //  🔮 人脈マップタブ
  // ========================================
  
  HIKARI.tabs.renderMap = () => {
    const referralAggregation = HIKARI.aggregation.aggregateReferrals();
    
    // 全員を対象にスコア計算
    const scoredRecords = HIKARI.data.peopleRecords.map(record => {
      const id = HIKARI.utils.getFieldValue(record, '$id');
      const name = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.NAME) || '';
      const company = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.COMPANY) || '';
      const relationship = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.RELATIONSHIP);
      const referrerId = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.REFERRER_ID);
      const referralCount = referralAggregation[id]?.count || 0;
      const score = HIKARI.utils.calculateScore(record, referralCount);
      const level = HIKARI.utils.getRelationshipLevel(relationship);
      const color = HIKARI.CONFIG.RELATIONSHIP_COLORS[level] || '#666';
      const contactCount = HIKARI.utils.getFieldValue(record, HIKARI.CONFIG.PEOPLE_FIELDS.CONTACT_COUNT) || 0;
      
      return { id, name, company, score, color, level, referralCount, contactCount, referrerId, record };
    });
    
    // スコア順にソート
    const sortedRecords = scoredRecords.sort((a, b) => b.score - a.score);
    const totalPeople = sortedRecords.length;
    const maxScore = sortedRecords.length > 0 ? Math.max(...sortedRecords.map(r => r.score)) : 1;
    
    // マップサイズ計算（人数に応じて拡大）
    const mapSize = Math.max(2000, Math.ceil(Math.sqrt(totalPeople)) * 250);
    
    // バブル配置を計算（スパイラル配置 - 中心から外側へ）
    const bubbles = sortedRecords.map((item, i) => {
      const minRadius = 20;
      const maxRadius = 60;
      const radius = minRadius + (item.score / maxScore) * (maxRadius - minRadius);
      
      // スパイラル配置（重要な人ほど中心に）
      const angle = i * 0.7;
      const distance = 100 + i * 12;
      const centerX = mapSize / 2;
      const centerY = mapSize / 2;
      
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      
      return {
        ...item,
        radius,
        x,
        y,
      };
    });
    
    // バブルのHTML生成
    const bubblesHtml = bubbles.map(item => `
      <div class="hikari-map-bubble" 
           data-record-id="${item.id}"
           data-name="${item.name}"
           data-company="${item.company}"
           data-referral="${item.referralCount}"
           data-contact="${item.contactCount}"
           style="
             width: ${item.radius * 2}px;
             height: ${item.radius * 2}px;
             left: ${item.x - item.radius}px;
             top: ${item.y - item.radius}px;
             background: ${item.color};
             font-size: ${Math.max(item.radius / 3, 10)}px;
           ">
        ${HIKARI.utils.getInitial(item.name)}
      </div>
    `).join('');
    
    return `
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 style="font-size: 2rem; font-weight: 300; color: #f7e7ce; margin-bottom: 10px;">
          人脈マップ
        </h2>
        <p style="color: #666;">ドラッグで移動、ホイールでズーム（全${totalPeople}人）</p>
      </div>
      
      <!-- 凡例＆コントロール -->
      <div class="hikari-card hikari-animate-slide-up" style="margin-bottom: 20px; opacity: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;">
          <div style="display: flex; gap: 20px; flex-wrap: wrap;">
            ${Object.entries(HIKARI.CONFIG.RELATIONSHIP_NAMES).map(([level, name]) => `
              <div style="display: flex; align-items: center; gap: 6px;">
                <div style="
                  width: 14px;
                  height: 14px;
                  border-radius: 50%;
                  background: ${HIKARI.CONFIG.RELATIONSHIP_COLORS[level]};
                "></div>
                <span style="color: #888; font-size: 0.85rem;">${name}</span>
              </div>
            `).join('')}
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button id="map-zoom-out" class="hikari-map-ctrl-btn" title="縮小">−</button>
            <span id="zoom-level" style="color: #d4af37; font-weight: 500; min-width: 50px; text-align: center;">100%</span>
            <button id="map-zoom-in" class="hikari-map-ctrl-btn" title="拡大">＋</button>
            <button id="map-fit" class="hikari-map-ctrl-btn hikari-map-ctrl-btn-text" title="全体表示">全体</button>
            <button id="map-center" class="hikari-map-ctrl-btn hikari-map-ctrl-btn-text" title="中心に戻る">中心</button>
          </div>
        </div>
      </div>
      
      <!-- マップコンテナ -->
      <div class="hikari-card hikari-animate-slide-up hikari-animate-delay-1" style="opacity: 0; padding: 0; overflow: hidden; position: relative;">
        <div class="hikari-map-viewport" id="map-viewport" data-map-size="${mapSize}">
          <div class="hikari-map-canvas" id="map-canvas" style="width: ${mapSize}px; height: ${mapSize}px;">
            <!-- グリッド背景 -->
            <div class="hikari-map-grid"></div>
            <!-- バブル -->
            ${bubblesHtml}
            <!-- 中心マーカー -->
            <div class="hikari-map-center-marker" style="left: ${mapSize/2}px; top: ${mapSize/2}px;"></div>
          </div>
        </div>
        
        <!-- ミニマップ -->
        <div class="hikari-minimap" id="minimap" data-map-size="${mapSize}">
          <!-- ミニマップ上のバブル点 -->
          ${bubbles.map(item => `
            <div class="hikari-minimap-dot" style="
              left: ${(item.x / mapSize) * 100}%;
              top: ${(item.y / mapSize) * 100}%;
              background: ${item.color};
            "></div>
          `).join('')}
          <div class="hikari-minimap-viewport" id="minimap-viewport"></div>
        </div>
        
        <!-- ツールチップ -->
        <div class="hikari-map-tooltip" id="map-tooltip"></div>
      </div>
      
      <!-- スコア上位リスト -->
      <div class="hikari-card hikari-animate-slide-up hikari-animate-delay-2" style="margin-top: 30px; opacity: 0;">
        <div class="hikari-card-header">
          <span class="hikari-card-icon">⭐</span>
          <span class="hikari-card-title">重要度スコア TOP10</span>
        </div>
        <ul class="hikari-list">
          ${sortedRecords.slice(0, 10).map((item, i) => `
            <li class="hikari-list-item" data-record-id="${item.id}">
              <span class="hikari-rank ${i === 0 ? '' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'normal'}">${i + 1}</span>
              <div style="
                width: 40px;
                height: 40px;
                background: ${item.color};
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #0a0a0a;
                font-weight: 700;
              ">${HIKARI.utils.getInitial(item.name)}</div>
              <div style="flex: 1;">
                <div style="font-weight: 500;">${item.name}</div>
                <div style="font-size: 0.85rem; color: #888;">${item.company}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 1.2rem; font-weight: 700; color: #d4af37;">
                  ${Math.round(item.score)}
                </div>
                <div style="font-size: 0.75rem; color: #666;">スコア</div>
              </div>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  };
  
  // ========================================
  //  マップ初期化（タブ切り替え時に呼び出し）
  // ========================================
  
  HIKARI.initMap = () => {
    const viewport = document.getElementById('map-viewport');
    const canvas = document.getElementById('map-canvas');
    const minimapEl = document.getElementById('minimap');
    const minimapViewport = document.getElementById('minimap-viewport');
    const zoomLevelEl = document.getElementById('zoom-level');
    const tooltip = document.getElementById('map-tooltip');
    
    if (!viewport || !canvas) {
      console.error('Map elements not found');
      return;
    }
    
    // 設定
    const mapSize = parseInt(viewport.dataset.mapSize) || 2000;
    const minScale = 0.15;
    const maxScale = 2.5;
    const zoomStep = 0.08; // 8%ずつズーム（小刻み）
    
    // 状態
    let scale = 0.4;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let scrollStartX = 0;
    let scrollStartY = 0;
    
    // ========== ユーティリティ ==========
    
    // スケールを適用（ビューポート中心を基準）
    const setScale = (newScale, pivotX, pivotY) => {
      // スケールを制限
      newScale = Math.max(minScale, Math.min(maxScale, newScale));
      
      // ピボットポイント（デフォルトはビューポート中心）
      if (pivotX === undefined) pivotX = viewport.clientWidth / 2;
      if (pivotY === undefined) pivotY = viewport.clientHeight / 2;
      
      // ピボットに対応するキャンバス上の座標（スケール前）
      const canvasX = (viewport.scrollLeft + pivotX) / scale;
      const canvasY = (viewport.scrollTop + pivotY) / scale;
      
      // スケール更新
      const oldScale = scale;
      scale = newScale;
      
      // キャンバスサイズ更新
      const scaledWidth = mapSize * scale;
      const scaledHeight = mapSize * scale;
      canvas.style.width = scaledWidth + 'px';
      canvas.style.height = scaledHeight + 'px';
      
      // バブルのサイズと位置を更新
      canvas.querySelectorAll('.hikari-map-bubble').forEach(bubble => {
        const originalLeft = parseFloat(bubble.dataset.originalLeft || bubble.style.left);
        const originalTop = parseFloat(bubble.dataset.originalTop || bubble.style.top);
        const originalWidth = parseFloat(bubble.dataset.originalWidth || bubble.style.width);
        const originalHeight = parseFloat(bubble.dataset.originalHeight || bubble.style.height);
        const originalFontSize = parseFloat(bubble.dataset.originalFontSize || bubble.style.fontSize);
        
        // 初回のみ元の値を保存
        if (!bubble.dataset.originalLeft) {
          bubble.dataset.originalLeft = originalLeft;
          bubble.dataset.originalTop = originalTop;
          bubble.dataset.originalWidth = originalWidth;
          bubble.dataset.originalHeight = originalHeight;
          bubble.dataset.originalFontSize = originalFontSize;
        }
        
        bubble.style.left = (parseFloat(bubble.dataset.originalLeft) * scale) + 'px';
        bubble.style.top = (parseFloat(bubble.dataset.originalTop) * scale) + 'px';
        bubble.style.width = (parseFloat(bubble.dataset.originalWidth) * scale) + 'px';
        bubble.style.height = (parseFloat(bubble.dataset.originalHeight) * scale) + 'px';
        bubble.style.fontSize = (parseFloat(bubble.dataset.originalFontSize) * scale) + 'px';
      });
      
      // 中心マーカー更新
      const centerMarker = canvas.querySelector('.hikari-map-center-marker');
      if (centerMarker) {
        centerMarker.style.left = (mapSize / 2 * scale) + 'px';
        centerMarker.style.top = (mapSize / 2 * scale) + 'px';
      }
      
      // スクロール位置調整（ピボットを維持）
      viewport.scrollLeft = canvasX * scale - pivotX;
      viewport.scrollTop = canvasY * scale - pivotY;
      
      // UI更新
      zoomLevelEl.textContent = Math.round(scale * 100) + '%';
      updateMinimap();
    };
    
    // 中央に移動
    const centerMap = () => {
      const scaledWidth = mapSize * scale;
      const scaledHeight = mapSize * scale;
      viewport.scrollLeft = (scaledWidth - viewport.clientWidth) / 2;
      viewport.scrollTop = (scaledHeight - viewport.clientHeight) / 2;
      updateMinimap();
    };
    
    // 全体表示
    const fitAll = () => {
      const viewportWidth = viewport.clientWidth;
      const viewportHeight = viewport.clientHeight;
      const fitScale = Math.min(viewportWidth / mapSize, viewportHeight / mapSize) * 0.85;
      setScale(fitScale);
      centerMap();
    };
    
    // ミニマップ更新
    const updateMinimap = () => {
      if (!minimapViewport || !minimapEl) return;
      
      // スケール適用後のキャンバスサイズ
      const canvasWidth = mapSize * scale;
      const canvasHeight = mapSize * scale;
      
      // ミニマップのサイズ
      const minimapWidth = minimapEl.clientWidth;
      const minimapHeight = minimapEl.clientHeight;
      
      // キャンバス→ミニマップの縮小率
      const ratioX = minimapWidth / canvasWidth;
      const ratioY = minimapHeight / canvasHeight;
      
      // ビューポートの表示範囲をミニマップ上に反映
      let vpWidth = viewport.clientWidth * ratioX;
      let vpHeight = viewport.clientHeight * ratioY;
      let vpLeft = viewport.scrollLeft * ratioX;
      let vpTop = viewport.scrollTop * ratioY;
      
      // 範囲制限
      vpWidth = Math.min(vpWidth, minimapWidth);
      vpHeight = Math.min(vpHeight, minimapHeight);
      vpLeft = Math.max(0, Math.min(vpLeft, minimapWidth - vpWidth));
      vpTop = Math.max(0, Math.min(vpTop, minimapHeight - vpHeight));
      
      minimapViewport.style.width = vpWidth + 'px';
      minimapViewport.style.height = vpHeight + 'px';
      minimapViewport.style.left = vpLeft + 'px';
      minimapViewport.style.top = vpTop + 'px';
    };
    
    // ========== イベントハンドラ ==========
    
    // ドラッグ開始
    const onDragStart = (e) => {
      // バブル上では開始しない
      if (e.target.classList.contains('hikari-map-bubble')) return;
      
      isDragging = true;
      viewport.classList.add('dragging');
      
      dragStartX = e.clientX || e.touches?.[0]?.clientX || 0;
      dragStartY = e.clientY || e.touches?.[0]?.clientY || 0;
      scrollStartX = viewport.scrollLeft;
      scrollStartY = viewport.scrollTop;
      
      e.preventDefault();
    };
    
    // ドラッグ中
    const onDragMove = (e) => {
      if (!isDragging) return;
      
      const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
      const clientY = e.clientY || e.touches?.[0]?.clientY || 0;
      
      const deltaX = dragStartX - clientX;
      const deltaY = dragStartY - clientY;
      
      viewport.scrollLeft = scrollStartX + deltaX;
      viewport.scrollTop = scrollStartY + deltaY;
      
      updateMinimap();
      e.preventDefault();
    };
    
    // ドラッグ終了
    const onDragEnd = () => {
      isDragging = false;
      viewport.classList.remove('dragging');
    };
    
    // マウスホイール
    const onWheel = (e) => {
      e.preventDefault();
      
      // マウス位置を取得
      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // ズーム方向
      const delta = e.deltaY > 0 ? -zoomStep : zoomStep;
      const newScale = scale * (1 + delta);
      
      setScale(newScale, mouseX, mouseY);
    };
    
    // バブルホバー
    const onBubbleEnter = (e) => {
      const bubble = e.target;
      const name = bubble.dataset.name;
      const company = bubble.dataset.company;
      const referral = bubble.dataset.referral;
      const contact = bubble.dataset.contact;
      
      tooltip.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 5px;">${name}</div>
        <div style="font-size: 0.85rem; color: #888; margin-bottom: 5px;">${company || ''}</div>
        <div style="font-size: 0.8rem;">紹介: ${referral}人 / 接点: ${contact}回</div>
      `;
      
      const rect = bubble.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      
      tooltip.style.left = (rect.left + rect.width / 2 - viewportRect.left) + 'px';
      tooltip.style.top = (rect.top - viewportRect.top - 10) + 'px';
      tooltip.classList.add('visible');
    };
    
    const onBubbleLeave = () => {
      tooltip.classList.remove('visible');
    };
    
    const onBubbleClick = (e) => {
      const recordId = e.target.dataset.recordId;
      if (recordId) {
        HIKARI.openPersonDetail(recordId);
      }
    };
    
    // ========== イベント登録 ==========
    
    // マウス
    viewport.addEventListener('mousedown', onDragStart);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    
    // タッチ
    viewport.addEventListener('touchstart', onDragStart, { passive: false });
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);
    
    // ホイール
    viewport.addEventListener('wheel', onWheel, { passive: false });
    
    // バブル
    canvas.querySelectorAll('.hikari-map-bubble').forEach(bubble => {
      bubble.addEventListener('mouseenter', onBubbleEnter);
      bubble.addEventListener('mouseleave', onBubbleLeave);
      bubble.addEventListener('click', onBubbleClick);
    });
    
    // コントロールボタン
    document.getElementById('map-zoom-in')?.addEventListener('click', () => {
      setScale(scale * (1 + zoomStep * 2));
    });
    document.getElementById('map-zoom-out')?.addEventListener('click', () => {
      setScale(scale * (1 - zoomStep * 2));
    });
    document.getElementById('map-fit')?.addEventListener('click', fitAll);
    document.getElementById('map-center')?.addEventListener('click', centerMap);
    
    // スクロールイベント
    viewport.addEventListener('scroll', updateMinimap);
    
    // ミニマップクリックで移動
    minimapEl?.addEventListener('click', (e) => {
      const rect = minimapEl.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      // ミニマップ上のクリック位置→キャンバス上の位置
      const minimapWidth = minimapEl.clientWidth;
      const minimapHeight = minimapEl.clientHeight;
      const canvasWidth = mapSize * scale;
      const canvasHeight = mapSize * scale;
      
      const targetX = (clickX / minimapWidth) * canvasWidth - viewport.clientWidth / 2;
      const targetY = (clickY / minimapHeight) * canvasHeight - viewport.clientHeight / 2;
      
      viewport.scrollTo({
        left: targetX,
        top: targetY,
        behavior: 'smooth'
      });
    });
    
    // ========== 初期化 ==========
    
    // 初期スケール適用
    setScale(scale);
    
    // 少し待ってから中央に移動
    setTimeout(() => {
      centerMap();
    }, 100);
    
    console.log('✅ Map initialized:', { mapSize, scale });
  };

})(window.HIKARI = window.HIKARI || {});
