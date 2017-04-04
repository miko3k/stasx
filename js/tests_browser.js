"use strict";

var tape = require('tape');
var encryption = require('./encryption.js');
var other_tests = require('./tests_node.js');

var random = function(target) {
        for(var i = 0; i < target.length; ++i) {
            target[i] = i
         }
    }
var subtle = window.crypto.subtle

var enc = encryption.createEncrpytor(subtle, random)

var enc1 = ''+
'eyJwMnMiOiJBQUVDQXdRRkJnY0lDUW9MREEwT0R3IiwicDJjIjoxMDAwLCJlbmMiOi'+
'JBMTI4Q0JDLUhTMjU2IiwiYWxnIjoiUEJFUzItSFMyNTYrQTEyOEtXIn0.L4A_u3o4'+
'Wb5M8Q-z_KeEvrhWEkJrLDaU315BrpE2Xua53Op1CzTb9Q.AAECAwQFBgcICQoLDA0'+
'ODw._HFX7OBoPK5u4uguMQ-LxQ.rqYOzGD2yTeD0BuCZHil2g';

var enc2 = ''+
'eyJwMnMiOiJaclVXMU5tYjc5Q2dmRWFTNnI3UEJRIiwicDJjIjoxMDAwLCJlbmMiOi'+
'JBMTI4Q0JDLUhTMjU2IiwiYWxnIjoiUEJFUzItSFMyNTYrQTEyOEtXIn0.ZPfsojr8'+
'90FvNdu7BEaCdS8ttH0_jNHuX3WkmvrXr7G0KoRBbxUpOw.c3lWHDN2S0HAMFZHob1'+
'rxQ.mMesuWEXhCl044rIbmAdQA.b7KQvir7crMq6Wd_ElMVaw';

tape.test('jose-password', function(assert) {
    assert.plan(3)
    enc.encrypt('Hello world!', 'asdfghjkl', 16, 1000).then(function(b) {
        assert.equal(enc1, b);
    }).catch(function(e) {
        assert.fail(e);
    });

    enc.decrypt(enc1, 'asdfghjkl').then(function(b) {
        assert.equal(b, 'Hello world!');
    }).catch(function(e) {
        assert.fail(e);
    });

    enc.decrypt(enc2, 'asdfghjkl').then(function(b) {
        assert.equal(b, 'Hello world!');
    }).catch(function(e) {
        assert.fail(e);
    });
});

