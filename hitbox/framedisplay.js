var globalVar = new Object();
var loadedCharacters = {}; // cache per version
var hashUpdatesEnabled = false;
var ASSET_ROOT = (typeof window.HITBOX_ASSET_ROOT === "string") ? window.HITBOX_ASSET_ROOT : "/ssbframedata/";
if (ASSET_ROOT.slice(-1) !== "/") { ASSET_ROOT += "/"; }
var IMAGE_ROOT = (typeof window.HITBOX_IMAGE_ROOT === "string") ? window.HITBOX_IMAGE_ROOT : "/ssbframedata/images/";
if (IMAGE_ROOT.slice(-1) !== "/") { IMAGE_ROOT += "/"; }
var uiText = {
  en: { character:"Character: ", attack:"Attack: ", speed:"Speed", hitbox:"Hitbox", overlay:"Overlay", loop:"Loop \u21bb", play:"Play", pause:"Pause", playing:"Playing", paused:"Paused" },
  ja: { character:"キャラ: ", attack:"技: ", speed:"速度", hitbox:"ヒットボックス", overlay:"オーバーレイ", loop:"ループ \u21bb", play:"再生", pause:"一時停止", playing:"再生中", paused:"停止中" }
};

function initSettings()
{
  // Assigns different page element to a global Object for easy names
  globalVar.repeatAnim = document.getElementById("repeatCheckbox");
  //globalVar.character = document.getElementById("selectChar"); //change to new select
  globalVar.character = document.getElementById("selectCharHidden"); //change to new select
  globalVar.attack = document.getElementById("selectAtt");
  globalVar.maxFrame;
  globalVar.hitboxRadio = document.getElementById("hitboxRadio");
  globalVar.overlayRadio = document.getElementById("overlayRadio");
  globalVar.selectSpeed = document.getElementById("selectSpeed");
  globalVar.videoPlayer = document.getElementById("videoPlayer");
  globalVar.manualFrameText = document.getElementById("manualFrameText");
  globalVar.selectVersion = document.getElementById("selectVersion");
  globalVar.selectLang = document.getElementById("selectLang");
  if (globalVar.selectVersion) {
    globalVar.selectVersion.onchange = function(){ setVersion(this.value); };
  }
  if (globalVar.selectLang) {
    globalVar.selectLang.onchange = function(){ setLanguage(this.value); };
  }
  globalVar.translations = (typeof moveTranslations !== "undefined") ? moveTranslations : {en:{},ja:{}};
  globalVar.assetRoot = ASSET_ROOT;
  globalVar.imgBase = IMAGE_ROOT;
  
  // Sets the default form values
  globalVar.fps = 30
  globalVar.selectSpeed.value = "60";
  globalVar.overlayRadio.checked = true;
  globalVar.repeatAnim.checked = true;
  globalVar.videoPlayer.loop = true;
  globalVar.playing = false;
  
  // Adds functions (play, pause, ratechange) when a certain event is happening
  globalVar.videoPlayer.addEventListener("play", function() {
    globalVar.frameTimer = setInterval(function(){
	  if (globalVar.playing==true) {
       globalVar.manualFrameText.value = Math.floor(globalVar.videoPlayer.currentTime * globalVar.fps + 1);
	   //console.log("play");
	  }
    }, 60);
  }, false);
  globalVar.videoPlayer.addEventListener("pause", function() {
    //console.log(Math.floor(globalVar.videoPlayer.currentTime * globalVar.fps + 1));
    clearInterval(globalVar.frameTimer);
    // If at the end of the video, the frame count is 1 over the maximum frame number
    globalVar.manualFrameText.value = 
      (Math.floor(globalVar.videoPlayer.currentTime * globalVar.fps + 1) <= globalVar.maxFrame
      ? Math.floor(globalVar.videoPlayer.currentTime * globalVar.fps + 1)
      : globalVar.maxFrame);
	//console.log("pause");
  }, false);
  globalVar.videoPlayer.addEventListener("timeupdate", function() {
    //console.log(globalVar.videoPlayer.currentTime);
  }, false);
  globalVar.videoPlayer.addEventListener('loadedmetadata', function () {
    if (this.previousFrame)
    {
      changeFrame(this.previousFrame);
      delete this.previousFrame;
    }
  }, false);
  globalVar.videoPlayer.addEventListener("ratechange", function() {
    chosenFPS = globalVar.videoPlayer.playbackRate * globalVar.fps;
    if ([15, 20, 30, 60].indexOf(chosenFPS) >= 0)
    {
      globalVar.selectSpeed.value = globalVar.videoPlayer.playbackRate * globalVar.fps;
    }
    else
    {
      alert("Invalid FPS");
      globalVar.selectSpeed.value = 30;
      globalVar.videoPlayer.playbackRate = 1;
    }
    //
  }, false);


  if (window.location.hash.indexOf("&") !== -1){
      urlChar = window.location.hash.substring(1,window.location.hash.indexOf("&"));
      urlMove=window.location.hash.substring(window.location.hash.indexOf("&")+1,);
  }

  if (typeof characterObject !== "undefined")
  {
    loadedCharacters["U"] = characterObject;
  }

  var params = readParams();
  setVersion(params.version || "U", function() {
    setLanguage(params.lang || "en");

    changeChar();

    if (typeof urlChar !== 'undefined'){
        document.getElementById("selectCharHidden").value=urlChar;
        setCardImage(urlChar);
        changeChar();
        globalVar.attack.value=urlMove
        changeAtt();
    }

    // Uses function changeSpeed, otherwise only the element "selectSpeed" is changed
    changeSpeed(globalVar.selectSpeed);
    initKeydown();
    hashUpdatesEnabled = true;
  });
}

// Changes the video src url depending on the globalVar.overlayRadio.checked value
function changeSourceVid()
{
  var currentSpeed = globalVar.videoPlayer.playbackRate;
  var base = globalVar.fdBase || (ASSET_ROOT + "fd/");
  if (globalVar.overlayRadio.checked)
  {
    globalVar.videoPlayer.src = base + globalVar.character.value + "/" + globalVar.attack.value + "/o.mp4";
  }
  else if (globalVar.hitboxRadio.checked)
  {
    globalVar.videoPlayer.src = base + globalVar.character.value + "/" + globalVar.attack.value + "/b.mp4";
  }
  // Sets the frame count to 1 everytime the video src url changes
  globalVar.manualFrameText.value = 1;
  globalVar.videoPlayer.playbackRate = currentSpeed;
}

// Changes the 'Character' title and calls the populateAttack function
function changeChar(elmnt)
{
  globalVar.playing = false;
  //console.log(globalVar.playing);
  document.getElementsByTagName("h1")[0].innerHTML = (globalVar.langText ? globalVar.langText.character : "Character: ") + characterObject[globalVar.character.value].name; //change for new select
  populateAttack(globalVar.character.value);
}

// Populates the 'Attack' dropdown list for the specific character
function populateAttack(charSelected)
{
  // Try to preserve current selection when switching characters
  var previousSelection = globalVar.attack.value;

  var selectAtt = document.getElementById("selectAtt");

  // Clear any existing groups/options
  while (selectAtt.firstChild)
  {
    selectAtt.removeChild(selectAtt.firstChild);
  }

  var optgroups = {
    aerial: document.createElement("optgroup"),
    tilt: document.createElement("optgroup"),
    smash: document.createElement("optgroup"),
    special: document.createElement("optgroup"),
    attackOther: document.createElement("optgroup"),
    ledge: document.createElement("optgroup"),
    ground: document.createElement("optgroup"),
    defendOther: document.createElement("optgroup")
  };
  var cats = (globalVar.langText && globalVar.langText.categories) ? globalVar.langText.categories : {};
  optgroups.aerial.label = cats.aerial || "Aerials";
  optgroups.tilt.label = cats.tilt || "Tilts";
  optgroups.smash.label = cats.smash || "Smashes";
  optgroups.special.label = cats.special || "Specials";
  optgroups.attackOther.label = cats.attackOther || "Other Attacks";
  optgroups.ledge.label = cats.ledge || "Ledge";
  optgroups.ground.label = cats.ground || "Ground (Tech/Get-up)";
  optgroups.defendOther.label = cats.defendOther || "Other";

  function categorizeMoveKey(key)
  {
    if (key.indexOf("ledge-") === 0) { return "ledge"; }
    if (key.indexOf("tech") === 0 || key.indexOf("getup") === 0) { return "ground"; }
    if (key.indexOf("roll-") === 0 ||
        key.indexOf("shield-") === 0 ||
        key === "taunt" ||
        key === "crouch")
    {
      return "defendOther";
    }
    if (key.indexOf("air-") === 0) { return "aerial"; }
    if (key.indexOf("tilt-") === 0) { return "tilt"; }
    if (key.indexOf("smash-") === 0) { return "smash"; }
    if (key.indexOf("special-") === 0) { return "special"; }
    if (key.indexOf("jab-") === 0 ||
        key.indexOf("grab") === 0 ||
        key.indexOf("throw-") === 0 ||
        key === "dash-a")
    {
      return "attackOther";
    }
    return "attackOther";
  }

  // Fills the new values for the character
  for (var key in characterObject[charSelected].move) {
    var optionAtt = document.createElement("OPTION");
    optionAtt.text = translatedMoveName(charSelected, key);
    optionAtt.value = key;
    var bucket = categorizeMoveKey(key);
    optgroups[bucket].appendChild(optionAtt);
  }

  ["aerial", "tilt", "smash", "special", "attackOther", "ledge", "ground", "defendOther"].forEach(function(groupKey) {
    if (optgroups[groupKey].childElementCount > 0)
    {
      selectAtt.appendChild(optgroups[groupKey]);
    }
  });

  // Restore previous selection if possible, otherwise choose first option
  var restored = false;
  for (var i = 0; i < selectAtt.options.length; i++) {
    if (selectAtt.options[i].value === previousSelection) {
      selectAtt.selectedIndex = i;
      restored = true;
      break;
    }
  }
  if (!restored && selectAtt.options.length > 0) { selectAtt.selectedIndex = 0; }

  changeAtt();
}

// This function is called when a new attack is selected from the drop-down list
function changeAtt(attDropdownObject)
{
  globalVar.playing = false;
  // Changes the number of maximum frames for the attack
  globalVar.maxFrame = characterObject[globalVar.character.value].move[globalVar.attack.value].totalFrames
  document.getElementById("maxFrameSpan").innerHTML = '/' + globalVar.maxFrame;
  if (hashUpdatesEnabled) {
    window.location.hash = globalVar.character.value + "&" + globalVar.attack.value;
  }
  // Prevent arrow keys from cycling the dropdown after selection
  if (attDropdownObject && typeof attDropdownObject.blur === "function")
  {
    attDropdownObject.blur();
  }
  else if (document.activeElement === globalVar.attack && typeof document.activeElement.blur === "function")
  {
    document.activeElement.blur();
  }

  // Show callout for shield/roll options that skip frame 1 when already shielding
  var callout = document.getElementById("callout");
  var needsCallout = ["roll-b","roll-f","shield-j","shield-d"].indexOf(globalVar.attack.value) !== -1;
  if (callout)
  {
    callout.style.display = needsCallout ? "block" : "none";
    callout.innerHTML = needsCallout ? "Note: If already shielding, frame 1 will be skipped" : "";
  }
  
  changeSourceVid();
}

function playFrame()
{
  if (globalVar.videoPlayer.paused)
  {
    globalVar.playing = true;
    globalVar.videoPlayer.play();
    updatePlayStatus();
    updatePlayPauseButton();
  }
  else
  {
    pauseFrame();
  }
}

// Stops the animation
function pauseFrame()
{
  globalVar.playing = false;
  globalVar.videoPlayer.pause()
  updatePlayStatus();
  updatePlayPauseButton();
}

// Goes to the first frame
function goToFirstFrame()
{
  changeFrame(1);
}

// This function is called to go to the previous frame.
function goToPreviousFrame()
{
  // Formula so that when placed at first frame, returns last frame
  var nextFrame = ((globalVar.manualFrameText.value - 2 + globalVar.maxFrame) % globalVar.maxFrame + 1)
  // If at first frame and loop is 'false'
  if (globalVar.manualFrameText.value == 1 && !globalVar.videoPlayer.loop)
  {
    return;
  }
    changeFrame(nextFrame);
}

// This function is called whenever you want to change currentTime
function changeFrame(newFrame)
{
  globalVar.videoPlayer.currentTime = ((newFrame - 1) / globalVar.fps) + 0.000002;
  globalVar.manualFrameText.value = newFrame;
}

// This function is called whenever the frame number is changed manually
function changeManualFrame()
{
  var newFrame = parseInt(globalVar.manualFrameText.value, 10);
  if (newFrame <= globalVar.maxFrame && newFrame > 0) { changeFrame(newFrame); }
  else {
    alert("Enter a number between : 1 and " + globalVar.maxFrame);
    globalVar.manualFrameText.value = Math.floor(globalVar.videoPlayer.currentTime * 30 + 1);
  }
}

// This function is called to go to the next frame.
function goToNextFrame()
{
  // Formula so that when placed at last frame, returns first frame
  var nextFrame = (globalVar.manualFrameText.value % globalVar.maxFrame + 1)
  if (globalVar.manualFrameText.value == globalVar.maxFrame && !globalVar.videoPlayer.loop)
  {
    return;
  }
    changeFrame(nextFrame);
}

// Goes to the last frame
function goToLastFrame()
{
  changeFrame(globalVar.maxFrame);
}

// This function is called whenever the speed in the drop-down list is changed.
function changeSpeed(speedSelected)
{
  globalVar.videoPlayer.playbackRate = speedSelected.value / globalVar.fps;
}

function selectCharacter(charId)
{
  document.getElementById("selectCharHidden").value = charId;
  setCardImage(charId);
  changeChar();
}

function setCardImage(charId)
{
  var card = cardNameForChar(charId);
  var imgBase = globalVar.imgBase || IMAGE_ROOT;
  document.getElementById("p1_select").innerHTML="<img src=\"" + imgBase + card + "_card.png\" style=\"width: 100%; height: 100%;\">";
}

function refreshCharacterPickerImages()
{
  var chars = ["luigi","mario","dk","link","samus","falcon","ness","yoshi","kirby","fox","pikachu","purin"];
  var base = globalVar.imgBase || IMAGE_ROOT;
  for (var i=0;i<chars.length;i++)
  {
    var el = document.getElementById(chars[i] + "_select");
    if (el) { el.src = base + cardNameForChar(chars[i]) + "_select.png"; }
  }
}

function cardNameForChar(charId)
{
  if (charId === "purin") return "jiggly";
  return charId;
}

function translatedMoveName(charId, moveKey)
{
  var lang = globalVar.lang || "en";
  var pack = (globalVar.translations && globalVar.translations[lang]) ? globalVar.translations[lang] : {};
  var byChar = (pack.moves && pack.moves[charId]) ? pack.moves[charId] : {};
  var common = pack.movesCommon || {};
  // also allow root-level moves map to be treated as common if values are strings
  var rootMoves = (pack.moves && typeof pack.moves[moveKey] === "string") ? pack.moves : {};
  // fallback: if English language but current version is J, try pulling the U-version name first
  var englishBase = null;
  if (lang === "en" && loadedCharacters["U"] && loadedCharacters["U"][charId] && loadedCharacters["U"][charId].move && loadedCharacters["U"][charId].move[moveKey])
  {
    englishBase = loadedCharacters["U"][charId].move[moveKey].name;
  }
  return byChar[moveKey] || common[moveKey] || rootMoves[moveKey] || englishBase || characterObject[charId].move[moveKey].name || moveKey;
}

function readParams()
{
  var params = { version: "U", lang: "en" };
  var search = new URLSearchParams(window.location.search);
  if (search.get("ver")) { params.version = search.get("ver").toUpperCase(); }
  if (search.get("lang")) { params.lang = search.get("lang").toLowerCase(); }
  // Hash still controls character & move
  return params;
}

function setVersion(ver, cb)
{
  var previousVersion = globalVar.version;
  globalVar.version = (ver === "J") ? "J" : "U";
  globalVar.fdBase = globalVar.assetRoot + (globalVar.version === "J" ? "J/fd/" : "fd/");
  // Images are identical across versions; always use the shared images directory
  globalVar.imgBase = IMAGE_ROOT;

  if (globalVar.selectVersion) { globalVar.selectVersion.value = globalVar.version; }

  if (previousVersion !== "J" && globalVar.version === "J" && globalVar.hitboxRadio)
  {
    globalVar.hitboxRadio.checked = true;
    if (globalVar.overlayRadio) { globalVar.overlayRadio.checked = false; }
  }

  refreshCharacterPickerImages();
  setCardImage(globalVar.character.value);

  loadCharactersForVersion(globalVar.version, function(){
    changeChar();
    if (typeof cb === "function") cb();
  });
}

function setLanguage(lang)
{
  globalVar.lang = (lang === "ja") ? "ja" : "en";
  if (globalVar.selectLang) { globalVar.selectLang.value = globalVar.lang; }

  var t = uiText[globalVar.lang] || uiText.en;
  // merge in category labels from moveTranslations if available
  var cat = (globalVar.translations && globalVar.translations[globalVar.lang] && globalVar.translations[globalVar.lang].categories) ? globalVar.translations[globalVar.lang].categories : {};
  t.categories = cat;
  globalVar.langText = t;
  document.getElementById("move_display").innerHTML = t.attack;
  document.getElementById("character_display").innerHTML = t.character + characterObject[globalVar.character.value].name;
  // radios labels
  var labels = document.querySelectorAll("label[for='hitboxRadio'], label[for='overlayRadio']");
  if (labels.length >=2) {
    labels[0].textContent = t.hitbox;
    labels[1].textContent = t.overlay;
  }
  updatePlayStatus();
  updatePlayPauseButton();
  populateAttack(globalVar.character.value);
}

function loadCharactersForVersion(ver, cb)
{
  if (loadedCharacters[ver])
  {
    characterObject = loadedCharacters[ver];
    if (typeof cb === "function") cb();
    return;
  }

  var script = document.createElement("script");
  script.src = (ver === "J") ? "J/characters-J.js" : "characters-U.js";
  script.onload = function() {
    loadedCharacters[ver] = characterObject;
    if (typeof cb === "function") cb();
  };
  document.head.appendChild(script);
}
// This function is called whenever the displayModeRadio is changed.
function changeHitbox()
{
  pauseFrame();
  var currentFrame = globalVar.manualFrameText.value
  globalVar.videoPlayer.previousFrame = currentFrame
  changeSourceVid();
}

// This function is called when 'repeat' is checked or unchecked
function changeRepeat(repeatSelected)
{
  globalVar.videoPlayer.loop = repeatSelected.checked;
}

function dummy()
{
  //
}

function updatePlayStatus()
{
  var status = document.getElementById("playStatus");
  if (!status) { return; }
  var t = globalVar.langText || uiText[globalVar.lang] || uiText.en || {};
  if (globalVar.playing)
  {
    status.textContent = "";
    status.classList.add("playing");
    status.classList.remove("paused");
  }
  else
  {
    status.textContent = "";
    status.classList.add("paused");
    status.classList.remove("playing");
  }
}

function updatePlayPauseButton()
{
  var btn = document.getElementById("playPauseButton");
  if (!btn) return;
  var t = globalVar.langText || uiText[globalVar.lang] || uiText.en || {};
  btn.value = globalVar.playing ? (t.pause || "Pause") : (t.play || "Play");
}

function togglePlayPause()
{
  if (globalVar.playing) pauseFrame(); else playFrame();
  // Avoid stealing arrow keys: drop focus from the button
  var btn = document.getElementById("playPauseButton");
  if (btn && typeof btn.blur === "function") { btn.blur(); }
}

window.onload = initSettings;
