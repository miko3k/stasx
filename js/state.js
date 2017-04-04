"use strict";

var Tag = require('./file.js').Tag
var PasswordEntry = require('./file.js').PasswordEntry
var File = require('./file.js').File
var util = require('./util.js')
var enc = require('./encryption')
var log = require('./log')

function normalizeMeta(data) {
    var result = {}

    if(typeof data === 'string') {
        result.name = util.addSuffix(data);
    } else {
        result.name = util.addSuffix(data.name);
        if(data.google_id)
            result.google_id = data.google_id;
    }

    return result;
}

function State(f, meta, masterPassword) {
    this._file = f;
    this._selectedTags = new Set();
    this._masterPassword = masterPassword;
    this._meta = normalizeMeta(meta);
}

State.prototype.getMasterPassword = function()
{
    return this._masterPassword;
}

State.prototype.setMasterPassword = function(p) {
    this._masterPassword = p;
}

State.prototype.getFileName = function() {
    return this._meta.name
}

State.prototype.setFileName = function(n) {
    this._meta.name = util.addSuffix(n)
}

State.prototype.setGoogleId = function(id) {
    this._meta.google_id = id
}

State.prototype.getGoogleId = function() {
    return this._meta.google_id
}

State.prototype.isTagSelected = function(tag) {
    return this._selectedTags.has(tag);
}

State.prototype.forEachTag = function(callback) {
    var keys = this._file.getTags()
    var f = this._file;

    keys.sort(function(a,b) {
        return util.strcmp(f.getTag(a).getName(), f.getTag(b).getName());
    });

    keys.forEach(function(id) {
        callback(id, f.getTag(id));
    });
}

State.prototype.getEachTag = function(creator)
{
    var result = [];
    this.forEachTag(function(id, tag) {
        result.push((creator) ? creator(id, tag) : { id: id, value: tag });
    });
    return result;
}

State.prototype.forEachVisibleEntry = function(callback) {
    var keys = this._file.getEntries()
    var f = this._file;

    keys.sort(function(a,b) {
        return util.strcmp(f.getEntry(a).getName(), f.getEntry(b).getName());
    });

    // XXX: this conversion to array is useless, I don't
    // feel like refactoring loop below at 0:45 am
    var selected = []
    this._selectedTags.forEach(function(s) {
        selected.push(s)
    })

    keys.forEach(function(id) {
        var use = true
        var entry = f.getEntry(id);

        if(selected.length > 0) {
            for(var i=0;i<selected.length;++i) {
                if(!entry.hasTag(selected[i])) {
                    use = false
                    break
                }
            }
        }

        if(use) {
            callback(id, entry);
        }
    });
}

State.prototype.getEachVisibleEntry = function(creator)
{
    var result = [];
    this.forEachVisibleEntry(function(id, value) {
        result.push((creator) ? creator(id, value) : { id: id, value: value });
    });
    return result;
}

State.prototype.toggleTag = function(tag) {
    if(this._selectedTags.has(tag)) {
        this._selectedTags.delete(tag)
    } else {
        this._selectedTags.add(tag)
    }

    var something = false;

    this.forEachVisibleEntry(function() {
        something = true;
    });
    // nothing would be visible, let's selected everything besides requested
    if(!something) {
        this._selectedTags.clear();
        this._selectedTags.add(tag);
    }
}

State.prototype.isTagSelected = function(tag) {
    return this._selectedTags.has(tag);
}

State.prototype.getOnlySelectedTag = function() {
    if(this._selectedTags.size != 1) {
        return undefined;
    } else {
        // get any item: cannot find anything smaller than forEach
        var result
        this._selectedTags.forEach(function(x) { result = x; })
        return result
    }
}

State.prototype.getTag = function(tag) {
    return this._file.getTag(tag);
}

State.prototype.getEntry = function(id) {
    return this._file.getEntry(id);
}

State.prototype.deleteEntry = function(id) {
    this._file.deleteEntry(id);
}

State.prototype.deleteTag = function(id) {
    this._file.deleteTag(id)
    this._selectedTags.delete(id)
}

State.prototype.hasEveryTag = function(entry) {
    var res = true

    this._file.getTags().forEach(function(tag) {
        if(!entry.hasTag(tag)) {
            res = false
        }
    })
    return res
}

function uniq(used) {

    var chars = "abcdefghijklmnopqrstuvwxyz";

    function gen(cur, depth) {
        if(depth <= 0) {
            if(used.indexOf(cur) >= 0) {
                return undefined;
            } else {
                return cur;
            }
        } else {
            for(var i=0;i<chars.length;++i) {
                var g = gen(cur + chars[i], depth-1);
                if(g !== undefined)
                    return g;
            }
            return undefined;
        }
    }

    var res = gen("tag_", 8);
    if(res === undefined)
        throw "unable to generate unique ID";

    return res;
}

State.prototype.createTag = function(name) {
    var id = uniq(this._file.getTags());
    this._file.setTag(id, new Tag(name));
}

State.prototype.createEntry = function(name) {
    var id = uniq(this._file.getEntries());

    var e = new PasswordEntry();
    e.setName(name);

    this._selectedTags.forEach(function(tag) {
        e.addTag(tag);
    });
    this._file.setEntry(id, e);
}

State.prototype.serialize = function() {
    var tags = {};
    var entries = {};

    this._file.getTags().forEach(function(id) {
        var tag = this._file.getTag(id);
        var current = {
            "name": tag.getName()
        };
        tags[id] = current;
    }, this);

    this._file.getEntries().forEach(function(id) {
        var entry = this._file.getEntry(id);
        var current = {}
        if(entry.getName()) current['name'] = entry.getName()
        if(entry.getUser()) current['user'] = entry.getUser()
        if(entry.getPassword()) current['password'] = entry.getPassword()
        if(entry.getRemarks()) current['remarks'] = entry.getRemarks()
        if(entry.hasAnyTag()) {
            var tags = []
            entry.forEachTag(function(tag) {
                tags.push(tag)
            })
            current['tags'] = tags
        }
        entries[id] = current;
    }, this);

    var resobject = {
        "tags": tags,
        "entries": entries
    };
    return JSON.stringify(resobject);
}


function createFile(src) {
    var result = new File();

    if(src.tags) {
        Object.keys(src.tags).forEach(function(id) {
            var val = src.tags[id];
            result.setTag(id, new Tag(val.name));
        });
    }
    if(src.entries) {
        Object.keys(src.entries).forEach(function(id) {
            var val = src.entries[id];
            var e = new PasswordEntry();
            if(val.name)
                e.setName(val.name);
            if(val.user)
                e.setUser(val.user);
            if(val.password)
                e.setPassword(val.password);
            if(val.tags) {
                val.tags.forEach(function(x) {
                    e.addTag(x);
                });
            }
            if(val.remarks) {
                e.setRemarks(val.remarks);
            }
            result.setEntry(id, e);
        });

    }

    return result;
}

function parseState(text, meta, password) {
    text = util.stripBom(text)

    try {
        var data = JSON.parse(text);
    } catch(e) {
        log("json parsing failed", text, e)
        return false;
    }
    return new State(createFile(data), meta, password)
}



function loadFile(decrypt, data, m, password) {
    var result = new Promise(function(resolve, reject) {
        var st = parseState(data, m, password)
        if(st)
            return resolve(st);

        decrypt(data, password || '').then(function(plain) {
            var st = parseState(plain, m, password)
            if(st) {
                return resolve(st);
            } else {
                return reject(enc.code.BAD_FORMAT)
            }
        }).catch(function(errcode) {
            return reject(errcode)
        });
    });

    return result
}

exports.State = State
exports.loadFile = loadFile

exports.emptyFile = function(name, password) {
    return new State(new File(), name, password);
}
