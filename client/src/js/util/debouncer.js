const assert_soft = require('assertion-soft');

module.exports = debouncer;

function debouncer(fct, {time}) {
    assert_soft(time>=0);

    let timeout = null;

    return fct__debounced;

    function fct__debounced() {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            timeout = null;
            fct.apply(this, arguments);
        }, time);
    }
}
