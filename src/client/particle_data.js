export let defs = {};

const { colors } = require('glov/client/pico8.js');

defs.explosion = {
  particles: {
    part0: {
      blend: 'alpha',
      texture: 'particles/circle64',
      color: [1,1,1,1], // multiplied by animation track, default 1,1,1,1, can be omitted
      color_track: [
        // just values, NOT random range
        { t: 0.0, v: [1,1,1,0] },
        { t: 0.2, v: [1,1,1,1] },
        { t: 0.4, v: [1,1,0.5,0.5] },
        { t: 1.0, v: [1,0,0,0] },
      ],
      size: [[8,2], [8,2]], // multiplied by animation track
      size_track: [
        // just values, NOT random range
        { t: 0.0, v: [1,1] },
        { t: 0.2, v: [2,2] },
        { t: 0.4, v: [1,1] },
        { t: 1.0, v: [1.5,1.5] },
      ],
      accel: [0,0,0],
      rot: [0,360], // degrees
      rot_vel: [10,2], // degrees per second
      lifespan: [1000,0], // milliseconds
      kill_time_accel: 5,
    },
  },
  emitters: {
    part0: {
      particle: 'part0',
      // Random ranges affect each emitted particle:
      pos: [[-4,8], [-4,8], 0],
      vel: [0,0,0],
      emit_rate: [100,0], // emissions per second
      // Random ranges only calculated upon instantiation:
      emit_time: [0, 150],
      emit_initial: 3,
      max_parts: Infinity,
    },
  },
  system_lifespan: 2500,
};

defs.explosion_small = {
  particles: {
    part0: {
      blend: 'alpha',
      texture: 'particles/circle64',
      color: [1,1,1,1], // multiplied by animation track, default 1,1,1,1, can be omitted
      color_track: [
        // just values, NOT random range
        { t: 0.0, v: [1,1,1,0] },
        { t: 0.2, v: [1,1,1,1] },
        { t: 0.4, v: [1,1,0.5,0.5] },
        { t: 1.0, v: [1,0,0,0] },
      ],
      size: [[4,1], [4,1]], // multiplied by animation track
      size_track: [
        // just values, NOT random range
        { t: 0.0, v: [1,1] },
        { t: 0.2, v: [2,2] },
        { t: 0.4, v: [1,1] },
        { t: 1.0, v: [1.5,1.5] },
      ],
      accel: [0,0,0],
      rot: [0,360], // degrees
      rot_vel: [10,2], // degrees per second
      lifespan: [1000,0], // milliseconds
      kill_time_accel: 5,
    },
  },
  emitters: {
    part0: {
      particle: 'part0',
      // Random ranges affect each emitted particle:
      pos: [[-3,6], [-3,6], 0],
      vel: [0,0,0],
      emit_rate: [100,0], // emissions per second
      // Random ranges only calculated upon instantiation:
      emit_time: [0, 100],
      emit_initial: 2,
      max_parts: Infinity,
    },
  },
  system_lifespan: 2500,
};

defs.build = {
  particles: {
    part0: {
      blend: 'alpha',
      texture: 'particles/circle64',
      color: colors[4], // multiplied by animation track, default 1,1,1,1, can be omitted
      color_track: [
        // just values, NOT random range
        { t: 0.0, v: [1,1,1,0] },
        { t: 0.2, v: [1,1,1,0.5] },
        { t: 0.4, v: [1,1,1,0.25] },
        { t: 1.0, v: [1,1,1,0] },
      ],
      size: [[5,2], [5,2]], // multiplied by animation track
      size_track: [
        // just values, NOT random range
        { t: 0.0, v: [1,1] },
        { t: 0.2, v: [2,2] },
        { t: 0.4, v: [1,1] },
        { t: 1.0, v: [1.5,1.5] },
      ],
      accel: [0,0,0],
      rot: [0,360], // degrees
      rot_vel: [10,2], // degrees per second
      lifespan: [1000,0], // milliseconds
      kill_time_accel: 5,
    },
  },
  emitters: {
    part0: {
      particle: 'part0',
      // Random ranges affect each emitted particle:
      pos: [[-3,6], [-3,6], 0],
      vel: [0,0,0],
      emit_rate: [100,0], // emissions per second
      // Random ranges only calculated upon instantiation:
      emit_time: [0, 100],
      emit_initial: 2,
      max_parts: Infinity,
    },
  },
  system_lifespan: 2500,
};

defs.build_finish = {
  particles: {
    part0: {
      blend: 'alpha',
      texture: 'particles/circle64',
      color: colors[9], // multiplied by animation track, default 1,1,1,1, can be omitted
      color_track: [
        // just values, NOT random range
        { t: 0.0, v: [1,1,1,0] },
        { t: 0.2, v: [1,1,1,0.5] },
        { t: 0.4, v: [1,1,1,0.25] },
        { t: 1.0, v: [1,1,1,0] },
      ],
      size: [[8,2], [8,2]], // multiplied by animation track
      size_track: [
        // just values, NOT random range
        { t: 0.0, v: [1,1] },
        { t: 0.2, v: [2,2] },
        { t: 0.4, v: [1,1] },
        { t: 1.0, v: [1.5,1.5] },
      ],
      accel: [0,0,0],
      rot: [0,360], // degrees
      rot_vel: [10,2], // degrees per second
      lifespan: [1000,0], // milliseconds
      kill_time_accel: 5,
    },
  },
  emitters: {
    part0: {
      particle: 'part0',
      // Random ranges affect each emitted particle:
      pos: [[-1,2], [-1,2], 0],
      vel: [0,0,0],
      emit_rate: [100,0], // emissions per second
      // Random ranges only calculated upon instantiation:
      emit_time: [0, 100],
      emit_initial: 2,
      max_parts: Infinity,
    },
  },
  system_lifespan: 2500,
};

defs.explosion_enemy = {
  particles: {
    part0: {
      blend: 'alpha',
      texture: 'particles/circle64',
      color: colors[14], // multiplied by animation track, default 1,1,1,1, can be omitted
      color_track: [
        // just values, NOT random range
        { t: 0.0, v: [1,1,1,0] },
        { t: 0.2, v: [1,1,1,1] },
        { t: 0.4, v: [1,1,0.5,0.5] },
        { t: 1.0, v: [1,0,0,0] },
      ],
      size: [[4,1], [4,1]], // multiplied by animation track
      size_track: [
        // just values, NOT random range
        { t: 0.0, v: [1,1] },
        { t: 0.2, v: [2,2] },
        { t: 0.4, v: [1,1] },
        { t: 1.0, v: [1.5,1.5] },
      ],
      accel: [0,0,0],
      rot: [0,360], // degrees
      rot_vel: [10,2], // degrees per second
      lifespan: [1000,0], // milliseconds
      kill_time_accel: 5,
    },
  },
  emitters: {
    part0: {
      particle: 'part0',
      // Random ranges affect each emitted particle:
      pos: [[-3,6], [-3,6], 0],
      vel: [0,0,0],
      emit_rate: [100,0], // emissions per second
      // Random ranges only calculated upon instantiation:
      emit_time: [0, 100],
      emit_initial: 2,
      max_parts: Infinity,
    },
  },
  system_lifespan: 2500,
};
