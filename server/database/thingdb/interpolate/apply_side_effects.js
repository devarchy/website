const assert = require('assert');
const Promise = require('bluebird'); Promise.longStackTraces();


module.exports = apply_side_effects;


function apply_side_effects(thing) {
    const side_effect_promises =
        ((thing.schema._options||{}).side_effects||[])
        .map(side_effect => side_effect(thing))
        .filter(side_effect => side_effect!==null);
    assert(side_effect_promises.every(side_effect => (side_effect||0).constructor === Function));
    return Promise.all(side_effect_promises.map(side_effect => side_effect()));
}
