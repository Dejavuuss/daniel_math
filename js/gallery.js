// Галерея: настоящие репродукции в залах и длинная экспозиция внизу каждой страницы —
// этюд «Математика картины» (живые SVG из art.js), портреты учёных и зал искусства XX века.
// Все изображения — общественное достояние или CC0, с Wikimedia Commons (источники — в конце экспозиции).
import { mountArt } from "./art.js";
import { reveal } from "./fx.js";
import { esc } from "./ui.js";

const COMMONS = "https://commons.wikimedia.org/wiki/File:";

/* ---------- Залы: оригинал картины в раме ---------- */

const HALL = {
  vitruvian:{ src:"hall-vitruvian.jpg", w:799, h:1100, alt:"Леонардо да Винчи. Витрувианский человек", file:"Da Vinci Vitruve Luc Viatour (cropped).jpg",
    study:"Фигура вписана сразу в квадрат и в круг: размах рук равен росту, а центр круга — пупок. Линии этюда повторяют построение Леонардо — циркулем и линейкой." },
  melencolia:{ src:"hall-melencolia.jpg", w:852, h:1100, alt:"Альбрехт Дюрер. Меланхолия I", file:"Melencolia I MET DP815743.jpg",
    study:"Магический квадрат из правого верхнего угла гравюры: суммы в каждой строке, столбце и на диагоналях равны 34, а в середине нижнего ряда спрятан год — 15 и 14. Наведите на клетку, чтобы сложить её строку. Рядом вращается многогранник с той же гравюры." },
  wave:{ src:"hall-wave.jpg", w:1100, h:759, alt:"Кацусика Хокусай. Большая волна в Канагаве", file:"The Great Wave off Kanagawa.jpg",
    study:"Гребень волны распадается на «когти», похожие на саму волну, а те — на ещё меньшие. Это самоподобие: так устроены фракталы. Изгиб волны близок к логарифмической спирали — той же, что у раковины наутилуса." },
  athens:{ src:"hall-athens.jpg", w:1100, h:853, alt:"Рафаэль Санти. Афинская школа", file:"\"The School of Athens\" by Raffaello Sanzio da Urbino.jpg",
    study:"Линии пола и арок сходятся в одной точке между Платоном и Аристотелем — это линейная перспектива. Подвигайте мышью: точка схода сместится, и вся «комната» перестроится по законам геометрии." }
};

export function mountHall(frame, name) {
  const a = HALL[name];
  if (!frame || !a) return;
  frame.classList.add("gilt");
  frame.innerHTML = `<div class="mat"><div class="canvas"><img src="img/${a.src}" width="${a.w}" height="${a.h}" alt="${esc(a.alt)}" decoding="async" fetchpriority="high"></div></div>`;
}

/* ---------- Учёные ---------- */

const SCIENTISTS = {
  euler:{ name:"Леонард Эйлер", years:"1707–1783", src:"euler.jpg", w:495, h:640, file:"Leonhard Euler - Jakob Emanuel Handmann (Kunstmuseum Basel).jpg", by:"Портрет работы Я. Э. Хандмана, 1753",
    text:"Написал больше, чем любой математик в истории, — даже потеряв зрение. Это он ввёл привычные нам обозначения f(x), e, i и знак суммы Σ." },
  gauss:{ name:"Карл Фридрих Гаусс", years:"1777–1855", src:"gauss.jpg", w:500, h:637, file:"Carl Friedrich Gauss 1840 by Jensen.jpg", by:"Портрет работы К. А. Йенсена, 1840",
    text:"В девятнадцать лет доказал, что правильный 17-угольник можно построить циркулем и линейкой, — задача, над которой бились две тысячи лет.", quote:["Математика — царица наук.", "К. Ф. Гаусс"] },
  kovalevskaya:{ name:"Софья Ковалевская", years:"1850–1891", src:"kovalevskaya.jpg", w:407, h:640, file:"Das Fotoalbum für Weierstraß 044 (Sofja Wassiljewna Kowalewskaja).jpg", by:"Фотография из альбома К. Вейерштрасса",
    text:"Первая в Северной Европе женщина — профессор математики. Парижская академия присудила ей премию Бордена за решение задачи о вращении твёрдого тела.", quote:["Нельзя быть математиком, не будучи в то же время поэтом в душе.", "С. В. Ковалевская"] },
  einstein:{ name:"Альберт Эйнштейн", years:"1879–1955", src:"einstein.jpg", w:487, h:640, file:"Einstein 1921 by F Schmutzer - restoration.jpg", by:"Фотография Ф. Шмутцера, 1921",
    text:"Создал теорию относительности и вывел формулу E = mc². Нобелевскую премию получил за объяснение фотоэффекта.", quote:["Воображение важнее знания.", "А. Эйнштейн"] },
  newton:{ name:"Исаак Ньютон", years:"1643–1727", src:"newton.jpg", w:483, h:640, file:"Portrait of Sir Isaac Newton, 1689 (brightened) (cropped).jpg", by:"Портрет работы Г. Неллера, 1689",
    text:"Открыл закон всемирного тяготения и одновременно с Лейбницем создал дифференциальное и интегральное исчисление.", quote:["Если я видел дальше других, то потому, что стоял на плечах гигантов.", "И. Ньютон"] },
  lobachevsky:{ name:"Николай Лобачевский", years:"1792–1856", src:"lobachevsky.jpg", w:492, h:640, file:"Lobachevsky 05.jpg", by:"Портрет XIX века",
    text:"Построил геометрию, в которой через точку можно провести много прямых, не пересекающих данную. Современники её не приняли, а сегодня она нужна в физике и теории относительности." },
  ramanujan:{ name:"Сриниваса Рамануджан", years:"1887–1920", src:"ramanujan.jpg", w:467, h:640, file:"Srinivasa Ramanujan - OPC - 1.jpg", by:"Фотография 1910-х",
    text:"Самоучка из Индии, оставивший почти четыре тысячи формул. Число 1729 он узнал сразу: это наименьшее число, которое двумя способами раскладывается в сумму двух кубов." },
  lovelace:{ name:"Ада Лавлейс", years:"1815–1852", src:"lovelace.jpg", w:446, h:640, file:"Ada Lovelace portrait.jpg", by:"Портрет работы А. Э. Шалона, около 1840",
    text:"В 1843 году написала алгоритм вычисления чисел Бернулли для машины Бэббиджа — его считают первой компьютерной программой." },
  curie:{ name:"Мария Склодовская-Кюри", years:"1867–1934", src:"curie.jpg", w:453, h:640, file:"Marie Curie c1920 (cropped).jpg", by:"Фотография, около 1920",
    text:"Единственный учёный с Нобелевскими премиями в двух разных науках — физике и химии. Открыла полоний и радий." },
  noether:{ name:"Эмми Нётер", years:"1882–1935", src:"noether.jpg", w:420, h:640, file:"Noether.jpg", by:"Фотография начала XX века",
    text:"Доказала, что каждой симметрии природы соответствует закон сохранения. Эйнштейн назвал её самым значительным творческим математическим гением среди женщин." },
  poincare:{ name:"Анри Пуанкаре", years:"1854–1912", src:"poincare.jpg", w:480, h:640, file:"Henri Poincaré in 1880s.jpg", by:"Фотография 1880-х",
    text:"Один из создателей топологии. Его знаменитую гипотезу о трёхмерной сфере доказал Григорий Перельман в 2002–2003 годах.", quote:["В математике нет символов для неясных мыслей.", "А. Пуанкаре"] },
  hilbert:{ name:"Давид Гильберт", years:"1862–1943", src:"hilbert.jpg", w:451, h:640, file:"David Hilbert postcard retusche.jpg", by:"Фотография, 1912",
    text:"В 1900 году назвал 23 главные задачи математики на новый век. Над некоторыми из них работают до сих пор.", quote:["Мы должны знать — мы будем знать.", "Д. Гильберт"] }
};

/* ---------- Искусство XX века ---------- */

const MODERN = {
  "kandinsky-8":{ artist:"Василий Кандинский", title:"Композиция VIII", info:"1923. Холст, масло. Музей Гуггенхайма, Нью-Йорк", src:"kandinsky-8.jpg", w:900, h:655, file:"Kandinsky - Composition 8, July 1923.jpg",
    text:"Здесь только точки, отрезки, дуги, круги и углы — словарь школьной геометрии. В книге «Точка и линия на плоскости» Кандинский разбирал, как по-разному ощущаются острый, прямой и тупой угол." },
  "kandinsky-circles":{ artist:"Василий Кандинский", title:"Несколько кругов", info:"1926. Холст, масло. Музей Гуггенхайма, Нью-Йорк", src:"kandinsky-circles.jpg", w:883, h:900, file:"Vassily Kandinsky, 1926 - Several Circles, Gugg 0910 25.jpg",
    text:"Полупрозрачные круги разного радиуса накладываются друг на друга, и там, где они пересекаются, рождается новый цвет — как пересечение множеств на диаграмме Эйлера." },
  malevich:{ artist:"Казимир Малевич", title:"Супрематическая композиция: летящий самолёт", info:"1915. Холст, масло. Музей современного искусства, Нью-Йорк", src:"malevich.jpg", w:747, h:900, file:"Suprematist Composition - Airplane Flying (Malevich, 1915).jpg",
    text:"Одни прямоугольники и полосы, но повёрнутые под углом — и картина начинает лететь. Попробуйте найти на ней параллельные и перпендикулярные стороны." },
  mondrian:{ artist:"Пит Мондриан", title:"Композиция II с красным, синим и жёлтым", info:"1930. Холст, масло. Кунстхаус, Цюрих", src:"mondrian.jpg", w:888, h:900, file:"Piet Mondriaan, 1930 - Mondrian Composition II in Red, Blue, and Yellow.jpg",
    text:"Только горизонтали, вертикали и прямоугольники. Прикиньте на глаз: красный квадрат занимает больше половины площади холста или меньше?" },
  klee:{ artist:"Пауль Клее", title:"Замок и солнце", info:"1928. Холст, масло. Частное собрание", src:"klee.jpg", w:900, h:739, file:"Burg und Sonne - Klee.jpg",
    text:"Город собран из квадратов, прямоугольников, треугольников и одного круга-солнца, как задача «из каких фигур составлен рисунок». Клее вёл в Баухаусе курс о форме и пропорции." },
  afklint:{ artist:"Хильма аф Клинт", title:"Десять крупнейших, № 3. Юность", info:"1907. Темпера на бумаге. Фонд Хильмы аф Клинт, Стокгольм", src:"afklint.jpg", w:675, h:900, file:"Hilma af Klint - The Ten Largest No. 3 - Youth - 1907.jpg",
    text:"Спирали, концентрические окружности и симметричные лепестки. Эту абстракцию шведская художница написала на несколько лет раньше Кандинского." },
  delaunay:{ artist:"Робер Делоне", title:"Ритм. Радость жизни", info:"1930. Холст, масло. Центр Помпиду, Париж", src:"delaunay.jpg", w:900, h:785, file:"Robert Delaunay - Rythme, Joie de vivre.jpg",
    text:"Концентрические кольца и дуги — окружности с общим центром и разными радиусами. Делоне хотел, чтобы цвета вращались, как диски." },
  lissitzky:{ artist:"Эль Лисицкий", title:"Проун 93. Спираль", info:"Около 1923", src:"lissitzky.jpg", w:897, h:900, file:"Lissitzky Proun 93.jpg",
    text:"Лисицкий учился на архитектора и рисовал «проуны» как чертежи. Здесь спираль, витки которой идут почти на равном расстоянии друг от друга, как у архимедовой спирали." },
  popova:{ artist:"Любовь Попова", title:"Живописная архитектоника", info:"1918. Национальные галереи Шотландии, Эдинбург", src:"popova.jpg", w:591, h:900, file:"Lyubov Popova - Painterly Architectonic - GMA 2080 - National Galleries of Scotland.jpg",
    text:"Треугольники, трапеции и параллелограммы лежат друг на друге, будто плоскости в пространстве. Это стереометрия, написанная на плоском холсте." }
};

const PAGES = {
  login:{ art:"vitruvian", scientists:["euler", "kovalevskaya", "einstein", "lovelace"], modern:["kandinsky-8", "malevich", "mondrian"] },
  student:{ art:"melencolia", scientists:["newton", "gauss", "ramanujan", "lobachevsky"], modern:["kandinsky-circles", "klee", "lissitzky"] },
  parent:{ art:"wave", scientists:["curie", "noether", "poincare", "hilbert"], modern:["delaunay", "afklint", "popova"] },
  admin:{ art:"athens", scientists:["gauss", "hilbert", "curie", "euler"], modern:["popova", "kandinsky-circles", "malevich"] }
};

const img = (o, cls = "") => `<img${cls ? ` class="${cls}"` : ""} src="img/${o.src}" width="${o.w}" height="${o.h}" alt="" loading="lazy" decoding="async">`;

export function mountGallery(host, page) {
  const p = PAGES[page];
  if (!host || !p) return;
  const hall = HALL[p.art];
  const scientists = p.scientists.map(k => SCIENTISTS[k]), modern = p.modern.map(k => MODERN[k]);
  const sources = [hall, ...scientists, ...modern].map(o => `<li><a href="${COMMONS + encodeURIComponent(o.file.replace(/ /g, "_"))}" target="_blank" rel="noopener noreferrer">${esc(o.name || o.title || o.alt)}</a></li>`).join("");
  host.innerHTML = `
  <section class="gallery-room study-room" data-reveal>
    <div class="room-head"><p class="hall-label">Этюд</p><h2>Математика картины</h2></div>
    <div class="study">
      <figure class="study-frame"><div class="frame" id="study-art"></div></figure>
      <p class="study-text">${esc(hall.study)}</p>
    </div>
  </section>

  <section class="gallery-room" data-reveal>
    <div class="room-head"><p class="hall-label">Портретная галерея</p><h2>Те, кто придумал математику</h2></div>
    <div class="portraits">${scientists.map((s, i) => `
      <figure class="portrait" data-reveal="${i}">
        <div class="photo">${img(s)}</div>
        <figcaption>
          <b>${esc(s.name)}</b><span class="years">${esc(s.years)}</span>
          <p>${esc(s.text)}</p>
          ${s.quote ? `<q>${esc(s.quote[0])}</q>` : ""}
          <small>${esc(s.by)}</small>
        </figcaption>
      </figure>`).join("")}
    </div>
  </section>

  <section class="gallery-room" data-reveal>
    <div class="room-head"><p class="hall-label">Зал XX века</p><h2>Геометрия в современном искусстве</h2></div>
    ${modern.map((m, i) => `
    <figure class="modern${i % 2 ? " flip" : ""}" data-reveal>
      <div class="modern-frame">${img(m)}</div>
      <figcaption class="placard">
        <b>${esc(m.artist)}</b><i>${esc(m.title)}</i><span>${esc(m.info)}</span>
        <p>${esc(m.text)}</p>
      </figcaption>
    </figure>`).join("")}
  </section>

  <details class="fold sources"><summary><span class="fold-title">Источники изображений</span><span class="fold-note">Wikimedia Commons, общественное достояние</span></summary>
    <div class="fold-body"><ul>${sources}</ul></div></details>`;
  mountArt(host.querySelector("#study-art"), p.art);
  reveal(host);
}
