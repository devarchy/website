"use strict";

const debug = module.exports = {
    buffer: {
        size: 100,
        flush,
        clear,
    },
    log,
};

debug._logs = [];

function flush() {
    console.log('\n');
    debug._logs.forEach(log => {
        console.log('['+log.time.toLocaleTimeString()+'] Debug Info');
        //console.log.apply(console, log.messages);
        console.log([].slice.call(log.messages).join('\n'));
        console.log('\n');
    });
    clear();
}

function clear() {
    debug._logs = [];
}

function log() {
    debug._logs.push({
        time: new Date(),
        messages: arguments,
    });

    debug._logs = debug._logs.slice(-debug.buffer.size);
}
