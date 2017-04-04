"use strict";

var tape = require('tape');
var State = require('./state.js').State
var Tag = require('./file.js').Tag
var PasswordEntry = require('./file.js').PasswordEntry
var File = require('./file.js').File
var util = require('./util.js')


// File
tape.test('File', function (assert) {
    assert.equal(new PasswordEntry().setName("X").getName(), "X");
    assert.equal(new PasswordEntry().setPassword("X").getPassword(), "X");
    assert.equal(new PasswordEntry().setRemarks("X").getRemarks(), "X");
    assert.equal(new PasswordEntry().setUser("X").getUser(), "X");

    assert.equal(new PasswordEntry().getName(), "");
    assert.equal(new PasswordEntry().getPassword(), "");
    assert.equal(new PasswordEntry().getRemarks(), "");
    assert.equal(new PasswordEntry().getUser(), "");

    assert.deepEqual(File.createExampleFile().getTags().sort(), [ "tag1", "tag2" ]);
    assert.deepEqual(File.createExampleFile().getEntries().sort(), [ "id1", "id2", "id3" ]);

    assert.equal(new Tag("x").getName(), "x");

    assert.equal(File.createExampleFile().getTag("tag1").getName(), "Tag one");
    assert.end()
})

tape.test('util', function (assert) {
    assert.deepEqual(util.arrayDiff([1,2,3],[3, 4]), [1,2]);
    assert.ok(util.strcmp("a", "b") < 0);
    assert.ok(util.strcmp("b", "a") > 0);
    assert.ok(util.strcmp("a", "a") === 0);
    assert.ok(util.arrayEq([1,2], [1,2]));
    assert.notOk(util.arrayEq([1,2], [1,2,3]));
    assert.notOk(util.arrayEq([], [1,2,3]));
    assert.ok(util.arrayEq([], []));
    assert.end()
});

tape.test('state.forEachTag', function (assert) {
    var s = new State(File.createExampleFile());
    assert.plan(2);
    s.forEachTag(function(k, v) {
        assert.ok(true);
    });
});

tape.test('state.forEachEntry', function (assert) {
    var s = new State(File.createExampleFile());
    assert.plan(3);
    s.forEachVisibleEntry(function(k, v) {
        assert.ok(true);
    });
});
