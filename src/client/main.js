/*eslint global-require:off*/
// eslint-disable-next-line import/order
const local_storage = require('glov/client/local_storage.js');
local_storage.setStoragePrefix('LD51'); // Before requiring anything else that might load from this

import assert from 'assert';
import { createAnimationSequencer } from 'glov/client/animation.js';
import * as camera2d from 'glov/client/camera2d.js';
import * as engine from 'glov/client/engine.js';
import { ALIGN, fontStyle, styleColored } from 'glov/client/font.js';
import * as input from 'glov/client/input.js';
import * as net from 'glov/client/net.js';
import { preloadParticleData } from 'glov/client/particles.js';
import * as pico8 from 'glov/client/pico8.js';
import { randFastCreate } from 'glov/client/rand_fast.js';
import * as score_system from 'glov/client/score.js';
import { scoresDraw } from 'glov/client/score_ui.js';
import * as settings from 'glov/client/settings.js';
import { FADE, soundPlayMusic } from 'glov/client/sound.js';
import { spriteSetGet } from 'glov/client/sprite_sets.js';
import { createSprite } from 'glov/client/sprites.js';
import * as transition from 'glov/client/transition.js';
import * as ui from 'glov/client/ui.js';
import { mashString, randCreate } from 'glov/common/rand_alea.js';
import {
  clamp,
  defaults,
  easeOut,
  isInteger,
  lineCircleIntersect,
  lineLineIntersect,
  ridx,
} from 'glov/common/util.js';
import {
  v2addScale,
  v2copy,
  v2dist,
  v2iNormalize,
  v2iRound,
  v2set,
  v2sub,
  v3copy,
  v3set,
  v4set,
  vec2,
  vec4,
} from 'glov/common/vmath.js';
import {
  FRAME_ASTEROID,
  FRAME_ASTEROID_EMPTY,
  FRAME_ENEMY1,
  FRAME_ENEMY2,
  FRAME_FACTORY,
  FRAME_FACTORY_BUILDING,
  FRAME_FACTORY_EMPTY,
  FRAME_FACTORY_READY,
  FRAME_FIGHTER,
  FRAME_FIGHTERBAY,
  FRAME_FIGHTERBAY_BUILDING,
  FRAME_FIGHTERBAY_EMPTY,
  FRAME_LASER,
  FRAME_LASER_BUILDING,
  FRAME_LASER_EMPTY,
  FRAME_MINER,
  FRAME_MINERDONE,
  FRAME_MINERUL,
  FRAME_MINERUP,
  FRAME_MINER_BUILDING,
  FRAME_MUSIC_OFF,
  FRAME_MUSIC_ON,
  FRAME_ROUTER,
  FRAME_ROUTER_BUILDING,
  FRAME_SOUND_OFF,
  FRAME_SOUND_ON,
  FRAME_SPEED_FF,
  FRAME_SPEED_PLAY,
  FRAME_SUPPLY,
  sprite_space,
} from './img/space.js';
import * as particle_data from './particle_data.js';

const { PI, abs, atan2, ceil, cos, max, min, random, round, sin, sqrt, floor } = Math;

const TYPE_MINER = 'miner';
const TYPE_ASTEROID = 'asteroid';
const TYPE_FACTORY = 'factory';
const TYPE_ROUTER = 'router';
const TYPE_LASER = 'laser';
const TYPE_FIGHTERBAY = 'fbay';

const PACKET_SPEED = 100/1000; // pixels per millisecond
const SUPPLY_EMIT_TIME = 250;

const FACTORY_SUPPLY = 10;

const FIGHTER_JIGGLE = 0.005;
const volume_sfx = 0.5;
const volume_lasers = 0.3;

window.Z = window.Z || {};
Z.BACKGROUND = 1;
Z.SPRITES = 10;
Z[FRAME_ASTEROID_EMPTY] = 9;
Z[FRAME_ASTEROID] = 10;
Z.BUILD_PARTICLES = 12;
Z.LINKS = 15;
Z[FRAME_ROUTER] = 20;
Z.SUPPLY = 25;
Z[FRAME_LASER] = 30;
Z[FRAME_FIGHTERBAY] = 30;
Z[FRAME_MINERDONE] = 30;
Z[FRAME_MINER] = 30;
Z[FRAME_MINERUP] = 35;
Z[FRAME_MINERUL] = 35;
Z[FRAME_FACTORY] = 40;

Z.PARTICLES = 42;

Z.ENEMIES = 44;
Z.FIGHTERS = 45;
Z.ENEMY_LASERS = 46;
Z.PLAYER_LASERS = 47;
Z.BUILDING_BAR = 50;
Z.PLACE_PREVIEW = 60;

const LASER_TIME = 100;
const BIG_LASER_TIME = 1000;
const PLAYER_LASER_TIME = 150;

const { KEYS } = input;

// Virtual viewport for our game logic
const game_width = 720;
const game_height = 480;

const SPRITE_W = 13;
const H_SPRITE_W = 6;

const NUM_CARDS = 9;
const CARD_W = 47;
const CARD_X0 = 3;
const CARD_ICON_SCALE = 3;
const CARD_H = 72;
const CARD_ICON_W = CARD_ICON_SCALE * SPRITE_W;
const CARD_ICON_X = (CARD_W - CARD_ICON_W) / 2;
const CARD_Y = game_height - CARD_H;

const PAD_TOP = 24;
const PAD_LEFTRIGHT = 2;
const PAD_BOTTOM = CARD_H + 2;

let sprites = {};
let font;
let title_font;
//let title_font2;
function init() {
  sprites.test = createSprite({
    name: 'test',
  });
  sprites.border = createSprite({
    name: 'border',
  });
  sprites.starfield = createSprite({
    name: 'starfield',
  });
  ui.loadUISprite('card_panel', [3, 2, 3], [3, 2, 3]);
  ui.loadUISprite('reticule_panel', [3, 2, 3], [3, 2, 3]);
  ui.loadUISprite('card_button', [3, 2, 3], [CARD_H]);
  ui.loadUISprite('buttongreen', [4, 5, 4], [13]);
  ui.loadUISprite('buttongreen_down', [4, 5, 4], [13]);
  v4set(ui.color_panel, 1, 1, 1, 1);
}

const RADIUS_DEFAULT = 4.5;
const RADIUS_LINK_ASTEROID = SPRITE_W * 2;
const RADIUS_LINK_SUPPLY = SPRITE_W * 4;
const RSQR_ASTERIOD = RADIUS_LINK_ASTEROID * RADIUS_LINK_ASTEROID;
const RSQR_SUPPLY = RADIUS_LINK_SUPPLY * RADIUS_LINK_SUPPLY;
const MINE_RATE = 1000/8;

const ent_types = {
  [TYPE_FACTORY]: {
    type: TYPE_FACTORY,
    frame: FRAME_FACTORY,
    frame_building: FRAME_FACTORY_BUILDING,
    frame_full: FRAME_FACTORY,
    frame_empty: FRAME_FACTORY_EMPTY,
    label: 'Factory',
    desc: [`Generates ${FACTORY_SUPPLY} Supply every 10 seconds`],
    cost: 750,
    cost_supply: 7,
    r: RADIUS_DEFAULT,
    supply_prod: FACTORY_SUPPLY, // every 10 seconds
    supply_max: FACTORY_SUPPLY,
    max_links: Infinity,
    supply_source: true,
    hp: 200,
    die_sound: 'die_structure',
    build_sound: 'build4',
  },
  [TYPE_MINER]: {
    type: TYPE_MINER,
    frame: FRAME_MINER,
    frame_building: FRAME_MINER_BUILDING,
    label: 'Miner',
    desc: [`Harvests ${round(1000/MINE_RATE)}g per second`, 'Requires 1 Supply every 10 seconds'],
    cost: 100,
    cost_supply: 3,
    supply_max: 1,
    r: RADIUS_DEFAULT,
    mine_rate: MINE_RATE, // millisecond per ore
    supply_rate: 1/10000, // supply per millisecond
    max_links: 1,
    hp: 50,
    die_sound: 'die_fighter',
    build_sound: 'build3',
  },
  [TYPE_ROUTER]: {
    type: TYPE_ROUTER,
    frame: FRAME_ROUTER,
    frame_building: FRAME_ROUTER_BUILDING,
    label: 'Router',
    cost: 10,
    cost_supply: 1,
    supply_max: 0,
    r: 3,
    max_links: 5,
    hp: 20,
    die_sound: 'die_fighter',
    explosion: 'explosion_small',
  },
  [TYPE_LASER]: {
    type: TYPE_LASER,
    frame: FRAME_LASER,
    frame_building: FRAME_LASER_BUILDING,
    frame_nosupply: FRAME_LASER_EMPTY,
    label: 'Laser',
    cost: 400,
    cost_supply: 4,
    supply_max: 10,
    range_sq: 50*50,
    fire_time: 500,
    supply_per_shot: 0.5,
    damage: 3,
    r: RADIUS_DEFAULT,
    max_links: 1,
    hp: 100,
    die_sound: 'die_structure',
    build_sound: 'build4',
  },
  [TYPE_FIGHTERBAY]: {
    type: TYPE_FIGHTERBAY,
    frame: FRAME_FIGHTERBAY,
    frame_building: FRAME_FIGHTERBAY_BUILDING,
    frame_nosupply: FRAME_FIGHTERBAY_EMPTY,
    w: 15, h: 15,
    label: 'Flybay',
    cost: 1200,
    cost_supply: 6,
    supply_max: 10,
    range_sq: 16*16,
    fire_time: 300,
    supply_per_shot: 10,
    max_fighters: 10,
    damage: 2,
    angle_of_fire: PI/4,
    speed: 12/1000, // pixels per ms
    turning: 0.001, // radians per ms
    r: RADIUS_DEFAULT + 1,
    max_links: 1,
    fighter_hp: 3,
    hp: 200,
    z: Z.FIGHTERS,
    die_sound: 'die_structure',
    build_sound: 'build5',
  },
  [TYPE_ASTEROID]: {
    frame: FRAME_ASTEROID,
    max_links: 0,
  },
};

const buttons = [
  TYPE_FACTORY,
  TYPE_MINER,
  TYPE_ROUTER,
  TYPE_LASER,
  TYPE_FIGHTERBAY,
];

const enemy_types = [
  {
    wave_size: 16,
    name: 'Fighters',
    w: SPRITE_W,
    h: SPRITE_W,
    z: Z.ENEMIES,
    speed: 10/1000, // pixels per ms
    turning: 0.0008, // radians per ms
    damage: 1,
    angle_of_fire: PI/4,
    hp: 5,
    frame: FRAME_ENEMY1,
    last_fire_time: 0,
    last_fire_target: null,
    range_sq: 26*26,
    fire_time: 700,
    fire_time_rand: 200,
    laser_time: LASER_TIME,
    alert_sound: 'alert1',
    wave_mult: 1,
    wave_max: 40,
  },
  {
    wave_size: 3,
    name: 'Marauders',
    w: SPRITE_W,
    h: SPRITE_W,
    z: Z.ENEMIES,
    speed: 5/1000, // pixels per ms
    turning: 0.0004, // radians per ms
    damage: 20,
    angle_of_fire: PI,
    hp: 25,
    frame: FRAME_ENEMY2,
    last_fire_time: 0,
    last_fire_target: null,
    range_sq: 70*70,
    fire_time: 2500,
    fire_time_rand: 200,
    laser_time: BIG_LASER_TIME,
    alert_sound: 'alert2',
    wave_mult: 0.25,
    wave_max: 8,
  },
];

const level_defs = {
  intro: {
    num_asteroids: 20,
    display_name: '1/3 Intro', seed: 'test1',
    subtitle: 'No danger, learn the basics',
    danger_pattern: [0],
    danger_start: 6*3,
    danger: 12,
    ore_base: 500,
    ore_range: 1000,
  },
  med: {
    num_asteroids: 80,
    display_name: '2/3 Defense', seed: '1234',
    subtitle: 'TL;DR: Boss was wrong',
    danger_pattern: [0,0,0,0,1,0,0,1],
    danger_start: 6,
    danger: 6,
    ore_base: 500,
    ore_range: 1000,
  },
  hard: {
    num_asteroids: 100,
    display_name: '3/3 Hard', seed: '5678',
    subtitle: 'Is this even winnable?',
    danger_pattern: [0,0,0,1,0,1],
    danger_start: 6,
    danger: 3,
    ore_base: 300,
    ore_range: 1500,
  },
};
let level_list = Object.keys(level_defs).map((key) => {
  let def = level_defs[key];
  def.name = key;
  return def;
});
// for (let ii = 0; ii < level_list.length; ++ii) {
//   level_list[ii].idx = ii;
// }

const link_color_supply = [pico8.colors[9], pico8.colors[4]];
const link_color_asteroid = [pico8.colors[11], pico8.colors[3]];

function entDistSq(a, b) {
  return (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
}

function cmpDistSq(a, b) {
  return a.dist_sq - b.dist_sq;
}

function cmpDistSqAllowed(a, b) {
  if (a.allowed && !b.allowed) {
    return -1;
  }
  if (b.allowed && !a.allowed) {
    return 1;
  }
  return a.dist_sq - b.dist_sq;
}

function cmpID(a, b) {
  return a.id < b.id ? -1 : 1;
}

let rand_fast = randFastCreate();
function asteroidName(ent) {
  let { vis_seed } = ent;
  rand_fast.reseed(floor(vis_seed * 1000000));
  return `Asteroid ${2032 + rand_fast.range(100)} ` +
    `${String.fromCharCode('A'.charCodeAt(0) + rand_fast.range(26))}` +
    `${String.fromCharCode('A'.charCodeAt(0) + rand_fast.range(15))}`;
}

function levelSelectInit() {
  soundPlayMusic('menu', 0.75, FADE);
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  engine.setState(stateLevelSelect);
}


let delta = vec2();
let temp_pos = vec2();

function desiredRot(enemy, ent) {
  let dx = ent.x - enemy.x;
  let dy = ent.y - enemy.y;
  return atan2(dx, -dy);
}

let style_cannot_afford = fontStyle(null, {
  color: pico8.font_colors[8],
  outline_color: 0x000000ff,
  outline_width: 4,
});
let style_selected = fontStyle(null, {
  color: pico8.font_colors[10],
  outline_color: 0x000000ff,
  outline_width: 4,
});


class Game {

  addEnt(ent) {
    let ent_type = ent_types[ent.type];
    ent.frame = ent.frame || ent_type.frame;
    ent.w = ent.w || ent_type.w || SPRITE_W;
    ent.h = ent.h || ent_type.h || SPRITE_W;
    ent.z = ent.z || Z[ent.frame];
    ent.r = ent.r || ent_type.r || RADIUS_DEFAULT;
    ent.hp = ent.hp || ent_type.hp || 0;
    ent.hp_max = ent.hp;
    ent.pos = vec2(ent.x, ent.y);
    ent.supply = ent.supply || 0;
    ent.supply_max = ent_type.supply_max;
    ent.supply_enroute = false;
    ent.supply_source = ent_type.supply_source;
    ent.max_links = ent_type.max_links;
    if (ent.supply_source) {
      ent.order_time_accum = 0;
      ent.orders = [];
      // ent.frame = ent_type.frame_empty;
    }
    this.map[++this.last_id] = ent;
    ent.id = this.last_id;
    return ent;
  }

  constructor(level_idx) {
    this.level_idx = level_idx;
    this.ff = false;
    let ld = level_list[level_idx];
    this.ld = ld;
    let w = this.w = game_width - PAD_LEFTRIGHT * 2;
    let h = this.h = game_height - PAD_TOP - PAD_BOTTOM;
    let rand = this.rand = randCreate(mashString(ld.seed));
    let { num_asteroids } = ld;
    this.game_over = false;
    this.map = {};
    this.supply_links = [];
    this.packets = [];
    this.last_id = 0;
    this.round_robin_id = 0;
    this.paths_dirty = true;
    this.enemies = [];
    this.fighters = [];
    this.danger_idx = 0;

    let factory = this.addEnt({
      type: TYPE_FACTORY,
      x: w/2, y: h/2,
      supply: ent_types[TYPE_FACTORY].supply_max,
      active: true,
    });
    factory.frame = ent_types[TYPE_FACTORY].frame_full;

    let total_value = 0;
    while (num_asteroids) {
      let x = rand.floatBetween(0, 1);
      x = x * x * 0.9 + 0.05;
      x *= (rand.range(2) ? -1 : 1);
      x = x * w / 2 + w / 2;
      let y = rand.floatBetween(0, 1);
      y = y * y * 0.9 + 0.05;
      y *= (rand.range(2) ? -1 : 1);
      y = y * h / 2 + h / 2;
      if (this.entNear({ x, y })) {
        continue;
      }
      let ent = this.addEnt({
        type: TYPE_ASTEROID,
        x, y,
        rot: rand.random() * PI * 2,
        value: ld.ore_base + rand.range(ld.ore_range),
        vis_seed: random(),
      });
      total_value += ent.value;
      this.updateAsteroidSize(ent);
      --num_asteroids;
    }
    this.value_mined = 0;
    this.total_value = total_value;
    this.money = 450;
    this.selected = null;
    this.tick_counter = 0;
    this.decaseconds = 0;
    this.danger_countdown = 0;
    this.paused = true;
    this.wave_index = 0;
    this.selected_ent = null;
    if (engine.DEBUG) {
      // this.game_over = true;
      // this.paused = false;
      // this.selected = TYPE_MINER;
      // this.selected_ent = factory;
      // this.money = 20000;
    }
  }

  entNear(pos) {
    let { map } = this;
    let rsq = RADIUS_DEFAULT * RADIUS_DEFAULT;
    for (let key in map) {
      if (entDistSq(pos, map[key]) <= rsq) {
        return true;
      }
    }
    return false;
  }

  updateAsteroidSize(ent) {
    let v = clamp(1.0 + (ent.value - this.ld.ore_base) / this.ld.ore_range, 0.5, 1.5);
    ent.w = ent.h = SPRITE_W * v;
    ent.r = RADIUS_DEFAULT * v;
  }

  tickWrap() {
    if (this.paused) {
      return;
    }
    let dt = engine.getFrameDt();
    if (this.ff) {
      dt *= 10;
    }
    while (dt > 16) {
      this.tick(16);
      dt -= 16;
    }
    if (dt) {
      this.tick(dt);
    }
  }

  scrapValue(ent) {
    let ent_type = ent_types[ent.type];
    let value = round(ent_type.cost * 0.5);
    if (ent.type === TYPE_MINER && ent.exhausted) {
      let { map } = this;
      let ret = 0;
      for (let key in map) {
        ent = map[key];
        if (ent.type === TYPE_MINER && ent.exhausted) {
          ret += value;
        }
      }
      value = ret;
    }
    return value;
  }
  canScrap(ent) {
    let { map } = this;
    let ent_type = ent_types[ent.type];
    if (ent_type.supply_prod) {
      for (let key in map) {
        let other = map[key];
        if (other !== ent && ent_types[other.type].supply_prod) {
          return true;
        }
      }
      return false;
    }
    return true;
  }
  particle(ent, type, z) {
    if (particle_data.defs[type]) {
      engine.glov_particles.createSystem(particle_data.defs[type], [ent.x, ent.y, z || Z.PARTICLES]);
    }
  }
  scrap(ent, is_scrap_all, is_from_death) {
    let { supply_links, map, packets } = this;
    if (is_scrap_all) {
      for (let key in map) {
        ent = map[key];
        if (ent.type === TYPE_MINER && ent.exhausted) {
          this.scrap(ent, false, false);
        }
      }
      return;
    }
    if (!is_from_death) {
      this.money += this.scrapValue(ent);
    }
    let ent_type = ent_types[ent.type];
    ui.playUISound(ent_type.die_sound, volume_sfx);
    this.particle(ent, ent_type.explosion || 'explosion');
    this.paths_dirty = true;
    delete map[ent.id];
    for (let ii = supply_links.length - 1; ii >= 0; --ii) {
      let link = supply_links[ii];
      if (link[0] === ent.id || link[1] === ent.id) {
        ridx(supply_links, ii);
      }
    }
    for (let ii = packets.length - 1; ii >= 0; --ii) {
      let packet = packets[ii];
      if (packet.target === ent || packet.next === ent) {
        packet.target.supply_enroute = false;
        ridx(packets, ii);
      }
    }
    if (this.selected_ent === ent) {
      this.selected_ent = null;
    }
    for (let key in map) {
      let other = map[key];
      if (other.orders) {
        for (let ii = other.orders.length - 1; ii >= 0; --ii) {
          if (other.orders[ii] === ent) {
            other.orders.splice(ii, 1);
          }
        }
      }
    }
  }

  exhaustMiner(ent) {
    ent.asteroid_link = null;
    ent.exhausted = true;
    ent.supply = ent.supply_max = 0;
    ent.rot = 0;
    ent.frame = FRAME_MINERDONE;
  }

  activateMiner(ent) {
    let links = this.findAsteroidLinks(ent);
    if (!links.length) {
      this.exhaustMiner(ent);
      return false;
    }
    links.sort(cmpDistSq);
    ent.asteroid_link = links[0].id;
    this.updateMinerFrame(ent);
    return true;
  }

  updateMiner(ent, dt) {
    if (ent.exhausted || !ent.active) {
      return;
    }
    let asteroid = this.map[ent.asteroid_link];
    if (!asteroid.value) {
      this.activateMiner(ent);
      asteroid = this.map[ent.asteroid_link];
    }
    if (!ent.supply) {
      return;
    }
    ent.time_accum += dt;
    let rate = ent_types[ent.type].mine_rate; // ms per ore
    let { supply_rate } = ent_types[ent.type]; // supply per ms
    let mined = floor(ent.time_accum / rate);
    if (mined >= 1) {
      mined = min(mined, asteroid.value);
      let supply_limit = ceil(ent.supply / supply_rate / rate);
      mined = min(mined, supply_limit);
      asteroid.value -= mined;
      this.value_mined += mined;
      if (!asteroid.value) {
        asteroid.dead_asteroid = true;
        asteroid.frame = FRAME_ASTEROID_EMPTY;
        asteroid.z = Z[FRAME_ASTEROID_EMPTY];
      } else {
        this.updateAsteroidSize(asteroid);
      }
      this.money += mined;

      ent.supply = max(0, ent.supply - mined * rate * supply_rate);
      ent.time_accum -= mined * rate;
      if (!ent.supply) {
        ent.time_accum = 0;
        this.updateMinerFrame(ent);
      }

      if (this.value_mined === this.total_value) {
        this.endGame();
      }
    }
  }

  endGame() {
    this.paused = true;
    this.won = true;
    score_system.setScore(this.level_idx, {
      seconds: floor(this.tick_counter / 1000),
      progress: this.value_mined / this.total_value,
    });
    let { map } = this;
    for (let key in map) {
      let ent = map[key];
      if (ent.type === TYPE_MINER) {
        this.exhaustMiner(ent);
      }
    }
  }

  nextStep(from_id, to_id) {
    let paths = this.getPaths();
    while (true) {
      let path = paths[from_id][to_id];
      if (!path) {
        return 0;
      }
      if (path[1] === null) {
        return to_id;
      }
      to_id = path[1];
    }
  }

  emitSupply(source, target) {
    let next_id = this.nextStep(source.id, target.id);
    if (!next_id) {
      // must be no longer connected
      target.supply_enroute = false;
      return;
    }
    source.supply--;
    if (!source.supply) {
      source.frame = ent_types[source.type].frame_empty;
    }
    this.packets.push({
      x: source.x,
      y: source.y,
      frame: FRAME_SUPPLY,
      z: Z.SUPPLY,
      w: 5, h: 5,
      source,
      target,
      next: this.map[next_id],
      speed: PACKET_SPEED,
      pos: vec2(source.x, source.y),
    });
  }

  updateSupplySource(ent, dt) {
    ent.order_time_accum += dt;
    if (!ent.orders.length) {
      ent.order_time_accum = min(ent.order_time_accum, SUPPLY_EMIT_TIME);
      return;
    }
    if (ent.order_time_accum >= SUPPLY_EMIT_TIME) {
      ent.order_time_accum -= SUPPLY_EMIT_TIME;
      let target = ent.orders.splice(0, 1)[0];
      this.emitSupply(ent, target);
    }
  }

  getPaths() {
    if (!this.paths_dirty) {
      return this.paths;
    }
    this.paths_dirty = false;
    let { map, supply_links } = this;
    let paths = [];
    let keys = [];
    for (let key in map) {
      let ent = map[key];
      if (ent.max_links) {
        keys.push(ent.id);
      }
    }
    for (let ii = 0; ii < keys.length; ++ii) {
      let id = keys[ii];
      paths[id] = [];
      //paths[id][id] = [0, null];
    }
    for (let ii = 0; ii < supply_links.length; ++ii) {
      let link = supply_links[ii];
      let [a, b, dist] = link;
      assert(!paths[a][b]);
      paths[a][b] = paths[b][a] = [dist, null];
    }
    for (let pivot_i = 0; pivot_i < keys.length; ++pivot_i) {
      let pivot = keys[pivot_i];
      let pivot_ent = map[pivot];
      if (!pivot_ent.active) {
        continue;
      }
      for (let ii_i = 0; ii_i < keys.length; ++ii_i) {
        let ii = keys[ii_i];
        if (pivot === ii) {
          continue;
        }
        for (let jj_i = 0; jj_i < keys.length; ++jj_i) {
          let jj = keys[jj_i];
          if (pivot === jj) {
            continue;
          }
          let pij = paths[ii][jj];
          let pip = paths[ii][pivot];
          let ppj = paths[pivot][jj];
          if (pip && ppj) {
            let d = pip[0] + ppj[0];
            if (!pij) {
              paths[ii][jj] = paths[jj][ii] = [d, pivot];
            } else if (d < pij[0]) {
              assert.equal(pij, paths[jj][ii]);
              pij[0] = d;
              pij[1] = pivot;
            }
          }
        }
      }
    }
    this.paths = paths;
    return paths;
  }

  findSupplySource(ent) {
    let paths = this.getPaths();
    let { map } = this;
    let best = null;
    let bestd = Infinity;
    for (let key in map) {
      let other = map[key];
      if (other.supply_source && other.active &&
        other.supply > other.orders.length
      ) {
        let path = paths[ent.id][other.id];
        if (path && path[0] < bestd) {
          best = other;
          bestd = path[0];
        }
      }
    }
    return best;
  }

  orderSupply(source, target) {
    source.orders.push(target);
    target.supply_enroute = true;
  }

  pullSupply(ent) {
    assert(!ent.supply_enroute);
    // find supply to send
    let source = this.findSupplySource(ent);
    if (!source) {
      return false;
    }
    this.orderSupply(source, ent);
    return true;
  }

  buildingFinished(ent) {
    ent.building = null;
    let ent_type = ent_types[ent.type];
    ent.frame = ent_type.frame;
    if (ent.type === TYPE_MINER) {
      this.activateMiner(ent);
    } else if (ent.type === TYPE_ROUTER) {
      this.paths_dirty = true;
    }
    if (ent.supply_source) {
      ent.frame = ent_type.frame_empty;
    }
    if (ent_type.frame_nosupply) {
      ent.frame = ent_type.frame_nosupply;
    }
    if (ent.max_links > 1) {
      // supply passes through us
      this.reorderSupply();
    }
    if (ent_type.build_sound) {
      ui.playUISound(ent_type.build_sound);
    }
    if (ent.type !== TYPE_ROUTER) {
      this.particle(ent, 'build_finish', Z.BUILD_PARTICLES);
    }
  }

  updatePacket(packet, dt) {
    let { map } = this;
    let { speed, target, source, next, pos } = packet;
    let dist = dt * speed;
    while (true) {
      let dist_needed = v2dist(pos, next.pos);
      if (dist >= dist_needed) {
        // arrived at next node, advance
        v2copy(pos, next.pos);
        dist -= dist_needed;
        if (next === target) {
          break;
        }
        packet.source = source = next;
        let next_id = this.nextStep(source.id, target.id);
        if (!next_id) {
          // no longer has a link, I guess, just delete itself
          target.supply_enroute = false;
          return true;
        }
        packet.next = next = map[next_id];
      } else {
        v2iNormalize(v2sub(delta, next.pos, source.pos));
        v2addScale(pos, pos, delta, dist);
        packet.x = pos[0];
        packet.y = pos[1];
        return false;
      }
    }

    // arrived!
    target.supply_enroute = false;
    let { building } = target;
    if (building) {
      target.building_est = target.building;
      building.progress++;
      if (building.progress === building.required) {
        target.active = true;
        this.buildingFinished(target);
      }
    } else {
      target.supply = min(target.supply + 1, target.supply_max);
      if (target.type === TYPE_MINER) {
        this.activateMiner(target);
      }
      if (ent_types[target.type].frame_nosupply) {
        target.frame = ent_types[target.type].frame;
      }
    }
    if (this.needsSupply(target, true)) {
      this.pullSupply(target);
    }
    return true;
  }

  needsSupply(ent, post_packet) {
    return !ent.supply_enroute && (
      ent.building ||
      ent.supply_max && ent.supply < ent.supply_max && !ent.supply_source &&
        !(post_packet && ent.supply > ent.supply_max - 1)
    );
  }

  reorderSupply() {
    let { map } = this;
    for (let key in map) {
      let ent = map[key];
      if (this.needsSupply(ent, true)) {
        this.pullSupply(ent);
      }
    }
  }

  every10Seconds() {
    let { map, round_robin_id, fighters, enemies } = this;
    this.decaseconds++;
    // Generate supply, assemble list of who needs
    let needs_supply = [];
    for (let key in map) {
      let ent = map[key];
      let ent_type = ent_types[ent.type];
      if (ent.active && ent_type.supply_prod) {
        ent.supply = min(ent_type.supply_max, ent.supply + ent_type.supply_prod);
        ent.frame = ent_type.frame_full;
      }
      if (ent.launched_fighter_this_deca) {
        ent.launched_fighter_this_deca = false;
      }
      if (this.needsSupply(ent, false)) {
        needs_supply.push(ent);
      }
    }
    // Send to those in need
    needs_supply.sort(cmpID);
    let start_ent = needs_supply.find((a) => a.id > round_robin_id);
    let start_idx = start_ent ? needs_supply.indexOf(start_ent) : 0;
    // TODO: assemble the list of those who _could_ receive, then sort them by
    //    minimum distance from their sources, so we don't have packets crossing
    //    (probably, or, maybe packet re-routing if they would cross is simpler?)
    for (let ii = 0; ii < needs_supply.length; ++ii) {
      let idx = (start_idx + ii) % needs_supply.length;
      let ent = needs_supply[idx];
      if (this.pullSupply(ent)) {
        this.round_robin_id = ent.id;
      }
    }

    for (let ii = 0; ii < fighters.length; ++ii) {
      fighters[ii].patrol_target = null;
    }
    for (let ii = 0; ii < enemies.length; ++ii) {
      enemies[ii].target_id = null;
    }

    if (this.decaseconds >= this.ld.danger_start) {
      if (this.danger_countdown === 0) {
        this.danger_countdown = this.ld.danger;
        this.spawn_wave = true;
      }
      --this.danger_countdown;
    }

    if (!this.submitting_score) {
      this.submitting_score = true;
      score_system.setScore(this.level_idx, {
        seconds: floor(this.tick_counter / 1000),
        progress: this.value_mined / this.total_value,
      }, () => {
        this.submitting_score = false;
      });
    }
  }

  spawnWave() {
    if (this.game_over) {
      return;
    }
    this.spawn_wave = false;
    let { enemies, w, h, ld } = this;
    let direction = this.rand.random() * PI * 2;
    let idx = this.danger_idx++;
    let enemy_type = ld.danger_pattern[idx % ld.danger_pattern.length];
    let et = enemy_types[enemy_type];
    ui.playUISound(et.alert_sound);
    let count = min(round(et.wave_size + this.wave_index * et.wave_mult), et.wave_max);
    ++this.wave_index;
    let dist = game_width * 0.75; // / 4;
    for (let ii = 0; ii < count; ++ii) {
      direction += (this.rand.random() - 0.5) * 0.5;
      let cosd = cos(direction);
      let sind = sin(direction);
      let e = Object.create(et);
      e.x = w/2 + sind * dist;
      e.y = h/2 + cosd * dist;
      e.rot = this.rand.random() * 2 * PI; // -direction;
      e.fire_time = et.fire_time + this.rand.range(et.fire_time_rand);
      enemies.push(e);
    }
  }

  enemyFindTarget(enemy) {
    let { map } = this;
    let best = null;
    let bestd = Infinity;
    for (let key in map) {
      let ent = map[key];
      if (ent.hp) {
        let d = entDistSq(enemy, ent);
        if (d < bestd) {
          best = ent.id;
          bestd = d;
        }
      }
    }
    return best;
  }

  weaponFindTarget(ent, within_range) {
    let { enemies } = this;
    let ent_type = ent_types[ent.type];
    let best = null;
    let bestd = Infinity;
    for (let ii = 0; ii < enemies.length; ++ii) {
      let enemy = enemies[ii];
      let d = entDistSq(enemy, ent);
      if (d < bestd && (
        !within_range && enemy.x > 0 && enemy.y > 0 && enemy.x < this.w && enemy.y < this.h ||
        d <= ent_type.range_sq
      )) {
        best = enemy;
        bestd = d;
      }
    }
    return best;
  }

  damage(ent, amount) {
    ui.playUISound('laser', volume_lasers);
    ent.hp -= amount;
    if (ent.hp <= 0) {
      this.scrap(ent, false, true);
    }
  }

  damageEnemy(enemy, amount) {
    ui.playUISound('laser', volume_lasers);
    enemy.hp -= amount;
    if (enemy.hp <= 0) {
      enemy.dead = true;
      let idx = this.enemies.indexOf(enemy);
      assert(idx !== -1);
      ridx(this.enemies, idx);
      ui.playUISound('die_enemy', volume_sfx);
      this.particle(enemy, 'explosion_enemy');
    }
  }

  damageFighter(fighter, amount) {
    ui.playUISound('laser', volume_lasers);
    fighter.hp -= amount;
    if (fighter.hp <= 0) {
      fighter.dead = true;
      let idx = this.fighters.indexOf(fighter);
      assert(idx !== -1);
      ridx(this.fighters, idx);
      fighter.bay.num_fighters--;
      ui.playUISound('die_fighter', volume_sfx);
      this.particle(fighter, 'explosion_small');
    }
  }

  weaponUpdateTarget(ent, within_range) { // or fighter
    let { target } = ent;
    let ent_type = ent_types[ent.type];
    if (target && target.dead) {
      ent.target = target = null;
    }
    if (target && entDistSq(ent, target) > ent_type.range_sq) {
      target = null;
    }
    if (!target) {
      target = this.weaponFindTarget(ent, within_range);
      if (!target) {
        return;
      }
      ent.target = target;
    }
  }

  updateLaser(ent) {
    if (!ent.supply) {
      return;
    }
    this.weaponUpdateTarget(ent, true);
    let { target } = ent;
    if (!target) {
      return;
    }
    let ent_type = ent_types[ent.type];
    if (this.tick_counter - ent.last_fire_time >= ent_type.fire_time) {
      // can fire
      ent.last_fire_time = this.tick_counter;
      ent.last_fire_target = target;
      ent.supply = max(0, ent.supply - ent_type.supply_per_shot);
      this.damageEnemy(target, ent_type.damage);
      if (ent.supply <= ent.supply_max - 1 && !ent.supply_enroute) {
        this.pullSupply(ent);
      }
    }
  }

  updateShip(entlike, target, dt, firefunc, also_target_fighters) {
    if (target) {
      let desired_rot = desiredRot(entlike, target);
      if (entlike.rot < desired_rot - PI) {
        entlike.rot += PI * 2;
      }
      if (entlike.rot > desired_rot + PI) {
        entlike.rot -= PI * 2;
      }
      let drot = abs(entlike.rot - desired_rot);
      let rot_allowed = entlike.turning * dt;
      if (drot < rot_allowed) {
        entlike.rot = desired_rot;
      } else {
        if (entlike.rot < desired_rot) {
          entlike.rot += rot_allowed;
        } else {
          entlike.rot -= rot_allowed;
        }
      }

      drot = abs(entlike.rot - desired_rot);
      let dist_sq = entDistSq(entlike, target);
      if (this.tick_counter - entlike.last_fire_time >= entlike.fire_time) {
        // can fire
        if (!target.no_fire && drot < entlike.angle_of_fire && dist_sq < entlike.range_sq) {
          // target in range
          entlike.last_fire_time = this.tick_counter;
          entlike.last_fire_target = target;
          this[firefunc](target, entlike.damage);
        } else if (also_target_fighters) {
          // any fighters in range?
          let { fighters } = this;
          for (let ii = 0; ii < fighters.length; ++ii) {
            let fighter = fighters[ii];
            let fighter_dist_sq = entDistSq(fighter, entlike);
            if (fighter_dist_sq < entlike.range_sq &&
              abs(entlike.rot - desiredRot(entlike, fighter)) < entlike.angle_of_fire
            ) {
              entlike.last_fire_time = this.tick_counter;
              entlike.last_fire_target = fighter;
              this.damageFighter(fighter, entlike.damage);
              break;
            }
          }
        }
      }
    }
    let cosr = cos(entlike.rot);
    let sinr = sin(entlike.rot);
    entlike.x += sinr * entlike.speed * dt;
    entlike.y += -cosr * entlike.speed * dt;
  }

  updateFighter(ent, dt) {
    this.weaponUpdateTarget(ent, false);
    let { target } = ent;
    if (!target) {
      if (!ent.patrol_target) {
        ent.patrol_target = {
          x: this.w / 4 + random() * this.w / 2,
          y: this.h / 4 + random() * this.h / 2,
          no_fire: true,
        };
      }
      target = ent.patrol_target;
    } else {
      ent.patrol_target = null;
    }
    ent.rot += (random() - 0.5) * FIGHTER_JIGGLE * dt;
    this.updateShip(ent, target, dt, 'damageEnemy', false);
  }

  updateEnemy(enemy, dt) {
    let target = this.map[enemy.target_id];
    if (!target) {
      enemy.target_id = this.enemyFindTarget(enemy);
      if (!enemy.target_id) {
        this.game_over = true;
        // this.paused = true;
        // return;
      }
      target = this.map[enemy.target_id];
    }
    this.updateShip(enemy, target, dt, 'damage', true);
  }

  updateFighterbay(ent) {
    let ent_type = ent_types[ent.type];
    if (ent.supply < ent_type.supply_per_shot) {
      return;
    }
    if (ent.num_fighters >= ent_type.max_fighters || ent.launched_fighter_this_deca) {
      return;
    }
    ent.launched_fighter_this_deca = true;
    ent.num_fighters++;
    ent.supply -= ent_type.supply_per_shot;
    let fighter = Object.create(ent_type);
    fighter.x = ent.x;
    fighter.y = ent.y;
    fighter.frame = FRAME_FIGHTER;
    fighter.bay = ent;
    fighter.last_fire_time = 0;
    fighter.rot = this.rand.random() * PI * 2;
    fighter.hp = ent_type.fighter_hp;
    fighter.max_hp = fighter.hp;
    this.fighters.push(fighter);
    this.pullSupply(ent);
  }

  tick(dt) {
    let last_tick_counter = this.tick_counter;
    let last_tick_decasecond = floor(last_tick_counter / 10000);
    this.tick_counter += dt;
    let this_tick_decasecond = floor(this.tick_counter / 10000);
    if (last_tick_decasecond !== this_tick_decasecond) {
      this.every10Seconds();
    }

    if (this.spawn_wave || engine.DEBUG && input.keyDownEdge(KEYS.W)) {
      this.spawnWave();
    }

    let { map, packets, enemies, fighters } = this;
    for (let key in map) {
      let ent = map[key];
      if (ent.building) {
        // No updating while building
        continue;
      }
      if (ent.supply_source) {
        this.updateSupplySource(ent, dt);
      }

      if (ent.type === TYPE_MINER) {
        this.updateMiner(ent, dt);
      } else if (ent.type === TYPE_LASER) {
        this.updateLaser(ent);
      } else if (ent.type === TYPE_FIGHTERBAY) {
        this.updateFighterbay(ent);
      }
    }

    for (let ii = packets.length - 1; ii >= 0; --ii) {
      let packet = packets[ii];
      if (this.updatePacket(packet, dt)) {
        ridx(packets, ii);
      }
    }

    for (let ii = 0; ii < enemies.length; ++ii) {
      this.updateEnemy(enemies[ii], dt);
    }

    for (let ii = 0; ii < fighters.length; ++ii) {
      this.updateFighter(fighters[ii], dt);
    }
  }

  getSelected(ignore_afford) {
    if (this.game_over || this.won) {
      return null;
    }
    if (ignore_afford || this.canAfford(this.selected)) {
      return this.selected;
    }
    return null;
  }

  canAfford(ent_type) {
    return ent_types[ent_type]?.cost <= this.money;
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
      if (ent.type === TYPE_ASTEROID && ent.value && dist_sq <= RSQR_ASTERIOD) {
        links.push({ id, dist_sq });
      }
    }
    return links;
  }

  hasSupplyLinks(ent) {
    let mx = ent.max_links;
    if (!mx) {
      return false;
    }
    let { supply_links } = this;
    let count = 0;
    for (let ii = 0; ii < supply_links.length; ++ii) {
      let link = supply_links[ii];
      if (link[0] === ent.id || link[1] === ent.id) {
        ++count;
      }
    }
    return count < mx;
  }

  linkAllowed(pos0, target) {
    let { map, supply_links } = this;
    for (let id in map) {
      let ent = map[id];
      if (ent.dead_asteroid) {
        continue;
      }
      if (ent === target) {
        continue;
      }
      if (lineCircleIntersect(pos0, target.pos, ent.pos, ent.r)) {
        return false;
      }
    }
    for (let ii = 0; ii < supply_links.length; ++ii) {
      let link = supply_links[ii];
      let a = map[link[0]];
      let b = map[link[1]];
      if (a === target || b === target) {
        continue;
      }
      if (lineLineIntersect(a.pos, b.pos, pos0, target.pos)) {
        return false;
      }
    }
    return true;
  }

  canPlace(param) {
    let selected = this.getSelected(true);
    let elem = ent_types[selected];
    let { map, supply_links } = this;
    let { r } = elem;
    let { links } = param;
    v2set(temp_pos, param.x, param.y);
    let had_asteroid = false;
    let new_supply_links = [];
    let any_allowed_supply = false;
    for (let id in map) {
      id = Number(id);
      let ent = map[id];
      if (ent.dead_asteroid) {
        continue;
      }
      let dist_sq = entDistSq(ent, param);
      if (dist_sq <= (r + ent.r) * (r + ent.r)) {
        return false;
      }
      if (selected === TYPE_MINER && ent.type === TYPE_ASTEROID && ent.value && dist_sq <= RSQR_ASTERIOD) {
        had_asteroid = true;
        links.push({ id, dist_sq, allowed: true });
      }
      if (dist_sq <= RSQR_SUPPLY && this.hasSupplyLinks(ent)) {
        if (ent.max_links === 1 && elem.max_links === 1) {
          // never connect two leaves
        } else {
          if (this.linkAllowed(temp_pos, ent)) {
            new_supply_links.push({ id, dist_sq, allowed: true });
            any_allowed_supply = true;
          } else {
            new_supply_links.push({ id, dist_sq, allowed: false });
          }
        }
      }
    }
    for (let ii = 0; ii < supply_links.length; ++ii) {
      let link = supply_links[ii];
      if (lineCircleIntersect(map[link[0]].pos, map[link[1]].pos, temp_pos, r)) {
        return false;
      }
    }

    if (selected === TYPE_MINER && !had_asteroid) {
      return false;
    }
    new_supply_links.sort(cmpDistSqAllowed);
    for (let ii = 0; ii < min(new_supply_links.length, elem.max_links); ++ii) {
      links.push(new_supply_links[ii]);
    }
    return any_allowed_supply;
  }

  updateMinerFrame(miner) {
    if (miner.exhausted) {
      return;
    }
    if (!miner.supply) {
      miner.frame = FRAME_MINER;
      miner.rot = 0;
      return;
    }
    let asteroid = this.map[miner.asteroid_link];
    let dx = asteroid.x - miner.x;
    let dy = asteroid.y - miner.y;
    if (abs(dx) > 2 * abs(dy)) {
      miner.frame = FRAME_MINERUP;
      if (dx < 0) {
        miner.rot = 3*PI/2;
      } else {
        miner.rot = PI/2;
      }
    } else if (abs(dy) > 2 * abs(dx)) {
      miner.frame = FRAME_MINERUP;
      if (dy < 0) {
        miner.rot = 0;
      } else {
        miner.rot = PI;
      }
    } else {
      miner.frame = FRAME_MINERUL;
      if (dx < 0 && dy < 0) {
        miner.rot = 0;
      } else if (dx < 0 && dy >= 0) {
        miner.rot = 3*PI/2;
      } else if (dx >= 0 && dy < 0) {
        miner.rot = PI/2;
      } else {
        miner.rot = PI;
      }
    }
  }

  place(param) {
    let { x, y, links } = param;
    let selected = this.getSelected();
    let ent_type = ent_types[selected];
    let { map } = this;
    let { frame, frame_building, cost } = ent_type;
    let ent = this.addEnt({
      type: selected,
      frame: frame_building, x, y, z: Z[frame],
      rot: 0,
      active: false,
      building: {
        progress: 0,
        required: ent_type.cost_supply,
        supply_enroute: false,
      },
      vis_seed: random(),
    });
    ent.building_est = ent.building;
    let asteroid_link;
    // Find first of any given type
    links.forEach((a) => {
      let { id, dist_sq, allowed } = a;
      if (!allowed) {
        return;
      }
      let asteroid = map[id];
      if (asteroid.type === TYPE_ASTEROID) {
        if (!asteroid_link) {
          asteroid_link = id;
        }
      } else {
        // must be supply link
        this.supply_links.push([id, ent.id, sqrt(dist_sq)]);
        this.paths_dirty = true;
      }
    });
    if (selected === TYPE_MINER) {
      ent.time_accum = 0;
      ent.exhausted = false;
      //ent.asteroid_link = asteroid_link;
      //assert(ent.asteroid_link);
      //this.updateMinerFrame(ent);
    }
    if (selected === TYPE_LASER) {
      ent.last_fire_time = 0;
    }
    if (selected === TYPE_FIGHTERBAY) {
      ent.num_fighters = 0;
    }
    this.money -= cost;

    this.pullSupply(ent);

    this.paused = false;
    this.particle(ent, 'build', Z.BUILD_PARTICLES);
  }

  availableSupply() {
    let { map } = this;
    let avail = 0;
    let total = 0;
    for (let key in map) {
      let ent = map[key];
      if (ent.supply_max && ent.supply_source) {
        total += ent.supply_max;
        if (ent.active) {
          avail += ent.supply;
        }
      }
    }
    return [avail, total];
  }
}

let game;

function playInit(level_idx, resume_game) {
  if (!resume_game) {
    game = new Game(level_idx);
  }
  soundPlayMusic('bgm', 0.5, FADE);
}

let mouse_pos = vec2();
let place_color = vec4();
function drawGhost(viewx0, viewy0, viewx1, viewy1) {
  let { map } = game;
  let selected = game.getSelected(true);
  if (selected !== null) {
    input.mousePos(mouse_pos);
    v2iRound(mouse_pos);
    let x = mouse_pos[0];
    let y = mouse_pos[1];
    let place_param = { x, y, links: [] };
    let can_place = game.canPlace(place_param) && x >= viewx0 && x < viewx1 && y >= viewy0 && y < viewy1;
    let can_afford = game.canAfford(selected);
    v4set(place_color, 1, 1, 1, 1);
    if (!can_place) {
      v3set(place_color, 1, 0, 0);
    }
    if (!can_afford) {
      place_color[3] = 0.5;
    }
    let ent_type = ent_types[selected];
    let miner = {
      x, y, z: Z.PLACE_PREVIEW,
      w: ent_type.w || SPRITE_W,
      h: ent_type.h || SPRITE_W,
      frame: ent_type.frame,
      color: place_color,
    };
    let { links } = place_param;
    links.sort(cmpDistSq);
    let seen = {};
    for (let ii = 0; ii < links.length; ++ii) {
      let link = links[ii];
      let ent = map[link.id];
      let is_first = !seen[ent.type];
      let color;
      if (ent.type === TYPE_ASTEROID) {
        if (is_first) {
          miner.asteroid_link = link.id;
          miner.active = true;
          miner.exhausted = false;
          game.updateMinerFrame(miner);
        }
        color = link_color_asteroid[is_first ? 0 : 1];
      } else if (!link.allowed) {
        color = pico8.colors[8];
      } else {
        color = link_color_supply[0];
      }
      seen[ent.type] = true;
      ui.drawLine(x, y, ent.x, ent.y, Z.LINKS + (is_first ? 2 : 1), 1, 1, color);
    }
    if (can_place && can_afford) {
      if (input.click({ max_dist: Infinity })) {
        game.place(place_param);
        ui.playUISound('place');
      }
    }
    sprite_space.draw(miner);
  }
}

const BUILDING_W = 11;
const BUILDING_H = 4;

function drawMap(dt) {
  gl.clearColor(0,0,0,1);
  let viewx0 = 0;
  let viewy0 = 0;
  // TODO: if zooming, offsets need to be in screen space, not view space!
  let xoffs = PAD_LEFTRIGHT;
  let yoffs = PAD_TOP;
  let viewx1 = game_width - PAD_LEFTRIGHT*2;
  let viewy1 = game_height - PAD_TOP - PAD_BOTTOM;
  camera2d.set(-xoffs, -yoffs, game_width - xoffs, game_height - yoffs);

  let blink = ((game.tick_counter % 10000) > 9000) &&
    game.tick_counter % 250 > 125;

  let { map, supply_links, packets, enemies, fighters, tick_counter } = game;
  for (let key in map) {
    let elem = map[key];
    let frame_save = elem.frame;
    if (elem.type === TYPE_FACTORY && elem.active && blink) {
      elem.frame = FRAME_FACTORY_READY;
    }
    sprite_space.draw(elem);
    elem.frame = frame_save;
    // if (elem.supply) {
    //   font.draw({
    //     x: elem.x,
    //     y: elem.y,
    //     text: `${elem.supply}`,
    //   });
    // }
    if (elem.last_fire_time) {
      if (elem.last_fire_time > tick_counter - PLAYER_LASER_TIME) {
        let target = elem.last_fire_target;
        ui.drawLine(elem.x, elem.y, target.x, target.y, Z.PLAYER_LASERS, 1.5, 0.5, pico8.colors[12]);
      }
    }

    if (!elem.dead_asteroid) {
      let elem_pos = {
        x: floor(elem.x - elem.r),
        y: floor(elem.y - elem.r),
        w: ceil(elem.r * 2 + 1),
        h: ceil(elem.r * 2 + 1),
      };
      let click = input.click(elem_pos);
      if (click) {
        ui.playUISound('button_click');
        if (click.button === 1 && elem.type !== TYPE_ASTEROID) {
          game.selected = elem.type;
          game.selected_ent = null;
        } else {
          game.selected_ent = elem;
          game.selected = null;
        }
      }
      if (game.selected_ent === elem) {
        ui.drawBox({
          x: elem_pos.x - 2,
          y: elem_pos.y - 2,
          w: elem_pos.w + 5,
          h: elem_pos.h + 5,
        }, ui.sprites.reticule_panel, 1);
      }
    }
    let { asteroid_link, building_est, hp, hp_max } = elem;
    let bar_y = elem.y - H_SPRITE_W - BUILDING_H;
    if (building_est) {
      let { progress, required } = building_est;
      let x = elem.x - floor(BUILDING_W/2);
      let y = bar_y;
      ui.drawRect(x, y, x + BUILDING_W, y + BUILDING_H, Z.BUILDING_BAR, pico8.colors[1]);
      let p = progress/required;
      building_est.p = min((building_est.p || 0) + dt / 100 / required, p);
      ui.drawRect(x+1, y+1, x+1 + (BUILDING_W-2) * building_est.p, y + BUILDING_H - 1,
        Z.BUILDING_BAR, pico8.colors[9]);
      if (building_est.p === 1) {
        delete elem.building_est;
      }
      bar_y -= BUILDING_H;
    }
    if (hp_max && hp < hp_max) {
      // draw health bars
      let x = elem.x - floor(BUILDING_W/2);
      let y = bar_y;
      let p = hp/hp_max;
      ui.drawRect(x, y, x + BUILDING_W, y + BUILDING_H, Z.BUILDING_BAR, pico8.colors[p < 0.2 ? 8 : 2]);
      ui.drawRect(x+1, y+1, x+1 + (BUILDING_W-2) * p, y + BUILDING_H - 1,
        Z.BUILDING_BAR, pico8.colors[11]);
    }
    if (asteroid_link) {
      let other = map[asteroid_link];
      let w = 1;
      let p = 1;
      let active_color = 1;
      if (elem.supply) {
        w += abs(sin(engine.frame_timestamp * 0.008 + elem.vis_seed * PI * 2));
        p = 0.9;
        active_color = 0;
      }
      ui.drawLine(elem.x, elem.y, other.x, other.y, Z.LINKS, w, p,
        link_color_asteroid[active_color]);
    }
  }
  for (let ii = 0; ii < supply_links.length; ++ii) {
    let [a, b] = supply_links[ii];
    let elem = map[a];
    let other = map[b];
    ui.drawLine(elem.x, elem.y, other.x, other.y, Z.LINKS, 1, 1,
      link_color_supply[0]);
  }
  for (let ii = 0; ii < packets.length; ++ii) {
    let packet = packets[ii];
    sprite_space.draw(packet);
  }
  for (let ii = 0; ii < enemies.length; ++ii) {
    let enemy = enemies[ii];
    if (enemy.x < viewx0 || enemy.x > viewx1 ||
      enemy.y < viewy0 || enemy.y > viewy1
    ) {
      let etemp = Object.create(enemy);
      etemp.x = clamp(enemy.x, viewx0, viewx1);
      etemp.y = clamp(enemy.y, viewy0, viewy1);
      sprite_space.draw(etemp);
    } else {
      sprite_space.draw(enemy);
      if (enemy.last_fire_time > tick_counter - enemy.laser_time) {
        let target = enemy.last_fire_target;
        ui.drawLine(enemy.x, enemy.y, target.x, target.y, Z.ENEMY_LASERS, 1.5, 0.5, pico8.colors[8]);
      }
    }
  }
  for (let ii = 0; ii < fighters.length; ++ii) {
    let fighter = fighters[ii];
    sprite_space.draw(fighter);
    if (fighter.last_fire_time > tick_counter - LASER_TIME) {
      let target = fighter.last_fire_target;
      ui.drawLine(fighter.x, fighter.y, target.x, target.y, Z.PLAYER_LASERS, 1.5, 0.5, pico8.colors[12]);
    }
  }

  drawGhost(viewx0, viewy0, viewx1, viewy1);

  let uv_slide = engine.getFrameTimestamp() * 0.000001;
  sprites.starfield.draw({
    x: 0, y: 0, w: 1024, h: 1024,
    uvs: [uv_slide*0.3,uv_slide,2+uv_slide*0.3,2+uv_slide],
    z: Z.BACKGROUND,
    color: [1,1,1,0.4],
  });
}

const CARD_LABEL_Y = CARD_Y + CARD_ICON_X * 2 + CARD_ICON_W;
const CARD_SUPPLY_Y = CARD_Y + CARD_H - 5;

function perc(v) {
  let rv = round(v * 100);
  if (rv === 100 && v !== 1) {
    rv = 99;
  }
  return `${rv}%`;
}

function pad2(v) {
  return `0${v}`.slice(-2);
}
function timefmt(ms) {
  let s = floor(ms / 1000);
  let m = floor(s / 60);
  s -= m * 60;
  return `${m}:${pad2(s)}`;
}

function fmtSupply(v) {
  if (isInteger(v)) {
    return v;
  }
  return v.toFixed(2);
}

let win_anim;
let win_alpha = {
  alpha: 0,
};
let style_win = fontStyle(null, {
  color: pico8.font_colors[11],
  outline_width: 1,
  outline_color: pico8.font_colors[10],
  glow_color: pico8.font_colors[10],
  glow_inner: -5,
  glow_outer: 4,
  glow_xoffs: 1,
  glow_yoffs: 1,
});
let style_game_over = fontStyle(style_win, {
  color: pico8.font_colors[8],
  outline_color: pico8.font_colors[2],
  glow_color: pico8.font_colors[2],
});

function drawHUD(dt) {
  v3copy(engine.border_clear_color, pico8.colors[15]);
  camera2d.set(0, 0, game_width, game_height);
  sprites.border.draw({ x: 0, y: 0, w: game_width, h: game_height, z: Z.UI - 1 });
  let x = CARD_X0;
  let selected = game.getSelected();
  for (let ii = 0; ii < NUM_CARDS; ++ii) {
    if (ii < buttons.length) {
      let type_id = buttons[ii];
      let ent_type = ent_types[type_id];
      let { frame } = ent_type;
      sprite_space.draw({
        frame,
        x: x + CARD_ICON_X + floor(CARD_ICON_W/2),
        y: CARD_Y + CARD_ICON_X + floor(CARD_ICON_W/2),
        w: CARD_ICON_W,
        h: CARD_ICON_W,
        z: Z.UI + 2
      });

      if (game.selected === type_id) {
        font.draw({
          style: selected === null ? style_cannot_afford : style_selected,
          x: x + 1,
          y: CARD_Y + CARD_ICON_X,
          z: Z.UI + 3,
          w: CARD_W,
          h: CARD_ICON_W,
          text: (game.game_over || game.won) ? 'GAME\nOVER' : selected === null ? 'CANNOT\nAFFORD' : 'SELECTED',
          align: ALIGN.HVCENTER | ALIGN.HWRAP,
        });
      }

      // label
      font.draw({
        color: 0x000000ff,
        x, y: CARD_LABEL_Y,
        z: Z.UI + 3,
        w: CARD_W,
        text: ent_type.label,
        align: ALIGN.HCENTER,
      });

      // cost
      font.draw({
        color: pico8.font_colors[game.canAfford(type_id) ? 3 : 8],
        x, y: CARD_LABEL_Y + ui.font_height,
        z: Z.UI + 3,
        w: CARD_W,
        text: `${ent_type.cost}g`,
        align: ALIGN.HCENTER,
      });
      // cost in supply
      let { cost_supply } = ent_type;
      let supply_w = 5;
      let supply_x = floor((CARD_W - (supply_w + 1) * (cost_supply - 1)) / 2);
      for (let jj = 0; jj < cost_supply; ++jj) {
        sprite_space.draw({
          x: x + supply_x + (supply_w + 1) * jj,
          y: CARD_SUPPLY_Y,
          w: 5, h: 5,
          frame: FRAME_SUPPLY,
        });
      }

      // hotkey
      let key = String.fromCharCode('1'.charCodeAt(0) + ii);
      font.draw({
        x: x + 2 + (ii === 0 ? 1 : 0), y: CARD_Y + 2, w: CARD_W - 4, h: CARD_H - 4,
        text: key,
        color: pico8.font_colors[5],
        align: ALIGN.HRIGHT,
      });

      if (ui.button({
        x, y: CARD_Y,
        w: CARD_W, h: CARD_H,
        text: ' ',
        base_name: 'card_button',
        hotkey: KEYS[key],
      })) {
        game.selected = game.selected === type_id ? null : type_id;
        game.selected_ent = null;
      }
      if (input.keyDownEdge(KEYS[`NUMPAD${ii+1}`])) {
        ui.playUISound('button_click');
        game.selected = game.selected === type_id ? null : type_id;
        game.selected_ent = null;
      }
    }
    // ui.panel({
    //   x, y: CARD_Y,
    //   w: CARD_W, h: CARD_H,
    //   sprite: ui.sprites.card_panel,
    // });
    x += CARD_W + 2;
  }

  let { selected_ent } = game;
  if (selected_ent || game.selected) {
    if (game.selected) {
      selected_ent = {
        type: game.selected,
      };
    }
    let y = CARD_Y;
    let line_height = ui.font_height + 1;
    let { type } = selected_ent;
    let ent_type = ent_types[type];
    x += 2;
    let panel_param = {
      x, y,
      w: game_width - x - 4,
      h: CARD_H,
    };
    x += 4;
    y += 4;

    if (type === TYPE_ASTEROID) {
      font.draw({
        color: pico8.font_colors[0],
        x, y,
        text: asteroidName(selected_ent),
      });
      y += line_height;
      font.draw({
        color: pico8.font_colors[0],
        x, y,
        text: selected_ent.value ? `Remaining value: ${selected_ent.value}g` : 'DEPLETED',
      });
      y += line_height;
      if (selected_ent.value) {
        font.draw({
          color: pico8.font_colors[3],
          x, y,
          text: 'Hint: Build Miners nearby to mine',
        });
        y += line_height;
      }
      font.draw({
        color: pico8.font_colors[0],
        x, y,
        text: 'Asteroids can be built over once depleted',
      });
      y += line_height;
    } else {
      font.draw({
        color: pico8.font_colors[0],
        x, y,
        text: ent_type.label,
      });
      font.draw({
        color: pico8.font_colors[0],
        x, y,
        w: panel_param.x + panel_param.w - 4 - x,
        align: ALIGN.HCENTER,
        text: game.selected ? `${ent_type.hp} HP` : `${selected_ent.hp} / ${selected_ent.hp_max} HP`,
      });
      y += line_height;

      if (ent_type.desc) {
        for (let ii = 0; ii < ent_type.desc.length; ++ii) {
          let line = ent_type.desc[ii];
          font.draw({
            color: pico8.font_colors[0],
            x, y,
            text: line,
          });
          y += line_height;
        }
      }

      if (ent_type.max_links > 1) {
        let text = isFinite(ent_type.max_links) ?
          `Supports ${ent_type.max_links} supply links` :
          'Supports unlimited supply links';
        font.draw({
          color: pico8.font_colors[0],
          x, y,
          text,
        });
        y += line_height;
      }

      if (type === TYPE_FIGHTERBAY) {
        font.draw({
          color: pico8.font_colors[0],
          x, y,
          text: `Supply per Fighter: ${ent_type.supply_per_shot}`,
        });
        y += line_height;
        font.draw({
          color: pico8.font_colors[0],
          x, y,
          text: `Fighter HP: ${ent_type.fighter_hp}`,
        });
        y += line_height;
        font.draw({
          color: pico8.font_colors[0],
          x, y,
          text: `Fighter Damage: ${ent_type.damage}`,
        });
        y += line_height;
      } else {
        if (ent_type.damage) {
          font.draw({
            color: pico8.font_colors[0],
            x, y,
            text: `Damage: ${ent_type.damage}`,
          });
          y += line_height;
        }
        if (ent_type.fire_time) {
          font.draw({
            color: pico8.font_colors[0],
            x, y,
            text: `Shots every 10 seconds: ${10000 / ent_type.fire_time}`,
          });
          y += line_height;
        }
        if (ent_type.supply_per_shot) {
          font.draw({
            color: pico8.font_colors[0],
            x, y,
            text: `Shots per Supply: ${1 / ent_type.supply_per_shot}`,
          });
          y += line_height;
        }
      }
      if (ent_type.supply_max) {
        font.draw({
          color: pico8.font_colors[0],
          x, y,
          text: `Max Supply: ${ent_type.supply_max}`,
        });
        y += line_height;
      }

      if (game.selected) {
        // details on build option
        y += 4;
        font.draw({
          color: pico8.font_colors[0],
          x, y,
          text: `Cost to build: ${ent_type.cost}g and ${ent_type.cost_supply} Supply`,
        });
        y += line_height;
        if (game.selected === TYPE_FIGHTERBAY) {
          font.draw({
            color: pico8.font_colors[3],
            x, y,
            text: 'Hint: Build close to a factory',
          });
          y += line_height;
        }

      } else {
        // details on real ent
        y += 3;

        if (selected_ent.building) {
          font.draw({
            color: pico8.font_colors[4],
            x, y,
            text: `Build progress: ${selected_ent.building.progress} / ${selected_ent.building.required}`,
          });
          y += line_height;
        } else if (selected_ent.supply_max) {
          font.draw({
            color: pico8.font_colors[4],
            x, y,
            text: `Supply: ${fmtSupply(selected_ent.supply)} / ${selected_ent.supply_max}`,
          });
          y += line_height;
        }
        font.draw({
          color: pico8.font_colors[0],
          x, y,
          text: `Scrap value: ${game.scrapValue(selected_ent)}g`,
        });
        y += line_height;

        let button_w = 72;
        y = CARD_Y + 4;
        x = game_width - 9 - button_w;
        let disabled = !game.canScrap(selected_ent);
        let is_scrap_all = selected_ent.type === TYPE_MINER && selected_ent.exhausted;
        if (ui.button({
          x, y, w: button_w,
          text: is_scrap_all ? 'Scrap All (Del)' : 'Scrap (Del)',
          disabled,
          hotkey: KEYS.DEL,
        })) {
          game.scrap(selected_ent, is_scrap_all, false);
        } else if (!disabled && (input.keyDownEdge(KEYS.NUMPAD_DECIMAL_POINT) || input.keyDownEdge(KEYS.BACKSPACE))) {
          ui.playUISound('button_click');
          game.scrap(selected_ent, is_scrap_all, false);
        }
      }
    }
    ui.panel(panel_param);
  }

  let y = 0;
  let status_size = ui.font_height * 2;
  let status_text_y = y + 4;
  let status_h = status_size + 8;
  let status_w = floor((game_width - 4 * 2 - 2 * 3) / 4);
  x = 4;
  ui.panel({
    x, y,
    w: status_w,
    h: status_h,
  });
  font.draw({
    color: pico8.font_colors[3],
    x: x + 6,
    y: status_text_y,
    z: Z.UI + 1,
    size: status_size,
    text: `Money: ${game.money}g`,
  });

  x += status_w + 2;
  ui.panel({
    x, y,
    w: status_w,
    h: status_h,
  });

  let [supply_cur, supply_max] = game.availableSupply();
  font.draw({
    color: pico8.font_colors[4],
    x: x + 6,
    y: status_text_y,
    z: Z.UI + 1,
    size: status_size,
    text: `Supply: ${supply_cur} / ${supply_max}`,
  });

  x += status_w + 2;
  let progress_w = round(status_w * 1.25);
  ui.panel({
    x, y,
    w: progress_w,
    h: status_h,
  });
  let progress = game.value_mined / game.total_value;
  ui.drawRect(x + 3, y + 3, x + 3 + (progress_w - 6) * progress, y + status_h - 3, Z.UI, pico8.colors[3]);

  font.draw({
    color: pico8.font_colors[0],
    x: x + 6,
    y: status_text_y,
    z: Z.UI + 2,
    size: status_size,
    text: `${game.value_mined} / ${game.total_value}` +
      `  ${timefmt(game.tick_counter)}`,
  });

  x += progress_w + 2;

  x = game_width - ui.button_width - 4;
  if (ui.button({
    x, y: 0,
    h: status_h,
    font_height: status_size,
    text: 'Menu',
  })) {
    levelSelectInit();
  }

  x -= status_h + 2;
  let ff_button = {
    img: sprite_space,
    shrink: 16/status_h,
    frame: FRAME_SPEED_PLAY,
    x, y: 0, h: status_h, w: status_h,
    sound_button: null,
    tooltip: 'Fast Forward (hotkeys: F, SHIFT)',
  };
  let was_ff = game.ff;
  if (input.mouseDownOverBounds(ff_button) || input.keyDown(KEYS.SHIFT) || input.keyDown(KEYS.F)) {
    ff_button.frame = FRAME_SPEED_FF;
    ff_button.base_name = 'buttongreen';
    game.ff = true;
  } else {
    game.ff = false;
  }
  if (game.ff !== was_ff) {
    ui.playUISound(game.ff ? 'speed_fast' : 'speed_slow');
  }
  ui.buttonImage(ff_button);


  if (game.won || game.game_over) {
    if (!win_anim) {
      win_anim = createAnimationSequencer();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      let t = win_anim.add(0, 1000, (p) => {
        win_alpha.alpha = p;
      });
      // t = win_anim.add(t + 200, 1000, (p) => {
      //   win_alpha.desc = p;
      // });
    }
    win_anim.update(dt);
    title_font.draw({
      alpha: easeOut(win_alpha.alpha, 2),
      style: game.game_over ? style_game_over : style_win,
      text: game.game_over ? 'GAME OVER' : 'LEVEL COMPLETE!',
      x: 0, y: 0, w: game_width, h: game_height * 0.85,
      size: ui.font_height * 8,
      align: ALIGN.HVCENTER,
    });
    let button_w = ui.button_width * 3;
    if (ui.buttonText({
      x: (game_width - button_w) / 2, y: game_height * 5/8,
      w: button_w,
      h: status_h,
      font_height: status_size,
      color: [1,1,1,win_alpha.alpha],
      text: game.game_over ? 'I\'ll do better next time' : 'I\'m good at this.',
    })) {
      levelSelectInit();
    }
  } else {
    win_anim = null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function statePlay(dt) {
  game.tickWrap();
  if ((game.selected || game.selected_ent) && (input.click({ button: 2 }) || input.keyUpEdge(KEYS.ESC))) {
    if (game.selected) {
      game.selected = null;
    } else {
      game.selected_ent = null;
    }
  }
  drawHUD(dt);
  drawMap(dt);
  if (game.selected_ent && input.click()) {
    game.selected_ent = null;
  }
}

let style_title = fontStyle(null, {
  color: pico8.font_colors[7],
  outline_color: pico8.font_colors[3],
  outline_width: 1.1,
  glow_color: pico8.font_colors[1],
  glow_inner: -2,
  glow_outer: 8,
  glow_xoffs: 2.5,
  glow_yoffs: 2.5,
});

const SCORE_COLUMNS = [
  // widths are just proportional, scaled relative to `width` passed in
  { name: '', width: 12, align: ALIGN.HFIT | ALIGN.HRIGHT | ALIGN.VCENTER },
  { name: 'Name', width: 60, align: ALIGN.HFIT | ALIGN.VCENTER },
  { name: 'Progress', width: 24 },
  { name: 'Time', width: 24 },
];
const style_score = styleColored(null, pico8.font_colors[7]);
const style_me = styleColored(null, pico8.font_colors[11]);
const style_header = styleColored(null, pico8.font_colors[6]);
function myScoreToRow(row, score) {
  let seconds = score.seconds;
  let s = (seconds % 60);
  seconds -= s;
  let m = seconds / 60;
  row.push(perc(score.progress), `${m}:${pad2(s)}`);
}

let level_idx = 0;
function stateLevelSelect(dt) {
  gl.clearColor(0,0,0,1);
  v3copy(engine.border_clear_color, pico8.colors[0]);
  let W = game_width/2;
  let H = game_height/2;
  camera2d.set(0, 0, W, H);

  let ld = level_list[level_idx];

  let y = 8;
  let pad = 16;
  let button_w = 24;
  let button_h = 16;
  if (ui.buttonText({
    x: pad, y,
    w: button_w, h: button_h,
    disabled: level_idx === 0,
    text: '<<',
  })) {
    --level_idx;
    transition.queue(Z.TRANSITION_FINAL, transition.splitScreen(500, 4, true));
  }

  title_font.draw({
    x: 0, w: W, y, align: ALIGN.HCENTER,
    size: 24,
    style: style_title,
    text: ld.display_name,
  });

  if (ui.buttonText({
    x: W - pad - button_w, y,
    w: button_w, h: button_h,
    disabled: level_idx >= level_list.length - 1,
    text: '>>',
  })) {
    ++level_idx;
    transition.queue(Z.TRANSITION_FINAL, transition.splitScreen(500, 4, true));
  }

  y += 24;
  font.draw({
    color: pico8.font_colors[5],
    x: 0, w: W, y, align: ALIGN.HCENTER,
    text: ld.subtitle,
  });

  y += 18;

  let has_score = score_system.getScore(level_idx);

  button_w = 64;

  let can_resume = game && game.level_idx === level_idx && !game.game_over && !game.won;
  let replay_text = can_resume ? 'Resume Level' :
    has_score ? 'Replay Level' : 'Start Level';

  if (has_score && level_idx < level_list.length - 1) {
    let x = (W - button_w * 2 - pad) / 2;
    if (ui.buttonText({
      x, y,
      w: button_w, h: button_h,
      text: replay_text,
    })) {
      playInit(level_idx, can_resume);
      engine.setState(statePlay);
    }
    x += button_w + pad;
    if (ui.buttonText({
      base_name: 'buttongreen',
      x, y,
      w: button_w, h: button_h,
      text: 'Next Level',
    })) {
      ++level_idx;
      transition.queue(Z.TRANSITION_FINAL, transition.splitScreen(500, 4, true));
    }
  } else {
    if (ui.buttonText({
      x: (W - button_w)/2, y,
      w: button_w, h: button_h,
      text: replay_text,
    })) {
      playInit(level_idx, can_resume);
      engine.setState(statePlay);
    }
  }
  y += button_h + 8;


  pad = 8;
  let x = pad;
  let toggle_y = H - button_h - pad;
  if (ui.buttonImage({
    img: sprite_space,
    shrink: 16/button_h,
    frame: settings.volume_sound ? FRAME_SOUND_ON : FRAME_SOUND_OFF,
    x, y: toggle_y, h: button_h, w: button_h,
  })) {
    settings.set('volume_sound', settings.volume_sound ? 0 : 1);
  }
  x += button_h + pad;
  if (ui.buttonImage({
    img: sprite_space,
    shrink: 16/button_h,
    frame: settings.volume_music ? FRAME_MUSIC_ON : FRAME_MUSIC_OFF,
    x, y: toggle_y, h: button_h, w: button_h,
  })) {
    settings.set('volume_music', settings.volume_music ? 0 : 1);
  }

  pad = 24;
  scoresDraw({
    x: pad, width: W - pad * 2,
    y, height: H - y - pad,
    z: Z.UI,
    size: ui.font_height,
    line_height: ui.font_height+2,
    level_id: ld.name,
    columns: SCORE_COLUMNS,
    scoreToRow: myScoreToRow,
    style_score,
    style_me,
    style_header,
    color_line: pico8.colors[3],
    color_me_background: pico8.colors[1],
  });
}

let title_anim;
let title_alpha = {
  title: 0,
  desc: 0,
  sub: 0,
  button: 0,
};
function stateTitleInit() {
  soundPlayMusic('menu', 0.75, FADE);
  title_anim = createAnimationSequencer();
  let t = title_anim.add(0, 300, (progress) => {
    title_alpha.title = progress;
  });
  t = title_anim.add(t + 200, 1000, (progress) => {
    title_alpha.desc = progress;
  });
  t = title_anim.add(t + 300, 300, (progress) => {
    title_alpha.sub = progress;
  });
  title_anim.add(t + 1000, 300, (progress) => {
    title_alpha.button = progress;
  });
}
function stateTitle(dt) {
  gl.clearColor(0,0,0,1);
  v3copy(engine.border_clear_color, pico8.colors[0]);
  let W = game_width/2;
  let H = game_height/2;
  camera2d.set(0, 0, W, H);
  if (title_anim) {
    if (!title_anim.update(dt)) {
      title_anim = null;
    } else {
      input.eatAllInput();
    }
  }

  let y = 40;

  title_font.draw({
    style: style_title,
    alpha: title_alpha.title,
    x: 0, y, w: W, align: ALIGN.HCENTER,
    size: 30,
    text: 'Spacemine Defense',
  });

  y += 40;
  font.draw({
    color: pico8.font_colors[5],
    alpha: title_alpha.sub,
    x: 0, y, w: W, align: ALIGN.HCENTER,
    text: 'By Jimb Esser in 48 hours for Ludum Dare 51',
  });
  y += ui.font_height + 2;
  font.draw({
    color: pico8.font_colors[5],
    alpha: title_alpha.sub,
    x: 0, y, w: W, align: ALIGN.HCENTER,
    text: 'Heavily inspired by "The Space Game"',
  });

  y += 50;
  font.draw({
    color: pico8.font_colors[6],
    alpha: title_alpha.desc,
    x: W/6,
    w: W - W/6*2,
    y, align: ALIGN.HCENTER | ALIGN.HWRAP,
    text: 'You are tasked with harvesting all resources from the sector as quickly' +
      ' as possible.  Your boss tells you there is no danger and everything will go' +
      ' just fine.',
  });

  if (title_alpha.button) {
    let button_w = 80;
    let button_h = 16;
    let button = {
      color: [1,1,1, title_alpha.button],
      x: (W - button_w) / 2,
      y: H - button_h - 24,
      w: button_w,
      h: button_h,
      text: 'Play',
    };
    if (ui.button(button)) {
      transition.queue(Z.TRANSITION_FINAL, transition.splitScreen(500, 4, true));
      engine.setState(stateLevelSelect);
    }
  }
}

export function main() {
  if (engine.DEBUG) {
    // Enable auto-reload, etc
    net.init({ engine });
  }

  // const font_info_04b03x2 = require('./img/font/04b03_8x2.json');
  const font_info_04b03x1 = require('./img/font/04b03_8x1.json');
  // const font_info_palanquin32 = require('./img/font/palanquin32.json');
  let pixely = 'strict';
  let ui_sprites;
  if (pixely === 'strict') {
    font = { info: font_info_04b03x1, texture: 'font/04b03_8x1' };
    ui_sprites = spriteSetGet('pixely');
  } else if (pixely && pixely !== 'off') {
    // font = { info: font_info_04b03x2, texture: 'font/04b03_8x2' };
    ui_sprites = spriteSetGet('pixely');
  } else {
    // font = { info: font_info_palanquin32, texture: 'font/palanquin32' };
  }
  const font_info_vga = require('./img/font/vga_16x2.json');
  title_font = { info: font_info_vga, texture: 'font/vga_16x2' };

  if (!engine.startup({
    game_width,
    game_height,
    pixely,
    font,
    title_font,
    viewport_postprocess: false,
    antialias: false,
    ui_sprites: defaults({
      panel: { name: 'pixely/panel', ws: [3, 6, 3], hs: [3, 6, 3] },
    }, ui_sprites),
    ui_sounds: {
      place: 'place',
      die_enemy: 'explode_small',
      die_fighter: 'explode_small2',
      die_structure: ['explode_big', 'explode_big2', 'explode_big3'],
      speed_fast: 'speed_fast',
      speed_slow: 'speed_slow',
      laser: ['laser1', 'laser2', 'laser3', 'laser4', 'laser5'],
      build3: 'build3',
      build4: 'build4',
      build5: 'build5',
      alert1: 'alert1',
      alert2: 'alert2',
    },
  })) {
    return;
  }
  ({ font, title_font } = ui);

  preloadParticleData(particle_data.defs);

  //title_font2 = fontCreate(require('./img/font/vga_16x1.json'), 'font/vga_16x1');

  ui.scaleSizes(13 / 32);
  ui.setFontHeight(8);

  init();

  const ENCODE = 100000;
  function encodeScore(score) {
    let progress = clamp(round(score.progress * 10000), 0, 10000);
    if (progress === 10000 && score.progress !== 1) {
      progress = 9999;
    }
    let time = ENCODE - 1 - min(score.seconds, ENCODE);
    return progress * ENCODE + time;
  }

  function parseScore(value) {
    let progress = floor(value / ENCODE);
    value -= progress * ENCODE;
    progress /= 10000;
    let seconds = ENCODE - 1 - value;
    return {
      seconds,
      progress,
    };
  }
  score_system.init(encodeScore, parseScore, level_list, 'LD51');
  score_system.updateHighScores();

  stateTitleInit();
  engine.setState(stateTitle);
  if (engine.DEBUG) {
    playInit(1, false);
    engine.setState(statePlay);
    //levelSelectInit();
  }
}
