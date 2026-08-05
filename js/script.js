"use strict";

const recipes = Array.isArray(window.CCD_RECIPES) ? window.CCD_RECIPES : [];
const groupOrder = Array.isArray(window.CCD_GROUP_ORDER) ? window.CCD_GROUP_ORDER : [];
const groupMeta = window.CCD_GROUP_META || {};

const STORAGE_KEY = "berryVibesLiveCookbookV2";
const DEFAULT_STATE = {
  xp: 0,
  streak: 1,
  hearts: 5,
  dailyXp: 0,
  savedRecipes: [],
  cookedRecipes: [],
  currentView: "home",
  profile: {
    name: "Berry Chef",
    icon: "🍓",
    photo: "",
    theme: "berry",
    accent: "#ed5f89"
  }
};

const avatarChoices = ["🍓","🧁","🥞","🍫","☕","🌸","🎨","⭐","🦋","🍒","🧋","🍪"];
const themeChoices = [
  ["berry","Berry Blush","linear-gradient(135deg,#fff1f7,#ffe1ec,#fff9dc)","#ed5f89"],
  ["duo","Lime Quest","linear-gradient(135deg,#f7fff1,#d7ffb8,#e9f8ff)","#58cc02"],
  ["lavender","Lavender League","linear-gradient(135deg,#f7f4ff,#ded4ff,#fff5fb)","#7c5ce7"],
  ["sunshine","Golden Streak","linear-gradient(135deg,#fffdf0,#ffe69a,#fff7df)","#f2a900"],
  ["ocean","Ocean Lesson","linear-gradient(135deg,#effaff,#bfeaff,#eafffb)","#168de2"],
  ["coral","Coral Combo","linear-gradient(135deg,#fff4f0,#ffd2c9,#fff0da)","#ff6b5f"],
  ["mint","Mint Garden","linear-gradient(135deg,#f1fff8,#bff0dd,#ebf9ff)","#24b884"],
  ["blueberry","Blueberry Mist","linear-gradient(135deg,#f1f4ff,#ccd5ff,#f2edff)","#4b66e8"],
  ["peach","Peach Pop","linear-gradient(135deg,#fff5ee,#ffd8c3,#ffeef4)","#f28a54"],
  ["mocha","Mocha Studio","linear-gradient(135deg,#fbf5f0,#ead1c3,#fff7e8)","#a96a54"]
];
const accentChoices = ["#ed5f89","#ff719d","#9b5de5","#58cc02","#1cb0f6","#f2a900","#ff7a3d","#24b884","#4b66e8","#9b6b52"];
const lanePattern = ["lane-left","lane-center","lane-right","lane-center"];

let state = loadState();
let activeRecipeFilter = "all";
let recipeSearchQuery = "";
let currentRecipeId = null;
let battleRecipeId = null;
let battleLocked = false;
let spotlightIndex = 0;
let wheelLocked = false;
let toastTimer = null;

function clone(value){ return JSON.parse(JSON.stringify(value)); }

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return clone(DEFAULT_STATE);
    const saved = JSON.parse(raw);
    return {
      ...clone(DEFAULT_STATE),
      ...saved,
      savedRecipes: Array.isArray(saved.savedRecipes) ? saved.savedRecipes : [],
      cookedRecipes: Array.isArray(saved.cookedRecipes) ? saved.cookedRecipes : [],
      profile: {...clone(DEFAULT_STATE.profile), ...(saved.profile || {})}
    };
  }catch(error){
    console.warn("Could not load Berry Vibes progress:", error);
    return clone(DEFAULT_STATE);
  }
}

function saveState(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch(error){ console.warn("Could not save Berry Vibes progress:", error); }
  updateStats();
}

function escapeHtml(value){
  return String(value)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function recipeById(id){ return recipes.find(recipe => recipe.id === id); }
function groupColor(group){ return groupMeta[group]?.color || "#ed5f89"; }
function groupSoft(group){ return groupMeta[group]?.soft || "#fff0f5"; }

function setText(selector,value){
  const element = document.querySelector(selector);
  if(element) element.textContent = String(value);
}

function showToast(message){
  const toast = document.querySelector("#toast");
  if(!toast) return;
  toast.textContent = message;
  toast.classList.add("show-toast");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show-toast"), 2200);
}

function celebrate(){
  const layer = document.querySelector("#confetti-layer");
  if(!layer) return;
  const colors = [state.profile.accent,"#ffd75a","#8bc34a","#a66be8","#ff9d43"];
  for(let i=0;i<34;i+=1){
    const bit = document.createElement("span");
    bit.className = "confetti";
    bit.style.left = `${Math.random()*100}%`;
    bit.style.background = colors[i%colors.length];
    bit.style.setProperty("--drift",`${(Math.random()-.5)*250}px`);
    bit.style.animationDelay = `${Math.random()*.2}s`;
    layer.appendChild(bit);
    setTimeout(() => bit.remove(), 1800);
  }
}

function applyProfileStyle(){
  document.body.dataset.profileTheme = state.profile.theme || "berry";
  document.body.style.setProperty("--custom-accent", state.profile.accent || "#ed5f89");
  document.body.style.setProperty("--theme-accent", state.profile.accent || "#ed5f89");
  const darker = shadeHex(state.profile.accent || "#ed5f89", -34);
  document.body.style.setProperty("--theme-accent-dark", darker);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", state.profile.accent || "#ed5f89");
}

function shadeHex(hex, percent){
  const clean = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "ed5f89";
  const n = parseInt(clean,16);
  const amt = Math.round(2.55*percent);
  const r = Math.max(0,Math.min(255,(n>>16)+amt));
  const g = Math.max(0,Math.min(255,((n>>8)&255)+amt));
  const b = Math.max(0,Math.min(255,(n&255)+amt));
  return `#${(0x1000000+r*0x10000+g*0x100+b).toString(16).slice(1)}`;
}

function renderAvatar(target, large=false){
  if(!target) return;
  target.innerHTML = "";
  if(state.profile.photo){
    const img = document.createElement("img");
    img.src = state.profile.photo;
    img.alt = "";
    target.appendChild(img);
  }else{
    target.textContent = state.profile.icon || "🍓";
  }
  if(large) target.classList.add("large-avatar");
}

function updateStats(){
  const level = Math.max(1, Math.floor(state.xp/250)+1);
  const dailyPercent = Math.min(100, Math.round(state.dailyXp));
  setText("#top-streak",state.streak);
  setText("#top-xp",state.xp);
  setText("#top-hearts",state.hearts);
  setText("#daily-xp",state.dailyXp);
  setText("#daily-percent",`${dailyPercent}%`);
  setText("#saved-count",`${state.savedRecipes.length} saved`);
  setText("#summary-cooked",state.cookedRecipes.length);
  setText("#summary-saved",state.savedRecipes.length);
  setText("#summary-total",recipes.length);
  setText("#profile-streak",state.streak);
  setText("#profile-xp",state.xp);
  setText("#profile-cooked",state.cookedRecipes.length);
  setText("#profile-saved",state.savedRecipes.length);
  setText("#profile-level",level);
  setText("#profile-name-display",state.profile.name);
  setText("#header-profile-name",state.profile.name);
  setText("#path-complete-text",`${state.cookedRecipes.length} / ${recipes.length} complete`);
  const ring = document.querySelector(".progress-ring");
  if(ring) ring.style.background = `radial-gradient(circle at center,#fff 53%,transparent 54%),conic-gradient(var(--theme-accent) 0 ${dailyPercent}%,var(--theme-soft) ${dailyPercent}% 100%)`;
  const pathBar = document.querySelector("#path-progress-bar");
  if(pathBar) pathBar.style.width = `${recipes.length ? (state.cookedRecipes.length/recipes.length)*100 : 0}%`;
  renderAvatar(document.querySelector("#header-avatar"));
  renderAvatar(document.querySelector("#profile-avatar-display"),true);
  updateBadges();
}

function addXp(amount,message){
  state.xp += amount;
  state.dailyXp = Math.min(100,state.dailyXp+amount);
  saveState();
  showToast(`+${amount} XP · ${message}`);
  if(state.dailyXp >= 100) celebrate();
}

function setView(viewName){
  const valid = ["home","path","battle","recipes","profile"];
  const view = valid.includes(viewName) ? viewName : "home";
  document.querySelectorAll("[data-view]").forEach(section => section.classList.toggle("active-view", section.dataset.view === view));
  document.querySelectorAll(".nav-button").forEach(button => button.classList.toggle("active-nav", button.dataset.viewTarget === view));
  state.currentView = view;
  saveState();
  if(view === "path") renderPath();
  if(view === "recipes") renderRecipes();
  if(view === "battle") renderBattle();
  if(view === "profile") renderProfileCustomizer();
  window.scrollTo({top:0,behavior:"smooth"});
}

function recipeTags(recipe){
  const n = recipe.name.toLowerCase();
  const tags=[];
  if(/chocolate|brownie|oreo|mocha/.test(n)) tags.push("chocolatey");
  if(/cinnamon|spice|pumpkin/.test(n)) tags.push("spiced");
  if(/coffee|latte|frapp|mocha/.test(n)) tags.push("café");
  if(/pizza|sandwich|wrap|burrito|quesadilla|chicken|egg/.test(n)) tags.push("savory");
  if(/cream|yogurt|pudding|soft-serve|mousse/.test(n)) tags.push("creamy");
  if(/donut|muffin|cake|cookie|bar|blondie/.test(n)) tags.push("bakery");
  tags.push("cozy");
  return [...new Set(tags)].slice(0,4);
}

function ingredientPreview(recipe){
  const g=recipe.group.toLowerCase(), n=recipe.name.toLowerCase();
  if(g.includes("drink") || /latte|coffee|shake|frapp/.test(n)) return ["Drink or coffee base","Milk or creamy element","Flavoring","Sweetener","Spice or topping"];
  if(g.includes("cold") || /pudding|yogurt|cream|mousse|soft-serve/.test(n)) return ["Creamy base","Flavor mix-in","Sweetener","Texture element","Optional topping"];
  if(g.includes("sandwich")) return ["Bread or toast base","Protein or filling","Cheese or creamy element","Greens or vegetables","Sauce or seasoning"];
  if(g.includes("wrap") || /wrap|burrito|quesadilla/.test(n)) return ["Tortilla or wrap base","Savory filling","Cheese or creamy element","Greens or vegetables","Sauce or seasoning"];
  if(g.includes("savory") || g.includes("pizza")) return ["Savory base","Protein or filling","Cheese or creamy element","Vegetables or herbs","Seasoning"];
  return ["CCD flour or base","Milk or moisture","Sweetener","Flavoring","Binder or texture helper"];
}

function expectation(recipe){
  const n=recipe.name.toLowerCase();
  if(n.includes("pancake")) return "Fluffy centers, warm edges, and a soft breakfast-stack texture with cozy flavor.";
  if(n.includes("cinnamon")) return "Warm cinnamon aroma, soft texture, and a bakery-inspired cozy finish.";
  if(/brownie|chocolate|oreo/.test(n)) return "Rich cocoa flavor with a soft, fudgy, creamy, or dessert-like finish.";
  if(/coffee|latte|mocha/.test(n)) return "Coffee-shop aroma with a smooth sip and a playful flavored finish.";
  if(n.includes("pizza")) return "Crisp edges, melty comfort, and a quick personal-pizza feeling.";
  if(/wrap|burrito|sandwich|quesadilla/.test(n)) return "A structured, portable savory bite with layered textures and a cozy center.";
  return recipe.flavor;
}

function renderPath(){
  const container = document.querySelector("#path-container");
  if(!container) return;
  container.innerHTML = "";
  groupOrder.forEach((group,groupIndex) => {
    const list = recipes.filter(recipe => recipe.group === group);
    if(!list.length) return;
    const cooked = list.filter(recipe => state.cookedRecipes.includes(recipe.id)).length;
    const unit=document.createElement("section");
    unit.className="path-unit";
    unit.style.setProperty("--unit-color", groupMeta[group]?.color || "#ed5f89");
    unit.innerHTML=`<div class="unit-header"><div><span>UNIT ${groupIndex+1}</span><h2>${escapeHtml(group)}</h2><p>${list.length} recipe stops</p></div><div class="unit-count">${cooked}/${list.length}</div></div><div class="unit-nodes"></div>`;
    const nodes=unit.querySelector(".unit-nodes");
    list.forEach((recipe,index) => {
      const row=document.createElement("div");
      row.className=`path-row ${lanePattern[index%lanePattern.length]}`;
      const button=document.createElement("button");
      button.type="button";
      button.className="path-recipe-node";
      if(state.cookedRecipes.includes(recipe.id)) button.classList.add("completed");
      if(state.savedRecipes.includes(recipe.id)) button.classList.add("favorite");
      button.innerHTML=`<span aria-hidden="true">${recipe.emoji}</span><span class="path-node-name">${index+1}. ${escapeHtml(recipe.name)}</span>`;
      button.setAttribute("aria-label",`Open ${recipe.name}`);
      button.addEventListener("click",()=>openRecipe(recipe.id));
      row.appendChild(button); nodes.appendChild(row);
    });
    container.appendChild(unit);
  });
  updateStats();
}

function buildFilters(){
  const row=document.querySelector("#recipe-filters");
  if(!row) return;
  row.innerHTML="";
  const options=[
    ["all","🍓 All"],["favorites","💗 Favorites"],
    ...groupOrder.map(group=>[group,`${recipes.find(r=>r.group===group)?.emoji || "🍓"} ${group}`])
  ];
  options.forEach(([key,label])=>{
    const button=document.createElement("button");
    button.type="button"; button.className="filter-chip";
    if(activeRecipeFilter===key) button.classList.add("active-filter");
    button.textContent=label;
    button.addEventListener("click",()=>{activeRecipeFilter=key;buildFilters();renderRecipes();});
    row.appendChild(button);
  });
}

function renderRecipes(){
  buildFilters();
  const grid=document.querySelector("#recipe-grid");
  if(!grid) return;
  const query=recipeSearchQuery.trim().toLowerCase();
  const filtered=recipes.filter(recipe=>{
    const filterMatch=activeRecipeFilter==="all" || (activeRecipeFilter==="favorites"&&state.savedRecipes.includes(recipe.id)) || recipe.group===activeRecipeFilter;
    const searchMatch=!query || recipe.name.toLowerCase().includes(query) || recipe.group.toLowerCase().includes(query) || recipe.flavor.toLowerCase().includes(query);
    return filterMatch&&searchMatch;
  });
  grid.innerHTML="";
  if(!filtered.length){grid.innerHTML='<div class="empty-state"><div style="font-size:3rem">🍓</div><h3>No cozy recipes found</h3><p>Try another search or filter.</p></div>';return;}
  filtered.forEach(recipe=>{
    const card=document.createElement("article");
    card.className="recipe-card";
    card.style.setProperty("--card-color",groupColor(recipe.group));
    card.style.setProperty("--card-soft",groupSoft(recipe.group));
    const saved=state.savedRecipes.includes(recipe.id), cooked=state.cookedRecipes.includes(recipe.id);
    card.innerHTML=`
      <button type="button" class="favorite-corner ${saved?"saved":""}" aria-label="${saved?"Remove":"Save"} favorite">${saved?"♥":"♡"}</button>
      <div class="recipe-card-top" aria-hidden="true">${recipe.emoji}</div>
      <div class="recipe-card-body">
        <span class="recipe-group">${escapeHtml(recipe.group)}</span>
        <h3>${escapeHtml(recipe.name)}</h3><p>${escapeHtml(recipe.flavor)}</p>
        <div class="recipe-tag-row">${recipeTags(recipe).map(tag=>`<span class="recipe-tag">${escapeHtml(tag)}</span>`).join("")}</div>
        <span class="recipe-state">${cooked?"✓ COOKED":"○ NEW"}</span>
        <button type="button" class="open-recipe">OPEN RECIPE →</button>
        <div class="recipe-actions"><button type="button" class="save-recipe ${saved?"saved":""}">${saved?"♥ SAVED":"♡ SAVE"}</button><button type="button" class="battle-recipe">⚔ BATTLE</button></div>
      </div>`;
    card.querySelector(".favorite-corner").addEventListener("click",()=>toggleSave(recipe.id));
    card.querySelector(".save-recipe").addEventListener("click",()=>toggleSave(recipe.id));
    card.querySelector(".open-recipe").addEventListener("click",()=>openRecipe(recipe.id));
    card.querySelector(".battle-recipe").addEventListener("click",()=>{battleRecipeId=recipe.id;setView("battle");renderBattle(recipe.id);});
    grid.appendChild(card);
  });
}

function openRecipe(id){
  const recipe=recipeById(id); if(!recipe) return;
  currentRecipeId=id;
  setText("#dialog-category",recipe.group);
  setText("#dialog-title",recipe.name);
  setText("#dialog-emoji",recipe.emoji);
  setText("#dialog-flavor",recipe.flavor);
  setText("#dialog-expect",expectation(recipe));
  const list=document.querySelector("#dialog-ingredients"); list.innerHTML="";
  ingredientPreview(recipe).forEach(item=>{const li=document.createElement("li");li.textContent=item;list.appendChild(li);});
  const tags=document.querySelector("#dialog-tags"); tags.innerHTML="";
  recipeTags(recipe).forEach(tag=>{const span=document.createElement("span");span.textContent=tag;tags.appendChild(span);});
  syncDialogButtons();
  const dialog=document.querySelector("#recipe-dialog");
  if(typeof dialog.showModal==="function") dialog.showModal();
}

function syncDialogButtons(){
  if(!currentRecipeId) return;
  const saved=state.savedRecipes.includes(currentRecipeId), cooked=state.cookedRecipes.includes(currentRecipeId);
  setText("#dialog-save",saved?"♥ SAVED":"♡ SAVE");
  const cook=document.querySelector("#dialog-cook");
  if(cook){cook.textContent=cooked?"✓ ALREADY COOKED":"✓ MARK COOKED +25 XP";cook.disabled=cooked;}
}

function toggleSave(id){
  if(state.savedRecipes.includes(id)){state.savedRecipes=state.savedRecipes.filter(item=>item!==id);showToast("Removed from favorites.");}
  else{state.savedRecipes.push(id);state.xp+=5;state.dailyXp=Math.min(100,state.dailyXp+5);showToast("+5 XP · Recipe saved 💗");}
  saveState();
  if(state.currentView==="recipes") renderRecipes();
  if(state.currentView==="path") renderPath();
  if(currentRecipeId===id) syncDialogButtons();
}

function markCooked(id){
  if(state.cookedRecipes.includes(id)) return;
  state.cookedRecipes.push(id); saveState(); addXp(25,"Recipe completed"); celebrate(); syncDialogButtons();
  if(state.currentView==="path") renderPath();
  if(state.currentView==="recipes") renderRecipes();
}

function classicVersion(recipe){
  const g=recipe.group.toLowerCase();
  if(g.includes("drink")) return {emoji:"🥤",name:"Coffee-Shop Classic",description:"A familiar café-style version of the same craving."};
  if(g.includes("cold")||g.includes("pudding")) return {emoji:"🍦",name:"Dessert-Shop Classic",description:"A familiar chilled dessert version with shop-counter energy."};
  if(g.includes("cookie")||g.includes("bar")) return {emoji:"🍪",name:"Bakery Counter Classic",description:"A familiar bakery-case version of the same sweet craving."};
  if(g.includes("muffin")||g.includes("donut")) return {emoji:"🥐",name:"Pastry-Case Classic",description:"A familiar bakery or pastry-case version of the craving."};
  if(g.includes("breakfast")) return {emoji:"🍳",name:"Diner Breakfast Classic",description:"A familiar diner-style take on the same breakfast craving."};
  if(g.includes("sandwich")||g.includes("wrap")) return {emoji:"🥪",name:"Deli Classic",description:"A familiar deli or café version of the savory craving."};
  return {emoji:"🍽️",name:"Comfort-Food Classic",description:"A familiar restaurant-style version of the same craving."};
}

function renderBattle(recipeId=null){
  battleLocked=false;
  document.querySelector("#next-battle").hidden=true;
  const recipe = recipeId ? recipeById(recipeId) : recipeById(battleRecipeId) || recipes[Math.floor(Math.random()*recipes.length)];
  if(!recipe) return;
  battleRecipeId=recipe.id;
  const classic=classicVersion(recipe);
  setText("#battle-category",recipe.group.toUpperCase());
  setText("#battle-question","Which vibe are you choosing today?");
  setText("#ccd-food",recipe.emoji); setText("#ccd-name",recipe.name); setText("#ccd-description",recipe.flavor);
  setText("#classic-food",classic.emoji); setText("#classic-name",classic.name); setText("#classic-description",classic.description);
  const traits=document.querySelector("#ccd-traits"); traits.innerHTML=""; recipeTags(recipe).slice(0,3).forEach(tag=>{const span=document.createElement("span");span.textContent=tag;traits.appendChild(span);});
  document.querySelectorAll(".choice-card").forEach(card=>{card.disabled=false;card.classList.remove("correct-choice","wrong-choice");});
  const feedback=document.querySelector("#battle-feedback"); feedback.className="battle-feedback"; feedback.innerHTML='<div class="feedback-icon">🍓</div><div><strong>Pick your cozy winner!</strong><p>Both choices are allowed. You’re choosing a vibe, not passing a morality test.</p></div>';
}

function handleBattleChoice(choice){
  if(battleLocked) return; battleLocked=true;
  document.querySelectorAll(".choice-card").forEach(card=>card.disabled=true);
  const feedback=document.querySelector("#battle-feedback");
  if(choice==="ccd"){
    addXp(15,"CCD battle pick");
    document.querySelector('[data-choice="ccd"]').classList.add("correct-choice");
    feedback.className="battle-feedback success-feedback";
    feedback.innerHTML=`<div class="feedback-icon">🏆</div><div><strong>CCD path bonus!</strong><p>${escapeHtml(recipeById(battleRecipeId)?.name || "Your recipe")} wins this round. +15 XP.</p></div>`;
  }else{
    addXp(5,"Classic craving explored");
    document.querySelector('[data-choice="classic"]').classList.add("correct-choice");
    feedback.className="battle-feedback choice-feedback";
    feedback.innerHTML='<div class="feedback-icon">💗</div><div><strong>Classic craving selected!</strong><p>Your mood picked the familiar version today. +5 XP for exploring the battle.</p></div>';
  }
  document.querySelector("#next-battle").hidden=false; celebrate();
}

function renderProfileCustomizer(){
  setText("#profile-name-display",state.profile.name);
  const input=document.querySelector("#profile-name-input"); if(input) input.value=state.profile.name;
  const color=document.querySelector("#custom-accent"); if(color) color.value=state.profile.accent;
  const avatarPicker=document.querySelector("#avatar-picker"); avatarPicker.innerHTML="";
  avatarChoices.forEach(icon=>{const button=document.createElement("button");button.type="button";button.className="avatar-choice";if(!state.profile.photo&&state.profile.icon===icon)button.classList.add("selected");button.textContent=icon;button.setAttribute("aria-label",`Choose ${icon} avatar`);button.addEventListener("click",()=>{state.profile.icon=icon;state.profile.photo="";saveState();renderProfileCustomizer();});avatarPicker.appendChild(button);});
  const themePicker=document.querySelector("#theme-picker"); themePicker.innerHTML="";
  themeChoices.forEach(([key,label,gradient,defaultAccent])=>{const button=document.createElement("button");button.type="button";button.className="theme-choice";if(state.profile.theme===key)button.classList.add("selected");button.innerHTML=`<span class="theme-swatch" style="background:${gradient}"></span><span>${escapeHtml(label)}</span>`;button.addEventListener("click",()=>{state.profile.theme=key;state.profile.accent=defaultAccent;saveState();applyProfileStyle();renderProfileCustomizer();});themePicker.appendChild(button);});
  const accentPicker=document.querySelector("#accent-picker"); accentPicker.innerHTML="";
  accentChoices.forEach(hex=>{const button=document.createElement("button");button.type="button";button.className="accent-choice";button.style.setProperty("--swatch",hex);button.setAttribute("aria-label",`Choose accent ${hex}`);if(state.profile.accent.toLowerCase()===hex.toLowerCase())button.classList.add("selected");button.addEventListener("click",()=>setAccent(hex));accentPicker.appendChild(button);});
  updateStats();
}

function setAccent(hex){
  state.profile.accent=hex;saveState();applyProfileStyle();renderProfileCustomizer();
}

function resizeProfilePhoto(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error("Could not read image."));
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error("Could not load image."));
      img.onload=()=>{
        const size=320, canvas=document.createElement("canvas");canvas.width=size;canvas.height=size;
        const ctx=canvas.getContext("2d");
        const scale=Math.max(size/img.width,size/img.height);const w=img.width*scale,h=img.height*scale;const x=(size-w)/2,y=(size-h)/2;
        ctx.drawImage(img,x,y,w,h);resolve(canvas.toDataURL("image/jpeg",.82));
      };
      img.src=String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function updateBadges(){
  const rules={first:state.cookedRecipes.length>=1,five:state.cookedRecipes.length>=5,save:state.savedRecipes.length>=5,xp:state.xp>=500};
  document.querySelectorAll("[data-badge]").forEach(card=>card.classList.toggle("earned-badge",Boolean(rules[card.dataset.badge])));
}

function renderSpotlight(){
  if(!recipes.length) return;
  const recipe=recipes[(spotlightIndex+recipes.length)%recipes.length];
  const next=recipes[(spotlightIndex+1+recipes.length)%recipes.length];
  setText("#packet-emoji",recipe.emoji);setText("#packet-name",recipe.name);setText("#packet-category",recipe.group);setText("#packet-left-emoji",recipe.emoji);setText("#packet-right-emoji",next.emoji);
  const packet=document.querySelector("#recipe-packet");packet.dataset.recipeId=recipe.id;packet.style.setProperty("--packet-rotation",`${spotlightIndex%2?180:0}deg`);
  packet.querySelectorAll("span,strong,small").forEach(child=>{child.style.transform=spotlightIndex%2?"rotate(180deg)":"";});
}

function shiftSpotlight(delta){spotlightIndex=(spotlightIndex+delta+recipes.length)%recipes.length;renderSpotlight();}

function wireEvents(){
  document.addEventListener("click",event=>{
    const viewButton=event.target.closest("[data-view-target]");if(viewButton){setView(viewButton.dataset.viewTarget);return;}
    const worldButton=event.target.closest("[data-world]");if(worldButton){activeRecipeFilter=worldButton.dataset.world;setView("recipes");renderRecipes();return;}
    const statButton=event.target.closest("[data-stat]");if(statButton){if(statButton.dataset.stat==="streak")showToast(`${state.streak}-day cozy streak 🔥`);if(statButton.dataset.stat==="xp")showToast(`${state.xp} Berry XP collected ✨`);if(statButton.dataset.stat==="hearts")showToast(`${state.hearts} hearts available 💗`);}
  });

  document.querySelector("#recipe-search")?.addEventListener("input",event=>{recipeSearchQuery=event.target.value;renderRecipes();});
  document.querySelector("#dialog-close")?.addEventListener("click",()=>document.querySelector("#recipe-dialog").close());
  document.querySelector("#recipe-dialog")?.addEventListener("click",event=>{const d=event.currentTarget,r=d.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)d.close();});
  document.querySelector("#dialog-save")?.addEventListener("click",()=>currentRecipeId&&toggleSave(currentRecipeId));
  document.querySelector("#dialog-cook")?.addEventListener("click",()=>currentRecipeId&&markCooked(currentRecipeId));
  document.querySelector("#dialog-battle")?.addEventListener("click",()=>{if(!currentRecipeId)return;battleRecipeId=currentRecipeId;document.querySelector("#recipe-dialog").close();setView("battle");renderBattle(battleRecipeId);});
  document.querySelectorAll(".choice-card[data-choice]").forEach(card=>card.addEventListener("click",()=>handleBattleChoice(card.dataset.choice)));
  document.querySelector("#next-battle")?.addEventListener("click",()=>{battleRecipeId=null;renderBattle();});
  document.querySelector("#random-battle")?.addEventListener("click",()=>{battleRecipeId=null;renderBattle();});

  document.querySelector("#save-profile-name")?.addEventListener("click",()=>{const value=document.querySelector("#profile-name-input").value.trim();state.profile.name=value||"Berry Chef";saveState();renderProfileCustomizer();showToast("Profile name saved ✨");});
  document.querySelector("#profile-photo-input")?.addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;if(!file.type.startsWith("image/")){showToast("Please choose an image file.");return;}try{state.profile.photo=await resizeProfilePhoto(file);saveState();renderProfileCustomizer();showToast("Profile picture updated!");}catch(error){console.warn(error);showToast("That image could not be loaded.");}});
  document.querySelector("#remove-profile-photo")?.addEventListener("click",()=>{state.profile.photo="";saveState();renderProfileCustomizer();showToast("Profile picture removed.");});
  document.querySelector("#custom-accent")?.addEventListener("input",event=>setAccent(event.target.value));
  document.querySelector("#reset-progress")?.addEventListener("click",()=>{if(!window.confirm("Reset XP, cooked recipes, favorites, and profile customization?"))return;localStorage.removeItem(STORAGE_KEY);state=clone(DEFAULT_STATE);applyProfileStyle();updateStats();renderPath();renderRecipes();renderProfileCustomizer();setView("home");showToast("Fresh cookbook journey started.");});

  document.querySelector("#packet-prev")?.addEventListener("click",()=>shiftSpotlight(-1));
  document.querySelector("#packet-next")?.addEventListener("click",()=>shiftSpotlight(1));
  document.querySelector("#recipe-packet")?.addEventListener("click",event=>openRecipe(event.currentTarget.dataset.recipeId));
  document.querySelector("#packet-stage")?.addEventListener("wheel",event=>{event.preventDefault();if(wheelLocked)return;wheelLocked=true;shiftSpotlight(event.deltaY>0?1:-1);setTimeout(()=>{wheelLocked=false;},420);},{passive:false});
  document.querySelector("#packet-stage")?.addEventListener("keydown",event=>{if(event.key==="ArrowDown"){event.preventDefault();shiftSpotlight(1);}if(event.key==="ArrowUp"){event.preventDefault();shiftSpotlight(-1);}});
}

function init(){
  document.body.dataset.profileTheme=state.profile.theme||"berry";
  applyProfileStyle();
  wireEvents();
  updateStats();
  renderSpotlight();
  renderRecipes();
  renderPath();
  renderBattle();
  renderProfileCustomizer();
  const start=document.querySelector(`[data-view="${state.currentView}"]`)?state.currentView:"home";
  setView(start);
}

document.addEventListener("DOMContentLoaded",init);
