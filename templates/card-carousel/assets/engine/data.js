// 片子的全部内容来自 film.json（由 scripts/build_film.py 从你写的配置生成）。
// 引擎源码里不含任何具体仓库的文字、颜色或图片。
import film from './film.json';
import { setup } from './choreo.js';

// 牌的总数 = 内容牌 + 1 张字标牌；film.step = 每拍转几张
setup(film.cards.length + 1, film.step);

export { film };
export const CARDS = film.cards;   // 已按槽位排好：第 0 张开场正对镜头，第 6×step 张是被拆开的主角
