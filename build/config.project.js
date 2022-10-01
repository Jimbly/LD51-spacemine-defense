const spritesheet = require('./spritesheet.js');

function copy(job, done) {
  job.out(job.getFile());
  done();
}

module.exports = function (config) {
  config.client_register_cbs.push((gb) => {

    let client_spritesheets = [];
    ['space'].forEach((name) => {
      gb.task({
        name: `client_sprites_${name}`,
        input: `textures/spritesheets/${name}/*.png`,
        ...spritesheet({
          name: name,
        }),
      });
      config.client_js_files.push(`client_sprites_${name}:**/*.js`);
      client_spritesheets.push(`client_sprites_${name}:**/*.png`);
    });

    gb.task({
      type: gb.SINGLE,
      name: 'client_spritesheets',
      input: client_spritesheets,
      target: 'dev',
      func: copy,
    });
    config.extra_client_tasks.push('client_spritesheets');
  });

};
