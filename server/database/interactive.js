r = require("repl").start("ThingDB> ");
r.context.Thing = require('./');
r.context.Promise_serial = require('promise-serial');
