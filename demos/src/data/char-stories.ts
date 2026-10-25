// 36 distinct mini-stories — one for each character in 《三十六个字》.
// Every character has its own topic, opening hook, evolution turn, and closer
// (never repeating a generic "Long, long ago..." template).
import type { Tri } from '../i18n';

const T = (en: string, zhs: string, zht: string): Tri => ({ en, zhs, zht });

export interface CharStory {
  topic: Tri;
  hook: Tri;
  rotate?: Tri;
  early?: Tri;
  turn?: Tri;
  closer: Tri;
}

export const CHAR_STORIES: Record<string, CharStory> = {
  // ---- Unit 1: Dawn in the Valley ----------------------------------------------------------------
  日: {
    topic: T('Catching the Morning Sun', '留住清晨的太阳', '留住清晨的太陽'),
    hook: T(
      'Roosters crow! Up in the morning sky shines a warm, round ball of light.',
      '公鸡喔喔叫！清晨的天空上，挂着一轮暖洋洋的圆太阳。',
      '公雞喔喔叫！清晨的天空上，掛著一輪暖洋洋的圓太陽。',
    ),
    early: T(
      'Carving a round circle on hard bone with a knife was tricky, so carvers made an outline with a bright mark in the middle.',
      '拿小刀在坚硬的骨头上刻圆圈可不容易，于是刻字的人刻出边框，中间加上代表光芒的一笔。',
      '拿小刀在堅硬的骨頭上刻圓圈可不容易，於是刻字的人刻出邊框，中間加上代表光芒的一筆。',
    ),
    turn: T(
      'When brushes replaced knives, the round sun squared off into a neat window with one horizontal bar inside.',
      '后来毛笔代替了刻刀，圆圆的太阳就变成了方方正正的框，中间留着一横。',
      '後來毛筆代替了刻刀，圓圓的太陽就變成了方方正正的框，中間留著一橫。',
    ),
    closer: T(
      'That bright sky-window is 日, the sun — and also a whole day from sunrise to sunset!',
      '这扇装满阳光的小窗户就是“日”——既是太阳，也代表从早到晚的一整天！',
      '這扇裝滿陽光的小窗戶就是「日」——既是太陽，也代表從早到晚的一整天！',
    ),
  },
  山: {
    topic: T('Three Peaks in the Clouds', '云端的三座山峰', '雲端的三座山峰'),
    hook: T(
      'Look out at the horizon: three rocky peaks stand shoulder to shoulder, with the tallest peak right in the middle.',
      '往远处望去：三座山峰肩并着肩立在大地上，中间的主峰最高。',
      '往遠處望去：三座山峰肩並著肩立在大地上，中間的主峰最高。',
    ),
    early: T(
      'On oracle bones and bronze pots, the three peaks were drawn like a crown of stone.',
      '在甲骨和青铜器上，三座山峰被刻得像一顶石头王冠。',
      '在甲骨和青銅器上，三座山峰被刻得像一頂石頭王冠。',
    ),
    turn: T(
      'Over time, each peak became a clean vertical stroke standing on one solid base.',
      '慢慢地，三座山峰简化成三根挺拔的竖画，稳稳地立在一条底线上。',
      '慢慢地，三座山峰簡化成三根挺拔的豎畫，穩穩地立在一條底線上。',
    ),
    closer: T(
      'Three upright strokes connected at the bottom: that is 山, mountain!',
      '三根竖画连着底座，这就是高山的“山”！',
      '三根豎畫連著底座，這就是高山的「山」！',
    ),
  },
  水: {
    topic: T('The Rushing Mountain Stream', '哗哗流淌的溪水', '嘩嘩流淌的溪水'),
    hook: T(
      'Listen — splash, gurgle! Melted snow tumbles down the valley in a winding stream, kicking up droplets on both sides.',
      '听——哗啦啦！山上融化的雪水顺着山谷蜿蜒流下，两边溅起晶莹的水花。',
      '聽——嘩啦啦！山上融化的雪水順著山谷蜿蜒流下，兩邊濺起晶瑩的水花。',
    ),
    early: T(
      'The center wave is the deep current, and the short ticks on left and right are the splashes.',
      '中间弯弯曲曲的一道是湍急的主流，左右两边的小短线就是飞溅的水滴。',
      '中間彎彎曲曲的一道是湍急的主流，左右兩邊的小短線就是飛濺的水滴。',
    ),
    turn: T(
      'In brush writing, the middle current straightened into a hooked vertical spine, while the splashes joined into side strokes.',
      '到了毛笔字里，中间的水流拉直成挺拔的竖钩，两边的水花也连成了撇和捺。',
      '到了毛筆字裡，中間的水流拉直成挺拔的豎鉤，兩邊的水花也連成了撇和捺。',
    ),
    closer: T(
      'Whenever you see 水 — or its three-drop sidekick 氵 — something wet and flowing is nearby!',
      '看到“水”或者三点水，就知道一定和水流有关啦！',
      '看到「水」或者三點水，就知道一定和水流有關啦！',
    ),
  },
  木: {
    topic: T('Branches Above, Roots Below', '上伸枝丫、下扎树根', '上伸枝丫、下扎樹根'),
    hook: T(
      'A single tree stands by the riverbank: green branches reaching up for sunlight, and roots gripping the soil underground.',
      '河岸边立着一棵树：树枝向上迎着阳光，树根向下紧紧抓住泥土。',
      '河岸邊立著一棵樹：樹枝向上迎著陽光，樹根向下緊緊抓住泥土。',
    ),
    early: T(
      'Even without leaves, the carved shape is unmistakable: a trunk in the middle, two branches curving up, and two roots curving down.',
      '就算不画树叶，刻出来的样子也一目了然：中间是树干，上面两根分叉是树枝，下面两根分叉是树根。',
      '就算不畫樹葉，刻出來的樣子也一目了然：中間是樹幹，上面兩根分叉是樹枝，下面兩根分叉是樹根。',
    ),
    turn: T(
      'Later, the upward branches flattened into a clean crossbar, while the roots swept out left and right.',
      '后来，向上的树枝变成了一道平平的横画，下面的树根化作了舒展的撇和捺。',
      '後來，向上的樹枝變成了一道平平的橫畫，下面的樹根化作了舒展的撇和捺。',
    ),
    closer: T(
      'That is 木, tree and wood — the building block for hundreds of plant and forest characters!',
      '这就是树木的“木”——许许多多和植物、木材有关的字，都是由它搭出来的！',
      '這就是樹木的「木」——許許多多和植物、木材有關的字，都是由它搭出來的！',
    ),
  },
  林: {
    topic: T('One Tree Meets Another', '两棵树做伴成树林', '兩棵樹做伴成樹林'),
    hook: T(
      'How do you draw a whole forest without spending all afternoon drawing trees? Put two trees side by side!',
      '要想画出一片树林，难道要画上一整天吗？聪明的人把两棵树并排画在一起！',
      '要想畫出一片樹林，難道要畫上一整天嗎？聰明的人把兩棵樹並排畫在一起！',
    ),
    early: T(
      'Carvers placed one 木 next to another 木: two trunks, two canopies, sharing the same patch of earth.',
      '刻字的人把两个“木”并排放在一起：两根树干、两丛枝丫，肩并肩长在同一片土地上。',
      '刻字的人把兩個「木」並排放在一起：兩根樹幹、兩叢枝丫，肩並肩長在同一片土地上。',
    ),
    turn: T(
      'Notice how the left tree tucks its right root in politely so the two trees don’t bump into each other!',
      '仔细看：左边那棵树礼貌地把右边的一捺收成了一点，这样两棵树就不会挤在一起啦！',
      '仔細看：左邊那棵樹禮貌地把右邊的一捺收成了一點，這樣兩棵樹就不會擠在一起啦！',
    ),
    closer: T(
      'One tree is 木, two trees make 林 (woods), and three trees stacked together make 森 (deep forest)!',
      '独木不成林：一棵树是“木”，两棵树是“林”，三棵树叠在一起就是大森林的“森”！',
      '獨木不成林：一棵樹是「木」，兩棵樹是「林」，三棵樹疊在一起就是大森林的「森」！',
    ),
  },
  鸟: {
    topic: T('The Songbird on the Branch', '枝头唱歌的小鸟', '枝頭唱歌的小鳥'),
    hook: T(
      'Chirp, chirp! A little songbird perches sideways so you can see its pointed beak, round eye, folded wing, and tail feathers.',
      '叽叽喳喳！一只小鸟侧身站在枝头，尖尖的嘴、圆圆的眼、收起的翅膀和翘起的尾羽全都看得清清楚楚。',
      '嘰嘰喳喳！一隻小鳥側身站在枝頭，尖尖的嘴、圓圓的眼、收起的翅膀和翹起的尾羽全都看得清清楚楚。',
    ),
    early: T(
      'In oracle bone and bronze scripts, the bird stands proudly with its crest raised and claws gripping tight.',
      '在甲骨文和金文里，小鸟昂着头冠，小爪子稳稳地抓着树枝。',
      '在甲骨文和金文裡，小鳥昂著頭冠，小爪子穩穩地抓著樹枝。',
    ),
    turn: T(
      'In regular script 鳥, the eye became a dot inside the head, and the four little strokes at the bottom show its tail feathers and claws.',
      '到了楷书“鳥”，眼睛变成了头里的一点，底下的四个点则是它的尾羽和爪子。',
      '到了楷書「鳥」，眼睛變成了頭裡的一點，底下的四個點則是它的尾羽和爪子。',
    ),
    closer: T(
      'Whether written 鳥 or simplified 鸟, that little dot in the head is still the bird’s bright eye!',
      '不管是繁体的“鳥”还是简体的“鸟”，脑袋里那一点，依然是小鸟亮晶晶的眼睛！',
      '不管是繁體的「鳥」還是簡體的「鳥」，腦袋裡那一點，依然是小鳥亮晶晶的眼睛！',
    ),
  },

  // ---- Unit 2: Across the Countryside ------------------------------------------------------------
  象: {
    topic: T('The Giant with a Curling Trunk', '长鼻弯弯的大象', '長鼻彎彎的大象'),
    hook: T(
      'Three thousand years ago, wild elephants roamed the Yellow River valley! Their most famous feature was that long, curling trunk.',
      '三千年前，黄河流域还生活着野生大象！大象最醒目的标志，就是那根又长又弯的鼻子。',
      '三千年前，黃河流域還生活著野生大象！大象最醒目的標誌，就是那根又長又彎的鼻子。',
    ),
    rotate: T(
      'Oracle bones were carved in narrow vertical columns — so the big elephant stood up on its hind legs, trunk pointing to the sky!',
      '因为甲骨文是一列一列竖着刻的，大象只好后腿站立、把长鼻子高高举向天空！',
      '因為甲骨文是一列一列豎著刻的，大象只好後腿站立、把長鼻子高高舉向天空！',
    ),
    early: T(
      'Look at the top of the carving: that hooked curve is the elephant’s trunk, above its heavy body and four legs.',
      '看刻字的最顶上：那道弯弯的钩就是象鼻，下面是圆滚滚的身子和四条粗腿。',
      '看刻字的最頂上：那道彎彎的鉤就是象鼻，下面是圓滾滾的身子和四條粗腿。',
    ),
    turn: T(
      'As centuries passed, the curling trunk stayed right at the top of 象, while the legs fanned out into sweeping strokes below.',
      '几千年过去，“象”字最顶上依然保留着弯弯的象鼻，下面的象腿则化作了舒展的笔画。',
      '幾千年過去，「象」字最頂上依然保留著彎彎的象鼻，下面的象腿則化作了舒展的筆畫。',
    ),
    closer: T(
      'Look at the top of 象 today: you can still spot the elephant’s curling trunk!',
      '今天再看“象”字的最上面，你还能一眼认出大象弯弯的长鼻子！',
      '今天再看「象」字的最上面，你還能一眼認出大象彎彎的長鼻子！',
    ),
  },
  草: {
    topic: T('Spring Sprouts After Rain', '春雨后的嫩草芽', '春雨後的嫩草芽'),
    hook: T(
      'After a warm spring rain, tiny green shoots push their way up through the soil, two leaves unfurling on each stem.',
      '一场温暖的春雨过后，嫩绿的小草芽钻出泥土，每根茎上都展开两片小叶。',
      '一場溫暖的春雨過後，嫩綠的小草芽鑽出泥土，每根莖上都展開兩片小葉。',
    ),
    early: T(
      'Two little sprouts side by side formed 艸 — the original character for grass and herbs.',
      '两棵小草芽并排长在一起，就是“艸”——这是“草”最早的样子。',
      '兩棵小草芽並排長在一起，就是「艸」——這是「草」最早的樣子。',
    ),
    turn: T(
      'Later, the two sprouts became the grass crown 艹 on top, and 早 (“early morning”) was added underneath to give its sound!',
      '后来，两棵小芽变成了顶上的草字头“艹”，下面加上“早”字来提示它的读音！',
      '後來，兩棵小芽變成了頂上的草字頭「艹」，下面加上「早」字來提示它的讀音！',
    ),
    closer: T(
      'That gives us 草: green sprouts on top, morning sun below!',
      '顶上是嫩绿的草芽，下面是清晨的“早”，合起来就是小草的“草”！',
      '頂上是嫩綠的草芽，下面是清晨的「早」，合起來就是小草的「草」！',
    ),
  },
  田: {
    topic: T('A Bird’s-Eye View of Farmland', '从山顶俯瞰农田', '從山頂俯瞰農田'),
    hook: T(
      'Climb to the top of a hill and look down at the valley: farmers have divided the flat earth into neat square plots crossed by ditches and footpaths.',
      '爬到山顶往下看：农夫们用田埂和水渠，把平平整整的土地分成了一块块方格。',
      '爬到山頂往下看：農夫們用田埂和水渠，把平平整整的土地分成了一塊塊方格。',
    ),
    early: T(
      'On oracle bone No. 6057, 田 is carved as a crisp rectangle divided into four plots — and on the Da Yu ding bronze, it appears again!',
      '在6057号甲骨上，“田”被刻成分成四格的方框；在大盂鼎的青铜铭文上，也能找到它！',
      '在6057號甲骨上，「田」被刻成分成四格的方框；在大盂鼎的青銅銘文上，也能找到它！',
    ),
    turn: T(
      'In three thousand years, this character barely changed at all — an outer boundary with a cross of paths inside.',
      '三千年过去了，这个字几乎一点儿也没变——外面一圈田界，中间十字田埂。',
      '三千年過去了，這個字幾乎一點兒也沒變——外面一圈田界，中間十字田埂。',
    ),
    closer: T(
      'Four little squares inside one big square: that is 田, field!',
      '大口里面加十字，分成四块小方格，这就是农田的“田”！',
      '大口裡面加十字，分成四塊小方格，這就是農田的「田」！',
    ),
  },
  竹: {
    topic: T('Whispering Bamboo Leaves', '风中垂叶的翠竹', '風中垂葉的翠竹'),
    hook: T(
      'Rustle, rustle… Slender bamboo stalks bend in the breeze, their pointed leaves drooping down like little green feathers.',
      '沙沙沙……细长的竹枝在微风里轻轻摇晃，尖尖的竹叶像绿羽毛一样垂下来。',
      '沙沙沙……細長的竹枝在微風裡輕輕搖晃，尖尖的竹葉像綠羽毛一樣垂下來。',
    ),
    early: T(
      'Before paper was invented, people split bamboo into strips and tied them together into books — so they knew bamboo well!',
      '在纸发明以前，古人把竹子劈成竹简、编成书册，所以天天都和竹子打交道！',
      '在紙發明以前，古人把竹子劈成竹簡、編成書冊，所以天天都和竹子打交道！',
    ),
    turn: T(
      'Each half of 竹 is one bamboo stem with drooping leaves; side by side, they form a bamboo grove.',
      '“竹”字的左右两边各是一根垂下叶子的竹枝，并排站在一起就是一片翠竹。',
      '「竹」字的左右兩邊各是一根垂下葉子的竹枝，並排站在一起就是一片翠竹。',
    ),
    closer: T(
      'Stand two leafy bamboo stalks side by side and you get 竹, bamboo!',
      '两根挂着竹叶的竹竿并排站，就是竹子的“竹”！',
      '兩根掛著竹葉的竹竿並排站，就是竹子的「竹」！',
    ),
  },
  马: {
    topic: T('The Galloping Steed', '迎风奔跑的骏马', '迎風奔跑的駿馬'),
    hook: T(
      'Clip-clop, clip-clop! A spirited horse gallops across the plain, its thick mane and long tail streaming in the wind.',
      '得儿驾！一匹骏马在原野上飞奔，浓密的马鬃和长长的马尾在风中飞扬。',
      '得兒駕！一匹駿馬在原野上飛奔，濃密的馬鬃和長長的馬尾在風中飛揚。',
    ),
    rotate: T(
      'Just like the elephant, the horse was stood upright on its tail so it could fit into a vertical column of writing!',
      '跟大象一样，为了写进窄窄的竖行里，骏马也竖着站了起来！',
      '跟大象一樣，為了寫進窄窄的豎行裡，駿馬也豎著站了起來！',
    ),
    early: T(
      'In the ancient carvings, you can spot its big eye, flowing mane along the back, four hooves, and sweeping tail.',
      '在古老的字形里，你能看到它大大的眼睛、脖子后一排马鬃、四条腿和长尾巴。',
      '在古老的字形裡，你能看到牠大大的眼睛、脖子後一排馬鬃、四條腿和長尾巴。',
    ),
    turn: T(
      'In regular script 馬, the mane became three horizontal strokes, and the four hooves turned into four dots at the bottom.',
      '到了楷书“馬”，马鬃变成了上面的横画，四只马蹄变成了底下的四个点。',
      '到了楷書「馬」，馬鬃變成了上面的橫畫，四隻馬蹄變成了底下的四個點。',
    ),
    closer: T(
      'And in simplified 马, the four galloping hooves are swept together into one fast horizontal stroke!',
      '而在简化字“马”里，奔跑的四只马蹄一笔连成了一道飞快的横画！',
      '而在簡化字「马」裡，奔跑的四隻馬蹄一筆連成了一道飛快的橫畫！',
    ),
  },
  夫: {
    topic: T('The Grown-Up’s Hairpin', '束发插簪的大人', '束髮插簪的大人'),
    hook: T(
      'In ancient China, when a boy grew up into a man, his family held a special ceremony: they tied his hair into a topknot and slid a pin through it.',
      '在古代中国，男孩长大成人时要行“冠礼”：把长发束在头顶，庄重地插上一根发簪。',
      '在古代中國，男孩長大成人時要行「冠禮」：把長髮束在頭頂，莊重地插上一根髮簪。',
    ),
    early: T(
      'Look at the bronze inscription on the Da Yu ding: a standing person (大) with one horizontal bar — the hairpin — right across the top!',
      '看大盂鼎铭文上的字形：一个张开双臂站立的大人（大），头顶正中横穿一根发簪！',
      '看大盂鼎銘文上的字形：一個張開雙臂站立的大人（大），頭頂正中橫穿一根髮簪！',
    ),
    turn: T(
      'In seal and regular scripts, the person’s arms became the lower horizontal stroke, and the hairpin became the top stroke.',
      '到了篆书和楷书里，张开的双臂变成了下面一横，头顶的发簪则是上面那一横。',
      '到了篆書和楷書裡，張開的雙臂變成了下面一橫，頭頂的髮簪則是上面那一橫。',
    ),
    closer: T(
      'Write 大 for a big person, push a hairpin stroke through the top, and you have 夫 — a grown man!',
      '先写一个大人的“大”，头顶再加一根发簪，就是长大成人的“夫”！',
      '先寫一個大人的「大」，頭頂再加一根髮簪，就是長大成人的「夫」！',
    ),
  },

  // ---- Unit 3: A Day on the River ----------------------------------------------------------------
  刀: {
    topic: T('The Curved Bronze Blade', '弯弯的青铜刀', '彎彎的青銅刀'),
    hook: T(
      'Before heading to the river, a craftsman picks up his bronze knife: a sturdy handle on top and a curved single-edged blade below.',
      '去河边之前，工匠拿起随身的青铜刀：上面是握手的刀柄，下面是弯弯的单面刀刃。',
      '去河邊之前，工匠拿起隨身的青銅刀：上面是握手的刀柄，下面是彎彎的單面刀刃。',
    ),
    turn: T(
      'From bone to bronze to brush, the back of the knife stayed strong and angled, while the cutting edge swept down in a curve.',
      '从甲骨、青铜一直到毛笔字，刀背始终厚实有力，刀刃则弯弯地向下延伸。',
      '從甲骨、青銅一直到毛筆字，刀背始終厚實有力，刀刃則彎彎地向下延伸。',
    ),
    closer: T(
      'Two brisk strokes — one hooked back, one sweeping blade — form 刀, knife!',
      '一笔横折钩做刀背，一笔长撇做刀刃，两笔就写出锋利的“刀”！',
      '一筆橫折鉤做刀背，一筆長撇做刀刃，兩筆就寫出鋒利的「刀」！',
    ),
  },
  舟: {
    topic: T('The Little Wooden Boat', '木板拼成的小船', '木板拼成的小船'),
    hook: T(
      'Push off from the shore! A narrow wooden boat glides onto the water, its curved hull held together by cross-planks.',
      '撑船离岸喽！一叶窄窄的小木船滑入水中，弯弯的船身中间横着几块木板。',
      '撐船離岸囉！一葉窄窄的小木船滑入水中，彎彎的船身中間橫著幾塊木板。',
    ),
    turn: T(
      'Drawn upright on bone and bronze, the boat looks like a tiny ladder with curved ends — the bow at the top and stern at the bottom.',
      '竖着刻在甲骨和铜器上时，小船像一架两头微翘的小梯子——船头朝上，船尾朝下。',
      '豎著刻在甲骨和銅器上時，小船像一架兩頭微翹的小梯子——船頭朝上，船尾朝下。',
    ),
    closer: T(
      'Today 舟 still keeps its arched hull and cross-ribs — and sits on the left of boat words like 船 and 航!',
      '今天的“舟”依然保留着船身和横木，还常常用作“船”和“航”的偏旁！',
      '今天的「舟」依然保留著船身和橫木，還常常用作「船」和「航」的偏旁！',
    ),
  },
  鱼: {
    topic: T('The Leaping River Fish', '跃出水面的小鱼', '躍出水面的小魚'),
    hook: T(
      'Plop! A silver fish leaps straight up out of the river — pointed head at the top, scaly body in the middle, and forked tail at the bottom.',
      '扑通！一条银亮的小鱼跃出水面——尖尖的鱼头朝上，带鳞的身子居中，分叉的鱼尾朝下。',
      '撲通！一條銀亮的小魚躍出水面——尖尖的魚頭朝上，帶鱗的身子居中，分叉的魚尾朝下。',
    ),
    turn: T(
      'In seal and regular script 魚, the scaly body became a checkered 田 shape, and the forked tail split into four little dots.',
      '到了篆书和楷书“魚”，带鳞的鱼身变成了“田”字格，分叉的鱼尾变成了底下的四个点。',
      '到了篆書和楷書「魚」，帶鱗的魚身變成了「田」字格，分叉的魚尾變成了底下的四個點。',
    ),
    closer: T(
      'In simplified 鱼, those four tail-dots join into one smooth horizontal bar at the bottom!',
      '到了简化字“鱼”，底下的四点鱼尾又连成了一道稳稳的横画！',
      '到了簡化字「鱼」，底下的四點魚尾又連成了一道穩穩的橫畫！',
    ),
  },
  网: {
    topic: T('The Fisherman’s Woven Net', '绳结交错的渔网', '繩結交錯的漁網'),
    hook: T(
      'To catch fish in the river, you weave hemp cords into a crisscross mesh stretched between two poles.',
      '要想在河里捕鱼，就要把麻绳编成交叉的网眼，张在两根木杆之间。',
      '要想在河裡捕魚，就要把麻繩編成交叉的網眼，張在兩根木杆之間。',
    ),
    turn: T(
      'Later scribes added the silk radical 糸 and wrote 網 — a very complex character with fourteen strokes!',
      '后来人们在旁边加上绞丝旁，写成了十四画的繁体“網”，表示用丝绳编织。',
      '後來人們在旁邊加上糸字旁，寫成了十四畫的「網」，表示用絲繩編織。',
    ),
    closer: T(
      'Then simplified Chinese went right back to the original 3,000-year-old picture: an outer frame with two crossed meshes inside — 网!',
      '而简化字直接回到了三千年前最初的模样：外框里面两个叉，就是渔网的“网”！',
      '而簡化字直接回到了三千年前最初的模樣：外框裡面兩個叉，就是漁網的「网」！',
    ),
  },
  燕: {
    topic: T('The Fork-Tailed Swallow', '剪刀尾巴的春燕', '剪刀尾巴的春燕'),
    hook: T(
      'Skimming low over the water flies a spring swallow: open beak in front, wide wings on left and right, and a scissor-like forked tail behind!',
      '一只春燕贴着水面掠过：前头是张开的小嘴，左右是展开的翅膀，后面拖着剪刀似的分叉尾巴！',
      '一隻春燕貼著水面掠過：前頭是張開的小嘴，左右是展開的翅膀，後面拖著剪刀似的分叉尾巴！',
    ),
    turn: T(
      'Seen from above as it soars upward, every part of the swallow stayed in place from oracle bone to seal script.',
      '从上往下看这只向上飞翔的燕子，从甲骨文到篆书，它的头、身、翅、尾全都一一对应。',
      '從上往下看這隻向上飛翔的燕子，從甲骨文到篆書，牠的頭、身、翅、尾全都一一對應。',
    ),
    closer: T(
      'Even in today’s 燕, the top is the head, 北 on the sides are the two wings, and the four dots below are the tail!',
      '就算在今天的“燕”字里，顶上依然是燕头，两边的“北”是双翅，底下四点就是燕尾！',
      '就算在今天的「燕」字裡，頂上依然是燕頭，兩邊的「北」是雙翅，底下四點就是燕尾！',
    ),
  },
  云: {
    topic: T('Curling Clouds in the Sky', '天边卷曲的白云', '天邊捲曲的白雲'),
    hook: T(
      'High above the river, soft white clouds drift and curl in the wind.',
      '小河上空，软绵绵的白云随着风儿轻轻打卷。',
      '小河上空，軟綿綿的白雲隨著風兒輕輕打捲。',
    ),
    turn: T(
      'The oldest 云 was simply two sky lines above a curling swirl of vapor. Later, 雨 (rain) was placed on top to make 雲.',
      '最早的“云”上面是两横天空，下面是一团卷曲的云气。后来人们在顶上加上“雨”，写成了“雲”。',
      '最早的「云」上面是兩橫天空，下面是一團捲曲的雲氣。後來人們在頂上加上「雨」，寫成了「雲」。',
    ),
    closer: T(
      'Today’s simplified 云 returned to that ancient curling cloud shape from three thousand years ago!',
      '今天的简化字“云”，又回到了三千年前那朵卷卷的古云朵！',
      '今天的簡化字「云」，又回到了三千年前那朵捲捲的古雲朵！',
    ),
  },

  // ---- Unit 4: Shelter from the Storm ------------------------------------------------------------
  雨: {
    topic: T('Raindrops from the Sky', '从天而降的雨滴', '從天而降的雨滴'),
    hook: T(
      'Dark clouds gather and — pitter-patter! — rows of raindrops fall from the sky.',
      '乌云聚拢过来——淅淅沥沥！一串串雨点从天空中落下来。',
      '烏雲聚攏過來——淅淅瀝瀝！一串串雨點從天空中落下來。',
    ),
    turn: T(
      'On the 3,000-year-old Da Yu ding cauldron, 雨 is an arched sky dome with vertical streaks of falling drops.',
      '在三千年前的大盂鼎铭文上，“雨”是弯弯的天空下面落下一排排雨滴。',
      '在三千年前的大盂鼎銘文上，「雨」是彎彎的天空下面落下一排排雨滴。',
    ),
    closer: T(
      'In today’s 雨, the top bar is the sky, the frame is the cloud, and the four dots inside are raindrops on the window!',
      '在今天的“雨”字里，顶上一横是天空，方框是云层，里面的四个点就是落下的雨滴！',
      '在今天的「雨」字裡，頂上一橫是天空，方框是雲層，裡面的四個點就是落下的雨滴！',
    ),
  },
  伞: {
    topic: T('Pop Open the Umbrella!', '撑开一把小雨伞', '撐開一把小雨傘'),
    hook: T(
      'When the rain pours down, pop! Up goes a wide round canopy held up by ribs on a central handle.',
      '大雨哗哗下起来，啪！一把圆圆的雨伞撑开了，伞骨支着伞面，中间立着伞柄。',
      '大雨嘩嘩下起來，啪！一把圓圓的雨傘撐開了，傘骨支著傘面，中間立著傘柄。',
    ),
    closer: T(
      '伞 has no oracle-bone or bronze carvings because folding umbrellas were invented later — yet the character itself looks just like an open umbrella!',
      '因为折叠伞发明得比较晚，“伞”没有甲骨文和金文——可你看它的样子，活脱脱就是一把撑开的伞！',
      '因為折疊傘發明得比較晚，「傘」沒有甲骨文和金文——可你看它的樣子，活脫脫就是一把撐開的傘！',
    ),
  },
  石: {
    topic: T('The Boulder Under the Cliff', '山崖下的大石头', '山崖下的大石頭'),
    hook: T(
      'To stay dry in the storm, duck under an overhanging rock cliff! Right at the foot of the cliff sits a solid boulder.',
      '下大雨了，快到突出的山崖下躲一躲！山崖底下，正躺着一块结实的大石头。',
      '下大雨了，快到突出的山崖下躲一躲！山崖底下，正躺著一塊結實的大石頭。',
    ),
    turn: T(
      'In oracle bone and bronze scripts, the top hook 厂 is the rocky cliff overhang, and the block underneath is the stone.',
      '在甲骨文和金文里，上面拐弯的“厂”就是突出的山崖，下面的小块就是滚落的石头。',
      '在甲骨文和金文裡，上面拐彎的「厂」就是突出的山崖，下面的小塊就是滾落的石頭。',
    ),
    closer: T(
      'Cliff overhang 厂 on top, square boulder 口 underneath: that is 石, stone!',
      '上面是山崖“厂”，下面是方石头“口”，合起来就是石头的“石”！',
      '上面是山崖「厂」，下面是方石頭「口」，合起來就是石頭的「石」！',
    ),
  },
  火: {
    topic: T('The Crackling Campfire', '噼啪跳动的篝火', '噼啪跳動的篝火'),
    hook: T(
      'Under the dry cliff, dry twigs catch a spark — crackle, pop! — and bright flames leap upward.',
      '在干燥的山崖下点燃枯枝——噼里啪啦！温暖的火苗窜了起来。',
      '在乾燥的山崖下點燃枯枝——噼裡啪啦！溫暖的火苗竄了起來。',
    ),
    turn: T(
      'The earliest 火 looked like a three-tongued flame, with sparks rising on the left and right.',
      '最早的“火”就像一团向上蹿的三簇火苗，左右两边还飘着火星。',
      '最早的「火」就像一團向上躥的三簇火苗，左右兩邊還飄著火星。',
    ),
    closer: T(
      'In today’s 火, the sweeping center strokes are the main flame, and the two side ticks are dancing sparks!',
      '在今天的“火”字里，中间的人字形是主火苗，左右两点就是跳动的火星！',
      '在今天的「火」字裡，中間的人字形是主火苗，左右兩點就是跳動的火星！',
    ),
  },
  龟: {
    topic: T('The Armored Storyteller', '背着硬壳的小乌龟', '背著硬殼的小烏龜'),
    hook: T(
      'Out from behind a warm rock pokes a little turtle: a domed shell patterned with plates, four stubby legs, and a pointed tail.',
      '暖烘烘的石头后面爬出一只小乌龟：背着花纹硬壳，四条短腿慢吞吞，后面还有小尾巴。',
      '暖烘烘的石頭後面爬出一隻小烏龜：背著花紋硬殼，四條短腿慢吞吞，後面還有小尾巴。',
    ),
    turn: T(
      'Because Shang-dynasty diviners carved their questions onto turtle shells, they drew 龜 with loving detail — shell, claws, and all!',
      '因为商朝占卜师就在龟壳上刻字，所以他们把“龜”画得格外仔细——背甲、肚子和爪子一应俱全！',
      '因為商朝占卜師就在龜殼上刻字，所以他們把「龜」畫得格外仔細——背甲、肚子和爪子一應俱全！',
    ),
    closer: T(
      'Traditional 龜 still shows the full patterned shell and claws, while simplified 龟 keeps the head, shell, and curving tail!',
      '繁体“龜”保留了繁复的背甲和爪子，简体“龟”则用几笔勾勒出龟头、龟壳和翘起的尾巴！',
      '繁體「龜」保留了繁複的背甲和爪子，簡體「龟」則用幾筆勾勒出龜頭、龜殼和翹起的尾巴！',
    ),
  },
  鹿: {
    topic: T('The Crown of Antlers', '头顶分叉角的梅花鹿', '頭頂分叉角的梅花鹿'),
    hook: T(
      'Stepping lightly through the mist comes a graceful deer, crowned with a pair of branching antlers.',
      '薄雾中轻轻走来一头梅花鹿，头顶立着一对漂亮的枝形鹿角。',
      '薄霧中輕輕走來一頭梅花鹿，頭頂立著一對漂亮的枝形鹿角。',
    ),
    turn: T(
      'In every single stage — oracle bone, bronze, and seal — those proud branching antlers sit right on top of the deer’s head.',
      '不管是甲骨文、金文还是篆书，那对分叉的大鹿角始终高高立在鹿头顶上。',
      '不管是甲骨文、金文還是篆書，那對分叉的大鹿角始終高高立在鹿頭頂上。',
    ),
    closer: T(
      'In 鹿 today, the top roof and grid come from its head and antlers, and 比 at the bottom comes from its slender legs!',
      '今天的“鹿”字，上半部来自鹿头和鹿角，底下的“比”则是它修长的四条腿！',
      '今天的「鹿」字，上半部來自鹿頭和鹿角，底下的「比」則是牠修長的四條腿！',
    ),
  },

  // ---- Unit 5: Watch Out for the Tiger! ----------------------------------------------------------
  豕: {
    topic: T('The Plump Little Pig', '圆肚子短尾巴的猪', '圓肚子短尾巴的豬'),
    hook: T(
      'Oink, oink! Around the farmyard trots a plump pig with a big snout, a round belly, four short legs, and a stubby tail.',
      '哼哼哼！院子里跑着一头胖乎乎的小猪，长鼻子、圆肚子、四条短腿，加上一根小短尾。',
      '哼哼哼！院子裡跑著一頭胖乎乎的小豬，長鼻子、圓肚子、四條短腿，加上一根小短尾。',
    ),
    turn: T(
      'Stood upright in oracle bone and bronze scripts, the pig’s round belly curves out on one side while its legs kick out on the other.',
      '在甲骨文和金文里，竖起来的小猪一边鼓着圆滚滚的肚皮，另一边伸着小短腿。',
      '在甲骨文和金文裡，豎起來的小豬一邊鼓著圓滾滾的肚皮，另一邊伸著小短腿。',
    ),
    closer: T(
      'Put a roof 宀 over 豕 (pig) and you get 家 — home! Having a pig under your roof meant a well-fed family.',
      '在“豕”（猪）头顶盖上屋顶“宀”，就是“家”！屋里有猪，就代表一家人丰衣足食。',
      '在「豕」（豬）頭頂蓋上屋頂「宀」，就是「家」！屋裡有豬，就代表一家人豐衣足食。',
    ),
  },
  叟: {
    topic: T('Grandpa with a Torch', '举着火把的老人家', '舉著火把的老人家'),
    hook: T(
      'Who is keeping watch over the farmyard at dusk? A wise old grandfather: 叟!',
      '傍晚时分，是谁在照看农家小院呢？是一位慈祥又勇敢的老爷爷：“叟”！',
      '傍晚時分，是誰在照看農家小院呢？是一位慈祥又勇敢的老爺爺：「叟」！',
    ),
    closer: T(
      'Its earliest form showed a hand (又) holding a torch inside a room to search in the dark — and later came to mean an elder, 叟!',
      '它最初的意思是手里（又）举着火把在屋里找东西，后来专门用来称呼智慧的长辈——“叟”！',
      '它最初的意思是手裡（又）舉著火把在屋裡找東西，後來專門用來稱呼智慧的長輩——「叟」！',
    ),
  },
  虎: {
    topic: T('The Roaring Striped Tiger', '张嘴咆哮的大老虎', '張嘴咆哮的大老虎'),
    hook: T(
      'Roaaar! Out from the mountain brush creeps a fierce tiger — jaws wide open, sharp fangs gleaming, and bold stripes across its back!',
      '嗷呜——！山林里钻出一只威风凛凛的大老虎——大嘴张开，露着尖牙，背上布满条纹！',
      '嗷嗚——！山林裡鑽出一隻威風凜凜的大老虎——大嘴張開，露著尖牙，背上佈滿條紋！',
    ),
    turn: T(
      'Carved upright on bone and cast in bronze, the tiger’s striped head became the famous “tiger crown” 虍.',
      '竖着刻在甲骨和铜器上的老虎，那颗布满花纹的大脑袋，后来变成了“虎字头”虍。',
      '豎著刻在甲骨和銅器上的老虎，那顆佈滿花紋的大腦袋，後來變成了「虎字頭」虍。',
    ),
    closer: T(
      'Today’s 虎 still wears that striped tiger-head crown on top, standing on two powerful hind legs below!',
      '今天的“虎”字，顶上依然戴着威风的虎头冠，底下稳稳立着强壮的后腿！',
      '今天的「虎」字，頂上依然戴著威風的虎頭冠，底下穩穩立著強壯的後腿！',
    ),
  },
  弓: {
    topic: T('The Bent Wooden Bow', '弯弯的射箭长弓', '彎彎的射箭長弓'),
    hook: T(
      'To scare the tiger away, bend a flexible wooden bow and pull the bowstring taut: twang!',
      '为了吓跑大老虎，拉满一张富有弹性的木弓——嘣！',
      '為了嚇跑大老虎，拉滿一張富有彈性的木弓——嘣！',
    ),
    turn: T(
      'The double-curved shape of 弓 is a reflex bow: when unstrung or drawn, its wooden limbs curve like a wave.',
      '“弓”那一道道优美的弯折，正是古代反曲弓的形状：弓身弯曲，充满力量。',
      '「弓」那一道道優美的彎折，正是古代反曲弓的形狀：弓身彎曲，充滿力量。',
    ),
    closer: T(
      'With just three winding brush strokes, 弓 still looks like a bent wooden bow ready to launch an arrow!',
      '只用弯弯曲曲的三笔，今天的“弓”看起来依然像一张蓄势待发的良弓！',
      '只用彎彎曲曲的三筆，今天的「弓」看起來依然像一張蓄勢待發的良弓！',
    ),
  },
  舍: {
    topic: T('A Cozy Thatched Hut', '尖顶休憩的小屋', '尖頂休憩的小屋'),
    hook: T(
      'Safe and sound! At the edge of the field stands a welcoming cottage with a peaked roof, a center post, and a raised floor.',
      '安全啦！田边立着一座温暖的小屋：上面是遮风挡雨的尖屋顶，中间是立柱，下面是地基。',
      '安全啦！田邊立著一座溫暖的小屋：上面是遮風擋雨的尖屋頂，中間是立柱，下面是地基。',
    ),
    turn: T(
      'From bronze vessels to the monk Zhiyong’s 1,400-year-old calligraphy scroll, 舍 kept its pointed roof 人 on top and square room 口 at the base.',
      '从青铜器一直到1400年前智永禅师写的《千字文》，“舍”始终顶着尖屋顶、立在方地基上。',
      '從青銅器一直到1400年前智永禪師寫的《千字文》，「舍」始終頂著尖屋頂、立在方地基上。',
    ),
    closer: T(
      'Pointed roof on top, pillar in the middle, room below: that is 舍, a house to rest in!',
      '上面人字屋顶，中间支柱，下面方屋：这就是供人歇息的“舍”！',
      '上面人字屋頂，中間支柱，下面方屋：這就是供人歇息的「舍」！',
    ),
  },
  羊: {
    topic: T('Curly Horns, Gentle Face', '弯弯羊角温顺的羊', '彎彎羊角溫順的羊'),
    hook: T(
      'Baa, baa! Looking straight at you over the fence is a gentle sheep, with two curling horns on top and a pointed nose below.',
      '咩——咩！篱笆后面有一只温顺的小羊正望着你：头顶一对弯弯的羊角，下面是尖尖的鼻子和嘴。',
      '咩——咩！籬笆後面有一隻溫順的小羊正望著你：頭頂一對彎彎的羊角，下面是尖尖的鼻子和嘴。',
    ),
    turn: T(
      'In oracle bone and bronze scripts, the V-shaped horns curl down on each side above the ears and snout.',
      '在甲骨文和金文里，两只大羊角在头顶向两边弯弯卷起，下面是向两边伸出的耳朵和窄窄的羊脸。',
      '在甲骨文和金文裡，兩隻大羊角在頭頂向兩邊彎彎捲起，下面是向兩邊伸出的耳朵和窄窄的羊臉。',
    ),
    closer: T(
      'In today’s 羊, the two top ticks are still the sheep’s horns! And because sheep were prized, 羊 sits inside 美 (beautiful) and 善 (kind)!',
      '今天的“羊”字顶上两点依然是羊角！古人觉得羊吉祥又美好，所以“美”和“善”字里都有“羊”！',
      '今天的「羊」字頂上兩點依然是羊角！古人覺得羊吉祥又美好，所以「美」和「善」字裡都有「羊」！',
    ),
  },

  // ---- Unit 6: Home Under the Moon ---------------------------------------------------------------
  花: {
    topic: T('Blossoms by the Garden Path', '小路边盛开的花朵', '小路邊盛開的花朵'),
    hook: T(
      'Along the path home, bright blossoms open their petals to the evening breeze.',
      '回家的小路旁，一朵朵鲜花在晚风里展开花瓣。',
      '回家的小路旁，一朵朵鮮花在晚風裡展開花瓣。',
    ),
    turn: T(
      'Ancient writers first drew a blooming bush as 華. Later, they combined the plant crown 艹 (meaning) with 化 (sound) to create 花.',
      '古人最早把满树繁花画成“華”。后来，人们用代表植物的草字头“艹”加上提示读音的“化”，造出了“花”字。',
      '古人最早把滿樹繁花畫成「華」。後來，人們用代表植物的草字頭「艹」加上提示讀音的「化」，造出了「花」字。',
    ),
    closer: T(
      'Grass crown 艹 on top for plants, 化 underneath for the sound huā: that is 花, flower!',
      '上面草字头表意，下面“化”字表音，合起来就是百花盛开的“花”！',
      '上面草字頭表意，下面「化」字表音，合起來就是百花盛開的「花」！',
    ),
  },
  门: {
    topic: T('Swing Open the Double Gate', '推开两扇木大门', '推開兩扇木大門'),
    hook: T(
      'Creak… We reach the front courtyard! Two tall wooden door-leaves hang on side posts, ready to swing open.',
      '吱呀——走到自家院子前啦！两扇高大的木门挂在左右的门柱上，正等着我们推开。',
      '吱呀——走到自家院子前啦！兩扇高大的木門掛在左右的門柱上，正等著我們推開。',
    ),
    turn: T(
      'Look at the Hu ding bronze rubbing: 門 has two tall side posts and two paneled doors facing each other.',
      '看曶鼎青铜拓片上的“門”：左右两根长长的门柱，中间两扇带方格的门板面对面合拢。',
      '看曶鼎青銅拓片上的「門」：左右兩根長長的門柱，中間兩扇帶方格的門板面對面合攏。',
    ),
    closer: T(
      'Traditional 門 still shows both swinging doors, while simplified 门 traces the whole doorway in three quick strokes!',
      '繁体“門”依然画着对称的两扇门板，简体“门”则吸收了草书连笔，三笔就勾出了门框！',
      '繁體「門」依然畫著對稱的兩扇門板，簡體「门」則吸收了草書連筆，三筆就勾出了門框！',
    ),
  },
  犬: {
    topic: T('The Puppy with a Curled Tail', '摇着卷尾巴的小狗', '搖著捲尾巴的小狗'),
    hook: T(
      'Woof, woof! Waiting right outside the gate is a loyal dog, barking happily with its tail curled high!',
      '汪、汪！守在大门口的是一只忠实的小狗，正欢快地摇着向上卷起的尾巴迎接主人！',
      '汪、汪！守在大門口的是一隻忠實的小狗，正歡快地搖著向上捲起的尾巴迎接主人！',
    ),
    turn: T(
      'How did carvers tell a dog (犬) apart from a plump pig (豕)? By the dog’s slender waist and that perky curled-up tail!',
      '古人怎么区分竖着刻的“犬”（狗）和“豕”（猪）呢？秘诀就在小狗瘦瘦的腰身，和那根高高卷起的尾巴！',
      '古人怎麼區分豎著刻的「犬」（狗）和「豕」（豬）呢？秘訣就在小狗瘦瘦的腰身，和那根高高捲起的尾巴！',
    ),
    closer: T(
      'In 犬 today, the little dot in the top-right corner comes from the dog’s ear and curled tail! On the left of characters like 猫 and 狗, it becomes 犭.',
      '今天“犬”字右上角的那一点，就来自小狗的耳朵与卷尾巴！当它做偏旁时，就变成了反犬旁“犭”。',
      '今天「犬」字右上角的那一點，就來自小狗的耳朵與捲尾巴！當它做偏旁時，就變成了反犬旁「犭」。',
    ),
  },
  子: {
    topic: T('The Waving Baby', '挥着小手的胖娃娃', '揮著小手的胖娃娃'),
    hook: T(
      'Inside the warm house, a happy baby waves both little arms in the air while its legs are tucked snugly in a swaddling blanket.',
      '温暖的屋子里，一个胖娃娃裹在襁褓里，正开心地挥舞着两只小手。',
      '溫暖的屋子裡，一個胖娃娃裹在襁褓裡，正開心地揮舞著兩隻小手。',
    ),
    turn: T(
      'In oracle bone, bronze, and seal scripts, you can see the baby’s round head on top, two outstretched arms in the middle, and wrapped legs below.',
      '在甲骨文、金文和篆书里，顶上是圆圆的小脑袋，中间一横是张开的双臂，下面是裹在一起的双腿。',
      '在甲骨文、金文和篆書裡，頂上是圓圓的小腦袋，中間一橫是張開的雙臂，下面是裹在一起的雙腿。',
    ),
    closer: T(
      'Round head, open arms, swaddled legs: that is 子, child!',
      '大脑袋、张开的小手、裹着的襁褓：这就是孩子的“子”！',
      '大腦袋、張開的小手、裹著的襁褓：這就是孩子的「子」！',
    ),
  },
  女: {
    topic: T('Sitting Gracefully by the Lamp', '端庄跪坐的母亲', '端莊跪坐的母親'),
    hook: T(
      'Beside the cradle sits the baby’s mother, kneeling gracefully on a woven mat with her hands folded gently in front.',
      '摇篮旁边，妈妈端庄地跪坐在草席上，双手轻轻交叉在身前。',
      '搖籃旁邊，媽媽端莊地跪坐在草席上，雙手輕輕交叉在身前。',
    ),
    turn: T(
      'From oracle bone to bamboo slips, 女 traces that poised kneeling posture and crossed sleeves.',
      '从甲骨文一直到秦代竹简，“女”字始终描绘着这样温婉跪坐、双手交叠的姿态。',
      '從甲骨文一直到秦代竹簡，「女」字始終描繪著這樣溫婉跪坐、雙手交疊的姿態。',
    ),
    closer: T(
      'Put 女 (mother) and 子 (child) right next to each other and what word do they make? 好 — good and happy!',
      '把妈妈“女”和孩子“子”放在一起，会合成什么字呢？就是美好、幸福的“好”！',
      '把媽媽「女」和孩子「子」放在一起，會合成什麼字呢？就是美好、幸福的「好」！',
    ),
  },
  月: {
    topic: T('The Silver Crescent Moon', '夜空里的弯月牙', '夜空裡的彎月牙'),
    hook: T(
      'Night falls, and a silver crescent moon hangs above the quiet courtyard.',
      '夜深了，一弯银亮的月牙挂在安静的小院上空。',
      '夜深了，一彎銀亮的月牙掛在安靜的小院上空。',
    ),
    turn: T(
      'Why didn’t carvers draw a full round moon? Because a round circle already belonged to 日, the sun! Drawing a crescent made 月 unmistakable.',
      '为什么古人不把月亮画成圆圆的满月呢？因为圆圈已经给了太阳“日”！画成弯弯的月牙，一眼就能认出“月”。',
      '為什麼古人不把月亮畫成圓圓的滿月呢？因為圓圈已經給了太陽「日」！畫成彎彎的月牙，一眼就能認出「月」。',
    ),
    closer: T(
      'Even today, the left curve of 月 sweeps down longer like the tip of a crescent moon!',
      '直到今天，“月”字左边的一竖撇依然弯弯地向下伸展，就像月牙尖尖的角！',
      '直到今天，「月」字左邊的一豎撇依然彎彎地向下伸展，就像月牙尖尖的角！',
    ),
  },
};
