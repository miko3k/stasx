"use strict";
/**
 * This file defines classes Tag, PasswordEntry and File
 */

// Tag
function Tag(name) {
    this._name = name;
}

Tag.prototype.getName = function() {
    return this._name;
}

Tag.prototype.setName = function(a) {
    this._name = a;
    return this;
}

// PasswordEntry
function PasswordEntry() {
    this._name = '';
    this._user = '';
    this._password = '';
    this._tags = new Set();
    this._remarks = '';
}

PasswordEntry.prototype.getName = function() {
    return this._name;
}

PasswordEntry.prototype.getUser = function() {
    return this._user;
}

PasswordEntry.prototype.getPassword = function() {
    return this._password;
}

PasswordEntry.prototype.forEachTag = function(what) {
    return this._tags.forEach(what);
}

PasswordEntry.prototype.hasTag = function(which) {
    return this._tags.has(which)
}

PasswordEntry.prototype.hasAnyTag = function() {
    return this._tags.size > 0
}

PasswordEntry.prototype.addTag = function(which) {
    this._tags.add(which)
    return this;
}

PasswordEntry.prototype.removeTag = function(which) {
    this._tags.delete(which)
    return this;
}

PasswordEntry.prototype.getRemarks = function() {
    return this._remarks;
}

PasswordEntry.prototype.setName = function(x) {
    this._name = x;
    return this;
}

PasswordEntry.prototype.setUser = function(x) {
    this._user = x;
    return this;
}

PasswordEntry.prototype.setPassword = function(x) {
    this._password = x;
    return this;
}

PasswordEntry.prototype.setRemarks = function(x) {
    this._remarks = x;
    return this;
}

PasswordEntry.prototype.eq = function(other) {
    // we use getters,
//    return
//        this.getName() === other.getName();


}

// File
function File() {
    this._tags = {}
    this._entries = {}
}

File.getTestFile = function() {
    var f = new File();

    return f;
}

File.prototype.getTag = function(id) {
    if(this._tags[id] === undefined) {
        throw "No such tag: " + id;
    }

    return this._tags[id];
}

File.prototype.deleteTag = function(id) {
    if(this._tags[id] === undefined) {
        throw "No such tag: " + id;
    }

    Object.keys(this._entries).forEach(function(e) {
        this._entries[e].removeTag(id);
    }, this);

    delete this._tags[id];
}

File.prototype.getTags = function() {
    // this returns a new array
    // https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Object/keys
    return Object.keys(this._tags);
}

File.prototype.getEntries = function() {
    // returns a new array, same as getTags
    return Object.keys(this._entries);
}

File.prototype.hasTag = function(id) {
    return this._tags[id] !== undefined;
}

File.prototype.setTag = function(id, tag) {
    this._tags[id] = tag;
}

File.prototype.getEntry = function(id) {
    if(this._entries[id] === undefined) {
        throw "No such entry: " + id;
    }

    return this._entries[id];
}

File.prototype.deleteEntry = function(id) {
    if(this._entries[id] === undefined) {
        throw "No such entry: " + id;
    }
    delete this._entries[id];
}

File.prototype.setEntry = function(id, tag) {
    this._entries[id] = tag;
}

File.prototype.hasEntry = function(id) {
    return this._entries[id] !== undefined;
}

File.createExampleFile = function() {
    var f = new File();

    f.setTag("tag1", new Tag("Tag one"));
    f.setTag("tag2", new Tag("Tag TWO"));

    var e1 = new PasswordEntry();
    e1.setName("site1").setUser("first site user").setPassword("1st password").addTag("tag1");

    var e2 = new PasswordEntry();
    e2.setName("site2").setUser("second site user").setPassword("2nd password").addTag("tag2");

    var e3 = new PasswordEntry();
    e3.setName("site3").setRemarks("no tags site, without password and user");

    f.setEntry("id1", e1);
    f.setEntry("id2", e2);
    f.setEntry("id3", e3);

    return f;
}

exports.Tag = Tag
exports.File = File
exports.PasswordEntry = PasswordEntry
