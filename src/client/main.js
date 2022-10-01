/*eslint global-require:off*/
// eslint-disable-next-line import/order
const local_storage = require('glov/client/local_storage.js');
local_storage.setStoragePrefix('glovjs-playground'); // Before requiring anything else that might load from this

import assert from 'assert';
import * as camera2d from 'glov/client/camera2d.js';
import * as engine from 'glov/client/engine.js';
import * as input from 'glov/client/input.js';
import * as net from 'glov/client/net.js';
import * as pico8 from 'glov/client/pico8.js';
import { createSprite } from 'glov/client/sprites.js';
import * as ui from 'glov/client/ui.js';
import { mashString, randCreate } from 'glov/common/rand_alea.js';
import { v2iRound, v3copy, v4set, vec2 } from 'glov/common/vmath.js';
import {
  FRAME_ASTEROID,
  FRAME_ASTEROID_EMPTY,
  FRAME_MINER,
  sprite_space,
} from './img/space.js';

const { PI, abs, min, sin, floor } = Math;

window.Z = window.Z || {};
Z.BACKGROUND = 1;
Z.SPRITES = 10;
Z[FRAME_ASTEROID] = 10;
Z[FRAME_ASTEROID_EMPTY] = 9;
Z.LINKS = 15;
Z[FRAME_MINER] = 20;
Z.PLACE_PREVIEW = 30;

// Virtual viewport for our game logic
const game_width = 720;
const game_height = 480;

const SPRITE_W = 13;

const NUM_CARDS = 9;
const CARD_W = 47;
const CARD_X0 = 3;
const CARD_ICON_SCALE = 3;
const CARD_H = 72;
const CARD_ICON_W = CARD_ICON_SCALE * SPRITE_W;
const CARD_ICON_X = (CARD_W - CARD_ICON_W) / 2;
const CARD_Y = game_height - CARD_H;


let sprites = {};
let font;
function init() {
  sprites.test = createSprite({
    name: 'test',
  });
  sprites.border = createSprite({
    name: 'border',
  });
  ui.loadUISprite('card_panel', [3, 2, 3], [3, 2, 3]);
  ui.loadUISprite('card_button', [3, 2, 3], [CARD_H]);
  v4set(ui.color_panel, 1, 1, 1, 1);
}

const RADIUS_DEFAULT = 5;
const RADIUS_LINK_ASTEROID = SPRITE_W * 2;
const RSQR_ASTERIOD = RADIUS_LINK_ASTEROID * RADIUS_LINK_ASTEROID;

const ent_types = {
  [FRAME_MINER]: {
    frame: FRAME_MINER,
    label: 'Miner',
    cost: 100,
    r: RADIUS_DEFAULT,
    mine_rate: 1000/8, // millisecond per ore
  },
};

const buttons = [
  FRAME_MINER,
];

const link_color = {
  [FRAME_ASTEROID]: [pico8.colors[11], pico8.colors[3]],
};

function entDistSq(a, b) {
  return (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
}

function cmpDistSq(a, b) {
  return a.dist_sq - b.dist_sq;
}

class Game {
  constructor(seed) {
    let w = this.w = 720;
    let h = this.h = 480;
    let rand = this.rand = randCreate(mashString(seed));
    let num_asteroids = 100;
    let map = this.map = {};
    this.last_id = 0;
    for (let ii = 0; ii < num_asteroids; ++ii) {
      let x = rand.floatBetween(0, 1);
      x = x * x * (rand.range(2) ? -1 : 1);
      x = x * w / 2 + w / 2;
      let y = rand.floatBetween(0, 1);
      y = y * y * (rand.range(2) ? -1 : 1);
      y = y * h / 2 + h / 2;
      map[++this.last_id] = {
        frame: FRAME_ASTEROID,
        x, y,
        z: Z[FRAME_ASTEROID],
        w: SPRITE_W, h: SPRITE_W,
        rot: rand.random() * PI * 2,
        value: 500 + rand.range(1000),
        r: RADIUS_DEFAULT,
      };
    }
    this.money = 500;
    this.selected = engine.DEBUG ? FRAME_MINER : null;
    this.tick_counter = 0;
  }

  tickWrap() {
    let dt = engine.getFrameDt();
    while (dt > 16) {
      this.tick(16);
      dt -= 16;
    }
    this.tick(dt);
  }

  updateMiner(ent, dt) {
    if (!ent.asteroid_link) {
      return;
    }
    let asteroid = this.map[ent.asteroid_link];
    if (!asteroid.value) {
      ent.links = ent.links.filter((a) => a !== ent.asteroid_link);
      ent.asteroid_link = null;
      let links = this.findAsteroidLinks(ent);
      if (!links.length) {
        ent.active = false;
        return;
      }
      links.sort(cmpDistSq);
      ent.links.push(links[0]);
      ent.asteroid_link = links[0].id;
      asteroid = this.map[ent.asteroid_link];
    }
    ent.time_accum += dt;
    let rate = ent_types[ent.frame].mine_rate;
    let mined = floor(ent.time_accum / rate);
    if (mined >= 1) {
      mined = min(mined, asteroid.value);
      asteroid.value -= mined;
      if (!asteroid.value) {
        asteroid.frame = FRAME_ASTEROID_EMPTY;
        asteroid.z = Z[FRAME_ASTEROID_EMPTY];
      }
      this.money += mined;

      ent.time_accum -= mined * rate;
    }
  }

  tick(dt) {
    let last_tick_counter = this.tick_counter;
    let last_tick_decasecond = floor(last_tick_counter / 10000);
    this.tick_counter += dt;
    let this_tick_decasecond = floor(this.tick_counter / 10000);
    if (last_tick_decasecond !== this_tick_decasecond) {
      // once every 10 seconds
    }

    let { map } = this;
    for (let key in map) {
      let ent = map[key];
      if (ent.frame === FRAME_MINER) {
        this.updateMiner(ent, dt);
      }
    }
  }

  getSelected() {
    if (this.canAfford(this.selected)) {
      return this.selected;
    }
    return null;
  }

  canAfford(frame) {
    return ent_types[frame]?.cost <= this.money;
  }

  findAsteroidLinks(from_ent) {
    let links = [];
    let { map } = this;
    for (let id in map) {
      let ent = map[id];
      if (ent === from_ent) {
        continue;
      }
      let dist_sq = entDistSq(ent, from_ent);
      if (ent.frame === FRAME_ASTEROID && ent.value && dist_sq <= RSQR_ASTERIOD) {
        links.push({ id, dist_sq });
      }
    }
    return links;
  }

  canPlace(param) {
    let selected = this.getSelected();
    let elem = ent_types[selected];
    let { map } = this;
    let { r } = elem;
    let { links } = param;
    for (let id in map) {
      let ent = map[id];
      let dist_sq = entDistSq(ent, param);
      if (dist_sq <= (r + ent.r) * (r + ent.r)) {
        return false;
      }
      if (ent.frame === FRAME_ASTEROID && dist_sq <= RSQR_ASTERIOD) {
        links.push({ id, dist_sq });
      }
    }
    if (selected === FRAME_MINER) {
      let ok = false;
      for (let ii = 0; ii < links.length; ++ii) {
        let ent = map[links[ii].id];
        if (ent.frame === FRAME_ASTEROID) {
          ok = true;
        }
      }
      if (!ok) {
        return false;
      }
    }
    return true;
  }

  place(param) {
    let { x, y, links } = param;
    let selected = this.getSelected();
    let ent_type = ent_types[selected];
    let { map } = this;
    let { r, frame, cost } = ent_type;
    let seen = {};
    // link to just first of any given type
    let use_links = links.filter((a) => {
      let { id } = a;
      let ent = map[id];
      if (seen[ent.frame]) {
        return false;
      }
      seen[ent.frame] = id;
      return true;
    });
    let elem = {
      frame, x, y, z: Z[frame],
      w: SPRITE_W, h: SPRITE_W,
      rot: 0,
      r,
      links: use_links,
      seed: this.rand.random(),
    };
    if (frame === FRAME_MINER) {
      elem.time_accum = 0;
      elem.active = true;
      elem.asteroid_link = seen[FRAME_ASTEROID];
      assert(elem.asteroid_link);
    }
    map[++this.last_id] = elem;
    this.money -= cost;
  }
}

let game;

function playInit() {
  game = new Game('1234');
}

let mouse_pos = vec2();
function drawMap() {
  gl.clearColor(0,0,0,1);
  let viewx0 = 0;
  let viewy0 = 0;
  let viewx1 = game_width;
  let viewy1 = game_height;
  camera2d.set(0, 0, game_width, game_height);
  // TODO: if zooming, offsets need to be in screen space, not view space!
  viewx0 += 2;
  viewy0 += 2;
  viewx1 -= 2;
  viewy1 -= CARD_H + 2;

  let { map } = game;
  for (let key in map) {
    let elem = map[key];
    sprite_space.draw(elem);
    let { links } = elem;
    if (links) {
      for (let ii = 0; ii < links.length; ++ii) {
        let link = links[ii];
        let other = map[link.id];
        let color = link_color[other.frame];
        if (!color) {
          // dead link
          continue;
        }
        let w = 1;
        let p = 1;
        if (elem.active) {
          w += abs(sin(engine.frame_timestamp * 0.008 + elem.seed * PI * 2));
          p = 0.9;
        }
        ui.drawLine(elem.x, elem.y, other.x, other.y, Z.LINKS, w, p,
          link_color[other.frame][0]);
      }
    }
  }

  let selected = game.getSelected();
  if (selected !== null) {
    input.mousePos(mouse_pos);
    v2iRound(mouse_pos);
    let x = mouse_pos[0];
    let y = mouse_pos[1];
    let place_param = { x, y, links: [] };
    let can_place = game.canPlace(place_param) && x >= viewx0 && x < viewx1 && y >= viewy0 && y < viewy1;
    sprite_space.draw({
      x, y, z: Z.PLACE_PREVIEW,
      w: SPRITE_W,
      h: SPRITE_W,
      frame: ent_types[selected].frame,
      color: can_place ? undefined : [1,0,1,1],
    });
    if (can_place) {
      let { links } = place_param;
      links.sort(cmpDistSq);
      let seen = {};
      for (let ii = 0; ii < links.length; ++ii) {
        let link = links[ii];
        let ent = map[link.id];
        let is_first = !seen[ent.frame];
        seen[ent.frame] = true;
        ui.drawLine(x, y, ent.x, ent.y, Z.LINKS + (is_first ? 2 : 1), 1, 1,
          link_color[ent.frame][is_first ? 0 : 1]);
      }
      if (input.click()) {
        game.place(place_param);
        ui.playUISound('button_click');
      }
    }
  }
}

const CARD_LABEL_Y = CARD_Y + CARD_ICON_X * 2 + CARD_ICON_W;

function drawHUD() {
  v3copy(engine.border_clear_color, pico8.colors[15]);
  camera2d.set(0, 0, game_width, game_height);
  sprites.border.draw({ x: 0, y: 0, w: game_width, h: game_height, z: Z.UI - 1 });
  let x = CARD_X0;
  let selected = game.getSelected();
  for (let ii = 0; ii < NUM_CARDS; ++ii) {
    if (ii < buttons.length) {
      let frame = buttons[ii];
      let ent_type = ent_types[frame];
      sprite_space.draw({
        frame,
        x: x + CARD_ICON_X + floor(CARD_ICON_W/2),
        y: CARD_Y + CARD_ICON_X + floor(CARD_ICON_W/2),
        w: CARD_ICON_W,
        h: CARD_ICON_W,
        z: Z.UI + 2
      });

      if (game.selected === frame) {
        font.draw({
          color: pico8.font_colors[selected === null ? 8 : 10],
          x, y: CARD_Y + CARD_ICON_X,
          z: Z.UI + 3,
          w: CARD_W,
          h: CARD_ICON_W,
          text: selected === null ? 'CANNOT\nAFFORD' : 'SELECTED',
          align: font.ALIGN.HVCENTER | font.ALIGN.HWRAP,
        });
      }
      font.draw({
        color: 0x000000ff,
        x, y: CARD_LABEL_Y,
        z: Z.UI + 3,
        w: CARD_W,
        text: ent_type.label,
        align: font.ALIGN.HCENTER,
      });
      font.draw({
        color: pico8.font_colors[game.canAfford(frame) ? 3 : 8],
        x, y: CARD_LABEL_Y + ui.font_height,
        z: Z.UI + 3,
        w: CARD_W,
        text: `${ent_type.cost}g`,
        align: font.ALIGN.HCENTER,
      });

      if (ui.button({
        x, y: CARD_Y,
        w: CARD_W, h: CARD_H,
        text: ' ',
        base_name: 'card_button',
        disabled: !game.canAfford(frame) && game.selected !== frame,
      })) {
        game.selected = game.selected === frame ? null : frame;
      }
    }
    // ui.panel({
    //   x, y: CARD_Y,
    //   w: CARD_W, h: CARD_H,
    //   sprite: ui.sprites.card_panel,
    // });
    x += CARD_W + 2;
  }
  x += 2;
  ui.panel({
    x, y: CARD_Y,
    w: game_width - x - 4,
    h: CARD_H,
  });
  font.draw({
    color: pico8.font_colors[3],
    x: x + 6,
    y: CARD_Y + 6,
    z: Z.UI + 1,
    size: ui.font_height * 2,
    text: `Money: ${game.money}g`,
  });
}

function statePlay(dt) {
  game.tickWrap();
  drawHUD();
  drawMap();
}

export function main() {
  if (engine.DEBUG) {
    // Enable auto-reload, etc
    net.init({ engine });
  }

  const font_info_04b03x2 = require('./img/font/04b03_8x2.json');
  const font_info_04b03x1 = require('./img/font/04b03_8x1.json');
  const font_info_palanquin32 = require('./img/font/palanquin32.json');
  let pixely = 'strict';
  if (pixely === 'strict') {
    font = { info: font_info_04b03x1, texture: 'font/04b03_8x1' };
  } else if (pixely && pixely !== 'off') {
    font = { info: font_info_04b03x2, texture: 'font/04b03_8x2' };
  } else {
    font = { info: font_info_palanquin32, texture: 'font/palanquin32' };
  }

  if (!engine.startup({
    game_width,
    game_height,
    pixely,
    font,
    viewport_postprocess: false,
    antialias: false,
    ui_sprites: {
      panel: { name: 'pixely/panel', ws: [3, 6, 3], hs: [3, 6, 3] },
    },
  })) {
    return;
  }
  font = engine.font;

  ui.scaleSizes(13 / 32);
  ui.setFontHeight(8);

  init();

  playInit();
  engine.setState(statePlay);
}
