'use strict';

const inline = require('./inline');

module.exports = function info(ctx) {
  return new Promise(async (resolve, reject) => {
    resolve(render(Object.assign({}, ctx.state)));
  });
};

function render(data) {
  return `
<button></button>
<div id="mocha"></div>
<script>
mocha.setup("bdd");
// mocha.bail(true);
mocha.timeout(4000);
(function () {
  ${data.content}
})()
${inline('lib/runner.js')}
</script>
`;
}
