// Simple translation map for move/category labels by language.
// Keys are move ids (e.g., "air-f", "smash-u"), organized under character ids.
// Category labels live under categories.

var moveTranslations = {
  en: {
    categories: {
      aerial: "Aerials",
      tilt: "Tilts",
      smash: "Smashes",
      special: "Specials",
      attackOther: "Other Attacks",
      ledge: "Ledge",
      ground: "Ground (Tech/Get-up)",
      defendOther: "Other"
    },
    movesCommon: {},
    moves: {}
  },
  ja: {
    categories: {
      aerial: "空中攻撃",
      tilt: "強攻撃",
      smash: "スマッシュ",
      special: "必殺技",
      attackOther: "その他攻撃",
      ledge: "崖",
      ground: "地上(受け身/起き上がり)",
      defendOther: "その他"
    },
    // Common translations shared across characters; character-specific overrides can go in `moves`.
    movesCommon: {
      "air-f": "空前",
      "air-b": "空後",
      "air-u": "空上",
      "air-d": "空下",
      "air-n": "空N",
      "smash-u": "上スマ",
      "smash-d": "下スマ",
      "smash-f": "横スマ",
      "smash-f-mh": "横スマ上シフト(１段階)",
      "smash-f-h": "横スマ上シフト",
      "smash-f-ml": "横スマ下シフト(１段階)",
      "smash-f-l": "横スマ下シフト",
      "tilt-u": "上強",
      "tilt-d": "下強",
      "tilt-f": "横強",
      "tilt-f-mh": "横強上シフト(１段階)",
      "tilt-f-h": "横強上シフト",
      "tilt-f-ml": "横強下シフト(１段階)",
      "tilt-f-l": "横強下シフト",
      "jab-1": "弱１",
      "jab-2": "弱２",
      "jab-3": "弱３",
      "grab": "つかみ",
      "grab-c": "空中つかみ",
      "roll-f": "前回避",
      "roll-b": "後ろ回避",
      "shield-j": "ジャンプ（シールド）",
      "shield-d": "しゃがみシールド",
      "ledge-a": "崖攻撃",
      "ledge-a-s": "崖攻撃（遅い）",
      "ledge-r": "崖上がり回避",
      "ledge-r-s": "崖上がり回避（遅い）",
      "ledge-g": "崖上がり",
      "ledge-g-s": "崖上がり（遅い）",
      "tech-n": "受け身（その場）",
      "tech-r-f": "受け身（前）",
      "tech-r-b": "受け身（後）",
      "tech-none-d": "その場起き上がり",
      "tech-none-u": "その場起き上がり",
      "getup-a-d": "起き上がり攻撃（下）",
      "getup-a-u": "起き上がり攻撃（上）",
      "getup-d": "起き上がり（下）",
      "getup-u": "起き上がり（上）",
      "getup-r-b-d": "起き上がり回避（後/下）",
      "getup-r-b-u": "起き上がり回避（後/上）",
      "getup-r-f-d": "起き上がり回避（前/下）",
      "getup-r-f-u": "起き上がり回避（前/上）",
      "dash-a": "ダッシュ攻撃",
      "special-n": "NB",
      "special-n-c": "NB溜め",
      "special-n-c-c": "NB溜めキャンセル",
      "special-n-f": "NB最大",
      "special-n-f-c": "NB最大キャンセル",
      "special-f": "横B",
      "special-u": "上B",
      "special-d": "下B",
      "special-u-a": "上B空",
      "throw-f": "前投げ",
      "throw-b": "後投げ",
      "crouch": "しゃがみ",
      "taunt": "アピール",
    },
    // Character-specific overrides (optional)
    moves: {
      // e.g., samus: { "special-n": "チャージショット" }
    }
  }
};
