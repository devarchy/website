r = require("repl").start("Thing> ");
r.context.Thing = require('./');
r.context.Promise_serial = require('promise-serial');
