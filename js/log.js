"use strict";
var isNode = require('detect-node');
var debug = typeof DEBUG !== 'undefined' && DEBUG;
var enabled = isNode || debug

function log() {
    if(enabled && console){
        console.log.apply(console, arguments);
    }
}

log.enabled = enabled

exports.enabled = enabled

module.exports = log
