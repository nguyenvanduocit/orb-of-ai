---
template: templates/mechanic-template.md
document_type: mechanic
title: Spirit và Spirit Reservation
status: published
author: duocnv
created: '2026-06-12'
updated: '2026-07-03'
league: '0.5'
patch: 0.5.3
tags:
  - spirit
  - reservation
  - reservation-efficiency
  - companion
  - minion
  - aura
  - poe2
  - mechanic
---

# Spirit và Spirit Reservation

:wiki-link{url="https://www.poe2wiki.net/wiki/Spirit"} = resource thứ ba cạnh Life/Mana: mọi persistent skill (minion, companion, aura, herald, persistent buff) chiếm Spirit chừng nào còn bật. Character bắt đầu 0 Spirit, quest cho 110 permanent, còn lại từ gear/passive/ascendancy/augment. Ledger 347 Spirit của ThaoCamVienSaiGon chạy all-on không dư.

## Công thức + 4 luật nền

```
Spirit Reserved = Base Reservation / (1 + Tổng Reservation Efficiency / 100)
```

- Mọi `% increased/reduced Reservation Efficiency` cộng additive vào MỘT pool rồi chia (100% res eff = cost còn nửa). Multiplier `less/more` đứng ngoài pool, nhân multiplicative sau: :wiki-link{url="https://www.poe2wiki.net/wiki/Matsya"} "Skills reserve 50% less Spirit", A Solid Plan "Persistent Buffs 50% less Reservation", :wiki-link{url="https://www.poe2wiki.net/wiki/Trusted_Kinship"} "30% more Reservation Efficiency of Companion Skills".
- VD: :wiki-link{url="https://www.poe2wiki.net/wiki/Wolf_Pack"} base 60 Spirit. anoint Gigantic Following (−25% minion res eff) + rune helm +8% → pool −17% → 60/0.83 ≈ 72 Spirit. Lord of Horrors (+12%) → pool +20% → 60/1.20 = 50 Spirit. Lệch 22 Spirit chỉ vì dấu pool.

1. **Skill granted từ item/ascendancy KHÔNG reserve Spirit.** Discipline + Azmerian Wolf từ :wiki-link{url="https://www.poe2wiki.net/wiki/Sylvan's_Effigy"}, ba Herald từ :wiki-link{url="https://www.poe2wiki.net/wiki/The_Coming_Calamity" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22The%20Coming%20Calamity%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"}, Purity từ Guiding Palm, Spirit Vessel từ Forgotten Warden: chạy 0 Spirit. Support gem socket vào granted skill VẪN cộng Additional Reservation.
2. **Mỗi weapon set có pool Spirit riêng.** Sceptre set 2 chỉ cho Spirit khi set 2 active; 24 điểm weapon-set passive mỗi set allocate khác nhau. Swap set có thể tắt buff nếu pool mới không gánh nổi.
3. **Persistent reservation không tắt khi chết.** Respawn không re-cast.
4. **Reservation Efficiency chỉ đụng reservation từ skill.** Life reserved của :wiki-link{url="https://www.poe2wiki.net/wiki/Widow's_Reign" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22Widow's%20Reign%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} hay debuff :wiki-link{url="https://www.poe2wiki.net/wiki/Blood_Price" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22Blood%20Price%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} miễn nhiễm res eff.

## Spirit permanent từ quest (110)

- :wiki-link{url="https://www.poe2wiki.net/wiki/Gembloom_Skull"} +30 (The King in the Mists, Freythorn — optional boss Act 1).
- :wiki-link{url="https://www.poe2wiki.net/wiki/Gemrot_Skull"} +30 (Ignagduk, the Bog Witch, The Azak Bog — Act 3).
- :wiki-link{url="https://www.poe2wiki.net/wiki/Gemcrust_Skull"} +40 (Lythara, the Wayward Spear, Kriar Village — Interlude 3).
- Uhtred's Boon +10 (chain The Grand Expedition của Ocean Exploring, right-click; xem [Cách chơi Ocean Exploring](/guides/0-5-ocean-exploring)).
- Act 4–6 chưa có quest Spirit (Skull of the Titan chưa release); atlas tree 0 node đụng player Spirit ("spirit" trong atlas = Azmeri Spirit entity, khác hệ); waystone/tablet không có dòng Spirit.

## Gear base + mod craft được

- **Sceptre** = weapon duy nhất có Spirit base: mọi base 100 Spirit implicit. Prefix local: % Spirit thuần Lord's → King's (20-26)% tới (61-65)%; hybrid % Spirit + flat Mana Advisor's → Chancellor's (10-14)% tới (35-38)%. Corruption: Vaal (15-25)%, double-corrupt Intrinsic (35-60)%. Rare King's + Intrinsic max ~125% local trên base 100 = ~225 Spirit/item.
- **Body armour**: prefix Lady's → Queen's 8 tier, +(30-33) ilvl 16 → +(57-61) ilvl 78; 3 tier chót Duchess'/Princess'/Queen's chỉ trên body. Corvus Mantle + Conjurer Mantle implicit +(20-30).
- **Amulet**: cùng prefix chỉ tier 1–5 (max Countess' +(47-50)); :wiki-link{url="https://www.poe2wiki.net/wiki/Solar_Amulet" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22type%22%3A%22Solar%20Amulet%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} implicit +(10-15); Lament Amulet đổi 1 prefix slot lấy "Grants Skill" (1 trong 37 persistent skill free).
- **Res eff (desecration/corruption)**: Abyss suffix of Amanamu (helmet 4-8%, body 6-12%, weapon 5-10%); Of Ulaman (body 12-18% companion, amulet 10-20% herald); Of Coherence (7-10% minion, amulet/ring, chỉ Breach desecration); Corruption helmet flat +(20-30) / +(40-60) Intrinsic; Amanamu's prefix flat +(35-50) staff (0.5.3 thêm prefix thứ hai cùng tên cho Gain 40–50% Damage as Extra Chaos — phân biệt qua stat, không tên); Soul-influenced Medved's (1-20)% increased Spirit + 6 variant hybrid.
- **Abyss jewel** (dày Spirit nhất/socket): suffix watcher (12-16)% res eff toàn skill; prefix Kulemak gộp +(40-60) flat + (6-10)% res eff trong MỘT mod.

## Unique định hình Spirit

- **Flat lớn nhất**: :wiki-link{url="https://www.poe2wiki.net/wiki/Enfolding_Dawn" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22Enfolding%20Dawn%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} + :wiki-link{url="https://www.poe2wiki.net/wiki/Alpha's_Howl" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22Alpha's%20Howl%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} mỗi +100 (body/helm). :wiki-link{url="https://www.poe2wiki.net/wiki/Soul_Mantle" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22Soul%20Mantle%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} sau rework 0.5.0 +75 (bỏ reduced Totem Life). +50: :wiki-link{url="https://www.poe2wiki.net/wiki/Prism_Guardian" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22Prism%20Guardian%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} (shield, 1% Buff res eff per 100 max Life), :wiki-link{url="https://www.poe2wiki.net/wiki/Pariah's_Embrace" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22Pariah's%20Embrace%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} (Lv26 leveling), :wiki-link{url="https://www.poe2wiki.net/wiki/Chober_Chaber" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22Chober%20Chaber%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} (2H mace, +2-3 Level minion skills).
- **% increased**: :wiki-link{url="https://www.poe2wiki.net/wiki/Sylvan's_Effigy" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22Sylvan's%20Effigy%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} (50-75)% increased Spirit trên base (150-175) + "any number of Companions of different types" + Discipline free. :wiki-link{url="https://www.poe2wiki.net/wiki/Font_of_Power" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22Font%20of%20Power%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} (Lv16) base (130-150) + (30-50)%. :wiki-link{url="https://www.poe2wiki.net/wiki/Grand_Spectrum" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22Grand%20Spectrum%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} Emerald 3 viên = 18% increased. :wiki-link{url="https://www.poe2wiki.net/wiki/Against_the_Darkness" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22Against%20the%20Darkness%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} roll "Notable trong radius grant +(8-12) Spirit".
- **Reservation**: :wiki-link{url="https://www.poe2wiki.net/wiki/Matsya" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22Matsya%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} "50% less Spirit" (mạnh nhất game, weapon Lv20 từ Act 2). :wiki-link{url="https://www.poe2wiki.net/wiki/The_Raven's_Flock" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22The%20Raven's%20Flock%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} (30-50)% res eff toàn skill + Minions (80-120)% Damage (Delirium pinnacle drop, không chance). :wiki-link{url="https://www.poe2wiki.net/wiki/Bones_of_Ullr" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22Bones%20of%20Ullr%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} (20-30)% (wording "Undead" nhưng áp mọi minion reserve flat Spirit). :wiki-link{url="https://www.poe2wiki.net/wiki/The_Hollow_Mask" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22The%20Hollow%20Mask%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} (80-100)% Remnant Skills.
- **Scale từ Spirit ra stat khác**: :wiki-link{url="https://www.poe2wiki.net/wiki/Threaded_Light" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22Threaded%20Light%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} (8-12)% Spell Damage per 10 Spirit; :wiki-link{url="https://www.poe2wiki.net/wiki/Amanamu's_Gaze" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22Amanamu's%20Gaze%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} +2 Armour per 1 Spirit (body) hoặc 1% MS per 15 Spirit cap 40% (boots). :wiki-link{url="https://www.poe2wiki.net/wiki/Kaom's_Heart" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22Kaom's%20Heart%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} "You have no Spirit" đổi +1500 Life.
- **Roll-pool**: Ventor's Gamble +(0-20), :wiki-link{url="https://www.poe2wiki.net/wiki/Morior_Invictus" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22Morior%20Invictus%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} +(10-14) per socket (max +56); :wiki-link{url="https://www.poe2wiki.net/wiki/Grip_of_Kulemak" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22name%22%3A%22Grip%20of%20Kulemak%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"}, Loreweave, The Unborn Lich roll desecrated pool có flat conditional + (6-10)% res eff. Từ 0.5.3, His Grave Command của :wiki-link{url="https://www.poe2wiki.net/wiki/The_Unborn_Lich"} không còn Spirit cost (trước reservation % như Tame Beast); mod pool desecrated staff không đổi.

## Passive tree + ascendancy

- Tree keo kiệt % Spirit: notable duy nhất Profane Commander 4% (+30% Presence AoE). Res eff theo skill type (anoint được):
  - **Herald**: 7 small (4×6%, 3×8%) + Fate Finding 20%.
  - **Companion**: 2 small 8% + Easy Going 25% (không lock ascendancy).
  - **Minion**: Lord of Horrors 12% (2 vị trí); Oracle-gated Self Sacrificing đổi −20% res eff toàn skill lấy +40% minion (net lời build thuần minion).
  - **Meta skill**: Efficient Inscriptions 20%.
  - **Penalty**: Gigantic Following −25% minion res eff đổi Gigantic (anoint damage/life, không tiết kiệm Spirit).
- Keystone: Trusted Kinship (rework 0.5.0: 2 companion khác type, 30% more companion res eff, 20% less skill khác — mix companion+aura lỗ phần aura), Lord of the Wilds (sceptre + Talisman, giá 50% less Spirit + non-minion 50% less res eff), Ancestral Bond (totem reserve 75 Spirit/totem, limit double, không cost).
- Ascendancy:
  - **Spirit Walker**: small +10 flat; Idolatry 2% res eff + companion 10% damage per Idol, phạt −4% all ele res mỗi augment không phải Idol (chi tiết [Spirit Walker companion beast hunt](/guides/spirit-walker-companion-beast-hunt)).
  - **Tactician**: small 8% increased Spirit; A Solid Plan "Persistent Buffs 50% less Reservation" (multiplier aura/herald mạnh nhất từ tree).
  - **Smith of Kitava**: Tribute to Utula "Body Armour 30% increased Spirit" (Enfolding Dawn +100 → +130).
  - **Infernalist**: Beidat's Will reserve 25% Life, +1 Spirit per 25 max Life (4.000 Life = +160).
  - **Shaman**: Sacred Flow +40 Spirit mỗi charm slot trống (max +160 với 4 slot).
  - **Invoker**: Lead me through Grace chặn MỌI Spirit từ equipment (kể cả sceptre), thay +1 per 20 Evasion / +1 per 8 ES trên body; The Soul Springs Eternal Meta Skills 50% increased res eff.
  - **Ritualist**: small bắt buộc 25% reduced Spirit trên đường tới Unfurled Finger.
  - **Acolyte of Chayula**: Embrace the Darkness bỏ Spirit hoàn toàn, thay Darkness (mọi modifier Spirit vô hiệu).
  - **Abyssal Lich**: small 6% minion res eff; Confined Exaltation 1% res eff per 20 Tribute; Spiritkeeper (jewel Undying Hate) 8% increased Spirit khi ≥100 Tribute.
- Liquid Emotions instil notable lên amulet (không stack với node đã allocate). The Soul Meridian discrepancy: GGG tree export không có res eff, poedb live ghi "10% increased Reservation Efficiency of Minion Skills" — đọc tooltip in-client.

## Rune, soul core, Idol

- :wiki-link{url="https://www.poe2wiki.net/wiki/Soul_Core_of_Azcapa" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22type%22%3A%22Soul%20Core%20of%20Azcapa%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"}: martial weapon +15 Spirit.
- Rune of the Blossom: body +50 Spirit nhưng −1 per 2 level (Lv94 còn +3 net, leveling).
- Greater Rune of Alacrity: Bonded martial weapon 15% res eff Herald.
- :wiki-link{url="https://www.poe2wiki.net/wiki/Mystic_Alloy" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22type%22%3A%22Mystic%20Alloy%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"}: league-exclusive, remove 1 mod random + add +(10-15) Spirit guaranteed lên boots (flat Spirit duy nhất trên boots).
- **Idol**: Rabbit Idol 15% increased Spirit trong sceptre, Limit 1 (từ 10% 0.5.0; Bonded = gold quantity, không phải Spirit); Bear Idol Bonded helmet 12% companion res eff; Idol of Ralakesh helmet 8% minion res eff base (không cần Bonded); Idol of Grold Bonded sceptre 15% companion res eff; Idol of Eeshta Bonded helmet 15% meta-skill res eff; Idol of the Pharisee (Bonded sceptre −25% minion res eff + 2 temporary minion limit); Idol of the Martyr (−25% Spirit + Meta Energy); Carved Majesty (Ancient Augment, Limit 1) body +3 Spirit per Idol socketed, Bonded +5% increased Spirit.
- Spirit Walker: mỗi augment không phải Idol = −4% all ele res qua Idolatry → khai delta resistance trước mọi swap.

## Gem level, quality, support

- Base reservation 3 tier: **30 Spirit** (35 gems: Herald, :wiki-link{url="https://www.poe2wiki.net/wiki/Ghost_Dance"}, Grim Feast, banners, Arctic Armour, Remnants of Kalguur…), **60 Spirit** (Wolf Pack, Blink, Elemental Conflux), **100 Spirit** (Trinity, Eternal Rage, Rhoa Mount).
- Minion gem ngược trực giác: **level cao reservation RẺ hơn**. Skeletal Brute 165→48 L1→L20, Skeletal Warrior 60→20, 2 Skeletal Warrior đầu free. Aura/herald base đứng yên. → đừng park minion gem level thấp; +Level to Minion Skills tăng damage-per-Spirit free.
- Quality res eff, cap khác nhau: 20% (Ghost Dance, Soul Crystal, Bind Spectre, Skeletal Frost Mage), 40% (Cast on Elemental Ailment, Feral Invocation, Lingering Illusion, Mirage Archer), 30% (Rhoa Mount), 10% (banners, companion gems, :wiki-link{url="https://www.poe2wiki.net/wiki/Blasphemy"}, Archmage). Companion quality copy từ Tame Beast lúc capture, nâng bằng :wiki-link{url="https://www.poe2wiki.net/wiki/Gemcutter's_Prism"} thẳng lên companion gem (test in-client Q0 → res eff tăng đúng). Q20 = 10% res eff, ~4-5 spirit/con trên base 39-47%. Cảnh giác corrupt: 0.5 gem Tame Beast 20+1 rớt về 20 khi capture — đừng trả tiền +1 corrupt đi tame.
- Support: **Giảm** — :wiki-link{url="https://www.poe2wiki.net/wiki/Dialla's_Desire" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22type%22%3A%22Dialla's%20Desire%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} (Lineage) Cost & Reservation Multiplier 90% + 1 level; :wiki-link{url="https://www.poe2wiki.net/wiki/Atziri's_Communion" trade="https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur?q=%7B%22query%22%3A%7B%22status%22%3A%7B%22option%22%3A%22online%22%7D%2C%22type%22%3A%22Atziri's%20Communion%22%7D%2C%22sort%22%3A%7B%22price%22%3A%22asc%22%7D%7D"} (Lineage) chuyển reservation sang Life 66% base Spirit (không support skill tạo minion; từ 0.5.1 Lich dùng được vì Eternal Life hết block Life Reservation; luật một-bản-mỗi-build xem [Lineage Support Gems](/guides/lineage-support-gems)). **Tăng** — Hulking Minions ×1.3 reservation; họ support aura-style +Additional Reservation +10 tới +40 (Precision/Clarity +10/+20, Vitality +20/+40, Direstrike/Thornskin +20/+40, Mysticism/Upwelling/Herbalism/Cannibalism +15/+30…). Invocation cấm cửa: không support skill có Reservation.

## Trick xếp hạng theo impact

1. **Granted skill = Spirit free**: Sylvan's Effigy, The Coming Calamity, Guiding Palm… mua 60–90 Spirit hiệu dụng bằng một item slot.
2. **Matsya**: 50% less mọi skill, multiplicative sau res eff, từ Act 2.
3. **A Solid Plan (Tactician)**: halve mọi persistent buff bằng một notable.
4. **Trusted Kinship cho build thuần companion**: 30% more companion res eff; mix herald/aura thì ăn 20% less.
5. **Atziri's Communion**: đẩy buff sang Life reservation 66% base, giải phóng pool Spirit cho minion.
6. **Idol stacking trên Spirit Walker**: Idolatry + Carved Majesty + Rabbit Idol scale cùng biến đếm Idol.
7. **Level minion gem LÊN để giảm cost**: Brute 165→48; first-2-free của Skeletal Warrior.
8. **Quality persistent gems**: 20-40% res eff chỉ tốn Gemcutter.
9. **Sceptre stacking**: King's + double-corrupt Intrinsic ≈ 225 Spirit; Smith of Kitava amplify body +30%.
10. **Sacred Flow charm-less**: 4 slot trống = +160 Spirit.
11. **Beidat's Will**: +1 per 25 Life (đi kèm Vaal Pact / Enduring Elixirs để sống với Life pool bị reserve).
12. **Weapon-set passive points**: 24 điểm mỗi set, pool Spirit tách theo set.

## Áp vào ThaoCamVienSaiGon

Ledger 347 Spirit all-on vừa khít, build ở [Tame Beast Companion Pack](/builds/huntress/0-5-spirit-walker-companion-pack). Thứ tự múc theo lời-trên-giá:

- **Làm ngay (gần free)**: Easy Going + 2 small companion 8% bằng weapon-set-1 points (24 điểm set-1, +41pp res eff lên ~300 Spirit companion → giải phóng 55–80 Spirit). Idol of Grold vào socket Sylvan's Effigy (thay idol Attack Speed; 15% companion res eff ≈ 25–35 Spirit freed, idol đổi idol nên Idolatry không đổi). Check Uhtred's Boon (+10 permanent nếu 347 chưa gồm).
- **Tốn currency**: Abyss jewel hệ Kulemak (+(40-60) flat + (6-10)% res eff một mod, thay 1 trong 5 Sapphire — Zekoa mất 21-25% crit damage, cân trước). Mystic Alloy lên boots (+(10-15) flat, bắn vào boots đã roll đủ life/res/MS). Helm rune → Idol of Ralakesh/Bear Idol Bonded (res eff giữ/nhỉnh, xoá một non-Idol augment lấy lại 4% all ele res, đổi lại mất Minions 15% max Life).
- **Situational (khai delta trước)**: Anoint Gigantic Following ↔ Lord of Horrors (swap = +37pp minion res eff ≈ 60–90 Spirit freed, mất Gigantic 20% more damage + 20% more life; build chốt giữ Gigantic, cắt Bramble Hulk). Divine Sylvan's Effigy nếu % Spirit chưa max (mỗi 10pp ≈ +15-17 Spirit, Divine roll lại cả hai dòng). Soul Core of Azcapa vào Tyranny's Grip (+15 flat nhưng chiếm socket rune phys nuôi Catha + non-Idol augment). Gemcutter's Prism lên companion gem còn Q0 (4 viên ra Q20 = 10% res eff ~4-5 spirit/con; trio active đã Q20).
- **Bỏ qua**: Rune of the Blossom (+3 net Lv94), Vaal/double-corrupt Skull Corona (brick risk helm đã curate), Carved Majesty đặt body (Limit 1 đã dành cho gloves lấy Onslaught).

## Cái không hoạt động

- ✗ **Gemling Legionnaire "Integrated Efficiency"**: icon nội bộ `GemlingBuffSkillsReserveLessSpirit` là legacy; node 0.5 không có stat Spirit/reservation nào. "Skills have 30% less cost" của Gem Studded Blue là mana/life cost, chưa có bằng chứng áp lên Spirit.
- ✗ **Res eff với reservation ngoài skill**: Widow's Reign, Blood Price đứng ngoài công thức.
- ✗ **Spirit mods dưới Embrace the Darkness**: Acolyte of Chayula vô hiệu mọi modifier Spirit.
- ✗ **Rabbit Idol Bonded**: dòng Bonded là gold quantity; phần Spirit 15% ở base stat sceptre, không double-dip.

## Chưa chốt in-client

- Flat Spirit trên gear đắt hơn res eff đa số trường hợp: suffix of Amanamu (6-12)% trên body thường rẻ hơn nhiều prefix Queen's +(57-61) cùng slot.
- Dòng minion res eff của The Soul Meridian (GGG tree export vs poedb vênh nhau); Atziri's Communion có thực sự drop trong league chưa (wiki scrape còn flag "Not in game"); giá đường nâng Masterwork Rune so với mua Perfect thẳng.

## Version History

### Patch 0.5.3
Amanamu's Staff Prefix thêm bản thứ hai cho Gain 40–50% of Damage as Extra Chaos Damage; prefix flat Spirit +(35-50) vẫn song song. His Grave Command của :wiki-link{url="https://www.poe2wiki.net/wiki/The_Unborn_Lich"} bỏ Spirit cost; quality gem đổi từ Reservation Efficiency sang +Minion Life.

### Patch 0.5.2
Bear Spirit (Wild Protector) presence radius 4m → 8m; companion granted vẫn 0 Spirit, 0 limit slot.

### Patch 0.5.1
Eternal Life của Lich hết block Life Reservation, mở Atziri's Communion + Beidat's Will cho archetype này.

### Patch 0.5.0 (Return of the Ancients)
Trusted Kinship rework (bỏ 30% less Defences, thêm cặp 30% more / 20% less res eff); Ancestral Bond chuyển totem reserve 75 Spirit; Soul Mantle đổi reduced Totem Life thành +75 Spirit; Rabbit Idol 10%→15% kèm Limit 1, Bear Idol 10%→12%; prefix Lord's fix về 20-26% (trước overlap 30-36%); The Hollow Mask rework sang (80-100)% Remnant res eff; Idol of Uldurn thêm 10-15% increased Spirit; Tame Beast summon ngay khi đủ Spirit; Dialla's Desire fix bug disabled-vẫn-ăn-hiệu-ứng, quality bonus 10%→5%.

## Relationships

- **related** [Spirit Walker companion beast hunt](/guides/spirit-walker-companion-beast-hunt) — Idolatry + hệ companion ăn trực tiếp vào ledger Spirit.
- **related** [Tame Beast Companion Pack](/builds/huntress/0-5-spirit-walker-companion-pack) — build đang áp toàn bộ thứ tự múc trên.
- **related** [Lineage Support Gems](/guides/lineage-support-gems) — Dialla's Desire + Atziri's Communion can thiệp reservation.
- **related** [Cách chơi Ocean Exploring](/guides/0-5-ocean-exploring) — chain The Grand Expedition trả Uhtred's Boon +10 Spirit.
- **farming_relevance** [Raven Boss Rush Farming](/farming/0-5-raven-boss-rush-farm) — The Raven's Flock là minion staff scale spirit reservation, bối cảnh cho vì sao nó kén người mua.
- **related** [ThaoCamVienSaiGon — Progress Tracker](/characters/thao-cam-vien-sai-gon) — quản spirit cho nguyên đàn.
- **related_builds** [Lich Soul Crystal Undead Companion](/builds/witch/0-5-lich-soul-crystal-undead) — cơ chế Soul Crystal vẫn reserve Spirit dù cast-skill free.
- **related_mechanics** [Craft amulet top-tier cho companion build](/crafting/0-5-plus4-minion-amulet) — Spirit trên amulet là nguồn spirit chính cho roster.
