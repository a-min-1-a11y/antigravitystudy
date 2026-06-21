// ================================================================
// FitMeal – Web / GitHub Pages version
// Data stored in localStorage instead of Electron file system.
// ================================================================

// ─── Web API shim (replaces window.api from Electron preload) ────
const DEFAULT_FOOD_DB_PATH = 'food_db.json';

window.api = {
  loadProfile: async () => {
    return localStorage.getItem('fitmeal_profile') || null;
  },
  saveProfile: async (csv) => {
    localStorage.setItem('fitmeal_profile', csv);
    return true;
  },
  loadFoodDb: async () => {
    const stored = localStorage.getItem('fitmeal_food_db');
    if (stored) return JSON.parse(stored);
    // First run: fetch from bundled food_db.json
    try {
      const res = await fetch(DEFAULT_FOOD_DB_PATH);
      const data = await res.json();
      localStorage.setItem('fitmeal_food_db', JSON.stringify(data));
      return data;
    } catch {
      return [];
    }
  },
  saveFoodDb: async (list) => {
    localStorage.setItem('fitmeal_food_db', JSON.stringify(list));
    return true;
  }
};

// ================================================================
// The rest is identical to renderer.js (no Electron-specific code)
// ================================================================

let userProfile = {
  Gender: 'Female', Age: 21, Height: 163, Weight: 52,
  ActivityLevel: 'Moderately Active', DietGoal: 'Weight Loss', DietType: 'Balanced'
};
let foodDatabase = [];
let currentCategory = '모두';
let currentRecommendation = null;
let filteredAlternatives = [];

const radialCircumference = 408.4;

const el = {
  miniUserName: document.getElementById('mini-user-name'),
  miniUserGoal: document.getElementById('mini-user-goal'),
  btnTabDashboard:       document.getElementById('btn-tab-dashboard'),
  btnTabFoodManager:     document.getElementById('btn-tab-food-manager'),
  btnTabProfileSettings: document.getElementById('btn-tab-profile-settings'),
  tabDashboard:          document.getElementById('tab-dashboard'),
  tabFoodManager:        document.getElementById('tab-food-manager'),
  tabProfileSettings:    document.getElementById('tab-profile-settings'),
  chipTargetCalories: document.getElementById('chip-target-calories'),
  targetCarb:    document.getElementById('target-carb'),
  targetProtein: document.getElementById('target-protein'),
  targetFat:     document.getElementById('target-fat'),
  percentCarb:    document.getElementById('percent-carb'),
  percentProtein: document.getElementById('percent-protein'),
  percentFat:     document.getElementById('percent-fat'),
  categoryBtns:       document.querySelectorAll('.category-btn'),
  btnRecommend:       document.getElementById('btn-recommend'),
  btnReroll:          document.getElementById('btn-reroll'),
  resultEmptyState:   document.getElementById('result-empty-state'),
  resultLoadedState:  document.getElementById('result-loaded-state'),
  resultFoodName:     document.getElementById('result-food-name'),
  resultFoodCategory: document.getElementById('result-food-category'),
  resultFoodCalories: document.getElementById('result-food-calories'),
  resultFoodCarb:     document.getElementById('result-food-carb'),
  resultFoodProtein:  document.getElementById('result-food-protein'),
  resultFoodFat:      document.getElementById('result-food-fat'),
  resultTargetCarb:   document.getElementById('result-target-carb'),
  resultTargetProtein:document.getElementById('result-target-protein'),
  resultTargetFat:    document.getElementById('result-target-fat'),
  resultCalMatchPct:  document.getElementById('result-cal-match-pct'),
  resultCarbMatchPct: document.getElementById('result-carb-match-pct'),
  resultProteinMatchPct: document.getElementById('result-protein-match-pct'),
  resultFatMatchPct:  document.getElementById('result-fat-match-pct'),
  barCarbProgress:    document.getElementById('bar-carb-progress'),
  barProteinProgress: document.getElementById('bar-protein-progress'),
  barFatProgress:     document.getElementById('bar-fat-progress'),
  radialProgress:     document.getElementById('radial-calories-progress'),
  recommendMsg:       document.getElementById('recommendation-message'),
  alternativesPanel:  document.getElementById('alternatives-panel'),
  alternativesContainer: document.getElementById('alternatives-container'),
  btnAddFood:         document.getElementById('btn-add-food-open'),
  foodSearchInput:    document.getElementById('food-search-input'),
  foodFilterCategory: document.getElementById('food-filter-category'),
  foodTableBody:      document.getElementById('food-table-body'),
  totalFoodCount:     document.getElementById('total-food-count'),
  foodModal:          document.getElementById('food-modal'),
  foodForm:           document.getElementById('food-form'),
  foodFormId:         document.getElementById('food-form-id'),
  foodFormName:       document.getElementById('food-form-name'),
  foodFormCategory:   document.getElementById('food-form-category'),
  foodFormCalories:   document.getElementById('food-form-calories'),
  foodFormCarbs:      document.getElementById('food-form-carbs'),
  foodFormProtein:    document.getElementById('food-form-protein'),
  foodFormFat:        document.getElementById('food-form-fat'),
  btnFoodModalClose:  document.getElementById('btn-food-modal-close'),
  btnFoodModalCancel: document.getElementById('btn-food-modal-cancel'),
  modalTitle:         document.getElementById('modal-title'),
  profileForm:   document.getElementById('profile-form'),
  profGender:    document.getElementById('prof-gender'),
  profAge:       document.getElementById('prof-age'),
  profHeight:    document.getElementById('prof-height'),
  profWeight:    document.getElementById('prof-weight'),
  profActivity:  document.getElementById('prof-activity'),
  profGoal:      document.getElementById('prof-goal'),
  profDietType:  document.getElementById('prof-diet-type'),
  calcBmr:           document.getElementById('calc-bmr'),
  calcTdee:          document.getElementById('calc-tdee'),
  calcTargetWeight:  document.getElementById('calc-target-weight'),
  calcDailyCalories: document.getElementById('calc-daily-calories'),
  calcMealCalories:  document.getElementById('calc-meal-calories'),
  calcMealCarb:      document.getElementById('calc-meal-carb'),
  calcMealProtein:   document.getElementById('calc-meal-protein'),
  calcMealFat:       document.getElementById('calc-meal-fat'),
  calcCarbPercent:   document.getElementById('calc-carb-percent'),
  calcProteinPercent:document.getElementById('calc-protein-percent'),
  calcFatPercent:    document.getElementById('calc-fat-percent'),
  splitBarCarb:      document.getElementById('split-bar-carb'),
  splitBarProtein:   document.getElementById('split-bar-protein'),
  splitBarFat:       document.getElementById('split-bar-fat'),
};

function parseProfileCSV(csv) {
  try {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return null;
    const headers = lines[0].split(',');
    const values  = lines[1].split(',');
    const p = {};
    headers.forEach((h, i) => p[h.trim()] = values[i] ? values[i].trim() : '');
    p.Age    = parseInt(p.Age, 10)  || 21;
    p.Height = parseFloat(p.Height) || 163;
    p.Weight = parseFloat(p.Weight) || 52;
    return p;
  } catch { return null; }
}

function stringifyProfileCSV(p) {
  const headers = ['Gender','Age','Height','Weight','ActivityLevel','DietGoal','DietType'];
  return `${headers.join(',')}\n${headers.map(h => p[h]).join(',')}`;
}

function calculateTargets(profile) {
  const { Gender, Age, Height, Weight, ActivityLevel, DietGoal, DietType } = profile;
  let bmr = Gender === 'Male'
    ? 10*Weight + 6.25*Height - 5*Age + 5
    : 10*Weight + 6.25*Height - 5*Age - 161;
  const actFactor = { Sedentary: 1.2, 'Lightly Active': 1.375, 'Moderately Active': 1.55, 'Very Active': 1.725 };
  const tdee = bmr * (actFactor[ActivityLevel] || 1.2);
  let targetWeight = Weight, offset = 0;
  if (DietGoal === 'Weight Loss') { targetWeight = Weight - 3; offset = -400; }
  if (DietGoal === 'Weight Gain') { targetWeight = Weight + 3; offset = +400; }
  const daily = tdee + offset;
  const pct = { Balanced: [50,30,20], 'Low Carb': [20,30,50], 'High Protein': [40,40,20] }[DietType] || [50,30,20];
  const [cP, prP, fP] = pct;
  return {
    bmr: Math.round(bmr), tdee: Math.round(tdee),
    targetWeight: targetWeight.toFixed(1),
    dailyCalories: Math.round(daily),
    mealCalories: Math.round(daily/3),
    mealCarb:    Math.round((daily * cP/100) / 4 / 3),
    mealProtein: Math.round((daily * prP/100) / 4 / 3),
    mealFat:     Math.round((daily * fP/100)  / 9 / 3),
    carbPct: cP, proteinPct: prP, fatPct: fP
  };
}

function updateTargetDisplays() {
  const t = calculateTargets(userProfile);
  el.miniUserName.textContent = `${userProfile.Age}세 ${userProfile.Gender === 'Male' ? '남성' : '여성'} 대학생`;
  const goalLabel = { 'Weight Loss': '3kg 감량 목표', 'Maintain': '체중 유지', 'Weight Gain': '3kg 증량 목표' }[userProfile.DietGoal] || '체중 유지';
  el.miniUserGoal.textContent = `${goalLabel} → ${t.targetWeight}kg`;
  el.chipTargetCalories.textContent = `한 끼 목표: ${t.mealCalories} kcal`;
  el.targetCarb.textContent = t.mealCarb; el.targetProtein.textContent = t.mealProtein; el.targetFat.textContent = t.mealFat;
  el.percentCarb.textContent = t.carbPct; el.percentProtein.textContent = t.proteinPct; el.percentFat.textContent = t.fatPct;
  el.calcBmr.textContent = `${t.bmr} kcal`; el.calcTdee.textContent = `${t.tdee} kcal`;
  el.calcTargetWeight.textContent = `${t.targetWeight} kg`;
  el.calcDailyCalories.textContent = `${t.dailyCalories} kcal`; el.calcMealCalories.textContent = `${t.mealCalories} kcal`;
  el.calcMealCarb.textContent = `${t.mealCarb}g`; el.calcMealProtein.textContent = `${t.mealProtein}g`; el.calcMealFat.textContent = `${t.mealFat}g`;
  el.calcCarbPercent.textContent = t.carbPct; el.calcProteinPercent.textContent = t.proteinPct; el.calcFatPercent.textContent = t.fatPct;
  el.splitBarCarb.style.width = `${t.carbPct}%`; el.splitBarProtein.style.width = `${t.proteinPct}%`; el.splitBarFat.style.width = `${t.fatPct}%`;
}

function setProfileFormValues() {
  el.profGender.value = userProfile.Gender; el.profAge.value = userProfile.Age;
  el.profHeight.value = userProfile.Height; el.profWeight.value = userProfile.Weight;
  el.profActivity.value = userProfile.ActivityLevel; el.profGoal.value = userProfile.DietGoal;
  el.profDietType.value = userProfile.DietType;
}

async function initApp() {
  const csv = await window.api.loadProfile();
  if (csv) { const p = parseProfileCSV(csv); if (p) userProfile = p; }
  else await window.api.saveProfile(stringifyProfileCSV(userProfile));
  const db = await window.api.loadFoodDb();
  if (db) foodDatabase = db;
  setProfileFormValues(); updateTargetDisplays(); renderFoodTable();
}

function switchTab(tabId) {
  [el.btnTabDashboard, el.btnTabFoodManager, el.btnTabProfileSettings].forEach(b => b.classList.remove('active'));
  [el.tabDashboard, el.tabFoodManager, el.tabProfileSettings].forEach(t => t.classList.remove('active'));
  document.getElementById('btn-' + tabId).classList.add('active');
  document.getElementById(tabId).classList.add('active');
  if (tabId === 'tab-food-manager') renderFoodTable();
  if (tabId === 'tab-profile-settings') setProfileFormValues();
}

el.btnTabDashboard.addEventListener('click', () => switchTab('tab-dashboard'));
el.btnTabFoodManager.addEventListener('click', () => switchTab('tab-food-manager'));
el.btnTabProfileSettings.addEventListener('click', () => switchTab('tab-profile-settings'));

function runRecommendation() {
  const t = calculateTargets(userProfile);
  let pool = currentCategory === '모두' ? foodDatabase : foodDatabase.filter(f => f.category === currentCategory);
  if (!pool.length) { alert('해당 카테고리에 등록된 음식이 없습니다.'); return; }
  const scored = pool.map(f => {
    const cd = Math.abs(f.calories - t.mealCalories) / t.mealCalories;
    const cr = Math.abs(f.carbs   - t.mealCarb)     / Math.max(t.mealCarb, 1);
    const pr = Math.abs(f.protein - t.mealProtein)  / Math.max(t.mealProtein, 1);
    const fr = Math.abs(f.fat     - t.mealFat)      / Math.max(t.mealFat, 1);
    return { ...f, score: cd*0.40+cr*0.20+pr*0.25+fr*0.15, calDiff:cd, carbDiff:cr, protDiff:pr, fatDiff:fr };
  });
  scored.sort((a,b) => a.score - b.score);
  filteredAlternatives = scored.slice(0,5);
  displayRecommendation(filteredAlternatives[0]);
}

function displayRecommendation(food) {
  currentRecommendation = food;
  const t = calculateTargets(userProfile);
  const calMatch  = Math.max(0, Math.min(100, Math.round((1-food.calDiff)*100)));
  const carbMatch = Math.max(0, Math.min(100, Math.round((1-food.carbDiff)*100)));
  const protMatch = Math.max(0, Math.min(100, Math.round((1-food.protDiff)*100)));
  const fatMatch  = Math.max(0, Math.min(100, Math.round((1-food.fatDiff)*100)));
  el.resultFoodName.textContent=food.name; el.resultFoodCategory.textContent=food.category;
  el.resultFoodCalories.textContent=food.calories; el.resultFoodCarb.textContent=food.carbs;
  el.resultFoodProtein.textContent=food.protein; el.resultFoodFat.textContent=food.fat;
  el.resultTargetCarb.textContent=t.mealCarb; el.resultTargetProtein.textContent=t.mealProtein; el.resultTargetFat.textContent=t.mealFat;
  el.resultCalMatchPct.textContent=`${calMatch}%`; el.resultCarbMatchPct.textContent=`${carbMatch}%`;
  el.resultProteinMatchPct.textContent=`${protMatch}%`; el.resultFatMatchPct.textContent=`${fatMatch}%`;
  el.barCarbProgress.style.width=`${carbMatch}%`; el.barProteinProgress.style.width=`${protMatch}%`; el.barFatProgress.style.width=`${fatMatch}%`;
  el.radialProgress.style.strokeDashoffset = radialCircumference - (calMatch/100)*radialCircumference;
  let msg = calMatch >= 95 ? '한 끼 목표 칼로리에 거의 완벽하게 부합합니다! '
    : food.calories > t.mealCalories ? '칼로리가 목표보다 약간 높아요. 활동량을 늘려보세요. '
    : '목표보다 칼로리가 낮아 가벼운 편입니다. ';
  if (food.protein >= t.mealProtein*1.1) msg += '단백질이 풍부하여 근성장에 도움이 됩니다.';
  else if (food.carbs <= t.mealCarb*0.7) msg += '탄수화물이 낮아 혈당 관리에 유리합니다.';
  el.recommendMsg.textContent = msg;
  renderAlternativeCards(filteredAlternatives.filter(f => f.id !== food.id).slice(0,3));
  el.resultEmptyState.classList.add('hidden'); el.resultLoadedState.classList.remove('hidden'); el.alternativesPanel.classList.remove('hidden');
}

function renderAlternativeCards(list) {
  el.alternativesContainer.innerHTML = '';
  list.forEach(f => {
    const card = document.createElement('div'); card.className = 'alt-card';
    card.innerHTML = `<div class="alt-header"><span class="alt-tag">${f.category}</span><span class="alt-kcal">${f.calories} kcal</span></div>
      <h3 class="alt-name">${f.name}</h3>
      <div class="alt-nutr-info"><span>탄 <span class="alt-c">${f.carbs}g</span></span><span>단 <span class="alt-p">${f.protein}g</span></span><span>지 <span class="alt-f">${f.fat}g</span></span></div>`;
    card.addEventListener('click', () => displayRecommendation(f));
    el.alternativesContainer.appendChild(card);
  });
}

el.categoryBtns.forEach(btn => btn.addEventListener('click', e => {
  el.categoryBtns.forEach(b => b.classList.remove('active'));
  const clicked = e.target.closest('.category-btn'); clicked.classList.add('active');
  currentCategory = clicked.getAttribute('data-category');
}));
el.btnRecommend.addEventListener('click', runRecommendation);
el.btnReroll.addEventListener('click', () => {
  const pool = filteredAlternatives.filter(f => currentRecommendation && f.id !== currentRecommendation.id);
  if (pool.length) displayRecommendation(pool[Math.floor(Math.random()*pool.length)]);
});

el.profileForm.addEventListener('submit', async e => {
  e.preventDefault();
  userProfile = {
    Gender: el.profGender.value, Age: parseInt(el.profAge.value,10),
    Height: parseFloat(el.profHeight.value), Weight: parseFloat(el.profWeight.value),
    ActivityLevel: el.profActivity.value, DietGoal: el.profGoal.value, DietType: el.profDietType.value
  };
  await window.api.saveProfile(stringifyProfileCSV(userProfile));
  updateTargetDisplays();
  alert('프로필이 저장되었습니다. (브라우저 localStorage 사용)');
});

[el.profGender,el.profAge,el.profHeight,el.profWeight,el.profActivity,el.profGoal,el.profDietType]
  .forEach(inp => inp.addEventListener('input', () => {
    const tmp = { Gender:el.profGender.value, Age:parseInt(el.profAge.value)||0, Height:parseFloat(el.profHeight.value)||0,
      Weight:parseFloat(el.profWeight.value)||0, ActivityLevel:el.profActivity.value, DietGoal:el.profGoal.value, DietType:el.profDietType.value };
    if (tmp.Age && tmp.Height && tmp.Weight) { userProfile=tmp; updateTargetDisplays(); }
  }));

function renderFoodTable() {
  const q = el.foodSearchInput.value.toLowerCase().trim();
  const cat = el.foodFilterCategory.value;
  const filtered = foodDatabase.filter(f =>
    (f.name.toLowerCase().includes(q)||f.category.toLowerCase().includes(q)) && (cat==='모두'||f.category===cat)
  );
  el.foodTableBody.innerHTML = '';
  if (!filtered.length) {
    el.foodTableBody.innerHTML=`<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px">검색 결과가 없습니다.</td></tr>`;
    el.totalFoodCount.textContent='조건에 맞는 음식이 없습니다.'; return;
  }
  filtered.forEach(f => {
    const tr = document.createElement('tr');
    tr.innerHTML=`<td><strong>${f.name}</strong></td><td><span class="food-category-tag">${f.category}</span></td>
      <td>${f.calories}</td><td>${f.carbs}g</td><td>${f.protein}g</td><td>${f.fat}g</td>
      <td class="actions-col">
        <button class="btn-icon-action btn-edit" onclick="openEditFoodModal(${f.id})" title="수정">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="16 3 21 8 8 21 3 21 3 16 16 3"/></svg>
        </button>
        <button class="btn-icon-action btn-delete" onclick="deleteFoodItem(${f.id})" title="삭제">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </td>`;
    el.foodTableBody.appendChild(tr);
  });
  el.totalFoodCount.textContent=`총 ${foodDatabase.length}개 중 ${filtered.length}개 표시`;
}

el.foodSearchInput.addEventListener('input', renderFoodTable);
el.foodFilterCategory.addEventListener('change', renderFoodTable);

function openAddFoodModal() { el.modalTitle.textContent='새 음식 추가'; el.foodFormId.value=''; el.foodForm.reset(); el.foodModal.classList.add('active'); }
window.openEditFoodModal = id => {
  const f=foodDatabase.find(x=>x.id===id); if(!f) return;
  el.modalTitle.textContent='음식 정보 수정'; el.foodFormId.value=f.id; el.foodFormName.value=f.name;
  el.foodFormCategory.value=f.category; el.foodFormCalories.value=f.calories; el.foodFormCarbs.value=f.carbs;
  el.foodFormProtein.value=f.protein; el.foodFormFat.value=f.fat; el.foodModal.classList.add('active');
};
function closeModal() { el.foodModal.classList.remove('active'); }
el.btnAddFood.addEventListener('click', openAddFoodModal);
el.btnFoodModalClose.addEventListener('click', closeModal);
el.btnFoodModalCancel.addEventListener('click', closeModal);

window.deleteFoodItem = async id => {
  const f=foodDatabase.find(x=>x.id===id);
  if(!f||!confirm(`'${f.name}' 음식을 삭제하시겠습니까?`)) return;
  foodDatabase=foodDatabase.filter(x=>x.id!==id);
  await window.api.saveFoodDb(foodDatabase); renderFoodTable();
};

el.foodForm.addEventListener('submit', async e => {
  e.preventDefault();
  const idVal=el.foodFormId.value, name=el.foodFormName.value.trim(), category=el.foodFormCategory.value;
  const calories=parseInt(el.foodFormCalories.value,10), carbs=parseInt(el.foodFormCarbs.value,10);
  const protein=parseInt(el.foodFormProtein.value,10), fat=parseInt(el.foodFormFat.value,10);
  if (idVal) { const i=foodDatabase.findIndex(x=>x.id===parseInt(idVal)); if(i!==-1) foodDatabase[i]={id:parseInt(idVal),name,category,calories,carbs,protein,fat}; }
  else { const maxId=foodDatabase.reduce((m,x)=>x.id>m?x.id:m,0); foodDatabase.push({id:maxId+1,name,category,calories,carbs,protein,fat}); }
  await window.api.saveFoodDb(foodDatabase); closeModal(); renderFoodTable();
  alert('음식 정보가 저장되었습니다.');
});

initApp();
