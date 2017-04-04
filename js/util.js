'use strict';
/**
 * functions
 */
module.exports.arrayDiff = function(a, b) {
    return a.filter(function(element) {return b.indexOf(element) < 0;});
}

module.exports.arrayEq = function(a, b) {
    return a.length == b.length &&
             a.every( function(this_i,i) { return this_i == b[i] } )
}

// is there a standard way to do this?
module.exports.strcmp = function(a, b) {
    if(a > b) return 1;
    if(a < b) return -1;
    return 0;
}

module.exports.masked = function(s) {
    return "\u25CF".repeat(s.length);
}

module.exports.removeSuffix = function(name) {
    return name.replace(/\.stasx$/, '')
}

module.exports.addSuffix = function(name) {
    if(!name.match(/\.stasx$/))
        name += ".stasx"

    return name;
}

module.exports.stripBom = function(x) {
    if(x.charCodeAt(0) === 0xFEFF) {
    	return x.slice(1);
    } else {
        return x;
    }
}
